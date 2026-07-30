"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.recreatePrismaClient = recreatePrismaClient;
const client_1 = require("@prisma/client");
function newClient() {
    return new client_1.PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
}
let _instance = newClient();
// Called by the global panic handler in index.ts if Prisma's Rust engine panics
function recreatePrismaClient() {
    try {
        _instance = newClient();
    }
    catch {
        // Keep existing instance if new one fails to initialize
    }
}
// Proxy delegates every property access to the current _instance.
// When recreatePrismaClient() replaces _instance, all callers immediately use the new client.
exports.prisma = new Proxy({}, {
    get(_, prop) {
        const val = _instance[prop];
        return typeof val === 'function' ? val.bind(_instance) : val;
    },
});
//# sourceMappingURL=prisma.js.map