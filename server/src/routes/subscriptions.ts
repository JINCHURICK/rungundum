import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import multer from 'multer'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole, requirePlatformAdmin, requirePermission, AuthRequest } from '../middleware/auth'
import { PLAN_LIMITS, PLAN_LABELS, PLAN_PRICES, getEffectiveLimits, type PlanKey } from '../lib/plans'
import { sendUpgradeRequest, sendPaymentProofReceived, sendSubscriptionApproved, sendSubscriptionRejected } from '../services/email'
import { uploadToCloudinary, uploadDocumentToCloudinary } from '../services/cloudinary'
import { readPlanCache } from '../lib/plan-cache'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const router = Router()
router.use(authenticate)

// GET /api/subscriptions/me — estado actual do plano do clube
router.get('/me', async (req: AuthRequest, res: Response) => {
  const club = await prisma.club.findUnique({
    where: { id: req.user!.clubId },
    select: { plan: true, planStatus: true, trialEndsAt: true, planExpiresAt: true },
  })
  if (!club) return res.status(404).json({ error: 'Clube não encontrado' })

  const plan = club.plan as PlanKey
  const limits = getEffectiveLimits(plan, club.planStatus, club.trialEndsAt)

  const [membersCount, raidsThisMonth] = await Promise.all([
    prisma.member.count({ where: { clubId: req.user!.clubId, status: 'ACTIVE' } }),
    prisma.raid.count({
      where: {
        clubId: req.user!.clubId,
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
  ])

  return res.json({
    plan,
    planLabel: PLAN_LABELS[plan],
    planStatus: club.planStatus,
    trialEndsAt: club.trialEndsAt,
    planExpiresAt: club.planExpiresAt,
    limits,
    usage: { membersCount, raidsThisMonth },
    prices: PLAN_PRICES[plan],
    allPlans: Object.entries(PLAN_LIMITS).map(([key, l]) => ({
      key,
      label: PLAN_LABELS[key as PlanKey],
      limits: l,
      prices: PLAN_PRICES[key as PlanKey],
      current: key === plan,
    })),
  })
})

// POST /api/subscriptions/request-upgrade — clube pede upgrade (guarda em BD + envia email)
router.post('/request-upgrade', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { plan } = z.object({ plan: z.enum(['STARTER', 'PRO', 'ENTERPRISE']) }).parse(req.body)

    const club = await prisma.club.findUnique({
      where: { id: req.user!.clubId },
      select: { name: true, location: true, plan: true },
    })
    const adminUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true },
    })

    if (!club || !adminUser) return res.status(404).json({ error: 'Clube não encontrado' })

    // Verificar se já existe pedido pendente para o mesmo plano
    const existing = await prisma.subscriptionRequest.findFirst({
      where: { clubId: req.user!.clubId, requestedPlan: plan, status: 'PENDING' },
    })
    if (existing) return res.status(409).json({ error: 'Já existe um pedido pendente para este plano.' })

    await prisma.subscriptionRequest.create({
      data: {
        clubId: req.user!.clubId,
        requestedPlan: plan,
        currentPlan: club.plan,
        requestedBy: adminUser.email,
        status: 'PENDING',
      },
    })

    const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL
    if (platformAdminEmail) {
      const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
      await sendUpgradeRequest({
        to: platformAdminEmail,
        clubName: club.name,
        clubLocation: club.location,
        currentPlan: PLAN_LABELS[club.plan as PlanKey] ?? club.plan,
        requestedPlan: PLAN_LABELS[plan as PlanKey] ?? plan,
        clubAdminEmail: adminUser.email,
        adminUrl: `${clientUrl}/platform-admin/requests`,
      })
    }

    return res.json({ message: 'Pedido enviado. Serás contactado para concluir o processo.' })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/subscriptions/upgrade — restrito a platform admins
// Actualiza o Club (legacy) E o Subscription (novo sistema) para manter ambos sincronizados
router.post('/upgrade', requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { clubId, planCode, billingCycle, planStatus, trialEndsAt, planExpiresAt } = z.object({
      clubId: z.string(),
      planCode: z.string(),
      billingCycle: z.enum(['MONTHLY', 'ANNUAL']).default('MONTHLY'),
      planStatus: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED']).default('ACTIVE'),
      trialEndsAt: z.string().optional(),
      planExpiresAt: z.string().optional(),
    }).parse(req.body)

    const newPlan = await prisma.plan.findUnique({ where: { code: planCode } })
    if (!newPlan) return res.status(404).json({ error: `Plano "${planCode}" não encontrado.` })

    const now = new Date()
    const periodEnd = planExpiresAt ? new Date(planExpiresAt) : (() => {
      const d = new Date(now)
      d.setMonth(d.getMonth() + (billingCycle === 'ANNUAL' ? 12 : 1))
      return d
    })()

    const subscription = await prisma.subscription.upsert({
      where: { clubId },
      update: {
        planId: newPlan.id,
        billingCycle,
        status: planStatus,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      create: {
        clubId,
        planId: newPlan.id,
        billingCycle,
        status: planStatus,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      include: { plan: true },
    })

    return res.json({ subscription })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// NOVO SISTEMA — baseado nos modelos Plan + Subscription
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/subscriptions/current — subscrição actual + uso de membros
router.get('/current', async (req: AuthRequest, res: Response) => {
  const clubId = req.user!.clubId

  const [subscription, activeMembers] = await Promise.all([
    prisma.subscription.findUnique({
      where: { clubId },
      include: { plan: true },
    }),
    prisma.member.count({ where: { clubId, status: 'ACTIVE' } }),
  ])

  if (!subscription) {
    // club sem subscrição — devolver estado vazio
    const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthlyKz: 'asc' } })
    return res.json({ subscription: null, plans, activeMembers, memberLimit: null, usagePercent: 0 })
  }

  const limit        = subscription.plan.memberLimit
  const usagePercent = limit ? Math.round((activeMembers / limit) * 100) : 0

  const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthlyKz: 'asc' } })

  return res.json({
    subscription: {
      id:                 subscription.id,
      status:             subscription.status,
      billingCycle:       subscription.billingCycle,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd:   subscription.currentPeriodEnd,
      paymentReference:   subscription.paymentReference,
      plan:               subscription.plan,
    },
    plans,
    activeMembers,
    memberLimit:  limit,
    usagePercent,
  })
})

// POST /api/subscriptions/switch-plan — mudar de plano (upgrade ou downgrade)
router.post('/switch-plan', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { planCode, billingCycle, paymentReference } = z.object({
      planCode:         z.string(),
      billingCycle:     z.enum(['MONTHLY', 'ANNUAL']).default('MONTHLY'),
      paymentReference: z.string().optional(),
    }).parse(req.body)

    const clubId = req.user!.clubId

    const newPlan = await prisma.plan.findUnique({ where: { code: planCode } })
    if (!newPlan || !newPlan.isActive) return res.status(404).json({ error: 'Plano não encontrado.' })

    // verificar downgrade: activos <= limite do novo plano
    if (newPlan.memberLimit !== null) {
      const activeCount = await prisma.member.count({ where: { clubId, status: 'ACTIVE' } })
      if (activeCount > newPlan.memberLimit) {
        return res.status(422).json({
          error: `Não é possível mudar para o plano ${newPlan.name}: tens ${activeCount} membros activos e este plano tem limite de ${newPlan.memberLimit}. Remove ou desactiva membros primeiro.`,
        })
      }
    }

    const now   = new Date()
    const end   = new Date(now)
    end.setMonth(end.getMonth() + (billingCycle === 'ANNUAL' ? 12 : 1))

    const subscription = await prisma.subscription.upsert({
      where:  { clubId },
      update: {
        planId:             newPlan.id,
        billingCycle,
        status:             'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd:   end,
        ...(paymentReference && { paymentReference }),
      },
      create: {
        clubId,
        planId:             newPlan.id,
        billingCycle,
        status:             'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd:   end,
        paymentReference:   paymentReference ?? null,
      },
      include: { plan: true },
    })

    return res.json(subscription)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PAGAMENTOS VIA TRANSFERÊNCIA BANCÁRIA
// ─────────────────────────────────────────────────────────────────────────────

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `RNG-${year}-`
  const last = await prisma.subscriptionPayment.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
  })
  const lastNum = last ? parseInt(last.invoiceNumber.split('-')[2], 10) : 0
  return `${prefix}${String(lastNum + 1).padStart(4, '0')}`
}

// GET /api/subscriptions/payment/pending — pedido pendente ou com comprovante (para retoma de fluxo)
router.get('/payment/pending', requirePermission('SUBSCRIPTIONS'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const planConfigs = readPlanCache() ?? []
    const payment = await prisma.subscriptionPayment.findFirst({
      where: {
        clubId: req.user!.clubId,
        status: { in: ['PENDING_PROOF', 'PROOF_UPLOADED'] },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!payment) return res.json(null)

    const plan = planConfigs.find((p: any) => p.key === payment.planCode)
    const club = await prisma.club.findUnique({
      where: { id: req.user!.clubId },
      select: { name: true, acronym: true },
    })
    return res.json({
      ...payment,
      planName:    plan?.name ?? payment.planCode,
      clubName:    club?.name ?? '',
      bankHolder:  process.env.BANK_HOLDER  ?? '',
      bankName:    process.env.BANK_NAME    ?? '',
      bankIban:    process.env.BANK_IBAN    ?? '',
      bankAccount: process.env.BANK_ACCOUNT ?? '',
    })
  } catch (err) { next(err) }
})

// POST /api/subscriptions/payment — criar pedido de pagamento (gera fatura)
router.post('/payment', requirePermission('SUBSCRIPTIONS'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { planCode, billingCycle } = z.object({
      planCode:     z.string(),
      billingCycle: z.enum(['MONTHLY', 'ANNUAL']),
    }).parse(req.body)

    // Ler plano do file cache (configurado em /platform-admin/plans)
    const planConfigs = readPlanCache() ?? []
    const plan = planConfigs.find((p: any) => p.key === planCode && p.active !== false)
    if (!plan) return res.status(404).json({ error: 'Plano não encontrado' })

    const months = billingCycle === 'ANNUAL' ? 12 : 1
    const tier   = plan.pricingTiers?.find((t: any) => t.months === months)
               ?? plan.pricingTiers?.[0]
    if (!tier) return res.status(400).json({ error: 'Plano sem preço configurado' })

    const amountKz      = tier.totalPrice as number
    const invoiceNumber = await generateInvoiceNumber()

    const club = await prisma.club.findUnique({
      where: { id: req.user!.clubId },
      select: { name: true, acronym: true },
    })

    const payment = await prisma.subscriptionPayment.create({
      data: { clubId: req.user!.clubId, planCode, billingCycle, amountKz, invoiceNumber },
    })

    return res.status(201).json({
      ...payment,
      planName:  plan.name,
      clubName:  club?.name,
      clubAcronym: club?.acronym,
      bankHolder:  process.env.BANK_HOLDER  ?? '',
      bankName:    process.env.BANK_NAME    ?? '',
      bankIban:    process.env.BANK_IBAN    ?? '',
      bankAccount: process.env.BANK_ACCOUNT ?? '',
    })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    next(err)
  }
})

// POST /api/subscriptions/payment/:id/proof — upload comprovante
router.post('/payment/:id/proof', requirePermission('SUBSCRIPTIONS'), upload.single('proof'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payment = await prisma.subscriptionPayment.findFirst({
      where: { id: req.params.id, clubId: req.user!.clubId },
    })
    if (!payment) return res.status(404).json({ error: 'Pedido não encontrado' })
    if (payment.status === 'APPROVED') return res.status(409).json({ error: 'Pagamento já aprovado' })

    if (!req.file) return res.status(400).json({ error: 'Ficheiro em falta' })

    const proofUrl = await uploadDocumentToCloudinary(req.file.buffer, `subscriptions/${payment.clubId}/proofs`)

    const updated = await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { proofUrl, status: 'PROOF_UPLOADED' },
    })

    const notifyEmail = process.env.PLATFORM_NOTIFY_EMAIL ?? process.env.PLATFORM_ADMIN_EMAIL
    if (notifyEmail) {
      const club = await prisma.club.findUnique({ where: { id: payment.clubId }, select: { name: true } })
      const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
      // proofUrl é um path relativo (/uploads/...) — converter para URL absoluta para o email
      const absoluteProofUrl = proofUrl.startsWith('http') ? proofUrl : `${clientUrl}${proofUrl}`
      await sendPaymentProofReceived({
        to: notifyEmail,
        clubName:     club?.name ?? payment.clubId,
        invoiceNumber: payment.invoiceNumber,
        planCode:     payment.planCode,
        billingCycle: payment.billingCycle,
        amountKz:     payment.amountKz,
        proofUrl:     absoluteProofUrl,
        adminUrl: `${clientUrl}/platform-admin/payment-requests`,
      })
    }

    return res.json(updated)
  } catch (err) { next(err) }
})

// GET /api/subscriptions/payments — histórico de pagamentos do clube
router.get('/payments', async (req: AuthRequest, res: Response) => {
  const payments = await prisma.subscriptionPayment.findMany({
    where:   { clubId: req.user!.clubId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return res.json(payments)
})

// GET /api/subscriptions/payment/:id — detalhes de um pagamento específico
router.get('/payment/:id', async (req: AuthRequest, res: Response) => {
  const payment = await prisma.subscriptionPayment.findFirst({
    where: { id: req.params.id, clubId: req.user!.clubId },
  })
  if (!payment) return res.status(404).json({ error: 'Pedido não encontrado' })
  return res.json(payment)
})

export default router
