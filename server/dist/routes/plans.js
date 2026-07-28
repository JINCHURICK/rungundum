"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
const DEFAULT_PLAN_CONFIGS = [
    {
        key: 'PRO', name: 'Motard',
        description: 'Plataforma completa de gestão para moto clubes angolanos',
        currency: 'Kz', contactOnly: false, highlight: true,
        maxMembers: null, active: true, displayOrder: 0,
        features: ['Membros ilimitados', 'Raids ilimitados', 'Gestão de quotas', 'Notificações por email', 'Plano de contingência', 'Estatísticas e CSV'],
        pricingTiers: [
            { months: 1, pricePerMonth: 12000, totalPrice: 12000, label: 'Mensal' },
            { months: 12, pricePerMonth: 9500, totalPrice: 114000, label: 'Anual' },
        ],
    },
];
// GET /api/plans/public — público, retorna configurações geridas pelo platform admin
router.get('/public', async (_req, res) => {
    const settings = await prisma_1.prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    const raw = settings?.planConfigs ?? [];
    const configs = raw.length ? raw : DEFAULT_PLAN_CONFIGS;
    return res.json(configs
        .filter((c) => c.active !== false)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)));
});
// GET /api/plans — público, sem autenticação (legado)
router.get('/', async (_req, res) => {
    const plans = await prisma_1.prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { priceMonthlyKz: 'asc' },
        select: { id: true, code: true, name: true, priceMonthlyKz: true, priceAnnualKz: true, memberLimit: true, isActive: true },
    });
    return res.json(plans);
});
exports.default = router;
//# sourceMappingURL=plans.js.map