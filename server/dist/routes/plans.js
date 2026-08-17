"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const plan_cache_1 = require("../lib/plan-cache");
const router = (0, express_1.Router)();
// GET /api/plans/public — reads from file cache (no Prisma); empty if not configured
// File cache is written by PUT /api/platform-admin/plan-configs
router.get('/public', (_req, res) => {
    const cached = (0, plan_cache_1.readPlanCache)();
    const configs = cached ?? [];
    return res.json(configs
        .filter((c) => c.active !== false)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)));
});
// GET /api/plans — legado
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