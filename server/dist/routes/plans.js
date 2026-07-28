"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
// GET /api/plans — público, sem autenticação
router.get('/', async (_req, res) => {
    const plans = await prisma_1.prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { priceMonthlyKz: 'asc' },
        select: {
            id: true, code: true, name: true,
            priceMonthlyKz: true, priceAnnualKz: true,
            memberLimit: true, isActive: true,
        },
    });
    return res.json(plans);
});
exports.default = router;
//# sourceMappingURL=plans.js.map