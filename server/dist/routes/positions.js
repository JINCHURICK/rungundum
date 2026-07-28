"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STANDARD_TITLES = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
exports.STANDARD_TITLES = [
    'Presidente',
    'Vice-Presidente',
    'Secretário',
    'Tesoureiro',
    'Capitão de Estrada',
    'Sub-Capitão',
    'Provedor',
    'Assessor',
    'Relações Públicas',
    'Outro',
];
const memberSelect = { fullName: true, nickname: true, memberNumber: true, photoUrl: true };
// GET /api/positions — posições actuais e históricas
router.get('/', async (req, res) => {
    const positions = await prisma_1.prisma.clubPosition.findMany({
        where: { clubId: req.user.clubId },
        include: { member: { select: memberSelect } },
        orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
    });
    return res.json(positions);
});
// GET /api/positions/titles — lista de títulos standard
router.get('/titles', (_req, res) => res.json(exports.STANDARD_TITLES));
// POST /api/positions — atribuir cargo
router.post('/', (0, auth_1.requirePermission)('POSITIONS_WRITE'), async (req, res) => {
    try {
        const data = zod_1.z.object({
            memberId: zod_1.z.string(),
            title: zod_1.z.string().min(1),
            startDate: zod_1.z.string(),
            endDate: zod_1.z.string().nullish(),
            notes: zod_1.z.string().nullish(),
        }).parse(req.body);
        const member = await prisma_1.prisma.member.findFirst({ where: { id: data.memberId, clubId: req.user.clubId } });
        if (!member)
            return res.status(404).json({ error: 'Membro não encontrado' });
        // Se o cargo já existe como "isCurrent" para outro membro, marcar o anterior como não-current
        await prisma_1.prisma.clubPosition.updateMany({
            where: { clubId: req.user.clubId, title: data.title, isCurrent: true },
            data: { isCurrent: false, endDate: new Date(data.startDate) },
        });
        const pos = await prisma_1.prisma.clubPosition.create({
            data: {
                clubId: req.user.clubId,
                memberId: data.memberId,
                title: data.title,
                startDate: new Date(data.startDate),
                endDate: data.endDate ? new Date(data.endDate) : null,
                isCurrent: !data.endDate,
                notes: data.notes ?? null,
            },
            include: { member: { select: memberSelect } },
        });
        return res.status(201).json(pos);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// PATCH /api/positions/:id — actualizar (ex: definir data de fim / encerrar mandato)
router.patch('/:id', (0, auth_1.requirePermission)('POSITIONS_WRITE'), async (req, res) => {
    try {
        const pos = await prisma_1.prisma.clubPosition.findFirst({ where: { id: req.params.id, clubId: req.user.clubId } });
        if (!pos)
            return res.status(404).json({ error: 'Cargo não encontrado' });
        const data = zod_1.z.object({
            endDate: zod_1.z.string().nullish(),
            isCurrent: zod_1.z.boolean().optional(),
            notes: zod_1.z.string().nullish(),
        }).parse(req.body);
        const updated = await prisma_1.prisma.clubPosition.update({
            where: { id: pos.id },
            data: {
                endDate: data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : undefined,
                isCurrent: data.isCurrent !== undefined ? data.isCurrent : (data.endDate ? false : undefined),
                notes: data.notes !== undefined ? (data.notes ?? null) : undefined,
            },
            include: { member: { select: memberSelect } },
        });
        return res.json(updated);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// DELETE /api/positions/:id
router.delete('/:id', (0, auth_1.requirePermission)('POSITIONS_WRITE'), async (req, res) => {
    const pos = await prisma_1.prisma.clubPosition.findFirst({ where: { id: req.params.id, clubId: req.user.clubId } });
    if (!pos)
        return res.status(404).json({ error: 'Cargo não encontrado' });
    await prisma_1.prisma.clubPosition.delete({ where: { id: pos.id } });
    return res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=positions.js.map