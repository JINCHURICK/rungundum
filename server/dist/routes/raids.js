"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const crypto_1 = require("crypto");
const multer_1 = __importDefault(require("multer"));
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const email_1 = require("../services/email");
const cloudinary_1 = require("../services/cloudinary");
const leagues_1 = require("./leagues");
const notifications_1 = require("../services/notifications");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const raidSchema = zod_1.z.object({
    title: zod_1.z.string().min(2),
    date: zod_1.z.string(),
    origin: zod_1.z.string().min(1),
    destination: zod_1.z.string().min(1),
    difficulty: zod_1.z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
    estimatedKm: zod_1.z.number().nullish(),
    estimatedDuration: zod_1.z.string().nullish(),
    roadTypes: zod_1.z.array(zod_1.z.string()).optional(),
    description: zod_1.z.string().nullish(),
    maxSpeed: zod_1.z.number().int().nullish(),
    communicationChannel: zod_1.z.string().nullish(),
    accommodation: zod_1.z.string().nullish(),
    accommodationContact: zod_1.z.string().nullish(),
    routePoints: zod_1.z.array(zod_1.z.object({
        order: zod_1.z.number().int(),
        name: zod_1.z.string().min(1),
        type: zod_1.z.enum(['DEPARTURE', 'TECH_STOP', 'LUNCH', 'OVERNIGHT', 'ARRIVAL', 'STOP', 'BREAKFAST', 'FUEL', 'COFFEE', 'SCENIC', 'BORDER']).optional(),
        scheduledDate: zod_1.z.string().nullish(),
        scheduledTime: zod_1.z.string().nullish(),
        kmAccumulated: zod_1.z.number().nullish(),
        stopDuration: zod_1.z.number().int().nullish(),
        notes: zod_1.z.string().nullish(),
    })).optional(),
    participants: zod_1.z.array(zod_1.z.object({
        memberId: zod_1.z.string(),
        vehicleId: zod_1.z.string().nullish(),
        role: zod_1.z.enum(['LEADER', 'TAIL', 'MEMBER', 'MECHANIC', 'SUPPORT']).optional(),
    })).optional(),
    contingency: zod_1.z.object({
        accidentText: zod_1.z.string().nullish(),
        breakdownText: zod_1.z.string().nullish(),
        separationText: zod_1.z.string().nullish(),
        weatherText: zod_1.z.string().nullish(),
        rallyPoint: zod_1.z.string().nullish(),
        contactsJson: zod_1.z.array(zod_1.z.unknown()).optional(),
    }).optional(),
});
const RAID_STATUS_VALUES = ['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
// GET /api/raids
router.get('/', async (req, res) => {
    const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status = RAID_STATUS_VALUES.includes(rawStatus) ? rawStatus : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : undefined;
    const year = typeof req.query.year === 'string' ? parseInt(req.query.year, 10) : undefined;
    const dateFilter = year && !isNaN(year) ? {
        date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
    } : {};
    const raids = await prisma_1.prisma.raid.findMany({
        where: {
            clubId: req.user.clubId,
            ...(status ? { status } : {}),
            ...dateFilter,
            ...(search ? {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { origin: { contains: search, mode: 'insensitive' } },
                    { destination: { contains: search, mode: 'insensitive' } },
                ],
            } : {}),
        },
        include: {
            _count: { select: { participants: true } },
            participants: { where: { status: 'CONFIRMED' }, select: { id: true } },
            routePoints: { orderBy: { order: 'asc' }, take: 1 },
        },
        orderBy: { date: 'desc' },
    });
    return res.json(raids);
});
// GET /api/raids/:id
router.get('/:id', async (req, res) => {
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
            photos: { orderBy: { createdAt: 'asc' } },
        },
    });
    if (!raid)
        return res.status(404).json({ error: 'Raid não encontrado' });
    return res.json(raid);
});
// GET /api/raids/public/:token
router.get('/public/:token', async (req, res) => {
    const raid = await prisma_1.prisma.raid.findUnique({
        where: { publicToken: req.params.token },
        include: {
            club: { select: { name: true, acronym: true, logoUrl: true, accentColor: true } },
            routePoints: { orderBy: { order: 'asc' } },
            participants: {
                include: {
                    member: { select: { fullName: true, nickname: true, photoUrl: true } },
                    vehicle: { select: { brand: true, model: true, type: true } },
                },
            },
            contingencyPlan: true,
        },
    });
    if (!raid)
        return res.status(404).json({ error: 'Raid não encontrado' });
    return res.json(raid);
});
// POST /api/raids
router.post('/', (0, auth_1.requireRole)('ADMIN', 'CAPTAIN'), async (req, res) => {
    try {
        const data = raidSchema.parse(req.body);
        const { routePoints, participants, contingency, ...raidData } = data;
        const raid = await prisma_1.prisma.$transaction(async (tx) => {
            const newRaid = await tx.raid.create({
                data: {
                    ...raidData,
                    date: new Date(raidData.date),
                    clubId: req.user.clubId,
                    publicToken: (0, crypto_1.randomBytes)(16).toString('hex'),
                },
            });
            if (routePoints?.length) {
                await tx.routePoint.createMany({
                    data: routePoints.map((rp) => ({ ...rp, raidId: newRaid.id })),
                });
            }
            if (participants?.length) {
                await tx.participant.createMany({
                    data: participants.map((p) => ({ ...p, raidId: newRaid.id })),
                });
            }
            if (contingency) {
                await tx.contingencyPlan.create({
                    data: {
                        raidId: newRaid.id,
                        ...contingency,
                        contactsJson: (contingency.contactsJson ?? []),
                    },
                });
            }
            return tx.raid.findUnique({
                where: { id: newRaid.id },
                include: {
                    routePoints: { orderBy: { order: 'asc' } },
                    participants: { include: { member: true, vehicle: true } },
                    contingencyPlan: true,
                },
            });
        });
        return res.status(201).json(raid);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// PATCH /api/raids/:id
router.patch('/:id', (0, auth_1.requireRole)('ADMIN', 'CAPTAIN'), async (req, res) => {
    try {
        const existing = await prisma_1.prisma.raid.findFirst({ where: { id: req.params.id, clubId: req.user.clubId } });
        if (!existing)
            return res.status(404).json({ error: 'Raid não encontrado' });
        if (['COMPLETED', 'CANCELLED'].includes(existing.status)) {
            return res.status(400).json({ error: 'Não é possível editar um raid concluído ou cancelado' });
        }
        const data = raidSchema.partial().parse(req.body);
        const { routePoints, participants, contingency, ...raidData } = data;
        const raid = await prisma_1.prisma.$transaction(async (tx) => {
            const updated = await tx.raid.update({
                where: { id: req.params.id },
                data: { ...raidData, date: raidData.date ? new Date(raidData.date) : undefined },
            });
            if (routePoints !== undefined) {
                await tx.routePoint.deleteMany({ where: { raidId: req.params.id } });
                if (routePoints.length) {
                    await tx.routePoint.createMany({ data: routePoints.map((rp) => ({ ...rp, raidId: req.params.id })) });
                }
            }
            if (participants !== undefined) {
                await tx.participant.deleteMany({ where: { raidId: req.params.id } });
                if (participants.length) {
                    await tx.participant.createMany({ data: participants.map((p) => ({ ...p, raidId: req.params.id })) });
                }
            }
            if (contingency !== undefined) {
                await tx.contingencyPlan.upsert({
                    where: { raidId: req.params.id },
                    update: { ...contingency, contactsJson: (contingency.contactsJson ?? []) },
                    create: { raidId: req.params.id, ...contingency, contactsJson: (contingency.contactsJson ?? []) },
                });
            }
            return tx.raid.findUnique({
                where: { id: req.params.id },
                include: { routePoints: { orderBy: { order: 'asc' } }, participants: { include: { member: true, vehicle: true } }, contingencyPlan: true },
            });
        });
        return res.json(raid);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// PATCH /api/raids/:id/status
router.patch('/:id/status', (0, auth_1.requireRole)('ADMIN', 'CAPTAIN'), async (req, res) => {
    const existing = await prisma_1.prisma.raid.findFirst({ where: { id: req.params.id, clubId: req.user.clubId } });
    if (!existing)
        return res.status(404).json({ error: 'Raid não encontrado' });
    const { status, cancelReason } = req.body;
    const transitions = {
        DRAFT: ['CONFIRMED'],
        CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
        IN_PROGRESS: ['COMPLETED'],
    };
    if (!transitions[existing.status]?.includes(status)) {
        return res.status(400).json({ error: `Transição de ${existing.status} para ${status} não permitida` });
    }
    const raid = await prisma_1.prisma.raid.update({
        where: { id: req.params.id },
        data: { status, ...(cancelReason ? { settings: { ...existing.settings, cancelReason } } : {}) },
        include: { club: { select: { name: true } } },
    });
    // Ao concluir, atribuir pontos nas ligas activas do clube
    if (status === 'COMPLETED') {
        await (0, leagues_1.awardLeaguePointsForRaid)(existing.clubId, existing.estimatedKm).catch(() => { });
    }
    // Ao publicar, notificar participantes que têm email + notificação in-app
    if (status === 'CONFIRMED' && existing.publicToken) {
        const participants = await prisma_1.prisma.participant.findMany({
            where: { raidId: raid.id },
            include: { member: { include: { user: { select: { id: true, email: true } } } } },
        });
        const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
        const publicUrl = `${clientUrl}/public/${existing.publicToken}`;
        const raidDate = existing.date.toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' });
        await Promise.allSettled([
            ...participants
                .filter((p) => p.member.user?.email)
                .map((p) => (0, email_1.sendRaidPublished)({
                to: p.member.user.email,
                memberName: p.member.nickname ?? p.member.fullName,
                raidTitle: existing.title,
                raidDate,
                clubName: raid.club.name,
                publicUrl,
            })),
            ...participants
                .filter((p) => p.member.user?.id)
                .map((p) => (0, notifications_1.createNotification)({
                clubId: existing.clubId,
                userId: p.member.user.id,
                type: 'RAID_CONFIRMED',
                title: `Raid confirmado: ${existing.title}`,
                body: `Data: ${raidDate}`,
                link: `/raids/${existing.id}`,
            })),
        ]);
    }
    return res.json(raid);
});
// POST /api/raids/:id/duplicate
router.post('/:id/duplicate', (0, auth_1.requireRole)('ADMIN', 'CAPTAIN'), async (req, res) => {
    const source = await prisma_1.prisma.raid.findFirst({
        where: { id: req.params.id, clubId: req.user.clubId },
        include: { routePoints: true, participants: true, contingencyPlan: true },
    });
    if (!source)
        return res.status(404).json({ error: 'Raid não encontrado' });
    const { id, createdAt, updatedAt, publicToken, status, settings, contingencyPlan: _cp, routePoints: _rp, participants: _parts, ...raidData } = source;
    const newRaid = await prisma_1.prisma.$transaction(async (tx) => {
        const raid = await tx.raid.create({
            data: { ...raidData, title: `${raidData.title} (cópia)`, status: 'DRAFT', publicToken: (0, crypto_1.randomBytes)(16).toString('hex'), settings: settings },
        });
        const { id: sourceId, ...routeData } = source.routePoints[0] || {};
        if (source.routePoints.length) {
            await tx.routePoint.createMany({
                data: source.routePoints.map(({ id, raidId, createdAt, ...rp }) => ({ ...rp, raidId: raid.id })),
            });
        }
        if (source.participants.length) {
            await tx.participant.createMany({
                data: source.participants.map(({ id, raidId, createdAt, updatedAt, confirmedAt, checklistCompletedAt, status, ...p }) => ({ ...p, raidId: raid.id })),
            });
        }
        if (source.contingencyPlan) {
            const { id, raidId, createdAt, updatedAt, contactsJson, ...cp } = source.contingencyPlan;
            await tx.contingencyPlan.create({ data: { ...cp, contactsJson: (contactsJson ?? []), raidId: raid.id } });
        }
        return raid;
    });
    return res.status(201).json(newRaid);
});
// POST /api/raids/:id/photos — upload de foto
router.post('/:id/photos', upload.single('photo'), async (req, res) => {
    const raid = await prisma_1.prisma.raid.findFirst({ where: { id: req.params.id, clubId: req.user.clubId } });
    if (!raid)
        return res.status(404).json({ error: 'Raid não encontrado' });
    if (!req.file)
        return res.status(400).json({ error: 'Nenhum ficheiro enviado' });
    const caption = typeof req.body.caption === 'string' ? req.body.caption : undefined;
    const url = await (0, cloudinary_1.uploadToCloudinary)(req.file.buffer, `clubs/${req.user.clubId}/raids/${raid.id}/photos`);
    const photo = await prisma_1.prisma.raidPhoto.create({
        data: { raidId: raid.id, url, caption, uploadedById: req.user.userId },
    });
    return res.status(201).json(photo);
});
// DELETE /api/raids/:id/photos/:photoId
router.delete('/:id/photos/:photoId', (0, auth_1.requireRole)('ADMIN', 'CAPTAIN'), async (req, res) => {
    const photo = await prisma_1.prisma.raidPhoto.findFirst({
        where: { id: req.params.photoId, raidId: req.params.id },
        include: { raid: { select: { clubId: true } } },
    });
    if (!photo || photo.raid.clubId !== req.user.clubId)
        return res.status(404).json({ error: 'Foto não encontrada' });
    await prisma_1.prisma.raidPhoto.delete({ where: { id: photo.id } });
    return res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=raids.js.map