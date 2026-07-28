"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const plans_1 = require("../lib/plans");
const email_1 = require("../services/email");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// GET /api/subscriptions/me — estado actual do plano do clube
router.get('/me', async (req, res) => {
    const club = await prisma_1.prisma.club.findUnique({
        where: { id: req.user.clubId },
        select: { plan: true, planStatus: true, trialEndsAt: true, planExpiresAt: true },
    });
    if (!club)
        return res.status(404).json({ error: 'Clube não encontrado' });
    const plan = club.plan;
    const limits = (0, plans_1.getEffectiveLimits)(plan, club.planStatus, club.trialEndsAt);
    const [membersCount, raidsThisMonth] = await Promise.all([
        prisma_1.prisma.member.count({ where: { clubId: req.user.clubId, status: 'ACTIVE' } }),
        prisma_1.prisma.raid.count({
            where: {
                clubId: req.user.clubId,
                createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
            },
        }),
    ]);
    return res.json({
        plan,
        planLabel: plans_1.PLAN_LABELS[plan],
        planStatus: club.planStatus,
        trialEndsAt: club.trialEndsAt,
        planExpiresAt: club.planExpiresAt,
        limits,
        usage: { membersCount, raidsThisMonth },
        prices: plans_1.PLAN_PRICES[plan],
        allPlans: Object.entries(plans_1.PLAN_LIMITS).map(([key, l]) => ({
            key,
            label: plans_1.PLAN_LABELS[key],
            limits: l,
            prices: plans_1.PLAN_PRICES[key],
            current: key === plan,
        })),
    });
});
// POST /api/subscriptions/request-upgrade — clube pede upgrade (guarda em BD + envia email)
router.post('/request-upgrade', (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const { plan } = zod_1.z.object({ plan: zod_1.z.enum(['STARTER', 'PRO', 'ENTERPRISE']) }).parse(req.body);
        const club = await prisma_1.prisma.club.findUnique({
            where: { id: req.user.clubId },
            select: { name: true, location: true, plan: true },
        });
        const adminUser = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { email: true },
        });
        if (!club || !adminUser)
            return res.status(404).json({ error: 'Clube não encontrado' });
        // Verificar se já existe pedido pendente para o mesmo plano
        const existing = await prisma_1.prisma.subscriptionRequest.findFirst({
            where: { clubId: req.user.clubId, requestedPlan: plan, status: 'PENDING' },
        });
        if (existing)
            return res.status(409).json({ error: 'Já existe um pedido pendente para este plano.' });
        await prisma_1.prisma.subscriptionRequest.create({
            data: {
                clubId: req.user.clubId,
                requestedPlan: plan,
                currentPlan: club.plan,
                requestedBy: adminUser.email,
                status: 'PENDING',
            },
        });
        const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL;
        if (platformAdminEmail) {
            const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
            await (0, email_1.sendUpgradeRequest)({
                to: platformAdminEmail,
                clubName: club.name,
                clubLocation: club.location,
                currentPlan: plans_1.PLAN_LABELS[club.plan] ?? club.plan,
                requestedPlan: plans_1.PLAN_LABELS[plan] ?? plan,
                clubAdminEmail: adminUser.email,
                adminUrl: `${clientUrl}/platform-admin/requests`,
            });
        }
        return res.json({ message: 'Pedido enviado. Serás contactado para concluir o processo.' });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// POST /api/subscriptions/upgrade — restrito a platform admins
// Actualiza o Club (legacy) E o Subscription (novo sistema) para manter ambos sincronizados
router.post('/upgrade', auth_1.requirePlatformAdmin, async (req, res) => {
    try {
        const { clubId, planCode, billingCycle, planStatus, trialEndsAt, planExpiresAt } = zod_1.z.object({
            clubId: zod_1.z.string(),
            planCode: zod_1.z.string(),
            billingCycle: zod_1.z.enum(['MONTHLY', 'ANNUAL']).default('MONTHLY'),
            planStatus: zod_1.z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED']).default('ACTIVE'),
            trialEndsAt: zod_1.z.string().optional(),
            planExpiresAt: zod_1.z.string().optional(),
        }).parse(req.body);
        const newPlan = await prisma_1.prisma.plan.findUnique({ where: { code: planCode } });
        if (!newPlan)
            return res.status(404).json({ error: `Plano "${planCode}" não encontrado.` });
        const now = new Date();
        const periodEnd = planExpiresAt ? new Date(planExpiresAt) : (() => {
            const d = new Date(now);
            d.setMonth(d.getMonth() + (billingCycle === 'ANNUAL' ? 12 : 1));
            return d;
        })();
        const subscription = await prisma_1.prisma.subscription.upsert({
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
        });
        return res.json({ subscription });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// NOVO SISTEMA — baseado nos modelos Plan + Subscription
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscriptions/current — subscrição actual + uso de membros
router.get('/current', async (req, res) => {
    const clubId = req.user.clubId;
    const [subscription, activeMembers] = await Promise.all([
        prisma_1.prisma.subscription.findUnique({
            where: { clubId },
            include: { plan: true },
        }),
        prisma_1.prisma.member.count({ where: { clubId, status: 'ACTIVE' } }),
    ]);
    if (!subscription) {
        // club sem subscrição — devolver estado vazio
        const plans = await prisma_1.prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthlyKz: 'asc' } });
        return res.json({ subscription: null, plans, activeMembers, memberLimit: null, usagePercent: 0 });
    }
    const limit = subscription.plan.memberLimit;
    const usagePercent = limit ? Math.round((activeMembers / limit) * 100) : 0;
    const plans = await prisma_1.prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthlyKz: 'asc' } });
    return res.json({
        subscription: {
            id: subscription.id,
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            paymentReference: subscription.paymentReference,
            plan: subscription.plan,
        },
        plans,
        activeMembers,
        memberLimit: limit,
        usagePercent,
    });
});
// POST /api/subscriptions/switch-plan — mudar de plano (upgrade ou downgrade)
router.post('/switch-plan', (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const { planCode, billingCycle, paymentReference } = zod_1.z.object({
            planCode: zod_1.z.string(),
            billingCycle: zod_1.z.enum(['MONTHLY', 'ANNUAL']).default('MONTHLY'),
            paymentReference: zod_1.z.string().optional(),
        }).parse(req.body);
        const clubId = req.user.clubId;
        const newPlan = await prisma_1.prisma.plan.findUnique({ where: { code: planCode } });
        if (!newPlan || !newPlan.isActive)
            return res.status(404).json({ error: 'Plano não encontrado.' });
        // verificar downgrade: activos <= limite do novo plano
        if (newPlan.memberLimit !== null) {
            const activeCount = await prisma_1.prisma.member.count({ where: { clubId, status: 'ACTIVE' } });
            if (activeCount > newPlan.memberLimit) {
                return res.status(422).json({
                    error: `Não é possível mudar para o plano ${newPlan.name}: tens ${activeCount} membros activos e este plano tem limite de ${newPlan.memberLimit}. Remove ou desactiva membros primeiro.`,
                });
            }
        }
        const now = new Date();
        const end = new Date(now);
        end.setMonth(end.getMonth() + (billingCycle === 'ANNUAL' ? 12 : 1));
        const subscription = await prisma_1.prisma.subscription.upsert({
            where: { clubId },
            update: {
                planId: newPlan.id,
                billingCycle,
                status: 'ACTIVE',
                currentPeriodStart: now,
                currentPeriodEnd: end,
                ...(paymentReference && { paymentReference }),
            },
            create: {
                clubId,
                planId: newPlan.id,
                billingCycle,
                status: 'ACTIVE',
                currentPeriodStart: now,
                currentPeriodEnd: end,
                paymentReference: paymentReference ?? null,
            },
            include: { plan: true },
        });
        return res.json(subscription);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
exports.default = router;
//# sourceMappingURL=subscriptions.js.map