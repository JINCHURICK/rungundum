"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.awardLeaguePointsForRaid = awardLeaguePointsForRaid;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// GET /api/leagues — lista ligas (activas e terminadas)
router.get('/', async (req, res) => {
    const leagues = await prisma_1.prisma.league.findMany({
        orderBy: [{ status: 'asc' }, { year: 'desc' }],
        include: {
            _count: { select: { entries: true } },
            entries: {
                where: { clubId: req.user.clubId },
                select: { points: true, raidsCompleted: true, totalKm: true },
            },
        },
    });
    return res.json(leagues.map((l) => ({
        id: l.id,
        name: l.name,
        year: l.year,
        region: l.region,
        description: l.description,
        status: l.status,
        pointsPerRaid: l.pointsPerRaid,
        bonusKmPoints: l.bonusKmPoints,
        clubCount: l._count.entries,
        myEntry: l.entries[0] ?? null,
    })));
});
// GET /api/leagues/:id — standings completos
router.get('/:id', async (req, res) => {
    const league = await prisma_1.prisma.league.findUnique({
        where: { id: req.params.id },
        include: {
            entries: {
                orderBy: { points: 'desc' },
                include: { club: { select: { id: true, name: true, acronym: true, logoUrl: true, accentColor: true } } },
            },
        },
    });
    if (!league)
        return res.status(404).json({ error: 'Liga não encontrada' });
    return res.json({
        ...league,
        entries: league.entries.map((e, i) => ({
            position: i + 1,
            clubId: e.clubId,
            clubName: e.club.name,
            clubAcronym: e.club.acronym,
            clubLogoUrl: e.club.logoUrl,
            clubAccentColor: e.club.accentColor,
            points: e.points,
            raidsCompleted: e.raidsCompleted,
            totalKm: e.totalKm,
            isMyClub: e.clubId === req.user.clubId,
        })),
    });
});
// POST /api/leagues — criar liga (apenas ADMIN, protegido por token especial)
router.post('/', (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const schema = zod_1.z.object({
            name: zod_1.z.string().min(3),
            year: zod_1.z.number().int().min(2020).max(2100),
            region: zod_1.z.string().nullish(),
            description: zod_1.z.string().nullish(),
            pointsPerRaid: zod_1.z.number().int().min(1).default(100),
            bonusKmPoints: zod_1.z.number().min(0).default(0.1),
        });
        const data = schema.parse(req.body);
        const league = await prisma_1.prisma.league.create({ data });
        return res.status(201).json(league);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// POST /api/leagues/:id/join — clube inscreve-se numa liga
router.post('/:id/join', (0, auth_1.requireRole)('ADMIN', 'CAPTAIN'), async (req, res) => {
    const league = await prisma_1.prisma.league.findUnique({ where: { id: req.params.id } });
    if (!league || league.status !== 'ACTIVE') {
        return res.status(404).json({ error: 'Liga não encontrada ou já encerrada' });
    }
    const entry = await prisma_1.prisma.leagueEntry.upsert({
        where: { leagueId_clubId: { leagueId: league.id, clubId: req.user.clubId } },
        update: {},
        create: { leagueId: league.id, clubId: req.user.clubId },
    });
    return res.status(201).json(entry);
});
// POST /api/leagues/:id/leave — sair de uma liga
router.post('/:id/leave', (0, auth_1.requireRole)('ADMIN', 'CAPTAIN'), async (req, res) => {
    await prisma_1.prisma.leagueEntry.deleteMany({
        where: { leagueId: req.params.id, clubId: req.user.clubId },
    });
    return res.status(204).send();
});
// POST /api/leagues/:id/award — atribuir pontos manualmente (ADMIN)
router.post('/:id/award', (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const schema = zod_1.z.object({
            clubId: zod_1.z.string(),
            points: zod_1.z.number().int(),
            raidsCompleted: zod_1.z.number().int().min(0).default(0),
            totalKm: zod_1.z.number().min(0).default(0),
        });
        const data = schema.parse(req.body);
        const entry = await prisma_1.prisma.leagueEntry.upsert({
            where: { leagueId_clubId: { leagueId: req.params.id, clubId: data.clubId } },
            update: {
                points: { increment: data.points },
                raidsCompleted: { increment: data.raidsCompleted },
                totalKm: { increment: data.totalKm },
                lastUpdated: new Date(),
            },
            create: {
                leagueId: req.params.id,
                clubId: data.clubId,
                points: data.points,
                raidsCompleted: data.raidsCompleted,
                totalKm: data.totalKm,
            },
        });
        return res.json(entry);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// PATCH /api/leagues/:id — actualizar estado da liga
router.patch('/:id', (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const schema = zod_1.z.object({ status: zod_1.z.enum(['ACTIVE', 'FINISHED']).optional() });
        const data = schema.parse(req.body);
        const league = await prisma_1.prisma.league.update({ where: { id: req.params.id }, data });
        return res.json(league);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
exports.default = router;
// Função auxiliar chamada quando um raid é COMPLETED — atribui pontos nas ligas activas
async function awardLeaguePointsForRaid(clubId, estimatedKm) {
    const activeEntries = await prisma_1.prisma.leagueEntry.findMany({
        where: { clubId, league: { status: 'ACTIVE' } },
        include: { league: true },
    });
    await Promise.all(activeEntries.map((entry) => {
        const kmBonus = Math.round((estimatedKm ?? 0) * entry.league.bonusKmPoints);
        const total = entry.league.pointsPerRaid + kmBonus;
        return prisma_1.prisma.leagueEntry.update({
            where: { id: entry.id },
            data: {
                points: { increment: total },
                raidsCompleted: { increment: 1 },
                totalKm: { increment: estimatedKm ?? 0 },
                lastUpdated: new Date(),
            },
        });
    }));
}
//# sourceMappingURL=leagues.js.map