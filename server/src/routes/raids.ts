import { Router, Response } from 'express'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import multer from 'multer'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { sendRaidPublished } from '../services/email'
import { uploadToCloudinary } from '../services/cloudinary'
import { awardLeaguePointsForRaid } from './leagues'
import { createNotification } from '../services/notifications'

const router = Router()
router.use(authenticate)

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const raidSchema = z.object({
  title: z.string().min(2),
  date: z.string(),
  origin: z.string().min(1),
  destination: z.string().min(1),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  estimatedKm: z.number().nullish(),
  estimatedDuration: z.string().nullish(),
  roadTypes: z.array(z.string()).optional(),
  description: z.string().nullish(),
  maxSpeed: z.number().int().nullish(),
  communicationChannel: z.string().nullish(),
  accommodation: z.string().nullish(),
  accommodationContact: z.string().nullish(),
  routePoints: z.array(z.object({
    order: z.number().int(),
    name: z.string().min(1),
    type: z.enum(['DEPARTURE', 'TECH_STOP', 'LUNCH', 'OVERNIGHT', 'ARRIVAL', 'STOP', 'BREAKFAST', 'FUEL', 'COFFEE', 'SCENIC', 'BORDER']).optional(),
    scheduledDate: z.string().nullish(),
    scheduledTime: z.string().nullish(),
    kmAccumulated: z.number().nullish(),
    stopDuration: z.number().int().nullish(),
    notes: z.string().nullish(),
  })).optional(),
  participants: z.array(z.object({
    memberId: z.string(),
    vehicleId: z.string().nullish(),
    role: z.enum(['LEADER', 'TAIL', 'MEMBER', 'MECHANIC', 'SUPPORT']).optional(),
  })).optional(),
  contingency: z.object({
    accidentText: z.string().nullish(),
    breakdownText: z.string().nullish(),
    separationText: z.string().nullish(),
    weatherText: z.string().nullish(),
    rallyPoint: z.string().nullish(),
    contactsJson: z.array(z.unknown()).optional(),
  }).optional(),
})

const RAID_STATUS_VALUES = ['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
type RaidStatus = typeof RAID_STATUS_VALUES[number]

// GET /api/raids
router.get('/', async (req: AuthRequest, res: Response) => {
  const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined
  const status: RaidStatus | undefined = RAID_STATUS_VALUES.includes(rawStatus as any) ? rawStatus as RaidStatus : undefined
  const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : undefined
  const year = typeof req.query.year === 'string' ? parseInt(req.query.year, 10) : undefined
  const dateFilter = year && !isNaN(year) ? {
    date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
  } : {}
  const raids = await prisma.raid.findMany({
    where: {
      clubId: req.user!.clubId,
      ...(status ? { status } : {}),
      ...dateFilter,
      ...(search ? {
        OR: [
          { title: { contains: search } },
          { origin: { contains: search } },
          { destination: { contains: search } },
        ],
      } : {}),
    },
    include: {
      _count: { select: { participants: true } },
      participants: { where: { status: 'CONFIRMED' }, select: { id: true } },
      routePoints: { orderBy: { order: 'asc' }, take: 1 },
    },
    orderBy: { date: 'desc' },
  })
  return res.json(raids)
})

// GET /api/raids/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const raid = await prisma.raid.findFirst({
    where: { id: req.params.id, clubId: req.user!.clubId },
    include: {
      routePoints: { orderBy: { order: 'asc' } },
      participants: {
        include: {
          member: { select: { id: true, fullName: true, nickname: true, photoUrl: true, phone: true } },
          vehicle: true,
          checklistItems: true,
        },
      },
      contingencyPlan: true,
      photos: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!raid) return res.status(404).json({ error: 'Raid não encontrado' })
  return res.json(raid)
})

// GET /api/raids/public/:token
router.get('/public/:token', async (req: AuthRequest, res: Response) => {
  const raid = await prisma.raid.findUnique({
    where: { publicToken: req.params.token },
    include: {
      club: { select: { name: true, acronym: true, logoUrl: true, accentColor: true } },
      routePoints: { orderBy: { order: 'asc' } },
      participants: {
        include: {
          member: { select: { fullName: true, nickname: true, photoUrl: true } },
          vehicle: { select: { brand: true, model: true, type: true } },
        },
      },
      contingencyPlan: true,
    },
  })
  if (!raid) return res.status(404).json({ error: 'Raid não encontrado' })
  return res.json(raid)
})

// POST /api/raids
router.post('/', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = raidSchema.parse(req.body)
    const { routePoints, participants, contingency, ...raidData } = data

    const raid = await prisma.$transaction(async (tx) => {
      const newRaid = await tx.raid.create({
        data: {
          ...raidData,
          date: new Date(raidData.date),
          clubId: req.user!.clubId,
          publicToken: randomBytes(16).toString('hex'),
        },
      })

      if (routePoints?.length) {
        await tx.routePoint.createMany({
          data: routePoints.map((rp) => ({ ...rp, raidId: newRaid.id })),
        })
      }

      if (participants?.length) {
        await tx.participant.createMany({
          data: participants.map((p) => ({ ...p, raidId: newRaid.id })),
        })
      }

      if (contingency) {
        await tx.contingencyPlan.create({
          data: {
            raidId: newRaid.id,
            ...contingency,
            contactsJson: (contingency.contactsJson ?? []) as any,
          },
        })
      }

      return tx.raid.findUnique({
        where: { id: newRaid.id },
        include: {
          routePoints: { orderBy: { order: 'asc' } },
          participants: { include: { member: true, vehicle: true } },
          contingencyPlan: true,
        },
      })
    })

    return res.status(201).json(raid)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// PATCH /api/raids/:id
router.patch('/:id', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.raid.findFirst({ where: { id: req.params.id, clubId: req.user!.clubId } })
    if (!existing) return res.status(404).json({ error: 'Raid não encontrado' })
    if (['COMPLETED', 'CANCELLED'].includes(existing.status)) {
      return res.status(400).json({ error: 'Não é possível editar um raid concluído ou cancelado' })
    }

    const data = raidSchema.partial().parse(req.body)
    const { routePoints, participants, contingency, ...raidData } = data

    const raid = await prisma.$transaction(async (tx) => {
      const updated = await tx.raid.update({
        where: { id: req.params.id },
        data: { ...raidData, date: raidData.date ? new Date(raidData.date) : undefined },
      })

      if (routePoints !== undefined) {
        await tx.routePoint.deleteMany({ where: { raidId: req.params.id } })
        if (routePoints.length) {
          await tx.routePoint.createMany({ data: routePoints.map((rp) => ({ ...rp, raidId: req.params.id })) })
        }
      }

      if (participants !== undefined) {
        await tx.participant.deleteMany({ where: { raidId: req.params.id } })
        if (participants.length) {
          await tx.participant.createMany({ data: participants.map((p) => ({ ...p, raidId: req.params.id })) })
        }
      }

      if (contingency !== undefined) {
        await tx.contingencyPlan.upsert({
          where: { raidId: req.params.id },
          update: { ...contingency, contactsJson: (contingency.contactsJson ?? []) as any },
          create: { raidId: req.params.id, ...contingency, contactsJson: (contingency.contactsJson ?? []) as any },
        })
      }

      return tx.raid.findUnique({
        where: { id: req.params.id },
        include: { routePoints: { orderBy: { order: 'asc' } }, participants: { include: { member: true, vehicle: true } }, contingencyPlan: true },
      })
    })

    return res.json(raid)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// PATCH /api/raids/:id/status
router.patch('/:id/status', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  const existing = await prisma.raid.findFirst({ where: { id: req.params.id, clubId: req.user!.clubId } })
  if (!existing) return res.status(404).json({ error: 'Raid não encontrado' })

  const { status, cancelReason } = req.body
  const transitions: Record<string, string[]> = {
    DRAFT: ['CONFIRMED'],
    CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED'],
  }

  if (!transitions[existing.status]?.includes(status)) {
    return res.status(400).json({ error: `Transição de ${existing.status} para ${status} não permitida` })
  }

  const raid = await prisma.raid.update({
    where: { id: req.params.id },
    data: { status, ...(cancelReason ? { settings: { ...(existing.settings as object), cancelReason } } : {}) },
    include: { club: { select: { name: true } } },
  })

  // Ao concluir, atribuir pontos nas ligas activas do clube
  if (status === 'COMPLETED') {
    await awardLeaguePointsForRaid(existing.clubId, existing.estimatedKm).catch(() => {})
  }

  // Ao publicar, notificar participantes que têm email + notificação in-app
  if (status === 'CONFIRMED' && existing.publicToken) {
    const participants = await prisma.participant.findMany({
      where: { raidId: raid.id },
      include: { member: { include: { user: { select: { id: true, email: true } } } } },
    })
    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
    const publicUrl = `${clientUrl}/public/${existing.publicToken}`
    const raidDate = existing.date.toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' })

    await Promise.allSettled([
      ...participants
        .filter((p) => p.member.user?.email)
        .map((p) =>
          sendRaidPublished({
            to: p.member.user!.email!,
            memberName: p.member.nickname ?? p.member.fullName,
            raidTitle: existing.title,
            raidDate,
            clubName: (raid as any).club.name,
            publicUrl,
          })
        ),
      ...participants
        .filter((p) => p.member.user?.id)
        .map((p) =>
          createNotification({
            clubId: existing.clubId,
            userId: p.member.user!.id!,
            type: 'RAID_CONFIRMED',
            title: `Raid confirmado: ${existing.title}`,
            body: `Data: ${raidDate}`,
            link: `/raids/${existing.id}`,
          })
        ),
    ])
  }

  return res.json(raid)
})

// POST /api/raids/:id/duplicate
router.post('/:id/duplicate', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  const source = await prisma.raid.findFirst({
    where: { id: req.params.id, clubId: req.user!.clubId },
    include: { routePoints: true, participants: true, contingencyPlan: true },
  })
  if (!source) return res.status(404).json({ error: 'Raid não encontrado' })

  const { id, createdAt, updatedAt, publicToken, status, settings, contingencyPlan: _cp, routePoints: _rp, participants: _parts, ...raidData } = source as any
  const newRaid = await prisma.$transaction(async (tx) => {
    const raid = await tx.raid.create({
      data: { ...raidData, title: `${raidData.title} (cópia)`, status: 'DRAFT', publicToken: randomBytes(16).toString('hex'), settings: settings as any },
    })
    const { id: sourceId, ...routeData } = source.routePoints[0] || {}
    if (source.routePoints.length) {
      await tx.routePoint.createMany({
        data: source.routePoints.map(({ id, raidId, createdAt, ...rp }) => ({ ...rp, raidId: raid.id })),
      })
    }
    if (source.participants.length) {
      await tx.participant.createMany({
        data: source.participants.map(({ id, raidId, createdAt, updatedAt, confirmedAt, checklistCompletedAt, status, ...p }) => ({ ...p, raidId: raid.id })),
      })
    }
    if (source.contingencyPlan) {
      const { id, raidId, createdAt, updatedAt, contactsJson, ...cp } = source.contingencyPlan
      await tx.contingencyPlan.create({ data: { ...cp, contactsJson: (contactsJson ?? []) as any, raidId: raid.id } })
    }
    return raid
  })
  return res.status(201).json(newRaid)
})

// POST /api/raids/:id/photos — upload de foto
router.post('/:id/photos', upload.single('photo'), async (req: AuthRequest, res: Response) => {
  const raid = await prisma.raid.findFirst({ where: { id: req.params.id, clubId: req.user!.clubId } })
  if (!raid) return res.status(404).json({ error: 'Raid não encontrado' })
  if (!req.file) return res.status(400).json({ error: 'Nenhum ficheiro enviado' })

  const caption = typeof req.body.caption === 'string' ? req.body.caption : undefined
  const url = await uploadToCloudinary(req.file.buffer, `clubs/${req.user!.clubId}/raids/${raid.id}/photos`)
  const photo = await prisma.raidPhoto.create({
    data: { raidId: raid.id, url, caption, uploadedById: req.user!.userId },
  })
  return res.status(201).json(photo)
})

// DELETE /api/raids/:id/photos/:photoId
router.delete('/:id/photos/:photoId', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  const photo = await prisma.raidPhoto.findFirst({
    where: { id: req.params.photoId, raidId: req.params.id },
    include: { raid: { select: { clubId: true } } },
  })
  if (!photo || photo.raid.clubId !== req.user!.clubId) return res.status(404).json({ error: 'Foto não encontrada' })
  await prisma.raidPhoto.delete({ where: { id: photo.id } })
  return res.status(204).send()
})

export default router
