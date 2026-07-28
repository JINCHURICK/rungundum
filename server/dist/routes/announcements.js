"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const notifications_1 = require("../services/notifications");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// GET /api/announcements
router.get('/', async (req, res) => {
    const announcements = await prisma_1.prisma.announcement.findMany({
        where: { clubId: req.user.clubId },
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });
    return res.json(announcements);
});
// POST /api/announcements
router.post('/', (0, auth_1.requirePermission)('ANNOUNCEMENTS_WRITE'), async (req, res) => {
    try {
        const data = zod_1.z.object({
            title: zod_1.z.string().min(1),
            body: zod_1.z.string().min(1),
            pinned: zod_1.z.boolean().default(false),
        }).parse(req.body);
        const ann = await prisma_1.prisma.announcement.create({
            data: {
                clubId: req.user.clubId,
                title: data.title,
                body: data.body,
                pinned: data.pinned,
                createdById: req.user.userId,
            },
        });
        (0, notifications_1.createNotificationForAllMembers)({
            clubId: req.user.clubId,
            type: 'ANNOUNCEMENT',
            title: data.pinned ? `📌 ${data.title}` : data.title,
            body: data.body.length > 100 ? data.body.slice(0, 97) + '…' : data.body,
            link: '/announcements',
        }).catch(() => { });
        return res.status(201).json(ann);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// PATCH /api/announcements/:id
router.patch('/:id', (0, auth_1.requirePermission)('ANNOUNCEMENTS_WRITE'), async (req, res) => {
    try {
        const ann = await prisma_1.prisma.announcement.findFirst({ where: { id: req.params.id, clubId: req.user.clubId } });
        if (!ann)
            return res.status(404).json({ error: 'Comunicado não encontrado' });
        const data = zod_1.z.object({
            title: zod_1.z.string().min(1).optional(),
            body: zod_1.z.string().min(1).optional(),
            pinned: zod_1.z.boolean().optional(),
        }).parse(req.body);
        const updated = await prisma_1.prisma.announcement.update({ where: { id: ann.id }, data });
        return res.json(updated);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// DELETE /api/announcements/:id
router.delete('/:id', (0, auth_1.requirePermission)('ANNOUNCEMENTS_WRITE'), async (req, res) => {
    const ann = await prisma_1.prisma.announcement.findFirst({ where: { id: req.params.id, clubId: req.user.clubId } });
    if (!ann)
        return res.status(404).json({ error: 'Comunicado não encontrado' });
    await prisma_1.prisma.announcement.delete({ where: { id: ann.id } });
    return res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=announcements.js.map