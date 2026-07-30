"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// On Hostinger the app runs from a versioned build path — DATABASE_URL should be
// configured in hPanel → Node.js → Environment Variables, not via a .env file.
// This fallback scan exists for local dev and other environments.
const candidates = [
    path_1.default.join(__dirname, '..', '..', '..', '..', '..', '.env'),
    path_1.default.join(__dirname, '..', '..', '..', '..', '.env'),
    path_1.default.join(__dirname, '..', '..', '..', '.env'),
    path_1.default.join(__dirname, '..', '..', '.env'),
    process.env.HOME ? path_1.default.join(process.env.HOME, '.env') : null,
    path_1.default.join(process.cwd(), '.env'),
];
for (const candidate of candidates) {
    if (!candidate)
        continue;
    if (fs_1.default.existsSync(candidate)) {
        dotenv_1.default.config({ path: candidate, override: false });
        break;
    }
}
dotenv_1.default.config({ override: false });
//# sourceMappingURL=env.js.map