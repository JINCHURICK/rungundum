"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureWarmedUp = ensureWarmedUp;
const START_TIME = Date.now();
const WARMUP_MS = 2000;
// Single shared promise — all held requests await the same timer
const warmupDone = new Promise(r => setTimeout(r, WARMUP_MS));
function ensureWarmedUp() {
    if (Date.now() - START_TIME >= WARMUP_MS)
        return Promise.resolve();
    return warmupDone;
}
//# sourceMappingURL=startup.js.map