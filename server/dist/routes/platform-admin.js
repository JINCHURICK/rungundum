"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const plans_1 = require("../lib/plans");
const plan_cache_1 = require("../lib/plan-cache");
const prisma_2 = require("../lib/prisma");
const email_1 = require("../services/email");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requirePlatformAdmin);
function clubTrialDaysLeft(trialEndsAt) {
    if (!trialEndsAt)
        return null;
    return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000));
}
// Migra formato antigo para o novo (pricingTiers + features + highlight)
function migrateLegacyConfig(c) {
    let pricingTiers = c.pricingTiers;
    if (!pricingTiers) {
        const months = c.periodMonths ?? 12;
        pricingTiers = (c.price !== null && c.price !== undefined && c.price > 0)
            ? [{ months, pricePerMonth: Math.round(c.price / months), totalPrice: c.price, label: months === 1 ? 'Mensal' : months === 12 ? 'Anual' : `${months} meses` }]
            : [];
    }
    const autoFeatures = [];
    if (c.maxMembers !== null && c.maxMembers !== undefined)
        autoFeatures.push(`Até ${c.maxMembers} membros`);
    else
        autoFeatures.push('Membros ilimitados');
    if (c.maxRaidsPerMonth !== null && c.maxRaidsPerMonth !== undefined)
        autoFeatures.push(`${c.maxRaidsPerMonth} raids/mês`);
    else
        autoFeatures.push('Raids ilimitados');
    if (c.emailNotifications)
        autoFeatures.push('Notificações por email');
    const { price, periodMonths, ...rest } = c;
    return {
        ...rest,
        contactOnly: c.contactOnly ?? (c.price === null && !pricingTiers.length),
        highlight: c.highlight ?? false,
        features: c.features ?? autoFeatures,
        pricingTiers,
    };
}
async function getPlanConfigs() {
    // Try file cache first — always available, no Prisma needed
    const cached = (0, plan_cache_1.readPlanCache)();
    if (cached && cached.length > 0)
        return cached.map(migrateLegacyConfig);
    // File cache empty or missing — try DB
    try {
        const settings = await prisma_1.prisma.platformSettings.upsert({
            where: { id: 'singleton' },
            create: { id: 'singleton', planConfigs: [] },
            update: {},
        });
        const raw = settings.planConfigs;
        const configs = raw.map(migrateLegacyConfig);
        (0, plan_cache_1.writePlanCache)(configs);
        return configs;
    }
    catch (err) {
        if (err?.name === 'PrismaClientRustPanicError')
            (0, prisma_2.recreatePrismaClient)();
        console.error('[plan-configs] DB read failed:', err?.message ?? err);
        return [];
    }
}
// GET /api/platform-admin/stats
router.get('/stats', async (_req, res) => {
    const [totalClubs, totalMembers, totalRaids, planGroups, statusGroups, recentClubs, pendingRequests] = await Promise.all([
        prisma_1.prisma.club.count(),
        prisma_1.prisma.member.count({ where: { status: 'ACTIVE' } }),
        prisma_1.prisma.raid.count(),
        prisma_1.prisma.club.groupBy({ by: ['plan'], _count: { id: true } }),
        prisma_1.prisma.club.groupBy({ by: ['planStatus'], _count: { id: true } }),
        prisma_1.prisma.club.findMany({
            take: 6,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, name: true, acronym: true, location: true,
                plan: true, planStatus: true, trialEndsAt: true, createdAt: true,
                _count: { select: { members: { where: { status: 'ACTIVE' } } } },
            },
        }),
        prisma_1.prisma.subscriptionRequest.count({ where: { status: 'PENDING' } }),
    ]);
    const trialClubs = statusGroups.find((g) => g.planStatus === 'TRIAL')?._count.id ?? 0;
    const expiringSoon = await prisma_1.prisma.club.count({
        where: {
            planStatus: 'TRIAL',
            trialEndsAt: { lte: new Date(Date.now() + 7 * 86400000), gte: new Date() },
        },
    });
    return res.json({
        totalClubs, totalMembers, totalRaids, trialClubs, expiringSoon, pendingRequests,
        planBreakdown: planGroups.map((g) => ({
            plan: g.plan, label: plans_1.PLAN_LABELS[g.plan] ?? g.plan, count: g._count.id,
        })),
        statusBreakdown: statusGroups.map((g) => ({ status: g.planStatus, count: g._count.id })),
        recentClubs: recentClubs.map((c) => ({
            ...c, planLabel: plans_1.PLAN_LABELS[c.plan] ?? c.plan,
            membersCount: c._count.members, trialDaysLeft: clubTrialDaysLeft(c.trialEndsAt),
        })),
    });
});
// GET /api/platform-admin/clubs
router.get('/clubs', async (_req, res) => {
    const clubs = await prisma_1.prisma.club.findMany({
        select: {
            id: true, name: true, acronym: true, location: true, country: true,
            plan: true, planStatus: true, trialEndsAt: true, planExpiresAt: true, createdAt: true,
            accentColor: true, logoUrl: true,
            _count: { select: { members: { where: { status: 'ACTIVE' } }, raids: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    return res.json(clubs.map((c) => ({
        ...c, planLabel: plans_1.PLAN_LABELS[c.plan] ?? c.plan,
        membersCount: c._count.members, raidsCount: c._count.raids,
        trialDaysLeft: clubTrialDaysLeft(c.trialEndsAt),
    })));
});
// GET /api/platform-admin/clubs/:id
router.get('/clubs/:id', async (req, res) => {
    const club = await prisma_1.prisma.club.findUnique({
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
    });
    if (!club)
        return res.status(404).json({ error: 'Clube não encontrado' });
    return res.json({
        ...club, planLabel: plans_1.PLAN_LABELS[club.plan] ?? club.plan,
        membersCount: club._count.members, raidsCount: club._count.raids,
        trialDaysLeft: clubTrialDaysLeft(club.trialEndsAt),
    });
});
// PATCH /api/platform-admin/clubs/:id/subscription
router.patch('/clubs/:id/subscription', async (req, res) => {
    try {
        const { plan, planStatus, trialEndsAt, planExpiresAt } = zod_1.z.object({
            plan: zod_1.z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']).optional(),
            planStatus: zod_1.z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED']).optional(),
            trialEndsAt: zod_1.z.string().nullable().optional(),
            planExpiresAt: zod_1.z.string().nullable().optional(),
        }).parse(req.body);
        const club = await prisma_1.prisma.club.update({
            where: { id: req.params.id },
            data: {
                ...(plan && { plan }),
                ...(planStatus && { planStatus }),
                ...(trialEndsAt !== undefined && { trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null }),
                ...(planExpiresAt !== undefined && { planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : null }),
            },
            select: { id: true, plan: true, planStatus: true, trialEndsAt: true, planExpiresAt: true },
        });
        if (planStatus)
            (0, auth_1.invalidateClubStatusCache)(club.id);
        return res.json({ ...club, planLabel: plans_1.PLAN_LABELS[club.plan] ?? club.plan });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// PATCH /api/platform-admin/clubs/:id/notifications
router.patch('/clubs/:id/notifications', async (req, res) => {
    try {
        const { notificationMode } = zod_1.z.object({
            notificationMode: zod_1.z.enum(['BOTH', 'SMS_ONLY', 'EMAIL_ONLY', 'NONE']),
        }).parse(req.body);
        const club = await prisma_1.prisma.club.findUnique({ where: { id: req.params.id }, select: { defaultSettings: true } });
        if (!club)
            return res.status(404).json({ error: 'Clube não encontrado' });
        const settings = (club.defaultSettings ?? {});
        await prisma_1.prisma.club.update({
            where: { id: req.params.id },
            data: { defaultSettings: { ...settings, notificationMode } },
        });
        return res.json({ notificationMode });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// GET /api/platform-admin/subscription-requests
router.get('/subscription-requests', async (req, res) => {
    const status = req.query.status ?? undefined;
    const requests = await prisma_1.prisma.subscriptionRequest.findMany({
        where: status ? { status: status } : undefined,
        include: {
            club: {
                select: {
                    id: true, name: true, acronym: true, location: true,
                    plan: true, planStatus: true, trialEndsAt: true, planExpiresAt: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    return res.json(requests.map((r) => ({
        ...r,
        requestedPlanLabel: plans_1.PLAN_LABELS[r.requestedPlan] ?? r.requestedPlan,
        currentPlanLabel: plans_1.PLAN_LABELS[r.currentPlan] ?? r.currentPlan,
    })));
});
// PATCH /api/platform-admin/subscription-requests/:id — aprovar ou rejeitar
router.patch('/subscription-requests/:id', async (req, res) => {
    try {
        const { action, reviewNotes, plan, planStatus, planExpiresAt, trialEndsAt } = zod_1.z.object({
            action: zod_1.z.enum(['APPROVED', 'REJECTED']),
            reviewNotes: zod_1.z.string().optional(),
            plan: zod_1.z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']).optional(),
            planStatus: zod_1.z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED']).optional(),
            planExpiresAt: zod_1.z.string().nullable().optional(),
            trialEndsAt: zod_1.z.string().nullable().optional(),
        }).parse(req.body);
        const request = await prisma_1.prisma.subscriptionRequest.findUnique({
            where: { id: req.params.id },
            include: { club: { select: { id: true } } },
        });
        if (!request)
            return res.status(404).json({ error: 'Pedido não encontrado' });
        if (request.status !== 'PENDING')
            return res.status(409).json({ error: 'Pedido já processado' });
        const updated = await prisma_1.prisma.subscriptionRequest.update({
            where: { id: req.params.id },
            data: {
                status: action,
                reviewNotes: reviewNotes ?? null,
                reviewedAt: new Date(),
            },
        });
        // Se aprovado, atualizar o plano do clube
        if (action === 'APPROVED' && plan) {
            await prisma_1.prisma.club.update({
                where: { id: request.clubId },
                data: {
                    plan,
                    ...(planStatus && { planStatus }),
                    ...(planExpiresAt !== undefined && { planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : null }),
                    ...(trialEndsAt !== undefined && { trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null }),
                },
            });
            (0, auth_1.invalidateClubStatusCache)(request.clubId);
        }
        return res.json(updated);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// POST /api/platform-admin/create-admin — criar conta de platform admin sem clube
router.post('/create-admin', async (req, res) => {
    try {
        const { email, password } = zod_1.z.object({
            email: zod_1.z.string().email(),
            password: zod_1.z.string().min(8),
        }).parse(req.body);
        if (await prisma_1.prisma.user.findUnique({ where: { email } })) {
            return res.status(400).json({ error: 'Email já registado' });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma_1.prisma.user.create({
            data: {
                clubId: null,
                email,
                passwordHash,
                role: 'ADMIN',
                emailVerified: true,
                platformAdmin: true,
            },
        });
        return res.status(201).json({ id: user.id, email: user.email });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// GET /api/platform-admin/plan-configs
router.get('/plan-configs', async (_req, res) => {
    const configs = await getPlanConfigs();
    return res.json(configs);
});
// PUT /api/platform-admin/plan-configs — substituir toda a configuração de planos
router.put('/plan-configs', async (req, res) => {
    try {
        const pricingTierSchema = zod_1.z.object({
            months: zod_1.z.number().int().min(1),
            pricePerMonth: zod_1.z.number().min(0),
            totalPrice: zod_1.z.number().min(0),
            label: zod_1.z.string().default(''),
        });
        const configs = zod_1.z.array(zod_1.z.object({
            key: zod_1.z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']),
            name: zod_1.z.string().min(1),
            description: zod_1.z.string().default(''),
            currency: zod_1.z.string().default('Kz'),
            contactOnly: zod_1.z.boolean().default(false),
            highlight: zod_1.z.boolean().default(false),
            maxMembers: zod_1.z.number().int().nullable(),
            maxRaidsPerMonth: zod_1.z.number().int().nullable(),
            emailNotifications: zod_1.z.boolean().default(false),
            leaguesEnabled: zod_1.z.boolean().default(false),
            active: zod_1.z.boolean().default(true),
            displayOrder: zod_1.z.number().int().default(0),
            features: zod_1.z.array(zod_1.z.string()).default([]),
            pricingTiers: zod_1.z.array(pricingTierSchema).default([]),
        })).parse(req.body);
        // Escrever ficheiro de cache PRIMEIRO — o endpoint público lê deste ficheiro
        const written = (0, plan_cache_1.writePlanCache)(configs);
        if (!written)
            console.error('[plan-configs] WARNING: file cache write failed — public plans will not update');
        // Persistir na BD de forma assíncrona — não bloqueia a resposta
        prisma_1.prisma.platformSettings.upsert({
            where: { id: 'singleton' },
            create: { id: 'singleton', planConfigs: configs },
            update: { planConfigs: configs },
        }).catch((err) => {
            if (err?.name === 'PrismaClientRustPanicError')
                (0, prisma_2.recreatePrismaClient)();
            console.error('[plan-configs] DB save failed:', err?.message ?? err);
        });
        return res.json(configs);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// PEDIDOS DE PAGAMENTO — COMPROVANTES DE TRANSFERÊNCIA
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/platform-admin/payment-requests
router.get('/payment-requests', async (_req, res) => {
    const payments = await prisma_1.prisma.subscriptionPayment.findMany({
        include: { club: { select: { id: true, name: true, acronym: true, location: true, plan: true, planStatus: true } } },
        orderBy: { createdAt: 'desc' },
    });
    return res.json(payments);
});
// PATCH /api/platform-admin/payment-requests/:id — aprovar ou rejeitar
router.patch('/payment-requests/:id', async (req, res, next) => {
    try {
        const { action, renewMonths, reviewNotes } = zod_1.z.object({
            action: zod_1.z.enum(['APPROVE', 'REJECT']),
            renewMonths: zod_1.z.number().int().min(1).max(36).optional(),
            reviewNotes: zod_1.z.string().optional(),
        }).parse(req.body);
        const payment = await prisma_1.prisma.subscriptionPayment.findUnique({
            where: { id: req.params.id },
            include: { club: { select: { name: true, planExpiresAt: true } } },
        });
        if (!payment)
            return res.status(404).json({ error: 'Pedido não encontrado' });
        if (payment.status === 'APPROVED')
            return res.status(409).json({ error: 'Já aprovado' });
        const now = new Date();
        if (action === 'APPROVE') {
            if (!renewMonths)
                return res.status(400).json({ error: 'Número de meses obrigatório para aprovar' });
            // Calcula nova data de expiração (soma ao período actual se ainda não expirou)
            const base = payment.club.planExpiresAt && payment.club.planExpiresAt > now
                ? payment.club.planExpiresAt : now;
            const newExpiry = new Date(base);
            newExpiry.setMonth(newExpiry.getMonth() + renewMonths);
            // Mapeia planCode para o enum ClubPlan (compatibilidade legacy)
            const planMap = { FREE: 'FREE', STARTER: 'STARTER', PRO: 'PRO', ENTERPRISE: 'ENTERPRISE' };
            const newPlan = planMap[payment.planCode.toUpperCase()] ?? 'STARTER';
            await prisma_1.prisma.$transaction([
                prisma_1.prisma.subscriptionPayment.update({
                    where: { id: payment.id },
                    data: { status: 'APPROVED', reviewNotes: reviewNotes ?? null, reviewedAt: now, renewMonths, reviewedBy: req.user.userId },
                }),
                prisma_1.prisma.club.update({
                    where: { id: payment.clubId },
                    data: { plan: newPlan, planStatus: 'ACTIVE', planExpiresAt: newExpiry },
                }),
            ]);
            (0, auth_1.invalidateClubStatusCache)(payment.clubId);
            // Sincroniza também o modelo Subscription (novo sistema)
            const plan = await prisma_1.prisma.plan.findFirst({
                where: { code: { equals: payment.planCode, mode: 'insensitive' } },
            });
            if (plan) {
                await prisma_1.prisma.subscription.upsert({
                    where: { clubId: payment.clubId },
                    update: { planId: plan.id, billingCycle: payment.billingCycle, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: newExpiry },
                    create: { clubId: payment.clubId, planId: plan.id, billingCycle: payment.billingCycle, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: newExpiry },
                });
            }
            const adminUser = await prisma_1.prisma.user.findFirst({
                where: { clubId: payment.clubId, role: { in: ['ADMIN', 'APP_ADMIN'] } },
                select: { email: true },
            });
            if (adminUser) {
                await (0, email_1.sendSubscriptionApproved)({
                    to: adminUser.email, clubName: payment.club.name,
                    invoiceNumber: payment.invoiceNumber, planCode: payment.planCode,
                    renewMonths, newExpiry, clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
                });
            }
        }
        else {
            await prisma_1.prisma.subscriptionPayment.update({
                where: { id: payment.id },
                data: { status: 'REJECTED', reviewNotes: reviewNotes ?? null, reviewedAt: now, reviewedBy: req.user.userId },
            });
            const adminUser = await prisma_1.prisma.user.findFirst({
                where: { clubId: payment.clubId, role: { in: ['ADMIN', 'APP_ADMIN'] } },
                select: { email: true },
            });
            if (adminUser) {
                await (0, email_1.sendSubscriptionRejected)({
                    to: adminUser.email, clubName: payment.club.name,
                    invoiceNumber: payment.invoiceNumber, reviewNotes: reviewNotes ?? '',
                    clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
                });
            }
        }
        return res.json({ message: action === 'APPROVE' ? 'Subscrição aprovada com sucesso' : 'Pedido rejeitado' });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=platform-admin.js.map