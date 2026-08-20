import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requirePermission, requireRole, AuthRequest } from '../middleware/auth'
import { sendSuspensionSms, sendSuspensionLiftedSms, sendFineSms } from '../services/sms'
import { sendFineEmail, sendSuspensionEmail } from '../services/email'
import { createFineTransaction, deleteFineTransaction } from './treasury'
import { getNotificationMode } from '../lib/notificationMode'

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
      include: { club: { select: { name: true } }, user: { select: { email: true } } },
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

    const memberName = member.nickname ?? member.fullName
    const clubName   = member.club.name
    const startStr   = start.toLocaleDateString('pt-AO')
    const endStr     = end.toLocaleDateString('pt-AO')

    const { sms: canSms, email: canEmail } = await getNotificationMode(req.user!.clubId)

    if (canSms && member.phone) {
      sendSuspensionSms({
        phone: member.phone, memberName, clubName,
        reason: data.reason, startDate: startStr, endDate: endStr,
      }).catch(() => {})
    }
    if (canEmail && member.user?.email) {
      sendSuspensionEmail({
        to: member.user.email, memberName, clubName,
        reason: data.reason, startDate: startStr, endDate: endStr,
        notes: data.notes ?? null,
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

  // SMS de levantamento
  const liftedMember = await prisma.member.findUnique({
    where: { id: suspension.memberId },
    include: { club: { select: { name: true } } },
  })
  if (liftedMember?.phone) {
    const { sms: canSms } = await getNotificationMode(suspension.clubId)
    if (canSms) {
      sendSuspensionLiftedSms({
        phone:      liftedMember.phone,
        memberName: liftedMember.nickname ?? liftedMember.fullName,
        clubName:   liftedMember.club.name,
      }).catch(() => {})
    }
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
      include: { club: { select: { name: true } }, user: { select: { email: true } } },
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

    const memberName = member.nickname ?? member.fullName
    const clubName   = member.club.name
    const { sms: canSms, email: canEmail } = await getNotificationMode(req.user!.clubId)

    if (canSms && member.phone) {
      sendFineSms({ phone: member.phone, memberName, clubName, reason: data.reason, amount: data.amount }).catch(() => {})
    }
    if (canEmail && member.user?.email) {
      sendFineEmail({ to: member.user.email, memberName, clubName, reason: data.reason, amount: data.amount, notes: data.notes ?? null }).catch(() => {})
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

  const paidAt = new Date()
  const updated = await prisma.fine.update({
    where: { id: fine.id },
    data: { status: 'PAID', paidAt },
    include: {
      member: { select: memberSelect },
      process: { select: { id: true, title: true } },
    },
  })

  // Entrada automática na tesouraria
  createFineTransaction({
    clubId:     fine.clubId,
    memberId:   fine.memberId,
    memberName: updated.member.nickname ?? updated.member.fullName,
    amount:     fine.amount,
    reason:     fine.reason,
    fineId:     fine.id,
    paidAt,
    createdById: req.user!.userId,
  }).catch(err => console.error('[treasury] falha ao criar transacção de multa:', err))

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

  // Remover entrada da tesouraria se a multa já tinha sido paga e entretanto cancelada
  deleteFineTransaction(fine.id, fine.clubId).catch(err =>
    console.error('[treasury] falha ao remover transacção de multa:', err)
  )

  return res.json(updated)
})

router.delete('/fines/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const fine = await prisma.fine.findFirst({
    where: { id: req.params.id, clubId: req.user!.clubId },
  })
  if (!fine) return res.status(404).json({ error: 'Multa não encontrada' })

  await prisma.fine.delete({ where: { id: fine.id } })
  deleteFineTransaction(fine.id, fine.clubId).catch(err =>
    console.error('[treasury] falha ao remover transacção de multa:', err)
  )
  return res.status(204).send()
})

export default router
