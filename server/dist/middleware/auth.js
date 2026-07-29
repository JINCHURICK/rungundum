"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRole = requireRole;
exports.requirePermission = requirePermission;
exports.requirePlatformAdmin = requirePlatformAdmin;
const jwt_1 = require("../lib/jwt");
const permissions_1 = require("../lib/permissions");
const prisma_1 = require("../lib/prisma");
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
    next();
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