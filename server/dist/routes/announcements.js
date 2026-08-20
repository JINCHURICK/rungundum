"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const notifications_1 = require("../services/notifications");
const sms_1 = require("../services/sms");
const notificationMode_1 = require("../lib/notificationMode");
async function notifyMembers(clubId, clubName, title, body, notify) {
    const members = await prisma_1.prisma.member.findMany({
        where: { clubId, status: 'ACTIVE' },
        include: { user: { select: { email: true } } },
    });
    const { sms: canSms, email: canEmail } = await (0, notificationMode_1.getNotificationMode)(clubId);
    const preview = body.length > 100 ? body.slice(0, 97) + '...' : body;
    const smsMsg = `${clubName} | ${title}: ${preview}`;
    if ((notify === 'sms' || notify === 'both') && canSms) {
        const phones = members.map(m => m.phone).filter(Boolean);
        if (phones.length > 0)
            (0, sms_1.sendBulkSms)(phones, smsMsg).catch(() => { });
    }
    if ((notify === 'email' || notify === 'both') && canEmail) {
        const { sendAnnouncementEmail } = await Promise.resolve().then(() => __importStar(require('../services/email')));
        for (const m of members) {
            if (!m.user?.email)
                continue;
            sendAnnouncementEmail({
                to: m.user.email,
                memberName: m.nickname ?? m.fullName,
                clubName,
                title,
                body,
            }).catch(() => { });
        }
    }
}
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
            notify: zod_1.z.enum(['none', 'sms', 'email', 'both']).default('none'),
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
        if (data.notify !== 'none') {
            const club = await prisma_1.prisma.club.findUnique({ where: { id: req.user.clubId }, select: { name: true } });
            notifyMembers(req.user.clubId, club?.name ?? 'Clube', data.title, data.body, data.notify).catch(() => { });
        }
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