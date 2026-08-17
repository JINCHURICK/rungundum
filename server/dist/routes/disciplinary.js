"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const sms_1 = require("../services/sms");
const email_1 = require("../services/email");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.use((0, auth_1.requirePermission)('DISCIPLINARY'));
const memberSelect = { fullName: true, nickname: true, memberNumber: true, photoUrl: true };
// ── PROCESSOS DISCIPLINARES ─────────────────────────────────────────────────
router.get('/processes', async (req, res) => {
    const processes = await prisma_1.prisma.disciplinaryProcess.findMany({
        where: { clubId: req.user.clubId },
        include: {
            member: { select: memberSelect },
            fines: { select: { id: true, amount: true, status: true } },
            suspensions: { select: { id: true, startDate: true, endDate: true, liftedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    return res.json(processes);
});
router.post('/processes', async (req, res) => {
    try {
        const schema = zod_1.z.object({
            memberId: zod_1.z.string(),
            title: zod_1.z.string().min(1),
            description: zod_1.z.string().nullish(),
            severity: zod_1.z.enum(['MINOR', 'MODERATE', 'SERIOUS']).default('MINOR'),
        });
        const data = schema.parse(req.body);
        const member = await prisma_1.prisma.member.findFirst({ where: { id: data.memberId, clubId: req.user.clubId } });
        if (!member)
            return res.status(404).json({ error: 'Membro não encontrado' });
        const process = await prisma_1.prisma.disciplinaryProcess.create({
            data: {
                clubId: req.user.clubId,
                memberId: data.memberId,
                title: data.title,
                description: data.description ?? null,
                severity: data.severity,
                createdById: req.user.userId,
            },
            include: {
                member: { select: memberSelect },
                fines: { select: { id: true, amount: true, status: true } },
                suspensions: { select: { id: true, startDate: true, endDate: true, liftedAt: true } },
            },
        });
        return res.status(201).json(process);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
router.patch('/processes/:id', async (req, res) => {
    try {
        const schema = zod_1.z.object({
            status: zod_1.z.enum(['OPEN', 'REVIEWING', 'CLOSED']).optional(),
            severity: zod_1.z.enum(['MINOR', 'MODERATE', 'SERIOUS']).optional(),
            outcome: zod_1.z.string().nullish(),
            title: zod_1.z.string().optional(),
            description: zod_1.z.string().nullish(),
        });
        const data = schema.parse(req.body);
        const process = await prisma_1.prisma.disciplinaryProcess.findFirst({
            where: { id: req.params.id, clubId: req.user.clubId },
        });
        if (!process)
            return res.status(404).json({ error: 'Processo não encontrado' });
        const updated = await prisma_1.prisma.disciplinaryProcess.update({
            where: { id: process.id },
            data: {
                ...data,
                closedAt: data.status === 'CLOSED' ? new Date() : process.closedAt,
            },
            include: {
                member: { select: memberSelect },
                fines: { select: { id: true, amount: true, status: true } },
                suspensions: { select: { id: true, startDate: true, endDate: true, liftedAt: true } },
            },
        });
        return res.json(updated);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
router.delete('/processes/:id', (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const process = await prisma_1.prisma.disciplinaryProcess.findFirst({
        where: { id: req.params.id, clubId: req.user.clubId },
    });
    if (!process)
        return res.status(404).json({ error: 'Processo não encontrado' });
    await prisma_1.prisma.disciplinaryProcess.delete({ where: { id: process.id } });
    return res.status(204).send();
});
// ── SUSPENSÕES ──────────────────────────────────────────────────────────────
router.get('/suspensions', async (req, res) => {
    const suspensions = await prisma_1.prisma.suspension.findMany({
        where: { clubId: req.user.clubId },
        include: {
            member: { select: memberSelect },
            process: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    return res.json(suspensions);
});
router.post('/suspensions', async (req, res) => {
    try {
        const schema = zod_1.z.object({
            memberId: zod_1.z.string(),
            reason: zod_1.z.string().min(1),
            startDate: zod_1.z.string(),
            endDate: zod_1.z.string(),
            processId: zod_1.z.string().nullish(),
            notes: zod_1.z.string().nullish(),
        });
        const data = schema.parse(req.body);
        const member = await prisma_1.prisma.member.findFirst({
            where: { id: data.memberId, clubId: req.user.clubId },
            include: { club: { select: { name: true } }, user: { select: { email: true } } },
        });
        if (!member)
            return res.status(404).json({ error: 'Membro não encontrado' });
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        if (end <= start)
            return res.status(400).json({ error: 'A data de fim deve ser posterior à data de início' });
        const suspension = await prisma_1.prisma.suspension.create({
            data: {
                clubId: req.user.clubId,
                memberId: data.memberId,
                reason: data.reason,
                startDate: start,
                endDate: end,
                processId: data.processId ?? null,
                notes: data.notes ?? null,
                createdById: req.user.userId,
            },
            include: {
                member: { select: memberSelect },
                process: { select: { id: true, title: true } },
            },
        });
        // Auto-suspender membro se a suspensão já está activa
        const now = new Date();
        if (start <= now && end >= now) {
            await prisma_1.prisma.member.update({ where: { id: data.memberId }, data: { status: 'SUSPENDED' } });
        }
        const memberName = member.nickname ?? member.fullName;
        const clubName = member.club.name;
        const startStr = start.toLocaleDateString('pt-AO');
        const endStr = end.toLocaleDateString('pt-AO');
        if (member.phone) {
            (0, sms_1.sendSuspensionSms)({
                phone: member.phone, memberName, clubName,
                reason: data.reason, startDate: startStr, endDate: endStr,
            }).catch(() => { });
        }
        if (member.user?.email) {
            (0, email_1.sendSuspensionEmail)({
                to: member.user.email, memberName, clubName,
                reason: data.reason, startDate: startStr, endDate: endStr,
                notes: data.notes ?? null,
            }).catch(() => { });
        }
        return res.status(201).json(suspension);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
router.patch('/suspensions/:id/lift', async (req, res) => {
    const suspension = await prisma_1.prisma.suspension.findFirst({
        where: { id: req.params.id, clubId: req.user.clubId },
    });
    if (!suspension)
        return res.status(404).json({ error: 'Suspensão não encontrada' });
    if (suspension.liftedAt)
        return res.status(400).json({ error: 'Suspensão já levantada' });
    const updated = await prisma_1.prisma.suspension.update({
        where: { id: suspension.id },
        data: { liftedAt: new Date() },
        include: {
            member: { select: memberSelect },
            process: { select: { id: true, title: true } },
        },
    });
    // Reactivar o membro (só se não tiver outras suspensões activas)
    const otherActive = await prisma_1.prisma.suspension.count({
        where: {
            memberId: suspension.memberId,
            id: { not: suspension.id },
            liftedAt: null,
            endDate: { gte: new Date() },
        },
    });
    if (otherActive === 0) {
        await prisma_1.prisma.member.update({ where: { id: suspension.memberId }, data: { status: 'ACTIVE' } });
    }
    // SMS de levantamento
    const liftedMember = await prisma_1.prisma.member.findUnique({
        where: { id: suspension.memberId },
        include: { club: { select: { name: true } } },
    });
    if (liftedMember?.phone) {
        (0, sms_1.sendSuspensionLiftedSms)({
            phone: liftedMember.phone,
            memberName: liftedMember.nickname ?? liftedMember.fullName,
            clubName: liftedMember.club.name,
        }).catch(() => { });
    }
    return res.json(updated);
});
router.delete('/suspensions/:id', (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const suspension = await prisma_1.prisma.suspension.findFirst({
        where: { id: req.params.id, clubId: req.user.clubId },
    });
    if (!suspension)
        return res.status(404).json({ error: 'Suspensão não encontrada' });
    await prisma_1.prisma.suspension.delete({ where: { id: suspension.id } });
    return res.status(204).send();
});
// ── MULTAS ──────────────────────────────────────────────────────────────────
router.get('/fines', async (req, res) => {
    const fines = await prisma_1.prisma.fine.findMany({
        where: { clubId: req.user.clubId },
        include: {
            member: { select: memberSelect },
            process: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    return res.json(fines);
});
router.post('/fines', async (req, res) => {
    try {
        const schema = zod_1.z.object({
            memberId: zod_1.z.string(),
            reason: zod_1.z.string().min(1),
            amount: zod_1.z.number().min(0),
            processId: zod_1.z.string().nullish(),
            notes: zod_1.z.string().nullish(),
        });
        const data = schema.parse(req.body);
        const member = await prisma_1.prisma.member.findFirst({
            where: { id: data.memberId, clubId: req.user.clubId },
            include: { club: { select: { name: true } }, user: { select: { email: true } } },
        });
        if (!member)
            return res.status(404).json({ error: 'Membro não encontrado' });
        const fine = await prisma_1.prisma.fine.create({
            data: {
                clubId: req.user.clubId,
                memberId: data.memberId,
                reason: data.reason,
                amount: data.amount,
                processId: data.processId ?? null,
                notes: data.notes ?? null,
                createdById: req.user.userId,
            },
            include: {
                member: { select: memberSelect },
                process: { select: { id: true, title: true } },
            },
        });
        const memberName = member.nickname ?? member.fullName;
        const clubName = member.club.name;
        if (member.phone) {
            (0, sms_1.sendFineSms)({ phone: member.phone, memberName, clubName, reason: data.reason, amount: data.amount }).catch(() => { });
        }
        if (member.user?.email) {
            (0, email_1.sendFineEmail)({ to: member.user.email, memberName, clubName, reason: data.reason, amount: data.amount, notes: data.notes ?? null }).catch(() => { });
        }
        return res.status(201).json(fine);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
router.patch('/fines/:id/pay', async (req, res) => {
    const fine = await prisma_1.prisma.fine.findFirst({
        where: { id: req.params.id, clubId: req.user.clubId },
    });
    if (!fine)
        return res.status(404).json({ error: 'Multa não encontrada' });
    if (fine.status === 'PAID')
        return res.status(400).json({ error: 'Multa já paga' });
    const updated = await prisma_1.prisma.fine.update({
        where: { id: fine.id },
        data: { status: 'PAID', paidAt: new Date() },
        include: {
            member: { select: memberSelect },
            process: { select: { id: true, title: true } },
        },
    });
    return res.json(updated);
});
router.patch('/fines/:id/cancel', async (req, res) => {
    const fine = await prisma_1.prisma.fine.findFirst({
        where: { id: req.params.id, clubId: req.user.clubId },
    });
    if (!fine)
        return res.status(404).json({ error: 'Multa não encontrada' });
    const updated = await prisma_1.prisma.fine.update({
        where: { id: fine.id },
        data: { status: 'CANCELLED' },
        include: {
            member: { select: memberSelect },
            process: { select: { id: true, title: true } },
        },
    });
    return res.json(updated);
});
router.delete('/fines/:id', (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    const fine = await prisma_1.prisma.fine.findFirst({
        where: { id: req.params.id, clubId: req.user.clubId },
    });
    if (!fine)
        return res.status(404).json({ error: 'Multa não encontrada' });
    await prisma_1.prisma.fine.delete({ where: { id: fine.id } });
    return res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=disciplinary.js.map