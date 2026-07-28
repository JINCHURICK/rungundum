"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const crypto_1 = require("crypto");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const cloudinary_1 = require("../services/cloudinary");
const email_1 = require("../services/email");
const multer_1 = __importDefault(require("multer"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const planLimit_1 = require("../middleware/planLimit");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.use(auth_1.authenticate);
const memberSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2),
    nickname: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    emergencyContact: zod_1.z.string().optional(),
    emergencyPhone: zod_1.z.string().optional(),
    status: zod_1.z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'GUEST']).optional(),
    memberNumber: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    birthDate: zod_1.z.string().optional(),
    biNumber: zod_1.z.string().optional(),
    bloodType: zod_1.z.string().optional(),
    licenseNumber: zod_1.z.string().optional(),
    licenseExpiresAt: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    password: zod_1.z.string().min(8).optional(),
    role: zod_1.z.enum(['ADMIN', 'VICE_PRESIDENT', 'TREASURER', 'SECRETARY', 'PR', 'DISCIPLINA', 'CAPTAIN', 'MEMBER', 'GUEST']).optional(),
});
const MEMBER_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'GUEST'];
// GET /api/members
router.get('/', async (req, res) => {
    const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status = MEMBER_STATUS_VALUES.includes(rawStatus) ? rawStatus : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : undefined;
    const members = await prisma_1.prisma.member.findMany({
        where: {
            clubId: req.user.clubId,
            ...(status ? { status } : {}),
            ...(search ? {
                OR: [
                    { fullName: { contains: search } },
                    { nickname: { contains: search } },
                ],
            } : {}),
        },
        include: { vehicles: true, user: { select: { id: true, email: true, role: true } } },
        orderBy: { fullName: 'asc' },
    });
    return res.json(members);
});
// GET /api/members/export.csv — must be before /:id
router.get('/export.csv', (0, auth_1.requirePermission)('MEMBERS_WRITE'), async (req, res) => {
    const members = await prisma_1.prisma.member.findMany({
        where: { clubId: req.user.clubId },
        include: { user: { select: { email: true } }, vehicles: { select: { brand: true, model: true, plate: true } } },
        orderBy: { fullName: 'asc' },
    });
    const escape = (v) => {
        const s = String(v ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['Número', 'Nome', 'Alcunha', 'Email', 'Telefone', 'Emergência', 'Tel. Emergência', 'Estado', 'Membro desde', 'Motos'];
    const rows = members.map((m) => [
        escape(m.memberNumber),
        escape(m.fullName),
        escape(m.nickname),
        escape(m.user?.email),
        escape(m.phone),
        escape(m.emergencyContact),
        escape(m.emergencyPhone),
        escape(m.status),
        escape(m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('pt-AO') : ''),
        escape(m.vehicles.map((v) => `${v.brand} ${v.model}${v.plate ? ` (${v.plate})` : ''}`).join('; ')),
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="membros.csv"');
    return res.send('﻿' + csv);
});
// GET /api/members/:id
router.get('/:id', async (req, res) => {
    const member = await prisma_1.prisma.member.findFirst({
        where: { id: req.params.id, clubId: req.user.clubId },
        include: {
            vehicles: true,
            user: { select: { id: true, email: true, role: true } },
            participations: {
                include: {
                    raid: { select: { id: true, title: true, date: true, status: true } },
                    checklistItems: { select: { id: true, checked: true } },
                },
                orderBy: { raid: { date: 'desc' } },
            },
        },
    });
    if (!member)
        return res.status(404).json({ error: 'Membro não encontrado' });
    return res.json(member);
});
// POST /api/members
router.post('/', (0, auth_1.requirePermission)('MEMBERS_WRITE'), async (req, res) => {
    try {
        const data = memberSchema.parse(req.body);
        // validar limite do plano (novo membro seria ACTIVE por omissão)
        const newStatus = data.status ?? 'ACTIVE';
        if (newStatus === 'ACTIVE') {
            const limitErr = await (0, planLimit_1.checkPlanLimit)(req.user.clubId);
            if (limitErr)
                return res.status(402).json(limitErr);
        }
        const { email, password, role, birthDate, licenseExpiresAt, ...memberData } = data;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            let userId;
            if (email && password) {
                const existing = await tx.user.findUnique({ where: { email } });
                if (existing)
                    throw new Error('Email já registado');
                const passwordHash = await bcryptjs_1.default.hash(password, 12);
                const user = await tx.user.create({
                    data: { clubId: req.user.clubId, email, passwordHash, role: role ?? 'MEMBER' },
                });
                userId = user.id;
            }
            const member = await tx.member.create({
                data: {
                    ...memberData,
                    clubId: req.user.clubId,
                    userId,
                    birthDate: birthDate ? new Date(birthDate) : undefined,
                    licenseExpiresAt: licenseExpiresAt ? new Date(licenseExpiresAt) : undefined,
                },
                include: { vehicles: true, user: { select: { id: true, email: true, role: true } } },
            });
            return member;
        });
        return res.status(201).json(result);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        if (err instanceof Error && err.message === 'Email já registado') {
            return res.status(409).json({ error: 'Email já registado' });
        }
        throw err;
    }
});
// PATCH /api/members/me — must be before /:id
router.patch('/me', async (req, res) => {
    const member = await prisma_1.prisma.member.findFirst({ where: { userId: req.user.userId } });
    if (!member)
        return res.status(404).json({ error: 'Perfil não encontrado' });
    const schema = zod_1.z.object({
        nickname: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        emergencyContact: zod_1.z.string().optional(),
        emergencyPhone: zod_1.z.string().optional(),
    });
    const data = schema.parse(req.body);
    const updated = await prisma_1.prisma.member.update({
        where: { id: member.id },
        data,
        include: { vehicles: true, user: { select: { id: true, email: true, role: true } } },
    });
    return res.json(updated);
});
// PATCH /api/members/:id
router.patch('/:id', (0, auth_1.requirePermission)('MEMBERS_WRITE'), async (req, res) => {
    try {
        const existing = await prisma_1.prisma.member.findFirst({
            where: { id: req.params.id, clubId: req.user.clubId },
            include: { user: true },
        });
        if (!existing)
            return res.status(404).json({ error: 'Membro não encontrado' });
        const data = memberSchema.partial().parse(req.body);
        const { email, password, role, birthDate, licenseExpiresAt, ...memberData } = data;
        // se está a reactivar um membro (a pôr ACTIVE), verificar limite do plano
        if (data.status === 'ACTIVE' && existing.status !== 'ACTIVE') {
            const limitErr = await (0, planLimit_1.checkPlanLimit)(req.user.clubId);
            if (limitErr)
                return res.status(402).json(limitErr);
        }
        const member = await prisma_1.prisma.$transaction(async (tx) => {
            // Actualizar papel do utilizador associado
            if (role && existing.user) {
                await tx.user.update({ where: { id: existing.user.id }, data: { role } });
            }
            return tx.member.update({
                where: { id: req.params.id },
                data: {
                    ...memberData,
                    birthDate: birthDate ? new Date(birthDate) : undefined,
                    licenseExpiresAt: licenseExpiresAt ? new Date(licenseExpiresAt) : undefined,
                },
                include: { vehicles: true, user: { select: { id: true, email: true, role: true } } },
            });
        });
        return res.json(member);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// POST /api/members/:id/photo
router.post('/:id/photo', (0, auth_1.requirePermission)('MEMBERS_WRITE'), upload.single('photo'), async (req, res) => {
    const member = await prisma_1.prisma.member.findFirst({ where: { id: req.params.id, clubId: req.user.clubId } });
    if (!member)
        return res.status(404).json({ error: 'Membro não encontrado' });
    if (!req.file)
        return res.status(400).json({ error: 'Ficheiro em falta' });
    const url = await (0, cloudinary_1.uploadToCloudinary)(req.file.buffer, `clubs/${req.user.clubId}/members/${req.params.id}`);
    const updated = await prisma_1.prisma.member.update({ where: { id: req.params.id }, data: { photoUrl: url } });
    return res.json({ photoUrl: updated.photoUrl });
});
// POST /api/members/:id/invite — gera link de convite para o membro criar conta
router.post('/:id/invite', (0, auth_1.requirePermission)('MEMBERS_WRITE'), async (req, res) => {
    const member = await prisma_1.prisma.member.findFirst({
        where: { id: req.params.id, clubId: req.user.clubId },
        include: { user: true, club: { select: { name: true } } },
    });
    if (!member)
        return res.status(404).json({ error: 'Membro não encontrado' });
    if (member.user)
        return res.status(409).json({ error: 'Este membro já tem conta de acesso' });
    const schema = zod_1.z.object({ email: zod_1.z.string().email().optional() });
    const { email } = schema.parse(req.body);
    const token = (0, crypto_1.randomBytes)(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h
    await prisma_1.prisma.member.update({
        where: { id: req.params.id },
        data: { inviteToken: token, inviteExpiresAt: expiresAt },
    });
    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
    const inviteUrl = `${clientUrl}/invite/${token}`;
    if (email) {
        try {
            await (0, email_1.sendAccountInvite)({ to: email, memberName: member.fullName, clubName: member.club.name, inviteUrl });
        }
        catch (err) {
            console.error('[invite] email send failed:', err);
        }
    }
    return res.json({ inviteUrl, expiresAt, emailSent: !!email });
});
// GET /api/members/:id/vehicles
router.get('/:id/vehicles', async (req, res) => {
    const member = await prisma_1.prisma.member.findFirst({ where: { id: req.params.id, clubId: req.user.clubId } });
    if (!member)
        return res.status(404).json({ error: 'Membro não encontrado' });
    const vehicles = await prisma_1.prisma.vehicle.findMany({ where: { memberId: req.params.id }, orderBy: { brand: 'asc' } });
    return res.json(vehicles);
});
// POST /api/members/:id/vehicles
router.post('/:id/vehicles', async (req, res) => {
    const member = await prisma_1.prisma.member.findFirst({ where: { id: req.params.id, clubId: req.user.clubId } });
    if (!member)
        return res.status(404).json({ error: 'Membro não encontrado' });
    const schema = zod_1.z.object({
        brand: zod_1.z.string().min(1),
        model: zod_1.z.string().min(1),
        year: zod_1.z.number().int().optional(),
        plate: zod_1.z.string().optional(),
        type: zod_1.z.enum(['TRAIL', 'ROAD', 'CUSTOM', 'SCOOTER', 'SUPPORT', 'OTHER']).optional(),
        displacement: zod_1.z.number().int().optional(),
        notes: zod_1.z.string().optional(),
    });
    try {
        const data = schema.parse(req.body);
        const vehicle = await prisma_1.prisma.vehicle.create({ data: { ...data, memberId: req.params.id } });
        return res.status(201).json(vehicle);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// PATCH /api/members/:memberId/vehicles/:vehicleId
router.patch('/:memberId/vehicles/:vehicleId', async (req, res) => {
    const member = await prisma_1.prisma.member.findFirst({ where: { id: req.params.memberId, clubId: req.user.clubId } });
    if (!member)
        return res.status(404).json({ error: 'Membro não encontrado' });
    // Verificar que o veículo pertence ao membro (previne IDOR cross-member)
    const existing = await prisma_1.prisma.vehicle.findFirst({ where: { id: req.params.vehicleId, memberId: req.params.memberId } });
    if (!existing)
        return res.status(404).json({ error: 'Veículo não encontrado' });
    // Schema explícito — sem mass assignment via req.body directo
    const vehicleUpdateSchema = zod_1.z.object({
        brand: zod_1.z.string().min(1).max(50).optional(),
        model: zod_1.z.string().min(1).max(100).optional(),
        year: zod_1.z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
        plate: zod_1.z.string().max(20).optional(),
        type: zod_1.z.enum(['TRAIL', 'ROAD', 'CUSTOM', 'SCOOTER', 'SUPPORT', 'OTHER']).optional(),
        displacement: zod_1.z.number().int().min(50).max(3000).optional(),
        notes: zod_1.z.string().max(500).optional(),
    });
    try {
        const data = vehicleUpdateSchema.parse(req.body);
        const vehicle = await prisma_1.prisma.vehicle.update({ where: { id: req.params.vehicleId }, data });
        return res.json(vehicle);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// DELETE /api/members/:memberId/vehicles/:vehicleId
router.delete('/:memberId/vehicles/:vehicleId', async (req, res) => {
    const member = await prisma_1.prisma.member.findFirst({ where: { id: req.params.memberId, clubId: req.user.clubId } });
    if (!member)
        return res.status(404).json({ error: 'Membro não encontrado' });
    // Verificar que o veículo pertence ao membro deste clube (previne IDOR)
    const vehicle = await prisma_1.prisma.vehicle.findFirst({ where: { id: req.params.vehicleId, memberId: req.params.memberId } });
    if (!vehicle)
        return res.status(404).json({ error: 'Veículo não encontrado' });
    await prisma_1.prisma.vehicle.delete({ where: { id: vehicle.id } });
    return res.json({ message: 'Veículo eliminado' });
});
exports.default = router;
//# sourceMappingURL=members.js.map