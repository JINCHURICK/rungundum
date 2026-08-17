import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requirePermission, AuthRequest } from '../middleware/auth'
import { sendQuotaReminder, sendQuotaPaid } from '../services/email'
import { sendQuotaReminderSms, sendQuotaPaidSms } from '../services/sms'
import { createQuotaTransaction, deleteQuotaTransaction } from './treasury'
import { getAlertConfig, saveAlertConfig, runQuotaAlerts, DEFAULT_ALERT_CONFIG } from '../services/quotaAlerts'
import { getNotificationMode } from '../lib/notificationMode'

const router = Router()
router.use(authenticate)

// GET /api/quotas/alerts/config
router.get('/alerts/config', requirePermission('ALERTS_CONFIG'), async (req: AuthRequest, res: Response) => {
  const cfg = await getAlertConfig(req.user!.clubId)
  return res.json(cfg)
})

// PATCH /api/quotas/alerts/config
router.patch('/alerts/config', requirePermission('QUOTAS'), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      enabled:              z.boolean(),
      firstAlertMonths:     z.number().int().min(1).max(12),
      secondAlertMonths:    z.number().int().min(1).max(12),
      disciplinaryMonths:   z.number().int().min(1).max(12),
      suspensionRiskMonths: z.number().int().min(1).max(24),
    })
    const cfg = schema.parse(req.body)
    await saveAlertConfig(req.user!.clubId, cfg)
    return res.json(cfg)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/quotas/alerts/run — executar alertas manualmente
router.post('/alerts/run', requirePermission('QUOTAS'), async (req: AuthRequest, res: Response) => {
  const result = await runQuotaAlerts(req.user!.clubId)
  return res.json(result)
})

// GET /api/quotas?year=2025
router.get('/', async (req: AuthRequest, res: Response) => {
  const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()

  const members = await prisma.member.findMany({
    where: { clubId: req.user!.clubId, status: { in: ['ACTIVE', 'INACTIVE'] } },
    include: {
      quotas: {
        where: { year },
        include: { payments: { orderBy: { paidAt: 'desc' } } },
      },
      user: { select: { email: true } },
    },
    orderBy: { fullName: 'asc' },
  })

  const data = members.map((m) => {
    const quota = m.quotas[0] ?? null
    return {
      memberId:     m.id,
      fullName:     m.fullName,
      nickname:     m.nickname,
      email:        m.user?.email ?? null,
      phone:        m.phone,
      photoUrl:     m.photoUrl,
      memberNumber: m.memberNumber,
      quota: quota ? {
        id:         quota.id,
        dueAmount:  quota.dueAmount,
        monthsPaid: quota.monthsPaid,
        paidAmount: quota.paidAmount,
        paidAt:     quota.paidAt,
        notes:      quota.notes,
        payments:   quota.payments,
      } : null,
    }
  })

  const withQuota       = data.filter(m => m.quota)
  const paidAtLeastOnce = data.filter(m => m.quota && m.quota.monthsPaid > 0)
  const completePaid    = data.filter(m => m.quota && m.quota.monthsPaid >= 12)
  const totalMonthlyDue = withQuota.reduce((s, m) => s + (m.quota?.dueAmount ?? 0), 0)
  const totalCollected  = data.reduce((s, m) => s + (m.quota?.paidAmount ?? 0), 0)

  return res.json({
    year,
    members: data,
    summary: {
      total:              members.length,
      withQuota:          withQuota.length,
      paidAtLeastOnce:    paidAtLeastOnce.length,
      completePaid:       completePaid.length,
      totalMonthlyDue,
      totalAnnualExpected: totalMonthlyDue * 12,
      totalCollected,
    },
  })
})

// GET /api/quotas/history?year=2025 — ANTES de /:id
router.get('/history', async (req: AuthRequest, res: Response) => {
  const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()

  const payments = await prisma.quotaPayment.findMany({
    where: {
      quota: { year, member: { clubId: req.user!.clubId } },
    },
    include: {
      quota: {
        include: {
          member: { select: { id: true, fullName: true, nickname: true, memberNumber: true, photoUrl: true } },
        },
      },
    },
    orderBy: { paidAt: 'desc' },
  })

  return res.json(payments)
})

// DELETE /api/quotas/payments/:paymentId — ANTES de /:id
router.delete('/payments/:paymentId', requirePermission('QUOTAS'), async (req: AuthRequest, res: Response) => {
  const payment = await prisma.quotaPayment.findUnique({
    where: { id: req.params.paymentId },
    include: { quota: { include: { member: { select: { clubId: true } } } } },
  })

  if (!payment || payment.quota.member.clubId !== req.user!.clubId) {
    return res.status(404).json({ error: 'Pagamento não encontrado' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.quotaPayment.delete({ where: { id: payment.id } })

    const remaining = await tx.quotaPayment.findMany({
      where: { quotaId: payment.quotaId },
      orderBy: { paidAt: 'asc' },
    })

    await tx.memberQuota.update({
      where: { id: payment.quotaId },
      data: {
        paidAmount: remaining.reduce((s, p) => s + p.amount, 0),
        monthsPaid: remaining.reduce((s, p) => s + p.monthsCount, 0),
        paidAt:     remaining.length > 0 ? remaining[0].paidAt : null,
      },
    })
  })

  // remove the auto-generated treasury transaction linked to this payment
  await deleteQuotaTransaction(payment.id, req.user!.clubId)

  return res.status(204).send()
})

// POST /api/quotas — criar ou actualizar quota (valor mensal)
router.post('/', requirePermission('ALERTS_CONFIG'), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      memberId:  z.string(),
      year:      z.number().int().min(2000).max(2100),
      dueAmount: z.number().min(0),
      notes:     z.string().nullish(),
    })
    const data = schema.parse(req.body)

    const member = await prisma.member.findFirst({ where: { id: data.memberId, clubId: req.user!.clubId } })
    if (!member) return res.status(404).json({ error: 'Membro não encontrado' })

    const quota = await prisma.memberQuota.upsert({
      where:  { memberId_year: { memberId: data.memberId, year: data.year } },
      update: { dueAmount: data.dueAmount, notes: data.notes },
      create: { memberId: data.memberId, year: data.year, dueAmount: data.dueAmount, notes: data.notes },
    })

    return res.status(201).json(quota)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/quotas/:quotaId/payments — registar pagamento
router.post('/:quotaId/payments', requirePermission('ALERTS_CONFIG'), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      amount:        z.number().min(0),
      monthsCount:   z.number().int().min(1).max(12),
      paymentMethod: z.string().optional(),
      reference:     z.string().optional(),
      notes:         z.string().optional(),
      paidAt:        z.string().optional(),
    })
    const data = schema.parse(req.body)

    const quota = await prisma.memberQuota.findUnique({
      where: { id: req.params.quotaId },
      include: {
        member: {
          include: {
            user:  { select: { email: true } },
            club:  { select: { name: true } },
          },
        },
      },
    })

    if (!quota || quota.member.clubId !== req.user!.clubId) {
      return res.status(404).json({ error: 'Quota não encontrada' })
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.quotaPayment.create({
        data: {
          quotaId:       quota.id,
          amount:        data.amount,
          monthsCount:   data.monthsCount,
          paymentMethod: data.paymentMethod,
          reference:     data.reference,
          notes:         data.notes,
          paidAt:        data.paidAt ? new Date(data.paidAt) : new Date(),
          confirmedById: req.user!.userId,
        },
      })

      const allPayments = await tx.quotaPayment.findMany({
        where: { quotaId: quota.id },
        orderBy: { paidAt: 'asc' },
      })

      const updated = await tx.memberQuota.update({
        where: { id: quota.id },
        data: {
          paidAmount:    allPayments.reduce((s, p) => s + p.amount, 0),
          monthsPaid:    allPayments.reduce((s, p) => s + p.monthsCount, 0),
          paidAt:        allPayments[0].paidAt,
          confirmedById: req.user!.userId,
        },
      })

      return { payment, quota: updated }
    })

    const memberName = quota.member.nickname ?? quota.member.fullName
    const clubName   = quota.member.club.name

    // auto-create treasury transaction for this payment
    createQuotaTransaction({
      clubId:      req.user!.clubId,
      memberId:    quota.member.id,
      memberName,
      amount:      result.payment.amount,
      year:        quota.year,
      paymentId:   result.payment.id,
      paidAt:      result.payment.paidAt,
      createdById: req.user!.userId,
    }).catch(() => {})

    const { sms: canSms, email: canEmail } = await getNotificationMode(req.user!.clubId)
    if (canEmail && quota.member.user?.email) {
      sendQuotaPaid({ to: quota.member.user.email, memberName, clubName, year: quota.year, amount: data.amount }).catch(() => {})
    }
    if (canSms && quota.member.phone) {
      sendQuotaPaidSms({ phone: quota.member.phone, memberName, clubName, monthsPaid: data.monthsCount, amount: data.amount, year: quota.year }).catch(() => {})
    }

    return res.status(201).json(result)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/quotas/:id/remind
router.post('/:id/remind', requirePermission('ALERTS_CONFIG'), async (req: AuthRequest, res: Response) => {
  const quota = await prisma.memberQuota.findUnique({
    where: { id: req.params.id },
    include: {
      member: {
        include: {
          user: { select: { email: true } },
          club: { select: { name: true } },
        },
      },
    },
  })
  if (!quota || quota.member.clubId !== req.user!.clubId) {
    return res.status(404).json({ error: 'Quota não encontrada' })
  }

  const memberName = quota.member.nickname ?? quota.member.fullName
  const clubName   = quota.member.club.name
  const { sms: canSms, email: canEmail } = await getNotificationMode(req.user!.clubId)
  const sent: string[] = []

  if (canEmail && quota.member.user?.email) {
    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
    await sendQuotaReminder({ to: quota.member.user.email, memberName, clubName, year: quota.year, amount: quota.dueAmount, appUrl: clientUrl })
    sent.push('email')
  }

  if (canSms && quota.member.phone) {
    await sendQuotaReminderSms({ phone: quota.member.phone, memberName, clubName, year: quota.year, monthlyAmount: quota.dueAmount }).catch(() => {})
    sent.push('SMS')
  }

  if (sent.length === 0) {
    const hasContact = quota.member.user?.email || quota.member.phone
    if (!hasContact) return res.status(400).json({ error: 'O membro não tem email nem telemóvel configurado.' })
    return res.status(400).json({ error: 'As notificações estão desactivadas para este clube.' })
  }
  return res.json({ message: `Lembrete enviado por ${sent.join(' e ')}.` })
})

// DELETE /api/quotas/:id
router.delete('/:id', requirePermission('QUOTAS'), async (req: AuthRequest, res: Response) => {
  const quota = await prisma.memberQuota.findUnique({
    where: { id: req.params.id },
    include: { member: { select: { clubId: true } } },
  })
  if (!quota || quota.member.clubId !== req.user!.clubId) {
    return res.status(404).json({ error: 'Quota não encontrada' })
  }

  await prisma.memberQuota.delete({ where: { id: quota.id } })
  return res.status(204).send()
})

export default router
