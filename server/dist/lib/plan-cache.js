"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPlanCache = readPlanCache;
exports.writePlanCache = writePlanCache;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Resolves to server/data/ regardless of whether running from src or dist
const CACHE_DIR = path_1.default.join(__dirname, '..', '..', 'data');
const CACHE_FILE = path_1.default.join(CACHE_DIR, 'plan-configs.json');
function readPlanCache() {
    try {
        return JSON.parse(fs_1.default.readFileSync(CACHE_FILE, 'utf-8'));
    }
    catch {
        return null;
    }
}
function writePlanCache(configs) {
    try {
        fs_1.default.mkdirSync(CACHE_DIR, { recursive: true });
        fs_1.default.writeFileSync(CACHE_FILE, JSON.stringify(configs, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('plan-cache write failed:', err);
    }
}
//# sourceMappingURL=plan-cache.js.map