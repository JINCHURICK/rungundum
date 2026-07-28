"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const crypto_1 = require("crypto");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const prisma_1 = require("../lib/prisma");
const jwt_1 = require("../lib/jwt");
const auth_1 = require("../middleware/auth");
const email_1 = require("../services/email");
const router = (0, express_1.Router)();
const isDev = process.env.NODE_ENV !== 'production';
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev,
    message: { error: 'Demasiadas tentativas de login. Aguarda 15 minutos.' },
});
const twoFALimiter = (0, express_rate_limit_1.default)({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev,
    message: { error: 'Demasiadas tentativas de verificação.' },
});
const forgotLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev,
    message: { error: 'Demasiadas requisições de reset. Aguarda 1 hora.' },
});
const registerSchema = zod_1.z.object({
    clubName: zod_1.z.string().min(2),
    clubAcronym: zod_1.z.string().min(1).max(10),
    clubLocation: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    fullName: zod_1.z.string().min(2),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
function buildAuthResponse(user, club, memberId, memberPhotoUrl) {
    return {
        user: { id: user.id, email: user.email, role: user.role, memberId, platformAdmin: user.platformAdmin ?? false, photoUrl: memberPhotoUrl ?? null },
        club: { id: club.id, name: club.name, acronym: club.acronym, accentColor: club.accentColor, logoUrl: club.logoUrl },
    };
}
async function createSession(userId, clubId, role, platformAdmin = false) {
    const payload = { userId, clubId, role, platformAdmin };
    const accessToken = (0, jwt_1.signAccessToken)(payload);
    const refreshToken = (0, jwt_1.signRefreshToken)(payload);
    // Sessão única: invalida todas as sessões anteriores do utilizador
    await prisma_1.prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma_1.prisma.refreshToken.create({
        data: { userId, token: refreshToken, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
    return { accessToken, refreshToken };
}
// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const data = registerSchema.parse(req.body);
        if (await prisma_1.prisma.user.findUnique({ where: { email: data.email } })) {
            return res.status(400).json({ error: 'Email já registado' });
        }
        const passwordHash = await bcryptjs_1.default.hash(data.password, 10);
        const verificationToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
        const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias de trial
        // PrismaNeonHTTP (HTTP adapter) não suporta transacções interactivas —
        // usamos queries sequenciais; falhas parciais são raras e recuperáveis
        const club = await prisma_1.prisma.club.create({
            data: {
                name: data.clubName, acronym: data.clubAcronym, location: data.clubLocation,
                planStatus: 'TRIAL',
                trialEndsAt,
                defaultSettings: {
                    maxSpeed: 90, minDistance: 3, radioChannel: 'PMR446 Canal 6',
                    contingency: {
                        accident: 'Em caso de acidente: parar imediatamente, activar luzes de emergência, ligar 113, sinalizar a zona, aguardar Capitão de Estrada.',
                        breakdown: 'Em caso de avaria: accionar pisca-pisca, mover a moto para fora da faixa, ligar ao Capitão de Estrada.',
                        separation: 'Em caso de separação: parar no próximo ponto seguro, ligar ao Capitão de Estrada via rádio ou telefone.',
                        weather: 'Em caso de mau tempo: reduzir velocidade, aumentar distância de segurança, parar num local coberto se necessário.',
                    },
                },
            },
        });
        const user = await prisma_1.prisma.user.create({
            data: { clubId: club.id, email: data.email, passwordHash, role: 'ADMIN', verificationToken, verificationExpires },
        });
        const member = await prisma_1.prisma.member.create({
            data: { clubId: club.id, userId: user.id, fullName: data.fullName, status: 'ACTIVE' },
        });
        const result = { club, user, member };
        // criar subscrição trial no plano Comitiva (sem bloquear registo se plano não existir ainda)
        prisma_1.prisma.plan.findUnique({ where: { code: 'comitiva' } }).then(plan => {
            if (!plan)
                return;
            const now = new Date();
            const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            return prisma_1.prisma.subscription.upsert({
                where: { clubId: result.club.id },
                update: {},
                create: {
                    clubId: result.club.id,
                    planId: plan.id,
                    billingCycle: 'MONTHLY',
                    status: 'TRIAL',
                    currentPeriodStart: now,
                    currentPeriodEnd: end,
                },
            });
        }).catch(() => { });
        const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
        (0, email_1.sendEmailVerification)({
            to: data.email,
            clubName: data.clubName,
            verifyUrl: `${clientUrl}/verify-email/${verificationToken}`,
        }).catch(err => console.error('[Email verify]', err.message));
        return res.status(201).json({ requiresVerification: true, email: data.email });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// POST /api/auth/verify-email
router.post('/verify-email', async (req, res) => {
    try {
        const { token } = zod_1.z.object({ token: zod_1.z.string() }).parse(req.body);
        const user = await prisma_1.prisma.user.findUnique({
            where: { verificationToken: token },
            include: { club: true, member: true },
        });
        if (!user || !user.verificationExpires || user.verificationExpires < new Date()) {
            return res.status(400).json({ error: 'Link de verificação inválido ou expirado.' });
        }
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: true, verificationToken: null, verificationExpires: null },
        });
        const { accessToken, refreshToken } = await createSession(user.id, user.clubId, user.role, user.platformAdmin);
        return res.json({ accessToken, refreshToken, ...buildAuthResponse(user, user.club, user.member?.id, user.member?.photoUrl) });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = zod_1.z.object({ email: zod_1.z.string().email() }).parse(req.body);
        const user = await prisma_1.prisma.user.findUnique({ where: { email }, include: { club: true } });
        // Resposta genérica para não revelar se o email existe
        if (!user || user.emailVerified) {
            return res.json({ message: 'Se o email existir e não estiver verificado, receberás um novo link.' });
        }
        const verificationToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma_1.prisma.user.update({ where: { id: user.id }, data: { verificationToken, verificationExpires } });
        const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
        (0, email_1.sendEmailVerification)({
            to: user.email,
            clubName: user.club.name,
            verifyUrl: `${clientUrl}/verify-email/${verificationToken}`,
        }).catch(err => console.error('[Email resend]', err.message));
        return res.json({ message: 'Se o email existir e não estiver verificado, receberás um novo link.' });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// POST /api/auth/login — passo 1: valida credenciais, envia código 2FA
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const data = loginSchema.parse(req.body);
        const user = await prisma_1.prisma.user.findUnique({
            where: { email: data.email },
            include: { club: true, member: true },
        });
        if (!user || !(await bcryptjs_1.default.compare(data.password, user.passwordHash))) {
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }
        if (!user.emailVerified) {
            return res.status(403).json({ error: 'Verifica o teu email antes de fazer login.', requiresVerification: true, email: user.email });
        }
        // Gerar código 2FA de 6 dígitos com CSPRNG
        const code = String((0, crypto_1.randomInt)(100000, 1000000)).padStart(6, '0');
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
        await prisma_1.prisma.pendingAuth.upsert({
            where: { userId: user.id },
            update: { code, token, expiresAt },
            create: { userId: user.id, code, token, expiresAt },
        });
        // Enviar email sem bloquear a resposta
        (0, email_1.sendTwoFactorCode)({ to: user.email, code, clubName: user.club.name }).catch(() => { });
        // Em desenvolvimento, mostrar o código no terminal para facilitar o teste
        if (isDev)
            console.log(`\n[2FA DEV] Código para ${user.email}: ${code}\n`);
        return res.json({ requires2FA: true, pendingToken: token });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// POST /api/auth/verify-2fa — passo 2: valida código
router.post('/verify-2fa', twoFALimiter, async (req, res) => {
    try {
        const schema = zod_1.z.object({ pendingToken: zod_1.z.string(), code: zod_1.z.string().length(6) });
        const { pendingToken, code } = schema.parse(req.body);
        const pending = await prisma_1.prisma.pendingAuth.findUnique({
            where: { token: pendingToken },
            include: { user: { include: { club: true, member: true } } },
        });
        if (!pending || pending.expiresAt < new Date()) {
            return res.status(401).json({ error: 'Código expirado. Faz login novamente.' });
        }
        // Comparação constant-time para prevenir timing attacks
        const expected = Buffer.from(pending.code.padEnd(6));
        const provided = Buffer.from(code.padEnd(6));
        const codesMatch = expected.length === provided.length && (0, crypto_1.timingSafeEqual)(expected, provided);
        if (!codesMatch) {
            return res.status(401).json({ error: 'Código incorrecto.' });
        }
        await prisma_1.prisma.pendingAuth.delete({ where: { id: pending.id } });
        const { user } = pending;
        const { accessToken, refreshToken } = await createSession(user.id, user.clubId, user.role, user.platformAdmin);
        return res.json({ accessToken, refreshToken, ...buildAuthResponse(user, user.club, user.member?.id, user.member?.photoUrl) });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// POST /api/auth/forgot-password
router.post('/forgot-password', forgotLimiter, async (req, res) => {
    try {
        const { email } = zod_1.z.object({ email: zod_1.z.string().email() }).parse(req.body);
        const user = await prisma_1.prisma.user.findUnique({ where: { email }, include: { club: true } });
        // Resposta genérica para não revelar se o email existe
        if (!user)
            return res.json({ message: 'Se o email existir, receberás um link.' });
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { resetToken: token, resetTokenExpiresAt: expiresAt },
        });
        const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
        (0, email_1.sendPasswordReset)({ to: user.email, resetUrl: `${clientUrl}/reset-password/${token}`, clubName: user.club.name })
            .catch(err => console.error('[Email reset]', err.message));
        return res.json({ message: 'Se o email existir, receberás um link.' });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
    try {
        const schema = zod_1.z.object({ token: zod_1.z.string(), password: zod_1.z.string().min(8) });
        const { token, password } = schema.parse(req.body);
        const user = await prisma_1.prisma.user.findUnique({ where: { resetToken: token } });
        if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
            return res.status(400).json({ error: 'Link inválido ou expirado.' });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
        });
        // Invalidar todas as sessões existentes
        await prisma_1.prisma.refreshToken.deleteMany({ where: { userId: user.id } });
        return res.json({ message: 'Senha actualizada. Podes fazer login.' });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// POST /api/auth/refresh — rota do refresh token com rotação obrigatória
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken)
        return res.status(400).json({ error: 'Refresh token em falta' });
    try {
        const payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
        // deleteMany é atómico — trata pedidos concorrentes sem corrida (não lança erro se já apagado)
        const deleted = await prisma_1.prisma.refreshToken.deleteMany({
            where: { token: refreshToken, expiresAt: { gte: new Date() } },
        });
        if (deleted.count === 0)
            return res.status(401).json({ error: 'Refresh token inválido' });
        const tokenPayload = { userId: payload.userId, clubId: payload.clubId, role: payload.role, platformAdmin: payload.platformAdmin };
        const newRefreshToken = (0, jwt_1.signRefreshToken)(tokenPayload);
        await prisma_1.prisma.refreshToken.create({
            data: { userId: payload.userId, token: newRefreshToken, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        });
        const accessToken = (0, jwt_1.signAccessToken)(tokenPayload);
        return res.json({ accessToken, refreshToken: newRefreshToken });
    }
    catch {
        return res.status(401).json({ error: 'Refresh token inválido' });
    }
});
// POST /api/auth/logout
router.post('/logout', auth_1.authenticate, async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken)
        await prisma_1.prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return res.json({ message: 'Sessão terminada' });
});
// GET /api/auth/invite/:token
router.get('/invite/:token', async (req, res) => {
    const member = await prisma_1.prisma.member.findUnique({
        where: { inviteToken: req.params.token },
        include: { club: { select: { name: true, acronym: true, accentColor: true, logoUrl: true } } },
    });
    if (!member || !member.inviteExpiresAt || member.inviteExpiresAt < new Date()) {
        return res.status(404).json({ error: 'Convite inválido ou expirado' });
    }
    if (member.userId)
        return res.status(409).json({ error: 'Este convite já foi utilizado' });
    return res.json({
        memberName: member.fullName, clubName: member.club.name, clubAcronym: member.club.acronym,
        clubAccentColor: member.club.accentColor, clubLogoUrl: member.club.logoUrl,
    });
});
// POST /api/auth/invite/:token
router.post('/invite/:token', async (req, res) => {
    try {
        const { email, password } = zod_1.z.object({ email: zod_1.z.string().email(), password: zod_1.z.string().min(8) }).parse(req.body);
        const member = await prisma_1.prisma.member.findUnique({ where: { inviteToken: req.params.token }, include: { club: true } });
        if (!member || !member.inviteExpiresAt || member.inviteExpiresAt < new Date()) {
            return res.status(404).json({ error: 'Convite inválido ou expirado' });
        }
        if (member.userId)
            return res.status(409).json({ error: 'Este convite já foi utilizado' });
        if (await prisma_1.prisma.user.findUnique({ where: { email } }))
            return res.status(400).json({ error: 'Email já registado' });
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // Convite validado = email confiável, marcar como verificado imediatamente
            const user = await tx.user.create({ data: { clubId: member.clubId, email, passwordHash, role: 'MEMBER', emailVerified: true } });
            await tx.member.update({ where: { id: member.id }, data: { userId: user.id, inviteToken: null, inviteExpiresAt: null } });
            return user;
        });
        const { accessToken, refreshToken } = await createSession(result.id, member.clubId, 'MEMBER');
        return res.status(201).json({ accessToken, refreshToken, ...buildAuthResponse(result, member.club, member.id, member.photoUrl) });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: err.errors });
        throw err;
    }
});
// GET /api/auth/me
router.get('/me', auth_1.authenticate, async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.userId }, include: { club: true, member: true } });
    if (!user)
        return res.status(404).json({ error: 'Utilizador não encontrado' });
    return res.json(buildAuthResponse(user, user.club, user.member?.id, user.member?.photoUrl));
});
// DEV ONLY — endpoint para testes automáticos obterem o código 2FA da BD
if (process.env.NODE_ENV !== 'production') {
    router.get('/dev/pending-code/:email', async (req, res) => {
        const user = await prisma_1.prisma.user.findUnique({ where: { email: req.params.email } });
        if (!user)
            return res.status(404).json({ error: 'Utilizador não encontrado' });
        const pending = await prisma_1.prisma.pendingAuth.findUnique({ where: { userId: user.id } });
        if (!pending)
            return res.status(404).json({ error: 'Sem código pendente' });
        return res.json({ code: pending.code, token: pending.token });
    });
}
exports.default = router;
//# sourceMappingURL=auth.js.map