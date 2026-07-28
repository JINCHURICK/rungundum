"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const zlib_1 = require("zlib");
// Must run before any Prisma code is loaded.
// Fixes "PANIC: timer has gone away" on Hostinger shared hosting.
// Limit Tokio worker threads — helps on restricted shared hosting environments
if (!process.env.TOKIO_WORKER_THREADS) {
    process.env.TOKIO_WORKER_THREADS = '1';
}
// Attempt to switch to the binary engine (isolated child process, no timer issues).
// If the binary engine is missing, download it in the background so the next
// restart can use it. The current process may still use library engine + TOKIO fix.
if (process.platform === 'linux') {
    const NODE_MODULES = path_1.default.resolve(__dirname, '..', '..', 'node_modules');
    const CLIENT_DIR = path_1.default.join(NODE_MODULES, '.prisma', 'client');
    const ENGINES_DIR = path_1.default.join(NODE_MODULES, '@prisma', 'engines');
    const BINARY_NAME = 'query-engine-debian-openssl-1.1.x';
    const binaryInClient = path_1.default.join(CLIENT_DIR, BINARY_NAME);
    const binaryInEngines = path_1.default.join(ENGINES_DIR, BINARY_NAME);
    let binaryPath = null;
    if (fs_1.default.existsSync(binaryInClient)) {
        binaryPath = binaryInClient;
    }
    else if (fs_1.default.existsSync(binaryInEngines)) {
        try {
            fs_1.default.copyFileSync(binaryInEngines, binaryInClient);
            binaryPath = binaryInClient;
        }
        catch {
            binaryPath = binaryInEngines;
        }
    }
    if (binaryPath) {
        activateBinaryEngine(binaryPath);
    }
    else {
        console.warn('[compat] Binary engine not found; TOKIO_WORKER_THREADS=1 active. Downloading in background...');
        downloadBinaryEngine(binaryInClient, CLIENT_DIR).catch(err => {
            console.error('[compat] Download failed:', err.message);
        });
    }
    function activateBinaryEngine(bp) {
        try {
            fs_1.default.chmodSync(bp, 0o755);
        }
        catch { }
        process.env.PRISMA_QUERY_ENGINE_BINARY = bp;
        const indexPath = path_1.default.join(CLIENT_DIR, 'index.js');
        if (fs_1.default.existsSync(indexPath)) {
            try {
                const original = fs_1.default.readFileSync(indexPath, 'utf-8');
                const patched = original.replace(/"engineType":\s*"library"/g, '"engineType":"binary"');
                if (patched !== original) {
                    fs_1.default.writeFileSync(indexPath, patched, 'utf-8');
                    console.log('[compat] Prisma: switched to binary engine →', bp);
                }
                else {
                    console.log('[compat] Prisma: binary engine already active');
                }
            }
            catch (err) {
                console.error('[compat] Failed to patch Prisma index.js:', err.message);
            }
        }
    }
    async function downloadBinaryEngine(destPath, clientDir) {
        // Resolve engine version from the installed @prisma/engines package
        let version = '';
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const engines = require('@prisma/engines');
            version = engines.enginesVersion ?? '';
        }
        catch { }
        if (!version) {
            try {
                const idx = fs_1.default.readFileSync(path_1.default.join(clientDir, 'index.js'), 'utf-8');
                const m = idx.match(/"engineVersion":\s*"([a-f0-9]{40})"/);
                version = m?.[1] ?? '';
            }
            catch { }
        }
        if (!version) {
            console.error('[compat] Cannot determine Prisma engine version — skipping download');
            return;
        }
        const url = `https://binaries.prisma.sh/all_commits/${version}/debian-openssl-1.1.x/query-engine.gz`;
        console.log('[compat] Downloading binary engine:', version.slice(0, 12) + '...');
        const tmpPath = destPath + '.tmp.gz';
        await new Promise((resolve, reject) => {
            https_1.default.get(url, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                const gunzip = (0, zlib_1.createGunzip)();
                const out = fs_1.default.createWriteStream(destPath + '.tmp');
                res.pipe(gunzip).pipe(out);
                out.on('finish', () => { out.close(); resolve(); });
                out.on('error', reject);
                gunzip.on('error', reject);
            }).on('error', reject);
        }).catch(e => { try {
            fs_1.default.unlinkSync(tmpPath);
        }
        catch { } throw e; });
        fs_1.default.renameSync(destPath + '.tmp', destPath);
        fs_1.default.chmodSync(destPath, 0o755);
        console.log('[compat] Binary engine downloaded — restart server to activate it');
    }
}
//# sourceMappingURL=prisma-patch.js.map