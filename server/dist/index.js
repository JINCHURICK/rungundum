"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./env");
const app_1 = __importDefault(require("./app"));
const socketPath = process.env.LSNODE_SOCKET;
const PORT = parseInt(process.env.PORT ?? '3001', 10);
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