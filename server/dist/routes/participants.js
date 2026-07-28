"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const checklist_1 = require("../services/checklist");
const email_1 = require("../services/email");
const router = (0, express_1.Router)({ mergeParams: true });
router.use(auth_1.authenticate);
// GET /api/raids/:raidId/participants
router.get('/', async (req, res) => {
    const raid = await prisma_1.prisma.raid.findFirst({ where: { id: req.params.raidId, clubId: req.user.clubId } });
    if (!raid)
        return res.status(404).json({ error: 'Raid não encontrado' });
    const participants = await prisma_1.prisma.participant.findMany({
        where: { raidId: req.params.raidId },
        include: {
            member: { select: { id: true, fullName: true, nickname: true, photoUrl: true, phone: true } },
            vehicle: true,
            checklistItems: true,
        },
    });
    return res.json(participants);
});
// POST /api/raids/:raidId/participants/:participantId/confirm
router.post('/:participantId/confirm', async (req, res) => {
    const participant = await prisma_1.prisma.participant.findFirst({
        where: { id: req.params.participantId, raidId: req.params.raidId },
        include: { member: true },
    });
    if (!participant)
        return res.status(404).json({ error: 'Participante não encontrado' });
    // Only the member themselves or an admin/captain can confirm
    const isOwn = participant.member.userId === req.user.userId;
    const isAdmin = ['ADMIN', 'CAPTAIN'].includes(req.user.role);
    if (!isOwn && !isAdmin)
        return res.status(403).json({ error: 'Sem permissão' });
    const { vehicleId } = req.body;
    const schema = zod_1.z.object({ vehicleId: zod_1.z.string().optional() });
    const data = schema.parse(req.body);
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        const p = await tx.participant.update({
            where: { id: req.params.participantId },
            data: { status: 'CONFIRMED', confirmedAt: new Date(), vehicleId: data.vehicleId },
        });
        // Create default checklist items if not yet created
        const existing = await tx.checklistItem.count({ where: { participantId: p.id } });
        if (existing === 0) {
            const items = (0, checklist_1.getDefaultChecklist)(p.id);
            await tx.checklistItem.createMany({ data: items });
        }
        return p;
    });
    return res.json(updated);
});
// PATCH /api/raids/:raidId/participants/:participantId/checklist
router.patch('/:participantId/checklist', async (req, res) => {
    const participant = await prisma_1.prisma.participant.findFirst({
        where: { id: req.params.participantId, raidId: req.params.raidId },
        include: { member: true },
    });
    if (!participant)
        return res.status(404).json({ error: 'Participante não encontrado' });
    const isOwn = participant.member.userId === req.user.userId;
    const isAdmin = ['ADMIN', 'CAPTAIN'].includes(req.user.role);
    if (!isOwn && !isAdmin)
        return res.status(403).json({ error: 'Sem permissão' });
    const schema = zod_1.z.object({
        items: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), checked: zod_1.z.boolean() })),
    });
    const { items } = schema.parse(req.body);
    // Carregar os IDs válidos deste participante antes de actualizar (previne IDOR)
    const allItems = await prisma_1.prisma.checklistItem.findMany({ where: { participantId: req.params.participantId } });
    const validIds = new Set(allItems.map((i) => i.id));
    const forbidden = items.filter((item) => !validIds.has(item.id));
    if (forbidden.length > 0)
        return res.status(403).json({ error: 'Item não pertence a este participante' });
    await Promise.all(items.map((item) => prisma_1.prisma.checklistItem.update({
        where: { id: item.id },
        data: { checked: item.checked, checkedAt: item.checked ? new Date() : null },
    })));
    // Recarregar estado actualizado
    const updatedItems = await prisma_1.prisma.checklistItem.findMany({ where: { participantId: req.params.participantId } });
    const allChecked = updatedItems.every((i) => i.checked);
    if (allChecked) {
        await prisma_1.prisma.participant.update({
            where: { id: req.params.participantId },
            data: { checklistCompletedAt: new Date() },
        });
    }
    return res.json({ items: updatedItems, complete: allChecked });
});
// POST /api/raids/:raidId/participants/:participantId/decline
router.post('/:participantId/decline', async (req, res) => {
    const participant = await prisma_1.prisma.participant.findFirst({
        where: { id: req.params.participantId, raidId: req.params.raidId },
        include: { member: true },
    });
    if (!participant)
        return res.status(404).json({ error: 'Participante não encontrado' });
    const isOwn = participant.member.userId === req.user.userId;
    const isAdmin = ['ADMIN', 'CAPTAIN'].includes(req.user.role);
    if (!isOwn && !isAdmin)
        return res.status(403).json({ error: 'Sem permissão' });
    const updated = await prisma_1.prisma.participant.update({
        where: { id: req.params.participantId },
        data: { status: 'DECLINED' },
    });
    return res.json(updated);
});
// PATCH /api/raids/:raidId/participants/:participantId — editar função e/ou moto
router.patch('/:participantId', (0, auth_1.requireRole)('ADMIN', 'CAPTAIN'), async (req, res) => {
    const participant = await prisma_1.prisma.participant.findFirst({
        where: { id: req.params.participantId, raidId: req.params.raidId },
    });
    if (!participant)
        return res.status(404).json({ error: 'Participante não encontrado' });
    const schema = zod_1.z.object({
        role: zod_1.z.enum(['LEADER', 'TAIL', 'MEMBER', 'MECHANIC', 'SUPPORT']).optional(),
        vehicleId: zod_1.z.string().nullable().optional(),
    });
    const data = schema.parse(req.body);
    const updated = await prisma_1.prisma.participant.update({
        where: { id: req.params.participantId },
        data,
        include: {
            member: { select: { id: true, fullName: true, nickname: true, photoUrl: true, phone: true } },
            vehicle: true,
            checklistItems: true,
        },
    });
    return res.json(updated);
});
// POST /api/raids/:raidId/participants — adicionar participante
router.post('/', (0, auth_1.requireRole)('ADMIN', 'CAPTAIN'), async (req, res) => {
    const raid = await prisma_1.prisma.raid.findFirst({ where: { id: req.params.raidId, clubId: req.user.clubId } });
    if (!raid)
        return res.status(404).json({ error: 'Raid não encontrado' });
    const schema = zod_1.z.object({
        memberId: zod_1.z.string(),
        role: zod_1.z.enum(['LEADER', 'TAIL', 'MEMBER', 'MECHANIC', 'SUPPORT']).default('MEMBER'),
    });
    const data = schema.parse(req.body);
    const existing = await prisma_1.prisma.participant.findFirst({ where: { raidId: req.params.raidId, memberId: data.memberId } });
    if (existing)
        return res.status(409).json({ error: 'Membro já adicionado' });
    const participant = await prisma_1.prisma.participant.create({
        data: { raidId: req.params.raidId, memberId: data.memberId, role: data.role, status: 'PENDING' },
        include: {
            member: { select: { id: true, fullName: true, nickname: true, photoUrl: true, phone: true } },
            vehicle: true,
            checklistItems: true,
        },
    });
    return res.status(201).json(participant);
});
// DELETE /api/raids/:raidId/participants/:participantId
router.delete('/:participantId', (0, auth_1.requireRole)('ADMIN', 'CAPTAIN'), async (req, res) => {
    const participant = await prisma_1.prisma.participant.findFirst({
        where: { id: req.params.participantId, raidId: req.params.raidId },
    });
    if (!participant)
        return res.status(404).json({ error: 'Participante não encontrado' });
    await prisma_1.prisma.participant.delete({ where: { id: req.params.participantId } });
    return res.status(204).send();
});
// POST /api/raids/:raidId/participants/remind
router.post('/remind', (0, auth_1.requireRole)('ADMIN', 'CAPTAIN'), async (req, res) => {
    const raid = await prisma_1.prisma.raid.findFirst({
        where: { id: req.params.raidId, clubId: req.user.clubId },
        include: { club: true },
    });
    if (!raid)
        return res.status(404).json({ error: 'Raid não encontrado' });
    const pending = await prisma_1.prisma.participant.findMany({
        where: { raidId: req.params.raidId, status: 'PENDING' },
        include: {
            member: {
                select: { fullName: true, nickname: true, user: { select: { email: true } } },
            },
        },
    });
    const confirmUrl = `${process.env.CLIENT_URL ?? 'http://localhost:5173'}/raids/${raid.id}`;
    const raidDate = raid.date.toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' });
    const toNotify = pending.filter((p) => p.member.user?.email);
    await Promise.allSettled(toNotify.map((p) => (0, email_1.sendRaidReminder)({
        to: p.member.user.email,
        memberName: p.member.nickname ?? p.member.fullName,
        raidTitle: raid.title,
        raidDate,
        clubName: raid.club.name,
        confirmUrl,
    })));
    return res.json({ message: `${toNotify.length} lembrete(s) enviado(s)`, count: toNotify.length });
});
exports.default = router;
//# sourceMappingURL=participants.js.map