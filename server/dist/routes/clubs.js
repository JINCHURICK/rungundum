"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const cloudinary_1 = require("../services/cloudinary");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.use(auth_1.authenticate);
const updateClubSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    acronym: zod_1.z.string().min(1).max(10).optional(),
    location: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
    foundedAt: zod_1.z.string().optional(),
    motto: zod_1.z.string().optional(),
    website: zod_1.z.string().optional(),
    accentColor: zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    statutesText: zod_1.z.string().optional(),
    statutesVersion: zod_1.z.string().optional(),
    defaultSettings: zod_1.z.record(zod_1.z.unknown()).optional(),
});
// GET /api/clubs/me
router.get('/me', async (req, res) => {
    const club = await prisma_1.prisma.club.findUnique({
        where: { id: req.user.clubId },
        include: {
            emergencyContacts: { orderBy: { region: 'asc' } },
            _count: { select: { members: true, raids: true } },
        },
    });
    if (!club)
        return res.status(404).json({ error: 'Clube não encontrado' });
    return res.json(club);
});
// PATCH /api/clubs/me
router.patch('/me', (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const data = updateClubSchema.parse(req.body);
        const club = await prisma_1.prisma.club.update({
            where: { id: req.user.clubId },
            data: {
                ...data,
                foundedAt: data.foundedAt ? new Date(data.foundedAt) : undefined,
                defaultSettings: data.defaultSettings,
            },
        });
        return res.json(club);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// POST /api/clubs/me/logo
router.post('/me/logo', (0, auth_1.requireRole)('ADMIN'), upload.single('logo'), async (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: 'Ficheiro em falta' });
    const url = await (0, cloudinary_1.uploadToCloudinary)(req.file.buffer, `clubs/${req.user.clubId}/logo`);
    const club = await prisma_1.prisma.club.update({ where: { id: req.user.clubId }, data: { logoUrl: url } });
    return res.json({ logoUrl: club.logoUrl });
});
// POST /api/clubs/me/second-logo
router.post('/me/second-logo', (0, auth_1.requireRole)('ADMIN'), upload.single('logo'), async (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: 'Ficheiro em falta' });
    const url = await (0, cloudinary_1.uploadToCloudinary)(req.file.buffer, `clubs/${req.user.clubId}/second-logo`);
    const club = await prisma_1.prisma.club.update({ where: { id: req.user.clubId }, data: { secondLogoUrl: url } });
    return res.json({ secondLogoUrl: club.secondLogoUrl });
});
// GET /api/clubs/me/emergency-contacts
router.get('/me/emergency-contacts', async (req, res) => {
    const contacts = await prisma_1.prisma.emergencyContact.findMany({
        where: { clubId: req.user.clubId },
        orderBy: [{ region: 'asc' }, { name: 'asc' }],
    });
    return res.json(contacts);
});
// POST /api/clubs/me/emergency-contacts
router.post('/me/emergency-contacts', (0, auth_1.requireRole)('ADMIN', 'CAPTAIN'), async (req, res) => {
    const schema = zod_1.z.object({
        region: zod_1.z.string().min(1),
        name: zod_1.z.string().min(1),
        role: zod_1.z.string().min(1),
        phone: zod_1.z.string().min(1),
    });
    try {
        const data = schema.parse(req.body);
        const contact = await prisma_1.prisma.emergencyContact.create({ data: { ...data, clubId: req.user.clubId } });
        return res.status(201).json(contact);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// DELETE /api/clubs/me/emergency-contacts/:id
router.delete('/me/emergency-contacts/:id', (0, auth_1.requireRole)('ADMIN', 'CAPTAIN'), async (req, res) => {
    const contact = await prisma_1.prisma.emergencyContact.findFirst({ where: { id: req.params.id, clubId: req.user.clubId } });
    if (!contact)
        return res.status(404).json({ error: 'Contacto não encontrado' });
    await prisma_1.prisma.emergencyContact.delete({ where: { id: req.params.id } });
    return res.json({ message: 'Contacto eliminado' });
});
exports.default = router;
//# sourceMappingURL=clubs.js.map