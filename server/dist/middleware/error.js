"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.notFound = notFound;
function errorHandler(err, req, res, next) {
    // Stack trace apenas nos logs do servidor, nunca exposto ao cliente
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} — ${err.stack}`);
    res.status(500).json({ error: 'Erro interno do servidor' });
}
function notFound(req, res) {
    res.status(404).json({ error: 'Recurso não encontrado' });
}
//# sourceMappingURL=error.js.map