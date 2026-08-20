import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { uploadToCloudinary, slugify } from '../services/cloudinary'
import multer from 'multer'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

router.use(authenticate)

const updateClubSchema = z.object({
  name: z.string().min(2).optional(),
  acronym: z.string().min(1).max(10).optional(),
  location: z.string().optional(),
  country: z.string().optional(),
  foundedAt: z.string().optional(),
  motto: z.string().optional(),
  website: z.string().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  statutesText: z.string().optional(),
  statutesVersion: z.string().optional(),
  defaultSettings: z.record(z.unknown()).optional(),
})

// GET /api/clubs/me
router.get('/me', async (req: AuthRequest, res: Response) => {
  const club = await prisma.club.findUnique({
    where: { id: req.user!.clubId },
    include: {
      emergencyContacts: { orderBy: { region: 'asc' } },
      _count: { select: { members: true, raids: true } },
    },
  })
  if (!club) return res.status(404).json({ error: 'Clube não encontrado' })
  return res.json(club)
})

// PATCH /api/clubs/me
router.patch('/me', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = updateClubSchema.parse(req.body)
    const club = await prisma.club.update({
      where: { id: req.user!.clubId },
      data: {
        ...data,
        foundedAt: data.foundedAt ? new Date(data.foundedAt) : undefined,
        defaultSettings: data.defaultSettings as any,
      },
    })
    return res.json(club)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/clubs/me/logo
router.post('/me/logo', requireRole('ADMIN'), upload.single('logo'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Ficheiro em falta' })
    const clubInfo = await prisma.club.findUnique({ where: { id: req.user!.clubId }, select: { acronym: true, name: true } })
    const clubSlug = slugify(clubInfo?.acronym || clubInfo?.name || req.user!.clubId)
    const url = await uploadToCloudinary(req.file.buffer, `clubs/${clubSlug}/logo`)
    const club = await prisma.club.update({ where: { id: req.user!.clubId }, data: { logoUrl: url } })
    return res.json({ logoUrl: club.logoUrl })
  } catch (err) { next(err) }
})

// POST /api/clubs/me/second-logo
router.post('/me/second-logo', requireRole('ADMIN'), upload.single('logo'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Ficheiro em falta' })
    const clubInfo = await prisma.club.findUnique({ where: { id: req.user!.clubId }, select: { acronym: true, name: true } })
    const clubSlug = slugify(clubInfo?.acronym || clubInfo?.name || req.user!.clubId)
    const url = await uploadToCloudinary(req.file.buffer, `clubs/${clubSlug}/second-logo`)
    const club = await prisma.club.update({ where: { id: req.user!.clubId }, data: { secondLogoUrl: url } })
    return res.json({ secondLogoUrl: club.secondLogoUrl })
  } catch (err) { next(err) }
})

// GET /api/clubs/me/emergency-contacts
router.get('/me/emergency-contacts', async (req: AuthRequest, res: Response) => {
  const contacts = await prisma.emergencyContact.findMany({
    where: { clubId: req.user!.clubId },
    orderBy: [{ region: 'asc' }, { name: 'asc' }],
  })
  return res.json(contacts)
})

// POST /api/clubs/me/emergency-contacts
router.post('/me/emergency-contacts', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    region: z.string().min(1),
    name: z.string().min(1),
    role: z.string().min(1),
    phone: z.string().min(1),
  })
  try {
    const data = schema.parse(req.body)
    const contact = await prisma.emergencyContact.create({ data: { ...data, clubId: req.user!.clubId } })
    return res.status(201).json(contact)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// DELETE /api/clubs/me/emergency-contacts/:id
router.delete('/me/emergency-contacts/:id', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  const contact = await prisma.emergencyContact.findFirst({ where: { id: req.params.id, clubId: req.user!.clubId } })
  if (!contact) return res.status(404).json({ error: 'Contacto não encontrado' })
  await prisma.emergencyContact.delete({ where: { id: req.params.id } })
  return res.json({ message: 'Contacto eliminado' })
})

// ── Sinais de Mão ─────────────────────────────────────────────────────────────

// GET /api/clubs/me/hand-signals
router.get('/me/hand-signals', async (req: AuthRequest, res: Response) => {
  const signals = await prisma.handSignal.findMany({
    where: { clubId: req.user!.clubId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })
  return res.json(signals)
})

const handSignalSchema = z.object({
  name:        z.string().min(1, 'Nome obrigatório').max(100),
  description: z.string().optional(),
  order:       z.number().int().optional(),
})

// POST /api/clubs/me/hand-signals
router.post('/me/hand-signals', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = handSignalSchema.parse(req.body)
    const maxOrder = await prisma.handSignal.count({ where: { clubId: req.user!.clubId } })
    const signal = await prisma.handSignal.create({
      data: { ...data, clubId: req.user!.clubId, order: data.order ?? maxOrder },
    })
    return res.status(201).json(signal)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// PATCH /api/clubs/me/hand-signals/:id
router.patch('/me/hand-signals/:id', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  try {
    const signal = await prisma.handSignal.findFirst({ where: { id: req.params.id, clubId: req.user!.clubId } })
    if (!signal) return res.status(404).json({ error: 'Sinal não encontrado' })
    const data = handSignalSchema.partial().parse(req.body)
    const updated = await prisma.handSignal.update({ where: { id: req.params.id }, data })
    return res.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// DELETE /api/clubs/me/hand-signals/:id
router.delete('/me/hand-signals/:id', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  const signal = await prisma.handSignal.findFirst({ where: { id: req.params.id, clubId: req.user!.clubId } })
  if (!signal) return res.status(404).json({ error: 'Sinal não encontrado' })
  await prisma.handSignal.delete({ where: { id: req.params.id } })
  return res.json({ message: 'Sinal eliminado' })
})

// POST /api/clubs/me/hand-signals/:id/image
router.post('/me/hand-signals/:id/image', requireRole('ADMIN', 'CAPTAIN'), upload.single('image'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Ficheiro em falta' })
    const signal = await prisma.handSignal.findFirst({ where: { id: req.params.id, clubId: req.user!.clubId } })
    if (!signal) return res.status(404).json({ error: 'Sinal não encontrado' })
    const clubInfo = await prisma.club.findUnique({ where: { id: req.user!.clubId }, select: { acronym: true, name: true } })
    const clubSlug = slugify(clubInfo?.acronym || clubInfo?.name || req.user!.clubId)
    const signalSlug = slugify(signal.name)
    const url = await uploadToCloudinary(req.file.buffer, `clubs/${clubSlug}/hand-signals/${signalSlug}`)
    const updated = await prisma.handSignal.update({ where: { id: req.params.id }, data: { imageUrl: url } })
    return res.json({ imageUrl: updated.imageUrl })
  } catch (err) { next(err) }
})

// PUT /api/clubs/me/hand-signals/reorder — actualizar ordem de vários sinais
router.put('/me/hand-signals/reorder', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  const schema = z.object({ ids: z.array(z.string()) })
  try {
    const { ids } = schema.parse(req.body)
    await Promise.all(ids.map((id, index) =>
      prisma.handSignal.updateMany({ where: { id, clubId: req.user!.clubId }, data: { order: index } })
    ))
    return res.json({ message: 'Ordem actualizada' })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

export default router
