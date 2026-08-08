"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// GET /api/stats
router.get('/', async (req, res) => {
    const clubId = req.user.clubId;
    const now = new Date();
    const [raids, memberCounts, topParticipantsRaw] = await Promise.all([
        prisma_1.prisma.raid.findMany({
            where: { clubId },
            select: { id: true, status: true, date: true, estimatedKm: true },
        }),
        prisma_1.prisma.member.groupBy({
            by: ['status'],
            where: { clubId },
            _count: true,
        }),
        prisma_1.prisma.participant.groupBy({
            by: ['memberId'],
            where: { raid: { clubId }, status: 'CONFIRMED' },
            _count: { memberId: true },
            orderBy: { _count: { memberId: 'desc' } },
            take: 5,
        }),
    ]);
    const totalMembers = memberCounts.reduce((s, g) => s + g._count, 0);
    const activeMembers = memberCounts.find((g) => g.status === 'ACTIVE')?._count ?? 0;
    const totalRaids = raids.length;
    const completedRaids = raids.filter((r) => r.status === 'COMPLETED').length;
    const upcomingRaids = raids.filter((r) => ['CONFIRMED', 'IN_PROGRESS'].includes(r.status)).length;
    const totalKm = raids
        .filter((r) => r.status === 'COMPLETED' && r.estimatedKm)
        .reduce((sum, r) => sum + (r.estimatedKm ?? 0), 0);
    // Raids by month (last 12 months)
    const months = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString('pt-AO', { month: 'short', year: '2-digit' });
        const count = raids.filter((r) => {
            const rd = new Date(r.date);
            return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
        }).length;
        months.push({ month: label, count });
    }
    // Resolve top participant names
    const topMemberIds = topParticipantsRaw.map((p) => p.memberId);
    const topMembers = topMemberIds.length > 0
        ? await prisma_1.prisma.member.findMany({
            where: { id: { in: topMemberIds } },
            select: { id: true, fullName: true, nickname: true },
        })
        : [];
    const topParticipants = topParticipantsRaw.map((p) => {
        const m = topMembers.find((tm) => tm.id === p.memberId);
        return { name: m?.nickname ?? m?.fullName ?? '?', count: p._count.memberId };
    });
    return res.json({
        totalRaids,
        completedRaids,
        upcomingRaids,
        totalKm: Math.round(totalKm),
        totalMembers,
        activeMembers,
        raidsByMonth: months,
        topParticipants,
    });
});
exports.default = router;
//# sourceMappingURL=stats.js.map