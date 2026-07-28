"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRole = requireRole;
exports.requirePermission = requirePermission;
exports.requirePlatformAdmin = requirePlatformAdmin;
const jwt_1 = require("../lib/jwt");
const permissions_1 = require("../lib/permissions");
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de acesso em falta' });
    }
    const token = authHeader.slice(7);
    try {
        req.user = (0, jwt_1.verifyAccessToken)(token);
        next();
    }
    catch {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
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