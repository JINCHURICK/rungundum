"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const pdf_1 = require("../services/pdf");
const programImage_1 = require("../services/programImage");
const date_fns_1 = require("date-fns");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// POST /api/pdf/raids/:id
router.post('/raids/:id', async (req, res) => {
    const raid = await prisma_1.prisma.raid.findFirst({
        where: { id: req.params.id, clubId: req.user.clubId },
        include: {
            routePoints: { orderBy: { order: 'asc' } },
            participants: {
                include: {
                    member: { select: { id: true, fullName: true, nickname: true, photoUrl: true, phone: true } },
                    vehicle: true,
                    checklistItems: true,
                },
            },
            contingencyPlan: true,
        },
    });
    if (!raid)
        return res.status(404).json({ error: 'Raid não encontrado' });
    const [club, handSignals] = await Promise.all([
        prisma_1.prisma.club.findUnique({ where: { id: req.user.clubId } }),
        prisma_1.prisma.handSignal.findMany({ where: { clubId: req.user.clubId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
    ]);
    if (!club)
        return res.status(404).json({ error: 'Clube não encontrado' });
    const optionsSchema = zod_1.z.object({
        includeRoster: zod_1.z.boolean().optional(),
        includeRoutePoints: zod_1.z.boolean().optional(),
        includeContingency: zod_1.z.boolean().optional(),
        includeEmergencyContacts: zod_1.z.boolean().optional(),
        includeBriefing: zod_1.z.boolean().optional(),
        includeChecklist: zod_1.z.boolean().optional(),
        includeStatutes: zod_1.z.boolean().optional(),
        includeSignatures: zod_1.z.boolean().optional(),
    });
    const options = optionsSchema.parse(req.body);
    const pdf = await (0, pdf_1.generateRaidPDF)(raid, { ...club, handSignals }, options);
    const clean = (s) => s.replace(/[<>:"/\\|?*]/g, '').trim();
    const dateStr = (0, date_fns_1.format)(new Date(raid.date), 'dd-MM-yyyy');
    const filename = `Plano de Raid - ${clean(raid.origin)} a ${clean(raid.destination)} - ${dateStr}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.send(pdf);
});
// POST /api/pdf/raids/:id/program-image
router.post('/raids/:id/program-image', async (req, res) => {
    const raid = await prisma_1.prisma.raid.findFirst({
        where: { id: req.params.id, clubId: req.user.clubId },
        include: {
            routePoints: { orderBy: { order: 'asc' } },
            participants: {
                include: { member: { select: { fullName: true, nickname: true } } },
            },
        },
    });
    if (!raid)
        return res.status(404).json({ error: 'Raid não encontrado' });
    const club = await prisma_1.prisma.club.findUnique({ where: { id: req.user.clubId } });
    if (!club)
        return res.status(404).json({ error: 'Clube não encontrado' });
    const image = await (0, programImage_1.generateProgramImage)(raid, club);
    const dateStr = (0, date_fns_1.format)(new Date(raid.date), 'yyyy-MM-dd');
    const filename = `programa_${raid.title.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.png`;
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(image);
});
// POST /api/pdf/raids/:id/program-pdf
router.post('/raids/:id/program-pdf', async (req, res) => {
    const raid = await prisma_1.prisma.raid.findFirst({
        where: { id: req.params.id, clubId: req.user.clubId },
        include: { routePoints: { orderBy: { order: 'asc' } } },
    });
    if (!raid)
        return res.status(404).json({ error: 'Raid não encontrado' });
    const club = await prisma_1.prisma.club.findUnique({ where: { id: req.user.clubId } });
    if (!club)
        return res.status(404).json({ error: 'Clube não encontrado' });
    const pdf = await (0, programImage_1.generateProgramPDF)(raid, club);
    const clean = (s) => s.replace(/[<>:"/\\|?*]/g, '').trim();
    const dateStr = (0, date_fns_1.format)(new Date(raid.date), 'dd-MM-yyyy');
    const filename = `Resumo - ${clean(raid.origin)} a ${clean(raid.destination)} - ${dateStr}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.send(pdf);
});
// POST /api/pdf/members/:memberId/certificate
router.post('/members/:memberId/certificate', async (req, res) => {
    const yearRaw = req.body?.year;
    const year = yearRaw && Number.isInteger(Number(yearRaw)) ? Number(yearRaw) : new Date().getFullYear();
    const member = await prisma_1.prisma.member.findFirst({
        where: { id: req.params.memberId, clubId: req.user.clubId },
        include: {
            participations: {
                where: {
                    status: 'CONFIRMED',
                    raid: {
                        date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) },
                    },
                },
                include: {
                    raid: { select: { title: true, date: true, estimatedKm: true, origin: true, destination: true } },
                },
                orderBy: { raid: { date: 'asc' } },
            },
        },
    });
    if (!member)
        return res.status(404).json({ error: 'Membro não encontrado' });
    const club = await prisma_1.prisma.club.findUnique({ where: { id: req.user.clubId } });
    if (!club)
        return res.status(404).json({ error: 'Clube não encontrado' });
    const pdf = await (0, pdf_1.generateMemberCertificate)(member, club, year);
    const clean = (s) => s.replace(/[<>:"/\\|?*]/g, '').trim();
    const name = clean(member.nickname ?? member.fullName);
    const filename = `Certificado - ${name} - ${year}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.send(pdf);
});
// POST /api/pdf/members-all — fichas de todos os membros (ADMIN / APP_ADMIN)
router.post('/members-all', async (req, res) => {
    const role = req.user.role;
    if (role !== 'ADMIN' && role !== 'APP_ADMIN')
        return res.status(403).json({ error: 'Sem permissão' });
    const clubId = req.user.clubId;
    const [club, members] = await Promise.all([
        prisma_1.prisma.club.findUnique({ where: { id: clubId } }),
        prisma_1.prisma.member.findMany({
            where: { clubId },
            orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
            include: {
                vehicles: { orderBy: { createdAt: 'asc' } },
                positions: { orderBy: { startDate: 'desc' } },
                quotas: { orderBy: { year: 'desc' }, take: 1 },
            },
        }),
    ]);
    if (!club)
        return res.status(404).json({ error: 'Clube não encontrado' });
    if (!members.length)
        return res.status(404).json({ error: 'Sem membros para exportar' });
    const pdf = await (0, pdf_1.generateAllMembersProfilesPDF)(members, club);
    const clean = (s) => s.replace(/[<>:"/\\|?*]/g, '').trim();
    const filename = `Fichas de Membros - ${clean(club.name)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.send(pdf);
});
// POST /api/pdf/members/:memberId/profile — ficha de um membro (ADMIN / APP_ADMIN)
router.post('/members/:memberId/profile', async (req, res) => {
    const role = req.user.role;
    if (role !== 'ADMIN' && role !== 'APP_ADMIN')
        return res.status(403).json({ error: 'Sem permissão' });
    const member = await prisma_1.prisma.member.findFirst({
        where: { id: req.params.memberId, clubId: req.user.clubId },
        include: {
            vehicles: { orderBy: { createdAt: 'asc' } },
            positions: { orderBy: { startDate: 'desc' } },
            quotas: { orderBy: { year: 'desc' }, take: 1 },
        },
    });
    if (!member)
        return res.status(404).json({ error: 'Membro não encontrado' });
    const club = await prisma_1.prisma.club.findUnique({ where: { id: req.user.clubId } });
    if (!club)
        return res.status(404).json({ error: 'Clube não encontrado' });
    const pdf = await (0, pdf_1.generateMemberProfilePDF)(member, club);
    const clean = (s) => s.replace(/[<>:"/\\|?*]/g, '').trim();
    const name = clean(member.nickname ?? member.fullName);
    const filename = `Ficha - ${name}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.send(pdf);
});
// POST /api/pdf/annual-report
router.post('/annual-report', async (req, res) => {
    const yearRaw = req.body?.year;
    const year = yearRaw && !isNaN(Number(yearRaw)) ? Number(yearRaw) : new Date().getFullYear();
    const clubId = req.user.clubId;
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year}-12-31T23:59:59.999Z`);
    const [club, raids, members, transactions] = await Promise.all([
        prisma_1.prisma.club.findUnique({ where: { id: clubId } }),
        prisma_1.prisma.raid.findMany({
            where: { clubId, date: { gte: start, lte: end } },
            include: {
                participants: {
                    where: { status: 'CONFIRMED' },
                    include: { member: { select: { fullName: true, nickname: true } } },
                },
            },
            orderBy: { date: 'asc' },
        }),
        prisma_1.prisma.member.findMany({
            where: { clubId },
            select: { id: true, fullName: true, nickname: true, status: true, joinedAt: true },
        }),
        prisma_1.prisma.transaction.findMany({
            where: { clubId, date: { gte: start, lte: end } },
            select: { type: true, amount: true, category: true },
        }),
    ]);
    if (!club)
        return res.status(404).json({ error: 'Clube não encontrado' });
    const pdf = await (0, pdf_1.generateAnnualReport)({ club, year, raids, members, transactions });
    const clean = (s) => s.replace(/[<>:"/\\|?*]/g, '').trim();
    const filename = `Relatorio Anual - ${clean(club.name)} - ${year}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.send(pdf);
});
exports.default = router;
//# sourceMappingURL=pdf.js.map