"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// __dirname = .../nodejs/server/dist  →  5 levels up = /home/USER/
// LiteSpeed does not always set HOME, so we derive the home dir from __dirname.
const homedirFromScript = path_1.default.join(__dirname, '..', '..', '..', '..', '..');
dotenv_1.default.config({ path: path_1.default.join(homedirFromScript, '.env'), override: false });
// Fallback for local dev where HOME is available
const homePath = process.env.HOME;
if (homePath) {
    dotenv_1.default.config({ path: path_1.default.join(homePath, '.env'), override: false });
}
// Final fallback: CWD .env
dotenv_1.default.config({ override: false });
//# sourceMappingURL=env.js.map