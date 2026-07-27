import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { uploadToCloudinary } from '../services/cloudinary'
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
router.post('/me/logo', requireRole('ADMIN'), upload.single('logo'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'Ficheiro em falta' })
  const url = await uploadToCloudinary(req.file.buffer, `clubs/${req.user!.clubId}/logo`)
  const club = await prisma.club.update({ where: { id: req.user!.clubId }, data: { logoUrl: url } })
  return res.json({ logoUrl: club.logoUrl })
})

// POST /api/clubs/me/second-logo
router.post('/me/second-logo', requireRole('ADMIN'), upload.single('logo'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'Ficheiro em falta' })
  const url = await uploadToCloudinary(req.file.buffer, `clubs/${req.user!.clubId}/second-logo`)
  const club = await prisma.club.update({ where: { id: req.user!.clubId }, data: { secondLogoUrl: url } })
  return res.json({ secondLogoUrl: club.secondLogoUrl })
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

export default router
