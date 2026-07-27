import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requirePermission, requireRole, AuthRequest } from '../middleware/auth'
import { sendSuspensionSms, sendFineSms } from '../services/sms'

const router = Router()
router.use(authenticate)
router.use(requirePermission('DISCIPLINARY'))

const memberSelect = { fullName: true, nickname: true, memberNumber: true, photoUrl: true }

// ── PROCESSOS DISCIPLINARES ─────────────────────────────────────────────────

router.get('/processes', async (req: AuthRequest, res: Response) => {
  const processes = await prisma.disciplinaryProcess.findMany({
    where: { clubId: req.user!.clubId },
    include: {
      member: { select: memberSelect },
      fines: { select: { id: true, amount: true, status: true } },
      suspensions: { select: { id: true, startDate: true, endDate: true, liftedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return res.json(processes)
})

router.post('/processes', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      memberId: z.string(),
      title: z.string().min(1),
      description: z.string().nullish(),
      severity: z.enum(['MINOR', 'MODERATE', 'SERIOUS']).default('MINOR'),
    })
    const data = schema.parse(req.body)

    const member = await prisma.member.findFirst({ where: { id: data.memberId, clubId: req.user!.clubId } })
    if (!member) return res.status(404).json({ error: 'Membro não encontrado' })

    const process = await prisma.disciplinaryProcess.create({
      data: {
        clubId: req.user!.clubId,
        memberId: data.memberId,
        title: data.title,
        description: data.description ?? null,
        severity: data.severity,
        createdById: req.user!.userId,
      },
      include: {
        member: { select: memberSelect },
        fines: { select: { id: true, amount: true, status: true } },
        suspensions: { select: { id: true, startDate: true, endDate: true, liftedAt: true } },
      },
    })
    return res.status(201).json(process)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

router.patch('/processes/:id', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      status: z.enum(['OPEN', 'REVIEWING', 'CLOSED']).optional(),
      severity: z.enum(['MINOR', 'MODERATE', 'SERIOUS']).optional(),
      outcome: z.string().nullish(),
      title: z.string().optional(),
      description: z.string().nullish(),
    })
    const data = schema.parse(req.body)

    const process = await prisma.disciplinaryProcess.findFirst({
      where: { id: req.params.id, clubId: req.user!.clubId },
    })
    if (!process) return res.status(404).json({ error: 'Processo não encontrado' })

    const updated = await prisma.disciplinaryProcess.update({
      where: { id: process.id },
      data: {
        ...data,
        closedAt: data.status === 'CLOSED' ? new Date() : process.closedAt,
      },
      include: {
        member: { select: memberSelect },
        fines: { select: { id: true, amount: true, status: true } },
        suspensions: { select: { id: true, startDate: true, endDate: true, liftedAt: true } },
      },
    })
    return res.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

router.delete('/processes/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const process = await prisma.disciplinaryProcess.findFirst({
    where: { id: req.params.id, clubId: req.user!.clubId },
  })
  if (!process) return res.status(404).json({ error: 'Processo não encontrado' })

  await prisma.disciplinaryProcess.delete({ where: { id: process.id } })
  return res.status(204).send()
})

// ── SUSPENSÕES ──────────────────────────────────────────────────────────────

router.get('/suspensions', async (req: AuthRequest, res: Response) => {
  const suspensions = await prisma.suspension.findMany({
    where: { clubId: req.user!.clubId },
    include: {
      member: { select: memberSelect },
      process: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return res.json(suspensions)
})

router.post('/suspensions', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      memberId: z.string(),
      reason: z.string().min(1),
      startDate: z.string(),
      endDate: z.string(),
      processId: z.string().nullish(),
      notes: z.string().nullish(),
    })
    const data = schema.parse(req.body)

    const member = await prisma.member.findFirst({
      where: { id: data.memberId, clubId: req.user!.clubId },
      include: { club: { select: { name: true } } },
    })
    if (!member) return res.status(404).json({ error: 'Membro não encontrado' })

    const start = new Date(data.startDate)
    const end = new Date(data.endDate)
    if (end <= start) return res.status(400).json({ error: 'A data de fim deve ser posterior à data de início' })

    const suspension = await prisma.suspension.create({
      data: {
        clubId: req.user!.clubId,
        memberId: data.memberId,
        reason: data.reason,
        startDate: start,
        endDate: end,
        processId: data.processId ?? null,
        notes: data.notes ?? null,
        createdById: req.user!.userId,
      },
      include: {
        member: { select: memberSelect },
        process: { select: { id: true, title: true } },
      },
    })

    // Auto-suspender membro se a suspensão já está activa
    const now = new Date()
    if (start <= now && end >= now) {
      await prisma.member.update({ where: { id: data.memberId }, data: { status: 'SUSPENDED' } })
    }

    // SMS de notificação
    if (member.phone) {
      sendSuspensionSms({
        phone:      member.phone,
        memberName: member.nickname ?? member.fullName,
        clubName:   member.club.name,
        reason:     data.reason,
        endDate:    end.toLocaleDateString('pt-AO'),
      }).catch(() => {})
    }

    return res.status(201).json(suspension)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

router.patch('/suspensions/:id/lift', async (req: AuthRequest, res: Response) => {
  const suspension = await prisma.suspension.findFirst({
    where: { id: req.params.id, clubId: req.user!.clubId },
  })
  if (!suspension) return res.status(404).json({ error: 'Suspensão não encontrada' })
  if (suspension.liftedAt) return res.status(400).json({ error: 'Suspensão já levantada' })

  const updated = await prisma.suspension.update({
    where: { id: suspension.id },
    data: { liftedAt: new Date() },
    include: {
      member: { select: memberSelect },
      process: { select: { id: true, title: true } },
    },
  })

  // Reactivar o membro (só se não tiver outras suspensões activas)
  const otherActive = await prisma.suspension.count({
    where: {
      memberId: suspension.memberId,
      id: { not: suspension.id },
      liftedAt: null,
      endDate: { gte: new Date() },
    },
  })
  if (otherActive === 0) {
    await prisma.member.update({ where: { id: suspension.memberId }, data: { status: 'ACTIVE' } })
  }

  return res.json(updated)
})

router.delete('/suspensions/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const suspension = await prisma.suspension.findFirst({
    where: { id: req.params.id, clubId: req.user!.clubId },
  })
  if (!suspension) return res.status(404).json({ error: 'Suspensão não encontrada' })

  await prisma.suspension.delete({ where: { id: suspension.id } })
  return res.status(204).send()
})

// ── MULTAS ──────────────────────────────────────────────────────────────────

router.get('/fines', async (req: AuthRequest, res: Response) => {
  const fines = await prisma.fine.findMany({
    where: { clubId: req.user!.clubId },
    include: {
      member: { select: memberSelect },
      process: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return res.json(fines)
})

router.post('/fines', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      memberId: z.string(),
      reason: z.string().min(1),
      amount: z.number().min(0),
      processId: z.string().nullish(),
      notes: z.string().nullish(),
    })
    const data = schema.parse(req.body)

    const member = await prisma.member.findFirst({
      where: { id: data.memberId, clubId: req.user!.clubId },
      include: { club: { select: { name: true } } },
    })
    if (!member) return res.status(404).json({ error: 'Membro não encontrado' })

    const fine = await prisma.fine.create({
      data: {
        clubId: req.user!.clubId,
        memberId: data.memberId,
        reason: data.reason,
        amount: data.amount,
        processId: data.processId ?? null,
        notes: data.notes ?? null,
        createdById: req.user!.userId,
      },
      include: {
        member: { select: memberSelect },
        process: { select: { id: true, title: true } },
      },
    })

    // SMS de notificação
    if (member.phone) {
      sendFineSms({
        phone:      member.phone,
        memberName: member.nickname ?? member.fullName,
        clubName:   member.club.name,
        reason:     data.reason,
        amount:     data.amount,
      }).catch(() => {})
    }

    return res.status(201).json(fine)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

router.patch('/fines/:id/pay', async (req: AuthRequest, res: Response) => {
  const fine = await prisma.fine.findFirst({
    where: { id: req.params.id, clubId: req.user!.clubId },
  })
  if (!fine) return res.status(404).json({ error: 'Multa não encontrada' })
  if (fine.status === 'PAID') return res.status(400).json({ error: 'Multa já paga' })

  const updated = await prisma.fine.update({
    where: { id: fine.id },
    data: { status: 'PAID', paidAt: new Date() },
    include: {
      member: { select: memberSelect },
      process: { select: { id: true, title: true } },
    },
  })
  return res.json(updated)
})

router.patch('/fines/:id/cancel', async (req: AuthRequest, res: Response) => {
  const fine = await prisma.fine.findFirst({
    where: { id: req.params.id, clubId: req.user!.clubId },
  })
  if (!fine) return res.status(404).json({ error: 'Multa não encontrada' })

  const updated = await prisma.fine.update({
    where: { id: fine.id },
    data: { status: 'CANCELLED' },
    include: {
      member: { select: memberSelect },
      process: { select: { id: true, title: true } },
    },
  })
  return res.json(updated)
})

router.delete('/fines/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const fine = await prisma.fine.findFirst({
    where: { id: req.params.id, clubId: req.user!.clubId },
  })
  if (!fine) return res.status(404).json({ error: 'Multa não encontrada' })

  await prisma.fine.delete({ where: { id: fine.id } })
  return res.status(204).send()
})

export default router
