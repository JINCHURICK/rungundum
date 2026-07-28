"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.notFound = notFound;
const prisma_1 = require("../lib/prisma");
function errorHandler(err, req, res, next) {
    if (err?.name === 'PrismaClientRustPanicError') {
        console.error('Prisma panic in error middleware — recreating client');
        (0, prisma_1.recreatePrismaClient)();
        return res.status(503).json({ error: 'Serviço temporariamente indisponível. Tente novamente.' });
    }
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} — ${err.stack}`);
    res.status(500).json({ error: 'Erro interno do servidor' });
}
function notFound(req, res) {
    res.status(404).json({ error: 'Recurso não encontrado' });
}
//# sourceMappingURL=error.js.map