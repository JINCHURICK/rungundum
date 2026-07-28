"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const plans_1 = require("../lib/plans");
const plan_cache_1 = require("../lib/plan-cache");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requirePlatformAdmin);
function clubTrialDaysLeft(trialEndsAt) {
    if (!trialEndsAt)
        return null;
    return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000));
}
const DEFAULT_PLAN_CONFIGS = [
    {
        key: 'PRO', name: 'Motard', description: 'Plataforma completa de gestão para moto clubes angolanos',
        currency: 'Kz', contactOnly: false, highlight: true,
        maxMembers: null, maxRaidsPerMonth: null, emailNotifications: true, leaguesEnabled: false,
        active: true, displayOrder: 0,
        features: [
            'Membros ilimitados',
            'Raids ilimitados',
            'Gestão de quotas e pagamentos',
            'Processos disciplinares e suspensões',
            'Envio de SMS para membros',
            'Notificações por email',
            'Plano de contingência por raid',
            'Estatísticas e exportação CSV',
        ],
        pricingTiers: [
            { months: 1, pricePerMonth: 12000, totalPrice: 12000, label: 'Mensal' },
            { months: 12, pricePerMonth: 9500, totalPrice: 114000, label: 'Anual' },
        ],
    },
];
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
    const settings = await prisma_1.prisma.platformSettings.upsert({
        where: { id: 'singleton' },
        create: { id: 'singleton', planConfigs: DEFAULT_PLAN_CONFIGS },
        update: {},
    });
    const raw = settings.planConfigs;
    const configs = raw.length ? raw.map(migrateLegacyConfig) : DEFAULT_PLAN_CONFIGS;
    return configs;
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
        return res.json({ ...club, planLabel: plans_1.PLAN_LABELS[club.plan] ?? club.plan });
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
        }
        return res.json(updated);
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
        const settings = await prisma_1.prisma.platformSettings.upsert({
            where: { id: 'singleton' },
            create: { id: 'singleton', planConfigs: configs },
            update: { planConfigs: configs },
        });
        (0, plan_cache_1.writePlanCache)(configs);
        return res.json(settings.planConfigs);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
exports.default = router;
//# sourceMappingURL=platform-admin.js.map