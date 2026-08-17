"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./prisma-patch"); // MUST be first — patches Prisma before any Prisma code is loaded
require("./env");
const app_1 = __importDefault(require("./app"));
const prisma_1 = require("./lib/prisma");
const cloudinary_1 = require("./services/cloudinary");
const socketPath = process.env.LSNODE_SOCKET;
const PORT = parseInt(process.env.PORT ?? '3001', 10);
function isPrismaPanic(err) {
    return err?.name === 'PrismaClientRustPanicError';
}
process.on('unhandledRejection', (reason) => {
    if (isPrismaPanic(reason)) {
        console.error('[panic] Prisma engine panic (unhandledRejection) — recreating client');
        (0, prisma_1.recreatePrismaClient)();
        return;
    }
    // Prisma initialization errors happen after engine panics — log but don't crash
    if (reason?.name === 'PrismaClientInitializationError') {
        console.error('[prisma] Initialization error (unhandledRejection) — request failed but server continues:', reason?.message);
        return;
    }
    console.error('Unhandled rejection:', reason);
    process.exit(1);
});
process.on('uncaughtException', (err) => {
    if (isPrismaPanic(err)) {
        console.error('[panic] Prisma engine panic (uncaughtException) — recreating client');
        (0, prisma_1.recreatePrismaClient)();
        return;
    }
    if (err?.name === 'PrismaClientInitializationError') {
        console.error('[prisma] Initialization error (uncaughtException) — request failed but server continues:', err?.message);
        return;
    }
    console.error('Uncaught exception:', err);
    process.exit(1);
});
prisma_1.prisma.$connect().catch(() => { });
(0, cloudinary_1.calibrateClockOffset)().catch(() => { });
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
//# sourceMappingURL=index.js.map