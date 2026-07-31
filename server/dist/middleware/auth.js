"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.invalidateClubStatusCache = invalidateClubStatusCache;
exports.requireRole = requireRole;
exports.requirePermission = requirePermission;
exports.requirePlatformAdmin = requirePlatformAdmin;
const jwt_1 = require("../lib/jwt");
const permissions_1 = require("../lib/permissions");
const prisma_1 = require("../lib/prisma");
// Cache em memória: clubId → { planStatus, cachedAt }
// Evita query extra à BD em cada pedido — TTL de 5 minutos
const clubStatusCache = new Map();
const CLUB_CACHE_TTL = 5 * 60 * 1000;
// Rotas isentas da verificação de subscrição
const SUBSCRIPTION_EXEMPT = [
    '/api/auth',
    '/api/public',
    '/api/plans',
    '/api/subscriptions',
    '/api/platform-admin',
];
async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de acesso em falta' });
    }
    const token = authHeader.slice(7);
    let payload;
    try {
        payload = (0, jwt_1.verifyAccessToken)(token);
    }
    catch {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
    // Verificar tokenVersion na BD — garante revogação imediata após logout, reset de password ou alteração de role
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: payload.userId },
            select: { tokenVersion: true },
        });
        if (!user || user.tokenVersion !== (payload.tv ?? 0)) {
            return res.status(401).json({ error: 'Sessão inválida. Autentique-se novamente.' });
        }
    }
    catch {
        // Se BD falhar, deixar passar com base na assinatura JWT (disponibilidade prioritária em Hostinger)
    }
    req.user = payload;
    // Platform admin pode aceder a qualquer clube via header X-Club-Id
    if (payload.platformAdmin && req.headers['x-club-id']) {
        req.user = { ...payload, clubId: req.headers['x-club-id'] };
    }
    // ── Verificação de subscrição ────────────────────────────────────────────────
    // Só para membros de clube (não platform admins, não rotas isentas)
    const exempted = SUBSCRIPTION_EXEMPT.some(p => req.originalUrl.startsWith(p));
    if (payload.clubId && !payload.platformAdmin && !exempted) {
        try {
            const now = Date.now();
            const cached = clubStatusCache.get(payload.clubId);
            let planStatus;
            if (cached && (now - cached.cachedAt) < CLUB_CACHE_TTL) {
                planStatus = cached.status;
            }
            else {
                const club = await prisma_1.prisma.club.findUnique({
                    where: { id: payload.clubId },
                    select: { planStatus: true },
                });
                planStatus = club?.planStatus ?? 'ACTIVE';
                clubStatusCache.set(payload.clubId, { status: planStatus, cachedAt: now });
            }
            if (planStatus === 'EXPIRED' || planStatus === 'CANCELLED') {
                return res.status(402).json({
                    error: 'A subscrição do clube expirou. Contacta o administrador.',
                    code: 'SUBSCRIPTION_EXPIRED',
                    planStatus,
                });
            }
        }
        catch {
            // Se BD falhar, não bloquear — disponibilidade primeiro
        }
    }
    next();
}
// Permite invalidar o cache de um clube imediatamente (ex: após renovação)
function invalidateClubStatusCache(clubId) {
    clubStatusCache.delete(clubId);
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: 'Não autenticado' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Permissão insuficiente' });
        }
        next();
    };
}
function requirePermission(perm) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: 'Não autenticado' });
        if (!(0, permissions_1.can)(req.user.role, perm)) {
            return res.status(403).json({ error: 'Permissão insuficiente para esta acção' });
        }
        next();
    };
}
function requirePlatformAdmin(req, res, next) {
    if (!req.user?.platformAdmin) {
        return res.status(403).json({ error: 'Acesso reservado a administradores da plataforma.' });
    }
    next();
}
//# sourceMappingURL=auth.js.map