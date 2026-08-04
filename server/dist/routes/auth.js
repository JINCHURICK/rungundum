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
const prisma_2 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const email_1 = require("../services/email");
const router = (0, express_1.Router)();
const isDev = process.env.NODE_ENV !== 'production';
// Rate limiting por email — complementa o limite por IP, resiste a IPs rotativos
const failedByEmail = new Map();
const EMAIL_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const EMAIL_MAX_FAILS = 10;
function checkEmailBlocked(email) {
    const entry = failedByEmail.get(email);
    if (!entry)
        return false;
    if (Date.now() > entry.resetAt) {
        failedByEmail.delete(email);
        return false;
    }
    return entry.count >= EMAIL_MAX_FAILS;
}
function recordEmailFailure(email) {
    const now = Date.now();
    const entry = failedByEmail.get(email);
    if (entry && now > entry.resetAt) {
        failedByEmail.delete(email);
    }
    const cur = failedByEmail.get(email) ?? { count: 0, resetAt: now + EMAIL_WINDOW_MS };
    cur.count++;
    failedByEmail.set(email, cur);
}
function clearEmailFailures(email) {
    failedByEmail.delete(email);
}
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev,
    message: { error: 'Demasiadas tentativas de login. Aguarda 15 minutos.' },
});
// Tracker de tentativas 2FA por pendingToken (in-memory)
// Progressive: 1ª vez → 10min, seguintes → 1 hora
const twoFaAttempts = new Map();
const MAX_2FA_ATTEMPTS = 5;
const LOCK_DURATIONS_MS = [10 * 60 * 1000, 60 * 60 * 1000]; // 10min, 1h
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
        club: club ? { id: club.id, name: club.name, acronym: club.acronym, accentColor: club.accentColor, logoUrl: club.logoUrl } : null,
    };
}
async function createSession(userId, clubId, role, platformAdmin = false, opts) {
    // Incrementar tokenVersion invalida imediatamente qualquer access token activo
    // (mesmo que ainda não tenha expirado), forçando logout na próxima chamada de API
    const { tokenVersion } = await prisma_1.prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
        select: { tokenVersion: true },
    });
    const payload = { userId, clubId: clubId ?? '', role, platformAdmin, tv: tokenVersion };
    const accessToken = (0, jwt_1.signAccessToken)(payload);
    const refreshToken = (0, jwt_1.signRefreshToken)(payload);
    // Sessão única: invalida todas as sessões anteriores do utilizador
    await prisma_1.prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma_1.prisma.refreshToken.create({
        data: {
            userId,
            token: refreshToken,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            ipAddress: opts?.ip ?? null,
            userAgent: opts?.userAgent ?? null,
        },
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
        // PrismaNeonHTTP: misturar DateTime + Json no mesmo create() causa serialização
        // incorrecta do Date (bug do adapter) — separamos em dois passos
        const club = await prisma_1.prisma.club.create({
            data: {
                name: data.clubName, acronym: data.clubAcronym, location: data.clubLocation,
                planStatus: 'TRIAL',
                trialEndsAt,
            },
        });
        await prisma_1.prisma.club.update({
            where: { id: club.id },
            data: {
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
            const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
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
        const { accessToken, refreshToken } = await createSession(user.id, user.clubId, user.role, user.platformAdmin, {
            ip: req.ip, userAgent: req.headers['user-agent'],
        });
        return res.json({ accessToken, refreshToken, ...buildAuthResponse(user, user.club ?? null, user.member?.id, user.member?.photoUrl) });
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
            clubName: user.club?.name ?? 'Rungundum',
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
        // Verificar bloqueio por email antes de consultar a BD
        if (!isDev && checkEmailBlocked(data.email)) {
            return res.status(429).json({ error: 'Conta temporariamente bloqueada. Aguarda 15 minutos.' });
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { email: data.email },
            include: { club: true, member: true },
        });
        if (!user || !(await bcryptjs_1.default.compare(data.password, user.passwordHash))) {
            if (!isDev)
                recordEmailFailure(data.email);
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }
        // Login bem sucedido — limpar contagem de falhas
        clearEmailFailures(data.email);
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
        (0, email_1.sendTwoFactorCode)({ to: user.email, code, clubName: user.club?.name ?? 'Rungundum' }).catch(() => { });
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
// POST /api/auth/verify-2fa — passo 2: valida código (com rate limiting progressivo por sessão)
router.post('/verify-2fa', async (req, res) => {
    try {
        const schema = zod_1.z.object({ pendingToken: zod_1.z.string(), code: zod_1.z.string().length(6) });
        const { pendingToken, code } = schema.parse(req.body);
        const now = Date.now();
        const entry = twoFaAttempts.get(pendingToken) ?? { count: 0, lockedUntil: 0, lockLevel: 0 };
        // Verificar se está bloqueado
        if (entry.lockedUntil > now) {
            const minutesLeft = Math.ceil((entry.lockedUntil - now) / 60000);
            return res.status(429).json({
                error: `Demasiadas tentativas. Aguarda ${minutesLeft} minuto${minutesLeft !== 1 ? 's' : ''}.`,
                lockedUntil: entry.lockedUntil,
            });
        }
        const pending = await prisma_1.prisma.pendingAuth.findUnique({
            where: { token: pendingToken },
            include: { user: { include: { club: true, member: true } } },
        });
        if (!pending || pending.expiresAt < new Date()) {
            twoFaAttempts.delete(pendingToken);
            return res.status(401).json({ error: 'Código expirado. Faz login novamente.' });
        }
        // Comparação constant-time para prevenir timing attacks
        const expected = Buffer.from(pending.code.padEnd(6));
        const provided = Buffer.from(code.padEnd(6));
        const codesMatch = expected.length === provided.length && (0, crypto_1.timingSafeEqual)(expected, provided);
        if (!codesMatch) {
            entry.count++;
            const attemptsLeft = MAX_2FA_ATTEMPTS - entry.count;
            if (attemptsLeft <= 0) {
                const duration = LOCK_DURATIONS_MS[Math.min(entry.lockLevel, LOCK_DURATIONS_MS.length - 1)];
                entry.lockedUntil = now + duration;
                entry.lockLevel++;
                entry.count = 0;
                twoFaAttempts.set(pendingToken, entry);
                const minutes = duration / 60000;
                return res.status(429).json({
                    error: `Bloqueado por ${minutes} minuto${minutes !== 1 ? 's' : ''} após demasiadas tentativas incorretas.`,
                    lockedUntil: entry.lockedUntil,
                });
            }
            twoFaAttempts.set(pendingToken, entry);
            const warning = attemptsLeft <= 2
                ? `Código incorrecto. Tens apenas ${attemptsLeft} tentativa${attemptsLeft !== 1 ? 's' : ''} restante${attemptsLeft !== 1 ? 's' : ''}.`
                : 'Código incorrecto.';
            return res.status(401).json({ error: warning, attemptsLeft });
        }
        // Sucesso — limpar tracker e sessão pendente
        twoFaAttempts.delete(pendingToken);
        await prisma_1.prisma.pendingAuth.delete({ where: { id: pending.id } });
        const { user } = pending;
        const { accessToken, refreshToken } = await createSession(user.id, user.clubId, user.role, user.platformAdmin, {
            ip: req.ip, userAgent: req.headers['user-agent'],
        });
        return res.json({ accessToken, refreshToken, ...buildAuthResponse(user, user.club ?? null, user.member?.id, user.member?.photoUrl) });
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
        const rawToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const hashToken = (0, crypto_1.createHash)('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { resetToken: hashToken, resetTokenExpiresAt: expiresAt },
        });
        // Enviar o token RAW no URL — guardar apenas o HASH na BD
        const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
        (0, email_1.sendPasswordReset)({ to: user.email, resetUrl: `${clientUrl}/reset-password/${rawToken}`, clubName: user.club?.name ?? 'Rungundum' })
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
        // Comparar o hash do token recebido — token em plaintext nunca é guardado na BD
        const hashToken = (0, crypto_1.createHash)('sha256').update(token).digest('hex');
        const user = await prisma_1.prisma.user.findUnique({ where: { resetToken: hashToken } });
        if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
            return res.status(400).json({ error: 'Link inválido ou expirado.' });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                resetToken: null,
                resetTokenExpiresAt: null,
                tokenVersion: { increment: 1 }, // invalida todos os access tokens activos imediatamente
            },
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
// POST /api/auth/refresh — rotação de refresh token
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken)
        return res.status(400).json({ error: 'Refresh token em falta' });
    // 1. JWT — barreira principal; inválido = rejeitar imediatamente
    let payload;
    try {
        payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
    }
    catch {
        return res.status(401).json({ error: 'Refresh token inválido' });
    }
    // 2. Verificar token na BD (sessão única) + idle timeout por inactividade
    // "não encontrado" = sessão terminada por outro login/logout
    // Erro de BD = Prisma panic no Hostinger → continuar com JWT apenas (sem rotação)
    const IDLE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias sem actividade
    let tokenConfirmedInDb = false;
    try {
        const found = await prisma_1.prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            select: { id: true, lastUsedAt: true },
        });
        if (!found) {
            return res.status(401).json({
                error: 'A sua sessão foi terminada. Por favor autentique-se novamente.',
                code: 'SESSION_TERMINATED',
            });
        }
        // Sessão inactiva há mais de 7 dias → forçar novo login
        if (found.lastUsedAt && Date.now() - found.lastUsedAt.getTime() > IDLE_TIMEOUT_MS) {
            await prisma_1.prisma.refreshToken.deleteMany({ where: { token: refreshToken } }).catch(() => { });
            return res.status(401).json({
                error: 'Sessão expirada por inatividade. Faz login novamente.',
                code: 'IDLE_TIMEOUT',
            });
        }
        tokenConfirmedInDb = true;
    }
    catch (err) {
        if (err?.name === 'PrismaClientRustPanicError')
            (0, prisma_2.recreatePrismaClient)();
        // BD indisponível — modo fallback JWT, sem rotação
    }
    // 3. tokenVersion actual (best-effort) — try/catch captures both sync throws and rejected promises
    let user = null;
    try {
        user = await prisma_1.prisma.user.findUnique({
            where: { id: payload.userId },
            select: { tokenVersion: true },
        });
    }
    catch (err) {
        if (err?.name === 'PrismaClientRustPanicError')
            (0, prisma_2.recreatePrismaClient)();
    }
    const tokenPayload = {
        userId: payload.userId,
        clubId: payload.clubId,
        role: payload.role,
        platformAdmin: payload.platformAdmin,
        tv: user?.tokenVersion ?? (payload.tv ?? 0),
    };
    const newRefreshToken = (0, jwt_1.signRefreshToken)(tokenPayload);
    const accessToken = (0, jwt_1.signAccessToken)(tokenPayload);
    // 4. Rotação SÍNCRONA: AGUARDAR o create antes de responder
    // Se o create falhar → devolver o token ORIGINAL (ainda válido na BD)
    // Elimina definitivamente o problema "cliente tem token que não existe na BD"
    if (tokenConfirmedInDb) {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        try {
            await prisma_1.prisma.refreshToken.create({
                data: { userId: payload.userId, token: newRefreshToken, expiresAt, lastUsedAt: new Date() },
            });
            // Novo token confirmado na BD — apagar o antigo de forma assíncrona (seguro)
            prisma_1.prisma.refreshToken.deleteMany({ where: { token: refreshToken } }).catch((err) => {
                if (err?.name === 'PrismaClientRustPanicError')
                    (0, prisma_2.recreatePrismaClient)();
            });
            return res.json({ accessToken, refreshToken: newRefreshToken });
        }
        catch (err) {
            if (err?.name === 'PrismaClientRustPanicError')
                (0, prisma_2.recreatePrismaClient)();
            // Create falhou (panic, coluna em falta, etc.) → devolver token original
            // O token original AINDA está na BD, logo o próximo refresh vai funcionar
        }
    }
    // BD indisponível ou create falhou → access token renovado, refresh token inalterado
    return res.json({ accessToken, refreshToken });
});
// POST /api/auth/logout
router.post('/logout', auth_1.authenticate, async (req, res) => {
    const userId = req.user.userId;
    // Revogar todos os refresh tokens E incrementar tokenVersion para invalidar access tokens activos imediatamente
    await Promise.all([
        prisma_1.prisma.refreshToken.deleteMany({ where: { userId } }),
        prisma_1.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
    ]).catch(() => { });
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
    try {
        const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.userId }, include: { club: true, member: true } });
        if (!user)
            return res.status(404).json({ error: 'Utilizador não encontrado' });
        return res.json(buildAuthResponse(user, user.club ?? null, user.member?.id, user.member?.photoUrl));
    }
    catch {
        return res.status(503).json({ error: 'Serviço temporariamente indisponível' });
    }
});
// PATCH /api/auth/change-password — alterar password do utilizador autenticado
router.patch('/change-password', auth_1.authenticate, async (req, res) => {
    const { currentPassword, newPassword } = zod_1.z.object({
        currentPassword: zod_1.z.string().min(1, 'Password atual obrigatória'),
        newPassword: zod_1.z.string().min(8, 'Nova password: mínimo 8 caracteres'),
    }).parse(req.body);
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.userId }, select: { id: true, passwordHash: true } });
    if (!user)
        return res.status(404).json({ error: 'Utilizador não encontrado' });
    const valid = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
    if (!valid)
        return res.status(400).json({ error: 'Password atual incorreta' });
    const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
    await prisma_1.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    return res.json({ message: 'Password alterada com sucesso' });
});
// DEV ONLY — endpoint para testes automáticos obterem o código 2FA da BD
// Protegido por DEV_SECRET mesmo em desenvolvimento — nunca expor em produção
if (process.env.NODE_ENV !== 'production') {
    const DEV_SECRET = process.env.DEV_SECRET;
    router.get('/dev/pending-code/:email', async (req, res) => {
        if (DEV_SECRET && req.headers['x-dev-secret'] !== DEV_SECRET) {
            return res.status(403).json({ error: 'Forbidden' });
        }
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