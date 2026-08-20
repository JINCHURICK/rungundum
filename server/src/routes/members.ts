import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { prisma } from '../lib/prisma'
import { authenticate, requirePermission, AuthRequest } from '../middleware/auth'
import { uploadToCloudinary } from '../services/cloudinary'
import { sendAccountInvite, sendWelcomeEmail } from '../services/email'
import multer from 'multer'
import bcrypt from 'bcryptjs'
import { checkPlanLimit } from '../middleware/planLimit'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

router.use(authenticate)

const memberSchema = z.object({
  fullName: z.string().min(2),
  nickname: z.string().optional(),
  phone: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'GUEST']).optional(),
  memberNumber: z.string().optional(),
  address: z.string().optional(),
  birthDate: z.string().optional(),
  biNumber: z.string().optional(),
  bloodType: z.string().optional(),
  licenseNumber: z.string().optional(),
  licenseExpiresAt: z.string().optional(),
  notes: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'TREASURER', 'SECRETARY', 'PR', 'DISCIPLINA', 'CAPTAIN', 'MEMBER', 'GUEST']).optional(),
})

const MEMBER_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'GUEST'] as const
type MemberStatus = typeof MEMBER_STATUS_VALUES[number]

// GET /api/members
// Paginação opcional: ?page=1&limit=50 (sem estes params retorna tudo — backward compat)
router.get('/', async (req: AuthRequest, res: Response) => {
  const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined
  const status: MemberStatus | undefined = MEMBER_STATUS_VALUES.includes(rawStatus as any) ? rawStatus as MemberStatus : undefined
  const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : undefined
  const pageRaw  = typeof req.query.page  === 'string' ? parseInt(req.query.page,  10) : undefined
  const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined
  const paginate = pageRaw !== undefined && limitRaw !== undefined && !isNaN(pageRaw) && !isNaN(limitRaw)
  const page  = paginate ? Math.max(1, pageRaw!)  : undefined
  const limit = paginate ? Math.min(200, Math.max(1, limitRaw!)) : undefined

  const where = {
    clubId: req.user!.clubId,
    ...(status ? { status } : {}),
    ...(search ? {
      OR: [
        { fullName: { contains: search } },
        { nickname: { contains: search } },
      ],
    } : {}),
  }

  const [members, total] = paginate
    ? await Promise.all([
        prisma.member.findMany({ where, include: { vehicles: true, user: { select: { id: true, email: true, role: true } } }, orderBy: { fullName: 'asc' }, skip: (page! - 1) * limit!, take: limit }),
        prisma.member.count({ where }),
      ])
    : [await prisma.member.findMany({ where, include: { vehicles: true, user: { select: { id: true, email: true, role: true } } }, orderBy: { fullName: 'asc' } }), undefined]

  if (paginate) {
    return res.json({ data: members, total, page, limit, pages: Math.ceil(total! / limit!) })
  }
  return res.json(members)
})

// GET /api/members/export.csv — must be before /:id
router.get('/export.csv', requirePermission('MEMBERS_WRITE'), async (req: AuthRequest, res: Response) => {
  const members = await prisma.member.findMany({
    where: { clubId: req.user!.clubId },
    include: { user: { select: { email: true } }, vehicles: { select: { brand: true, model: true, plate: true } } },
    orderBy: { fullName: 'asc' },
  })

  const escape = (v: any) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }

  const header = ['Número', 'Nome', 'Alcunha', 'Email', 'Telefone', 'Emergência', 'Tel. Emergência', 'Estado', 'Membro desde', 'Motos']
  const rows = members.map((m) => [
    escape(m.memberNumber),
    escape(m.fullName),
    escape(m.nickname),
    escape(m.user?.email),
    escape(m.phone),
    escape(m.emergencyContact),
    escape((m as any).emergencyPhone),
    escape(m.status),
    escape(m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('pt-AO') : ''),
    escape(m.vehicles.map((v) => `${v.brand} ${v.model}${v.plate ? ` (${v.plate})` : ''}`).join('; ')),
  ])

  const csv = [header, ...rows].map((r) => r.join(',')).join('\r\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="membros.csv"')
  return res.send('﻿' + csv)
})

// GET /api/members/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const member = await prisma.member.findFirst({
    where: { id: req.params.id, clubId: req.user!.clubId },
    include: {
      vehicles: true,
      user: { select: { id: true, email: true, role: true } },
      participations: {
        include: {
          raid: { select: { id: true, title: true, date: true, status: true } },
          checklistItems: { select: { id: true, checked: true } },
        },
        orderBy: { raid: { date: 'desc' } },
      },
    },
  })
  if (!member) return res.status(404).json({ error: 'Membro não encontrado' })
  return res.json(member)
})

// POST /api/members
router.post('/', requirePermission('MEMBERS_WRITE'), async (req: AuthRequest, res: Response) => {
  try {
    const data = memberSchema.parse(req.body)

    // validar limite do plano (novo membro seria ACTIVE por omissão)
    const newStatus = data.status ?? 'ACTIVE'
    if (newStatus === 'ACTIVE') {
      const limitErr = await checkPlanLimit(req.user!.clubId)
      if (limitErr) return res.status(402).json(limitErr)
    }

    const { email, password, role, birthDate, licenseExpiresAt, ...memberData } = data

    let verificationToken: string | undefined
    const result = await prisma.$transaction(async (tx) => {
      let userId: string | undefined

      if (email && password) {
        const existing = await tx.user.findUnique({ where: { email } })
        if (existing) throw new Error('Email já registado')
        const passwordHash = await bcrypt.hash(password, 12)
        verificationToken = randomBytes(32).toString('hex')
        const user = await tx.user.create({
          data: {
            clubId: req.user!.clubId,
            email,
            passwordHash,
            role: role ?? 'MEMBER',
            verificationToken,
            verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        })
        userId = user.id
      }

      const member = await tx.member.create({
        data: {
          ...memberData,
          clubId: req.user!.clubId,
          userId,
          birthDate: birthDate ? new Date(birthDate) : undefined,
          licenseExpiresAt: licenseExpiresAt ? new Date(licenseExpiresAt) : undefined,
        },
        include: { vehicles: true, user: { select: { id: true, email: true, role: true } } },
      })
      return member
    })

    // Enviar email de boas-vindas + link de verificação se foi criada conta
    if (email && password && verificationToken) {
      const club = await prisma.club.findUnique({ where: { id: req.user!.clubId }, select: { name: true } })
      const clientUrl = process.env.CLIENT_URL ?? 'https://rungundum.com'
      sendWelcomeEmail({
        to: email,
        memberName: memberData.fullName,
        clubName: club?.name ?? 'Rungundum',
        password,
        verifyUrl: `${clientUrl}/verify-email/${verificationToken}`,
      }).catch((err) => console.error('[members] Erro ao enviar email de boas-vindas:', err))
    }

    return res.status(201).json(result)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    if (err instanceof Error && err.message === 'Email já registado') {
      return res.status(409).json({ error: 'Email já registado' })
    }
    throw err
  }
})

// PATCH /api/members/me — must be before /:id
router.patch('/me', async (req: AuthRequest, res: Response) => {
  const member = await prisma.member.findFirst({ where: { userId: req.user!.userId } })
  if (!member) return res.status(404).json({ error: 'Perfil não encontrado' })

  const schema = z.object({
    nickname: z.string().optional(),
    phone: z.string().optional(),
    emergencyContact: z.string().optional(),
    emergencyPhone: z.string().optional(),
  })
  const data = schema.parse(req.body)

  const updated = await prisma.member.update({
    where: { id: member.id },
    data,
    include: { vehicles: true, user: { select: { id: true, email: true, role: true } } },
  })
  return res.json(updated)
})

// PATCH /api/members/:id
router.patch('/:id', requirePermission('MEMBERS_WRITE'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.member.findFirst({
      where: { id: req.params.id, clubId: req.user!.clubId },
      include: { user: true },
    })
    if (!existing) return res.status(404).json({ error: 'Membro não encontrado' })

    const data = memberSchema.partial().parse(req.body)
    const { email, password, role, birthDate, licenseExpiresAt, ...memberData } = data

    // se está a reactivar um membro (a pôr ACTIVE), verificar limite do plano
    if (data.status === 'ACTIVE' && existing.status !== 'ACTIVE') {
      const limitErr = await checkPlanLimit(req.user!.clubId)
      if (limitErr) return res.status(402).json(limitErr)
    }

    const member = await prisma.$transaction(async (tx) => {
      // Actualizar papel do utilizador associado
      if (role && existing.user) {
        // Incrementar tokenVersion invalida imediatamente todos os access tokens activos com o role antigo
        await tx.user.update({ where: { id: existing.user.id }, data: { role, tokenVersion: { increment: 1 } } })
      }

      return tx.member.update({
        where: { id: req.params.id },
        data: {
          ...memberData,
          birthDate: birthDate ? new Date(birthDate) : undefined,
          licenseExpiresAt: licenseExpiresAt ? new Date(licenseExpiresAt) : undefined,
        },
        include: { vehicles: true, user: { select: { id: true, email: true, role: true } } },
      })
    })

    return res.json(member)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/members/:id/photo
router.post('/:id/photo', requirePermission('MEMBERS_WRITE'), upload.single('photo'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const member = await prisma.member.findFirst({ where: { id: req.params.id, clubId: req.user!.clubId } })
    if (!member) return res.status(404).json({ error: 'Membro não encontrado' })
    if (!req.file) return res.status(400).json({ error: 'Ficheiro em falta' })
    const url = await uploadToCloudinary(req.file.buffer, `clubs/${req.user!.clubId}/members/${req.params.id}`)
    const updated = await prisma.member.update({ where: { id: req.params.id }, data: { photoUrl: url } })
    return res.json({ photoUrl: updated.photoUrl })
  } catch (err) { next(err) }
})

// POST /api/members/:id/invite — gera link de convite para o membro criar conta
router.post('/:id/invite', requirePermission('MEMBERS_WRITE'), async (req: AuthRequest, res: Response) => {
  const member = await prisma.member.findFirst({
    where: { id: req.params.id, clubId: req.user!.clubId },
    include: { user: true, club: { select: { name: true } } },
  })
  if (!member) return res.status(404).json({ error: 'Membro não encontrado' })
  if (member.user) return res.status(409).json({ error: 'Este membro já tem conta de acesso' })

  const schema = z.object({ email: z.string().email().optional() })
  const { email } = schema.parse(req.body)

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48h

  await prisma.member.update({
    where: { id: req.params.id },
    data: { inviteToken: token, inviteExpiresAt: expiresAt },
  })

  const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
  const inviteUrl = `${clientUrl}/invite/${token}`

  if (email) {
    try {
      await sendAccountInvite({ to: email, memberName: member.fullName, clubName: member.club.name, inviteUrl })
    } catch (err) {
      console.error('[invite] email send failed:', err)
    }
  }

  return res.json({ inviteUrl, expiresAt, emailSent: !!email })
})

// GET /api/members/:id/vehicles
router.get('/:id/vehicles', async (req: AuthRequest, res: Response) => {
  const member = await prisma.member.findFirst({ where: { id: req.params.id, clubId: req.user!.clubId } })
  if (!member) return res.status(404).json({ error: 'Membro não encontrado' })
  const vehicles = await prisma.vehicle.findMany({ where: { memberId: req.params.id }, orderBy: { brand: 'asc' } })
  return res.json(vehicles)
})

// POST /api/members/:id/vehicles
router.post('/:id/vehicles', async (req: AuthRequest, res: Response) => {
  const member = await prisma.member.findFirst({ where: { id: req.params.id, clubId: req.user!.clubId } })
  if (!member) return res.status(404).json({ error: 'Membro não encontrado' })

  const schema = z.object({
    brand: z.string().min(1),
    model: z.string().min(1),
    year: z.number().int().optional(),
    plate: z.string().optional(),
    type: z.enum(['TRAIL', 'ROAD', 'CUSTOM', 'SCOOTER', 'SUPPORT', 'OTHER']).optional(),
    displacement: z.number().int().optional(),
    notes: z.string().optional(),
  })

  try {
    const data = schema.parse(req.body)
    const vehicle = await prisma.vehicle.create({ data: { ...data, memberId: req.params.id } })
    return res.status(201).json(vehicle)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// PATCH /api/members/:memberId/vehicles/:vehicleId
router.patch('/:memberId/vehicles/:vehicleId', async (req: AuthRequest, res: Response) => {
  const member = await prisma.member.findFirst({ where: { id: req.params.memberId, clubId: req.user!.clubId } })
  if (!member) return res.status(404).json({ error: 'Membro não encontrado' })

  // Verificar que o veículo pertence ao membro (previne IDOR cross-member)
  const existing = await prisma.vehicle.findFirst({ where: { id: req.params.vehicleId, memberId: req.params.memberId } })
  if (!existing) return res.status(404).json({ error: 'Veículo não encontrado' })

  // Schema explícito — sem mass assignment via req.body directo
  const vehicleUpdateSchema = z.object({
    brand: z.string().min(1).max(50).optional(),
    model: z.string().min(1).max(100).optional(),
    year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
    plate: z.string().max(20).optional(),
    type: z.enum(['TRAIL', 'ROAD', 'CUSTOM', 'SCOOTER', 'SUPPORT', 'OTHER']).optional(),
    displacement: z.number().int().min(50).max(3000).optional(),
    notes: z.string().max(500).optional(),
  })
  try {
    const data = vehicleUpdateSchema.parse(req.body)
    const vehicle = await prisma.vehicle.update({ where: { id: req.params.vehicleId }, data })
    return res.json(vehicle)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/members/:memberId/vehicles/:vehicleId/photo
router.post('/:memberId/vehicles/:vehicleId/photo', upload.single('photo'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const member = await prisma.member.findFirst({ where: { id: req.params.memberId, clubId: req.user!.clubId } })
    if (!member) return res.status(404).json({ error: 'Membro não encontrado' })
    const vehicle = await prisma.vehicle.findFirst({ where: { id: req.params.vehicleId, memberId: req.params.memberId } })
    if (!vehicle) return res.status(404).json({ error: 'Veículo não encontrado' })
    if (!req.file) return res.status(400).json({ error: 'Ficheiro em falta' })
    const url = await uploadToCloudinary(req.file.buffer, `clubs/${req.user!.clubId}/vehicles/${req.params.vehicleId}`)
    const updated = await prisma.vehicle.update({ where: { id: vehicle.id }, data: { photoUrl: url } })
    return res.json({ photoUrl: updated.photoUrl })
  } catch (err) { next(err) }
})

// DELETE /api/members/:memberId/vehicles/:vehicleId
router.delete('/:id', requirePermission('MEMBERS_WRITE'), async (req: AuthRequest, res: Response) => {
  const member = await prisma.member.findFirst({
    where: { id: req.params.id, clubId: req.user!.clubId },
    select: { id: true, userId: true },
  })
  if (!member) return res.status(404).json({ error: 'Membro não encontrado' })
  await prisma.member.delete({ where: { id: member.id } })
  if (member.userId) {
    await prisma.user.delete({ where: { id: member.userId } }).catch(() => {})
  }
  return res.json({ message: 'Membro eliminado' })
})

router.delete('/:memberId/vehicles/:vehicleId', async (req: AuthRequest, res: Response) => {
  const member = await prisma.member.findFirst({ where: { id: req.params.memberId, clubId: req.user!.clubId } })
  if (!member) return res.status(404).json({ error: 'Membro não encontrado' })
  // Verificar que o veículo pertence ao membro deste clube (previne IDOR)
  const vehicle = await prisma.vehicle.findFirst({ where: { id: req.params.vehicleId, memberId: req.params.memberId } })
  if (!vehicle) return res.status(404).json({ error: 'Veículo não encontrado' })
  await prisma.vehicle.delete({ where: { id: vehicle.id } })
  return res.json({ message: 'Veículo eliminado' })
})

export default router
