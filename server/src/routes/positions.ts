import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requirePermission, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

export const STANDARD_TITLES = [
  'Presidente',
  'Vice-Presidente',
  'Secretário',
  'Tesoureiro',
  'Capitão de Estrada',
  'Sub-Capitão',
  'Provedor',
  'Assessor',
  'Relações Públicas',
  'Outro',
]

const memberSelect = { fullName: true, nickname: true, memberNumber: true, photoUrl: true }

// GET /api/positions — posições actuais e históricas
router.get('/', async (req: AuthRequest, res: Response) => {
  const positions = await prisma.clubPosition.findMany({
    where: { clubId: req.user!.clubId },
    include: { member: { select: memberSelect } },
    orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
  })
  return res.json(positions)
})

// GET /api/positions/titles — lista de títulos standard
router.get('/titles', (_req, res) => res.json(STANDARD_TITLES))

// POST /api/positions — atribuir cargo
router.post('/', requirePermission('POSITIONS_WRITE'), async (req: AuthRequest, res: Response) => {
  try {
    const data = z.object({
      memberId:  z.string(),
      title:     z.string().min(1),
      startDate: z.string(),
      endDate:   z.string().nullish(),
      notes:     z.string().nullish(),
    }).parse(req.body)

    const member = await prisma.member.findFirst({ where: { id: data.memberId, clubId: req.user!.clubId } })
    if (!member) return res.status(404).json({ error: 'Membro não encontrado' })

    // Se o cargo já existe como "isCurrent" para outro membro, marcar o anterior como não-current
    await prisma.clubPosition.updateMany({
      where: { clubId: req.user!.clubId, title: data.title, isCurrent: true },
      data:  { isCurrent: false, endDate: new Date(data.startDate) },
    })

    const pos = await prisma.clubPosition.create({
      data: {
        clubId:    req.user!.clubId,
        memberId:  data.memberId,
        title:     data.title,
        startDate: new Date(data.startDate),
        endDate:   data.endDate ? new Date(data.endDate) : null,
        isCurrent: !data.endDate,
        notes:     data.notes ?? null,
      },
      include: { member: { select: memberSelect } },
    })
    return res.status(201).json(pos)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// PATCH /api/positions/:id — actualizar (ex: definir data de fim / encerrar mandato)
router.patch('/:id', requirePermission('POSITIONS_WRITE'), async (req: AuthRequest, res: Response) => {
  try {
    const pos = await prisma.clubPosition.findFirst({ where: { id: req.params.id, clubId: req.user!.clubId } })
    if (!pos) return res.status(404).json({ error: 'Cargo não encontrado' })

    const data = z.object({
      endDate:   z.string().nullish(),
      isCurrent: z.boolean().optional(),
      notes:     z.string().nullish(),
    }).parse(req.body)

    const updated = await prisma.clubPosition.update({
      where: { id: pos.id },
      data: {
        endDate:   data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : undefined,
        isCurrent: data.isCurrent !== undefined ? data.isCurrent : (data.endDate ? false : undefined),
        notes:     data.notes !== undefined ? (data.notes ?? null) : undefined,
      },
      include: { member: { select: memberSelect } },
    })
    return res.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// DELETE /api/positions/:id
router.delete('/:id', requirePermission('POSITIONS_WRITE'), async (req: AuthRequest, res: Response) => {
  const pos = await prisma.clubPosition.findFirst({ where: { id: req.params.id, clubId: req.user!.clubId } })
  if (!pos) return res.status(404).json({ error: 'Cargo não encontrado' })
  await prisma.clubPosition.delete({ where: { id: pos.id } })
  return res.status(204).send()
})

export default router
