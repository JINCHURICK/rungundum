"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
// --- Mocks (hoisted antes dos imports) ---
vitest_1.vi.mock('../lib/prisma', () => ({
    prisma: {
        user: { findUnique: vitest_1.vi.fn(), create: vitest_1.vi.fn(), update: vitest_1.vi.fn() },
        club: { create: vitest_1.vi.fn(), update: vitest_1.vi.fn() },
        member: { create: vitest_1.vi.fn(), update: vitest_1.vi.fn(), findUnique: vitest_1.vi.fn() },
        plan: { findUnique: vitest_1.vi.fn().mockResolvedValue(null) },
        subscription: { upsert: vitest_1.vi.fn() },
        refreshToken: {
            deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }),
            create: vitest_1.vi.fn().mockResolvedValue({ id: 'rt-1' }),
        },
        pendingAuth: {
            findUnique: vitest_1.vi.fn(),
            upsert: vitest_1.vi.fn().mockResolvedValue({ id: 'pa-1' }),
            delete: vitest_1.vi.fn().mockResolvedValue({ id: 'pa-1' }),
        },
    },
    recreatePrismaClient: vitest_1.vi.fn(),
}));
vitest_1.vi.mock('../services/email', () => ({
    sendTwoFactorCode: vitest_1.vi.fn().mockResolvedValue(undefined),
    sendPasswordReset: vitest_1.vi.fn().mockResolvedValue(undefined),
    sendEmailVerification: vitest_1.vi.fn().mockResolvedValue(undefined),
}));
vitest_1.vi.mock('bcryptjs', () => ({
    default: {
        compare: vitest_1.vi.fn(),
        hash: vitest_1.vi.fn().mockResolvedValue('$2b$10$hashed'),
    },
}));
vitest_1.vi.mock('node-cron', () => ({ default: { schedule: vitest_1.vi.fn() } }));
// --- Imports (depois dos mocks) ---
const auth_1 = __importDefault(require("../routes/auth"));
const prisma_1 = require("../lib/prisma");
const jwt_1 = require("../lib/jwt");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// --- App de teste mínimo (sem compressão, cron, startup, etc.) ---
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use('/api/auth', auth_1.default);
// --- Helpers de acesso às funções mockadas ---
const userMock = prisma_1.prisma.user;
const pendingAuthMock = prisma_1.prisma.pendingAuth;
const refreshMock = prisma_1.prisma.refreshToken;
const compareMock = bcryptjs_1.default.compare;
// --- Fixtures reutilizáveis ---
const mockClub = {
    id: 'club-1', name: 'Rungundum MC', acronym: 'RMC',
    accentColor: '#dc2626', logoUrl: null,
};
const mockUser = {
    id: 'user-1', email: 'admin@rungundum.com', passwordHash: '$2b$10$hashed',
    role: 'ADMIN', emailVerified: true, platformAdmin: false,
    clubId: 'club-1', club: mockClub,
    member: { id: 'member-1', photoUrl: null },
};
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('POST /api/auth/login', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        refreshMock.deleteMany.mockResolvedValue({ count: 0 });
        refreshMock.create.mockResolvedValue({ id: 'rt-1' });
        pendingAuthMock.upsert.mockResolvedValue({ id: 'pa-1' });
    });
    (0, vitest_1.it)('retorna 400 quando o payload é inválido (email mal formado)', async () => {
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/login')
            .send({ email: 'nao-e-um-email', password: 'x' });
        (0, vitest_1.expect)(res.status).toBe(400);
    });
    (0, vitest_1.it)('retorna 401 quando o utilizador não existe', async () => {
        userMock.findUnique.mockResolvedValue(null);
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/login')
            .send({ email: 'ninguem@test.com', password: 'pass1234' });
        (0, vitest_1.expect)(res.status).toBe(401);
        (0, vitest_1.expect)(res.body.error).toMatch(/incorretos/i);
    });
    (0, vitest_1.it)('retorna 401 quando a senha está errada', async () => {
        userMock.findUnique.mockResolvedValue(mockUser);
        compareMock.mockResolvedValue(false);
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/login')
            .send({ email: mockUser.email, password: 'errada' });
        (0, vitest_1.expect)(res.status).toBe(401);
        (0, vitest_1.expect)(res.body.error).toMatch(/incorretos/i);
    });
    (0, vitest_1.it)('retorna 403 quando o email não está verificado', async () => {
        userMock.findUnique.mockResolvedValue({ ...mockUser, emailVerified: false });
        compareMock.mockResolvedValue(true);
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/login')
            .send({ email: mockUser.email, password: 'correta' });
        (0, vitest_1.expect)(res.status).toBe(403);
        (0, vitest_1.expect)(res.body.requiresVerification).toBe(true);
    });
    (0, vitest_1.it)('retorna 200 com requires2FA quando as credenciais são válidas', async () => {
        userMock.findUnique.mockResolvedValue(mockUser);
        compareMock.mockResolvedValue(true);
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/login')
            .send({ email: mockUser.email, password: 'correta' });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.requires2FA).toBe(true);
        (0, vitest_1.expect)(typeof res.body.pendingToken).toBe('string');
        (0, vitest_1.expect)(res.body.pendingToken.length).toBeGreaterThan(10);
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-2fa
// ─────────────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('POST /api/auth/verify-2fa', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        refreshMock.deleteMany.mockResolvedValue({ count: 0 });
        refreshMock.create.mockResolvedValue({ id: 'rt-1' });
        pendingAuthMock.delete.mockResolvedValue({ id: 'pa-1' });
    });
    (0, vitest_1.it)('retorna 401 quando o código está expirado', async () => {
        pendingAuthMock.findUnique.mockResolvedValue({
            id: 'pa-1', code: '123456', token: 'tok',
            expiresAt: new Date(Date.now() - 1000), // já expirou
            user: mockUser,
        });
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/verify-2fa')
            .send({ pendingToken: 'tok', code: '123456' });
        (0, vitest_1.expect)(res.status).toBe(401);
        (0, vitest_1.expect)(res.body.error).toMatch(/expirado/i);
    });
    (0, vitest_1.it)('retorna 401 quando o código está errado', async () => {
        pendingAuthMock.findUnique.mockResolvedValue({
            id: 'pa-1', code: '111111', token: 'tok',
            expiresAt: new Date(Date.now() + 60_000),
            user: mockUser,
        });
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/verify-2fa')
            .send({ pendingToken: 'tok', code: '999999' });
        (0, vitest_1.expect)(res.status).toBe(401);
        (0, vitest_1.expect)(res.body.error).toMatch(/incorrecto/i);
    });
    (0, vitest_1.it)('retorna 200 com tokens e dados do utilizador quando o código é correcto', async () => {
        pendingAuthMock.findUnique.mockResolvedValue({
            id: 'pa-1', code: '123456', token: 'tok',
            expiresAt: new Date(Date.now() + 60_000),
            user: mockUser,
        });
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/verify-2fa')
            .send({ pendingToken: 'tok', code: '123456' });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(typeof res.body.accessToken).toBe('string');
        (0, vitest_1.expect)(typeof res.body.refreshToken).toBe('string');
        (0, vitest_1.expect)(res.body.user.email).toBe(mockUser.email);
        (0, vitest_1.expect)(res.body.club.id).toBe(mockClub.id);
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('POST /api/auth/refresh', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        refreshMock.deleteMany.mockResolvedValue({ count: 1 });
        refreshMock.create.mockResolvedValue({ id: 'rt-new' });
    });
    (0, vitest_1.it)('retorna 400 quando o token está ausente', async () => {
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/refresh')
            .send({});
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)(res.body.error).toMatch(/falta/i);
    });
    (0, vitest_1.it)('retorna 401 para JWT inválido', async () => {
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: 'isto.nao.e.um.jwt' });
        (0, vitest_1.expect)(res.status).toBe(401);
        (0, vitest_1.expect)(res.body.error).toMatch(/inválido/i);
    });
    (0, vitest_1.it)('retorna 200 com novos tokens para refresh token válido', async () => {
        const token = (0, jwt_1.signRefreshToken)({ userId: 'user-1', clubId: 'club-1', role: 'ADMIN' });
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: token });
        (0, vitest_1.expect)(res.status).toBe(200);
        // Ambos os tokens são JWTs válidos (3 partes separadas por ponto)
        (0, vitest_1.expect)(res.body.accessToken.split('.')).toHaveLength(3);
        (0, vitest_1.expect)(res.body.refreshToken.split('.')).toHaveLength(3);
    });
});
//# sourceMappingURL=auth.test.js.map