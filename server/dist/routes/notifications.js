"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// GET /api/notifications — últimas 30 notificações do utilizador
router.get('/', async (req, res) => {
    const notifications = await prisma_1.prisma.notification.findMany({
        where: { userId: req.user.userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
    });
    const unreadCount = await prisma_1.prisma.notification.count({
        where: { userId: req.user.userId, read: false },
    });
    return res.json({ notifications, unreadCount });
});
// PATCH /api/notifications/:id/read — marcar uma como lida
router.patch('/:id/read', async (req, res) => {
    await prisma_1.prisma.notification.updateMany({
        where: { id: req.params.id, userId: req.user.userId },
        data: { read: true },
    });
    return res.json({ ok: true });
});
// POST /api/notifications/read-all — marcar todas como lidas
router.post('/read-all', async (req, res) => {
    await prisma_1.prisma.notification.updateMany({
        where: { userId: req.user.userId, read: false },
        data: { read: true },
    });
    return res.json({ ok: true });
});
exports.default = router;
//# sourceMappingURL=notifications.js.map