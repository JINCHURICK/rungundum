import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { generateRaidPDF, generateMemberCertificate, generateAnnualReport } from '../services/pdf'
import { generateProgramImage, generateProgramPDF } from '../services/programImage'
import { format } from 'date-fns'

const router = Router()
router.use(authenticate)

// POST /api/pdf/raids/:id
router.post('/raids/:id', async (req: AuthRequest, res: Response) => {
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
    },
  })
  if (!raid) return res.status(404).json({ error: 'Raid não encontrado' })

  const [club, handSignals] = await Promise.all([
    prisma.club.findUnique({ where: { id: req.user!.clubId } }),
    prisma.handSignal.findMany({ where: { clubId: req.user!.clubId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
  ])
  if (!club) return res.status(404).json({ error: 'Clube não encontrado' })

  const optionsSchema = z.object({
    includeRoster: z.boolean().optional(),
    includeRoutePoints: z.boolean().optional(),
    includeContingency: z.boolean().optional(),
    includeEmergencyContacts: z.boolean().optional(),
    includeBriefing: z.boolean().optional(),
    includeChecklist: z.boolean().optional(),
    includeStatutes: z.boolean().optional(),
    includeSignatures: z.boolean().optional(),
  })

  const options = optionsSchema.parse(req.body)
  const pdf = await generateRaidPDF(raid, { ...club, handSignals }, options)

  const clean = (s: string) => s.replace(/[<>:"/\\|?*]/g, '').trim()
  const dateStr = format(new Date(raid.date), 'dd-MM-yyyy')
  const filename = `Plano de Raid - ${clean(raid.origin)} a ${clean(raid.destination)} - ${dateStr}.pdf`

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
  return res.send(pdf)
})

// POST /api/pdf/raids/:id/program-image
router.post('/raids/:id/program-image', async (req: AuthRequest, res: Response) => {
  const raid = await prisma.raid.findFirst({
    where: { id: req.params.id, clubId: req.user!.clubId },
    include: {
      routePoints: { orderBy: { order: 'asc' } },
      participants: {
        include: { member: { select: { fullName: true, nickname: true } } },
      },
    },
  })
  if (!raid) return res.status(404).json({ error: 'Raid não encontrado' })

  const club = await prisma.club.findUnique({ where: { id: req.user!.clubId } })
  if (!club) return res.status(404).json({ error: 'Clube não encontrado' })

  const image = await generateProgramImage(raid, club)

  const dateStr = format(new Date(raid.date), 'yyyy-MM-dd')
  const filename = `programa_${raid.title.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.png`

  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  return res.send(image)
})

// POST /api/pdf/raids/:id/program-pdf
router.post('/raids/:id/program-pdf', async (req: AuthRequest, res: Response) => {
  const raid = await prisma.raid.findFirst({
    where: { id: req.params.id, clubId: req.user!.clubId },
    include: { routePoints: { orderBy: { order: 'asc' } } },
  })
  if (!raid) return res.status(404).json({ error: 'Raid não encontrado' })

  const club = await prisma.club.findUnique({ where: { id: req.user!.clubId } })
  if (!club) return res.status(404).json({ error: 'Clube não encontrado' })

  const pdf = await generateProgramPDF(raid, club)

  const clean = (s: string) => s.replace(/[<>:"/\\|?*]/g, '').trim()
  const dateStr = format(new Date(raid.date), 'dd-MM-yyyy')
  const filename = `Resumo - ${clean(raid.origin)} a ${clean(raid.destination)} - ${dateStr}.pdf`

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
  return res.send(pdf)
})

// POST /api/pdf/members/:memberId/certificate
router.post('/members/:memberId/certificate', async (req: AuthRequest, res: Response) => {
  const yearRaw = req.body?.year
  const year = yearRaw && Number.isInteger(Number(yearRaw)) ? Number(yearRaw) : new Date().getFullYear()

  const member = await prisma.member.findFirst({
    where: { id: req.params.memberId, clubId: req.user!.clubId },
    include: {
      participations: {
        where: {
          status: 'CONFIRMED',
          raid: {
            date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) },
          },
        },
        include: {
          raid: { select: { title: true, date: true, estimatedKm: true, origin: true, destination: true } },
        },
        orderBy: { raid: { date: 'asc' } },
      },
    },
  })
  if (!member) return res.status(404).json({ error: 'Membro não encontrado' })

  const club = await prisma.club.findUnique({ where: { id: req.user!.clubId } })
  if (!club) return res.status(404).json({ error: 'Clube não encontrado' })

  const pdf = await generateMemberCertificate(member, club, year)

  const clean = (s: string) => s.replace(/[<>:"/\\|?*]/g, '').trim()
  const name = clean(member.nickname ?? member.fullName)
  const filename = `Certificado - ${name} - ${year}.pdf`

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
  return res.send(pdf)
})

// POST /api/pdf/annual-report
router.post('/annual-report', async (req: AuthRequest, res: Response) => {
  const yearRaw = req.body?.year
  const year = yearRaw && !isNaN(Number(yearRaw)) ? Number(yearRaw) : new Date().getFullYear()
  const clubId = req.user!.clubId

  const start = new Date(`${year}-01-01T00:00:00.000Z`)
  const end   = new Date(`${year}-12-31T23:59:59.999Z`)

  const [club, raids, members, transactions] = await Promise.all([
    prisma.club.findUnique({ where: { id: clubId } }),
    prisma.raid.findMany({
      where: { clubId, date: { gte: start, lte: end } },
      include: {
        participants: {
          where: { status: 'CONFIRMED' },
          include: { member: { select: { fullName: true, nickname: true } } },
        },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.member.findMany({
      where: { clubId },
      select: { id: true, fullName: true, nickname: true, status: true, joinedAt: true },
    }),
    prisma.transaction.findMany({
      where: { clubId, date: { gte: start, lte: end } },
      select: { type: true, amount: true, category: true },
    }),
  ])

  if (!club) return res.status(404).json({ error: 'Clube não encontrado' })

  const pdf = await generateAnnualReport({ club, year, raids, members, transactions })

  const clean = (s: string) => s.replace(/[<>:"/\\|?*]/g, '').trim()
  const filename = `Relatorio Anual - ${clean(club.name)} - ${year}.pdf`
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
  return res.send(pdf)
})

export default router
