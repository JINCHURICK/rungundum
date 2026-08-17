import { Router, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requirePlatformAdmin, AuthRequest, invalidateClubStatusCache } from '../middleware/auth'
import { PLAN_LABELS, PLAN_LIMITS, PLAN_PRICES, type PlanKey } from '../lib/plans'
import { readPlanCache, writePlanCache } from '../lib/plan-cache'
import { recreatePrismaClient } from '../lib/prisma'
import { sendSubscriptionApproved, sendSubscriptionRejected } from '../services/email'

const router = Router()
router.use(authenticate, requirePlatformAdmin)

function clubTrialDaysLeft(trialEndsAt: Date | null) {
  if (!trialEndsAt) return null
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
}


// Migra formato antigo para o novo (pricingTiers + features + highlight)
function migrateLegacyConfig(c: any): any {
  let pricingTiers = c.pricingTiers
  if (!pricingTiers) {
    const months = c.periodMonths ?? 12
    pricingTiers = (c.price !== null && c.price !== undefined && c.price > 0)
      ? [{ months, pricePerMonth: Math.round(c.price / months), totalPrice: c.price, label: months === 1 ? 'Mensal' : months === 12 ? 'Anual' : `${months} meses` }]
      : []
  }
  const autoFeatures: string[] = []
  if (c.maxMembers !== null && c.maxMembers !== undefined) autoFeatures.push(`Até ${c.maxMembers} membros`)
  else autoFeatures.push('Membros ilimitados')
  if (c.maxRaidsPerMonth !== null && c.maxRaidsPerMonth !== undefined) autoFeatures.push(`${c.maxRaidsPerMonth} raids/mês`)
  else autoFeatures.push('Raids ilimitados')
  if (c.emailNotifications) autoFeatures.push('Notificações por email')
  const { price, periodMonths, ...rest } = c
  return {
    ...rest,
    contactOnly: c.contactOnly ?? (c.price === null && !pricingTiers.length),
    highlight:   c.highlight ?? false,
    features:    c.features ?? autoFeatures,
    pricingTiers,
  }
}

async function getPlanConfigs() {
  // Try file cache first — always available, no Prisma needed
  const cached = readPlanCache()
  if (cached && cached.length > 0) return cached.map(migrateLegacyConfig)

  // File cache empty or missing — try DB
  try {
    const settings = await prisma.platformSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', planConfigs: [] },
      update: {},
    })
    const raw = settings.planConfigs as any[]
    const configs = raw.map(migrateLegacyConfig)
    writePlanCache(configs)
    return configs
  } catch (err: any) {
    if (err?.name === 'PrismaClientRustPanicError') recreatePrismaClient()
    console.error('[plan-configs] DB read failed:', err?.message ?? err)
    return []
  }
}

// GET /api/platform-admin/stats
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  const [totalClubs, totalMembers, totalRaids, planGroups, statusGroups, recentClubs, pendingRequests] = await Promise.all([
    prisma.club.count(),
    prisma.member.count({ where: { status: 'ACTIVE' } }),
    prisma.raid.count(),
    prisma.club.groupBy({ by: ['plan'], _count: { id: true } }),
    prisma.club.groupBy({ by: ['planStatus'], _count: { id: true } }),
    prisma.club.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, acronym: true, location: true,
        plan: true, planStatus: true, trialEndsAt: true, createdAt: true,
        _count: { select: { members: { where: { status: 'ACTIVE' } } } },
      },
    }),
    prisma.subscriptionRequest.count({ where: { status: 'PENDING' } }),
  ])

  const trialClubs = statusGroups.find((g) => g.planStatus === 'TRIAL')?._count.id ?? 0
  const expiringSoon = await prisma.club.count({
    where: {
      planStatus: 'TRIAL',
      trialEndsAt: { lte: new Date(Date.now() + 7 * 86400000), gte: new Date() },
    },
  })

  return res.json({
    totalClubs, totalMembers, totalRaids, trialClubs, expiringSoon, pendingRequests,
    planBreakdown: planGroups.map((g) => ({
      plan: g.plan, label: PLAN_LABELS[g.plan as PlanKey] ?? g.plan, count: g._count.id,
    })),
    statusBreakdown: statusGroups.map((g) => ({ status: g.planStatus, count: g._count.id })),
    recentClubs: recentClubs.map((c) => ({
      ...c, planLabel: PLAN_LABELS[c.plan as PlanKey] ?? c.plan,
      membersCount: c._count.members, trialDaysLeft: clubTrialDaysLeft(c.trialEndsAt),
    })),
  })
})

// GET /api/platform-admin/clubs
router.get('/clubs', async (_req: AuthRequest, res: Response) => {
  const clubs = await prisma.club.findMany({
    select: {
      id: true, name: true, acronym: true, location: true, country: true,
      plan: true, planStatus: true, trialEndsAt: true, planExpiresAt: true, createdAt: true,
      accentColor: true, logoUrl: true,
      _count: { select: { members: { where: { status: 'ACTIVE' } }, raids: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return res.json(clubs.map((c) => ({
    ...c, planLabel: PLAN_LABELS[c.plan as PlanKey] ?? c.plan,
    membersCount: c._count.members, raidsCount: c._count.raids,
    trialDaysLeft: clubTrialDaysLeft(c.trialEndsAt),
  })))
})

// GET /api/platform-admin/clubs/:id
router.get('/clubs/:id', async (req: AuthRequest, res: Response) => {
  const club = await prisma.club.findUnique({
    where: { id: req.params.id },
    include: {
      members: {
        select: {
          id: true, fullName: true, nickname: true, memberNumber: true,
          status: true, joinedAt: true, phone: true,
          user: { select: { email: true, role: true, emailVerified: true } },
        },
        orderBy: { fullName: 'asc' },
      },
      _count: { select: { raids: true, members: { where: { status: 'ACTIVE' } } } },
    },
  })
  if (!club) return res.status(404).json({ error: 'Clube não encontrado' })
  return res.json({
    ...club, planLabel: PLAN_LABELS[club.plan as PlanKey] ?? club.plan,
    membersCount: club._count.members, raidsCount: club._count.raids,
    trialDaysLeft: clubTrialDaysLeft(club.trialEndsAt),
  })
})

// PATCH /api/platform-admin/clubs/:id/subscription
router.patch('/clubs/:id/subscription', async (req: AuthRequest, res: Response) => {
  try {
    const { plan, planStatus, trialEndsAt, planExpiresAt } = z.object({
      plan: z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']).optional(),
      planStatus: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED']).optional(),
      trialEndsAt: z.string().nullable().optional(),
      planExpiresAt: z.string().nullable().optional(),
    }).parse(req.body)

    const club = await prisma.club.update({
      where: { id: req.params.id },
      data: {
        ...(plan && { plan }),
        ...(planStatus && { planStatus }),
        ...(trialEndsAt !== undefined && { trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null }),
        ...(planExpiresAt !== undefined && { planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : null }),
      },
      select: { id: true, plan: true, planStatus: true, trialEndsAt: true, planExpiresAt: true },
    })
    if (planStatus) invalidateClubStatusCache(club.id)
    return res.json({ ...club, planLabel: PLAN_LABELS[club.plan as PlanKey] ?? club.plan })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// PATCH /api/platform-admin/clubs/:id/notifications
router.patch('/clubs/:id/notifications', async (req: AuthRequest, res: Response) => {
  try {
    const { notificationMode } = z.object({
      notificationMode: z.enum(['BOTH', 'SMS_ONLY', 'EMAIL_ONLY', 'NONE']),
    }).parse(req.body)

    const club = await prisma.club.findUnique({ where: { id: req.params.id }, select: { defaultSettings: true } })
    if (!club) return res.status(404).json({ error: 'Clube não encontrado' })

    const settings = (club.defaultSettings ?? {}) as Record<string, any>
    await prisma.club.update({
      where: { id: req.params.id },
      data: { defaultSettings: { ...settings, notificationMode } },
    })
    return res.json({ notificationMode })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// GET /api/platform-admin/subscription-requests
router.get('/subscription-requests', async (req: AuthRequest, res: Response) => {
  const status = (req.query.status as string | undefined) ?? undefined
  const requests = await prisma.subscriptionRequest.findMany({
    where: status ? { status: status as any } : undefined,
    include: {
      club: {
        select: {
          id: true, name: true, acronym: true, location: true,
          plan: true, planStatus: true, trialEndsAt: true, planExpiresAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return res.json(requests.map((r) => ({
    ...r,
    requestedPlanLabel: PLAN_LABELS[r.requestedPlan as PlanKey] ?? r.requestedPlan,
    currentPlanLabel: PLAN_LABELS[r.currentPlan as PlanKey] ?? r.currentPlan,
  })))
})

// PATCH /api/platform-admin/subscription-requests/:id — aprovar ou rejeitar
router.patch('/subscription-requests/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { action, reviewNotes, plan, planStatus, planExpiresAt, trialEndsAt } = z.object({
      action: z.enum(['APPROVED', 'REJECTED']),
      reviewNotes: z.string().optional(),
      plan: z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']).optional(),
      planStatus: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED']).optional(),
      planExpiresAt: z.string().nullable().optional(),
      trialEndsAt: z.string().nullable().optional(),
    }).parse(req.body)

    const request = await prisma.subscriptionRequest.findUnique({
      where: { id: req.params.id },
      include: { club: { select: { id: true } } },
    })
    if (!request) return res.status(404).json({ error: 'Pedido não encontrado' })
    if (request.status !== 'PENDING') return res.status(409).json({ error: 'Pedido já processado' })

    const updated = await prisma.subscriptionRequest.update({
      where: { id: req.params.id },
      data: {
        status: action,
        reviewNotes: reviewNotes ?? null,
        reviewedAt: new Date(),
      },
    })

    // Se aprovado, atualizar o plano do clube
    if (action === 'APPROVED' && plan) {
      await prisma.club.update({
        where: { id: request.clubId },
        data: {
          plan,
          ...(planStatus && { planStatus }),
          ...(planExpiresAt !== undefined && { planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : null }),
          ...(trialEndsAt !== undefined && { trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null }),
        },
      })
      invalidateClubStatusCache(request.clubId)
    }

    return res.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/platform-admin/create-admin — criar conta de platform admin sem clube
router.post('/create-admin', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    }).parse(req.body)

    if (await prisma.user.findUnique({ where: { email } })) {
      return res.status(400).json({ error: 'Email já registado' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        clubId: null,
        email,
        passwordHash,
        role: 'ADMIN',
        emailVerified: true,
        platformAdmin: true,
      },
    })

    return res.status(201).json({ id: user.id, email: user.email })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// GET /api/platform-admin/plan-configs
router.get('/plan-configs', async (_req: AuthRequest, res: Response) => {
  const configs = await getPlanConfigs()
  return res.json(configs)
})

// PUT /api/platform-admin/plan-configs — substituir toda a configuração de planos
router.put('/plan-configs', async (req: AuthRequest, res: Response) => {
  try {
    const pricingTierSchema = z.object({
      months:        z.number().int().min(1),
      pricePerMonth: z.number().min(0),
      totalPrice:    z.number().min(0),
      label:         z.string().default(''),
    })
    const configs = z.array(z.object({
      key:                z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']),
      name:               z.string().min(1),
      description:        z.string().default(''),
      currency:           z.string().default('Kz'),
      contactOnly:        z.boolean().default(false),
      highlight:          z.boolean().default(false),
      maxMembers:         z.number().int().nullable(),
      maxRaidsPerMonth:   z.number().int().nullable(),
      emailNotifications: z.boolean().default(false),
      leaguesEnabled:     z.boolean().default(false),
      active:             z.boolean().default(true),
      displayOrder:       z.number().int().default(0),
      features:           z.array(z.string()).default([]),
      pricingTiers:       z.array(pricingTierSchema).default([]),
    })).parse(req.body)

    // Escrever ficheiro de cache PRIMEIRO — o endpoint público lê deste ficheiro
    const written = writePlanCache(configs)
    if (!written) console.error('[plan-configs] WARNING: file cache write failed — public plans will not update')

    // Persistir na BD de forma assíncrona — não bloqueia a resposta
    prisma.platformSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', planConfigs: configs },
      update: { planConfigs: configs },
    }).catch((err: any) => {
      if (err?.name === 'PrismaClientRustPanicError') recreatePrismaClient()
      console.error('[plan-configs] DB save failed:', err?.message ?? err)
    })

    return res.json(configs)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PEDIDOS DE PAGAMENTO — COMPROVANTES DE TRANSFERÊNCIA
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/platform-admin/payment-requests
router.get('/payment-requests', async (_req: AuthRequest, res: Response) => {
  const payments = await prisma.subscriptionPayment.findMany({
    include: { club: { select: { id: true, name: true, acronym: true, location: true, plan: true, planStatus: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return res.json(payments)
})

// PATCH /api/platform-admin/payment-requests/:id — aprovar ou rejeitar
router.patch('/payment-requests/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { action, renewMonths, reviewNotes } = z.object({
      action:      z.enum(['APPROVE', 'REJECT']),
      renewMonths: z.number().int().min(1).max(36).optional(),
      reviewNotes: z.string().optional(),
    }).parse(req.body)

    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: req.params.id },
      include: { club: { select: { name: true, planExpiresAt: true } } },
    })
    if (!payment) return res.status(404).json({ error: 'Pedido não encontrado' })
    if (payment.status === 'APPROVED') return res.status(409).json({ error: 'Já aprovado' })

    const now = new Date()

    if (action === 'APPROVE') {
      if (!renewMonths) return res.status(400).json({ error: 'Número de meses obrigatório para aprovar' })

      // Calcula nova data de expiração (soma ao período actual se ainda não expirou)
      const base = payment.club.planExpiresAt && payment.club.planExpiresAt > now
        ? payment.club.planExpiresAt : now
      const newExpiry = new Date(base)
      newExpiry.setMonth(newExpiry.getMonth() + renewMonths)

      // Mapeia planCode para o enum ClubPlan (compatibilidade legacy)
      const planMap: Record<string, string> = { FREE: 'FREE', STARTER: 'STARTER', PRO: 'PRO', ENTERPRISE: 'ENTERPRISE' }
      const newPlan = planMap[payment.planCode.toUpperCase()] ?? 'STARTER'

      await prisma.$transaction([
        prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: { status: 'APPROVED', reviewNotes: reviewNotes ?? null, reviewedAt: now, renewMonths, reviewedBy: req.user!.userId },
        }),
        prisma.club.update({
          where: { id: payment.clubId },
          data: { plan: newPlan as any, planStatus: 'ACTIVE', planExpiresAt: newExpiry },
        }),
      ])

      invalidateClubStatusCache(payment.clubId)

      // Sincroniza também o modelo Subscription (novo sistema)
      const plan = await prisma.plan.findFirst({
        where: { code: { equals: payment.planCode, mode: 'insensitive' } },
      })
      if (plan) {
        await prisma.subscription.upsert({
          where:  { clubId: payment.clubId },
          update: { planId: plan.id, billingCycle: payment.billingCycle, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: newExpiry },
          create: { clubId: payment.clubId, planId: plan.id, billingCycle: payment.billingCycle, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: newExpiry },
        })
      }

      const adminUser = await prisma.user.findFirst({
        where: { clubId: payment.clubId, role: { in: ['ADMIN', 'APP_ADMIN'] } },
        select: { email: true },
      })
      if (adminUser) {
        await sendSubscriptionApproved({
          to: adminUser.email, clubName: payment.club.name,
          invoiceNumber: payment.invoiceNumber, planCode: payment.planCode,
          renewMonths, newExpiry, clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
        })
      }
    } else {
      await prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: 'REJECTED', reviewNotes: reviewNotes ?? null, reviewedAt: now, reviewedBy: req.user!.userId },
      })

      const adminUser = await prisma.user.findFirst({
        where: { clubId: payment.clubId, role: { in: ['ADMIN', 'APP_ADMIN'] } },
        select: { email: true },
      })
      if (adminUser) {
        await sendSubscriptionRejected({
          to: adminUser.email, clubName: payment.club.name,
          invoiceNumber: payment.invoiceNumber, reviewNotes: reviewNotes ?? '',
          clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
        })
      }
    }

    return res.json({ message: action === 'APPROVE' ? 'Subscrição aprovada com sucesso' : 'Pedido rejeitado' })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    next(err)
  }
})

export default router
