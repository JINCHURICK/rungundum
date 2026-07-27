import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /api/leagues — lista ligas (activas e terminadas)
router.get('/', async (req: AuthRequest, res: Response) => {
  const leagues = await prisma.league.findMany({
    orderBy: [{ status: 'asc' }, { year: 'desc' }],
    include: {
      _count: { select: { entries: true } },
      entries: {
        where: { clubId: req.user!.clubId },
        select: { points: true, raidsCompleted: true, totalKm: true },
      },
    },
  })

  return res.json(leagues.map((l) => ({
    id: l.id,
    name: l.name,
    year: l.year,
    region: l.region,
    description: l.description,
    status: l.status,
    pointsPerRaid: l.pointsPerRaid,
    bonusKmPoints: l.bonusKmPoints,
    clubCount: l._count.entries,
    myEntry: l.entries[0] ?? null,
  })))
})

// GET /api/leagues/:id — standings completos
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const league = await prisma.league.findUnique({
    where: { id: req.params.id },
    include: {
      entries: {
        orderBy: { points: 'desc' },
        include: { club: { select: { id: true, name: true, acronym: true, logoUrl: true, accentColor: true } } },
      },
    },
  })
  if (!league) return res.status(404).json({ error: 'Liga não encontrada' })

  return res.json({
    ...league,
    entries: league.entries.map((e, i) => ({
      position: i + 1,
      clubId: e.clubId,
      clubName: e.club.name,
      clubAcronym: e.club.acronym,
      clubLogoUrl: e.club.logoUrl,
      clubAccentColor: e.club.accentColor,
      points: e.points,
      raidsCompleted: e.raidsCompleted,
      totalKm: e.totalKm,
      isMyClub: e.clubId === req.user!.clubId,
    })),
  })
})

// POST /api/leagues — criar liga (apenas ADMIN, protegido por token especial)
router.post('/', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(3),
      year: z.number().int().min(2020).max(2100),
      region: z.string().nullish(),
      description: z.string().nullish(),
      pointsPerRaid: z.number().int().min(1).default(100),
      bonusKmPoints: z.number().min(0).default(0.1),
    })
    const data = schema.parse(req.body)
    const league = await prisma.league.create({ data })
    return res.status(201).json(league)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/leagues/:id/join — clube inscreve-se numa liga
router.post('/:id/join', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  const league = await prisma.league.findUnique({ where: { id: req.params.id } })
  if (!league || league.status !== 'ACTIVE') {
    return res.status(404).json({ error: 'Liga não encontrada ou já encerrada' })
  }

  const entry = await prisma.leagueEntry.upsert({
    where: { leagueId_clubId: { leagueId: league.id, clubId: req.user!.clubId } },
    update: {},
    create: { leagueId: league.id, clubId: req.user!.clubId },
  })

  return res.status(201).json(entry)
})

// POST /api/leagues/:id/leave — sair de uma liga
router.post('/:id/leave', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  await prisma.leagueEntry.deleteMany({
    where: { leagueId: req.params.id, clubId: req.user!.clubId },
  })
  return res.status(204).send()
})

// POST /api/leagues/:id/award — atribuir pontos manualmente (ADMIN)
router.post('/:id/award', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      clubId: z.string(),
      points: z.number().int(),
      raidsCompleted: z.number().int().min(0).default(0),
      totalKm: z.number().min(0).default(0),
    })
    const data = schema.parse(req.body)

    const entry = await prisma.leagueEntry.upsert({
      where: { leagueId_clubId: { leagueId: req.params.id, clubId: data.clubId } },
      update: {
        points: { increment: data.points },
        raidsCompleted: { increment: data.raidsCompleted },
        totalKm: { increment: data.totalKm },
        lastUpdated: new Date(),
      },
      create: {
        leagueId: req.params.id,
        clubId: data.clubId,
        points: data.points,
        raidsCompleted: data.raidsCompleted,
        totalKm: data.totalKm,
      },
    })

    return res.json(entry)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// PATCH /api/leagues/:id — actualizar estado da liga
router.patch('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({ status: z.enum(['ACTIVE', 'FINISHED']).optional() })
    const data = schema.parse(req.body)
    const league = await prisma.league.update({ where: { id: req.params.id }, data })
    return res.json(league)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

export default router

// Função auxiliar chamada quando um raid é COMPLETED — atribui pontos nas ligas activas
export async function awardLeaguePointsForRaid(clubId: string, estimatedKm: number | null) {
  const activeEntries = await prisma.leagueEntry.findMany({
    where: { clubId, league: { status: 'ACTIVE' } },
    include: { league: true },
  })

  await Promise.all(
    activeEntries.map((entry) => {
      const kmBonus = Math.round((estimatedKm ?? 0) * entry.league.bonusKmPoints)
      const total = entry.league.pointsPerRaid + kmBonus
      return prisma.leagueEntry.update({
        where: { id: entry.id },
        data: {
          points: { increment: total },
          raidsCompleted: { increment: 1 },
          totalKm: { increment: estimatedKm ?? 0 },
          lastUpdated: new Date(),
        },
      })
    })
  )
}
