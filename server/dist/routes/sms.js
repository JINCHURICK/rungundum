"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const sms_1 = require("../services/sms");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.use((0, auth_1.requirePermission)('SMS'));
// POST /api/sms/send — enviar SMS para membros específicos ou todos
router.post('/send', async (req, res) => {
    try {
        const schema = zod_1.z.object({
            message: zod_1.z.string().min(1).max(160),
            memberIds: zod_1.z.array(zod_1.z.string()).optional(), // vazio = todos os membros activos com telefone
        });
        const { message, memberIds } = schema.parse(req.body);
        const where = {
            clubId: req.user.clubId,
            status: 'ACTIVE',
            phone: { not: null },
        };
        if (memberIds && memberIds.length > 0) {
            where.id = { in: memberIds };
        }
        const members = await prisma_1.prisma.member.findMany({ where, select: { id: true, fullName: true, phone: true } });
        const phones = members.map(m => m.phone).filter(Boolean);
        if (phones.length === 0) {
            return res.status(400).json({ error: 'Nenhum membro com telemóvel configurado.' });
        }
        await (0, sms_1.sendBulkSms)(phones, message);
        return res.json({ sent: phones.length, message: `SMS enviado para ${phones.length} membro(s).` });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// POST /api/sms/member/:id — SMS directo para um membro
router.post('/member/:id', async (req, res) => {
    try {
        const { message } = zod_1.z.object({ message: zod_1.z.string().min(1).max(160) }).parse(req.body);
        const member = await prisma_1.prisma.member.findFirst({
            where: { id: req.params.id, clubId: req.user.clubId },
        });
        if (!member)
            return res.status(404).json({ error: 'Membro não encontrado' });
        if (!member.phone)
            return res.status(400).json({ error: 'O membro não tem telemóvel configurado.' });
        await (0, sms_1.sendSms)(member.phone, message);
        return res.json({ message: 'SMS enviado.' });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
exports.default = router;
//# sourceMappingURL=sms.js.map