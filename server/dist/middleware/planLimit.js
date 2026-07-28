"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPlanLimit = checkPlanLimit;
const prisma_1 = require("../lib/prisma");
async function checkPlanLimit(clubId) {
    const subscription = await prisma_1.prisma.subscription.findUnique({
        where: { clubId },
        include: { plan: true },
    });
    // sem subscrição ou status que bloqueia escrita → não limitar aqui (outro middleware trata)
    if (!subscription)
        return null;
    if (subscription.status === 'CANCELLED')
        return null;
    const limit = subscription.plan.memberLimit;
    if (limit === null)
        return null; // plano ilimitado
    const activeCount = await prisma_1.prisma.member.count({
        where: { clubId, status: 'ACTIVE' },
    });
    if (activeCount < limit)
        return null; // dentro do limite
    // encontrar próximo plano sugerido
    const nextPlan = await prisma_1.prisma.plan.findFirst({
        where: {
            isActive: true,
            OR: [
                { memberLimit: { gt: limit } },
                { memberLimit: null },
            ],
        },
        orderBy: { priceMonthlyKz: 'asc' },
    });
    return {
        error: `O teu clube cresceu! Passa ao plano ${nextPlan?.name ?? 'superior'} para adicionar mais membros.`,
        nextPlanCode: nextPlan?.code ?? null,
        activeMembers: activeCount,
        memberLimit: limit,
    };
}
//# sourceMappingURL=planLimit.js.map