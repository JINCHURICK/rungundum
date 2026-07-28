"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./env");
const app_1 = __importDefault(require("./app"));
const prisma_1 = require("./lib/prisma");
const socketPath = process.env.LSNODE_SOCKET;
const PORT = parseInt(process.env.PORT ?? '3001', 10);
async function start() {
    // Inicializar a ligação ao MySQL antes de aceitar requests
    // (evita o PANIC: timer has gone away do Prisma quando requests chegam antes do engine inicializar)
    await prisma_1.prisma.$connect();
    if (socketPath) {
        app_1.default.listen(socketPath, () => {
            console.log(`🏍️  Rungundum Server running on socket ${socketPath}`);
        });
    }
    else {
        app_1.default.listen(PORT, '0.0.0.0', () => {
            console.log(`🏍️  Rungundum Server running on http://0.0.0.0:${PORT}`);
        });
    }
}
start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map