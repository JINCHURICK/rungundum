"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
require("dotenv/config");
const auth_1 = __importDefault(require("./routes/auth"));
const clubs_1 = __importDefault(require("./routes/clubs"));
const members_1 = __importDefault(require("./routes/members"));
const raids_1 = __importDefault(require("./routes/raids"));
const participants_1 = __importDefault(require("./routes/participants"));
const pdf_1 = __importDefault(require("./routes/pdf"));
const public_1 = __importDefault(require("./routes/public"));
const stats_1 = __importDefault(require("./routes/stats"));
const subscriptions_1 = __importDefault(require("./routes/subscriptions"));
const quotas_1 = __importDefault(require("./routes/quotas"));
const leagues_1 = __importDefault(require("./routes/leagues"));
const disciplinary_1 = __importDefault(require("./routes/disciplinary"));
const sms_1 = __importDefault(require("./routes/sms"));
const platform_admin_1 = __importDefault(require("./routes/platform-admin"));
const treasury_1 = __importDefault(require("./routes/treasury"));
const announcements_1 = __importDefault(require("./routes/announcements"));
const positions_1 = __importDefault(require("./routes/positions"));
const plans_1 = __importDefault(require("./routes/plans"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const error_1 = require("./middleware/error");
const startup_1 = require("./lib/startup");
const node_cron_1 = __importDefault(require("node-cron"));
const quotaAlerts_1 = require("./services/quotaAlerts");
const app = (0, express_1.default)();
// Hostinger (e qualquer hosting com reverse proxy) envia X-Forwarded-For
// sem isto o express-rate-limit lança ValidationError em cada pedido
app.set('trust proxy', 1);
// Compressão gzip/brotli — crítico para redes móveis
app.use((0, compression_1.default)());
// Security headers
app.use((0, helmet_1.default)({
    crossOriginEmbedderPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
            connectSrc: ["'self'"],
            workerSrc: ["'self'"],
            frameSrc: ["'none'"],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: [],
        },
    },
}));
// CORS — apenas origem conhecida
const allowedOrigin = process.env.CLIENT_URL ?? 'http://localhost:5173';
app.use((0, cors_1.default)({ origin: allowedOrigin, credentials: true }));
app.use(express_1.default.json({ limit: '5mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '5mb' }));
// Rate limiter global — activo apenas em produção
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV !== 'production',
    message: { error: 'Demasiadas requisições. Aguarda alguns minutos.' },
});
app.use(globalLimiter);
// Servir uploads locais — paths são IDs aleatórios (timestamp), não enumeráveis
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '..', 'uploads')));
app.get('/health', (_, res) => res.json({ status: 'ok', version: '1.0.2', timestamp: new Date().toISOString() }));
// Prisma's Rust/Tokio engine needs ~2s to initialize on Hostinger shared hosting.
// Hold every non-health request until that window has passed, then release all at once.
app.use((req, res, next) => { (0, startup_1.ensureWarmedUp)().then(next); });
app.use('/api/auth', auth_1.default);
app.use('/api/clubs', clubs_1.default);
app.use('/api/members', members_1.default);
app.use('/api/raids', raids_1.default);
app.use('/api/raids/:raidId/participants', participants_1.default);
app.use('/api/pdf', pdf_1.default);
app.use('/api/public', public_1.default);
app.use('/api/stats', stats_1.default);
app.use('/api/subscriptions', subscriptions_1.default);
app.use('/api/quotas', quotas_1.default);
app.use('/api/leagues', leagues_1.default);
app.use('/api/disciplinary', disciplinary_1.default);
app.use('/api/sms', sms_1.default);
app.use('/api/platform-admin', platform_admin_1.default);
app.use('/api/treasury', treasury_1.default);
app.use('/api/announcements', announcements_1.default);
app.use('/api/positions', positions_1.default);
app.use('/api/plans', plans_1.default);
app.use('/api/notifications', notifications_1.default);
// Em produção, o Express serve o frontend React compilado
if (process.env.NODE_ENV === 'production') {
    const clientDist = path_1.default.join(__dirname, '..', '..', 'client', 'dist');
    // Assets com hash no nome → cache longa (imutáveis); index.html → sem cache
    app.use('/assets', express_1.default.static(path_1.default.join(clientDist, 'assets'), {
        maxAge: '1y',
        immutable: true,
    }));
    app.use(express_1.default.static(clientDist, { maxAge: 0, etag: false }));
    // SPA fallback — index.html nunca deve ser cacheado pela CDN
    app.get(/^(?!\/api\/).*/, (_req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.sendFile(path_1.default.join(clientDist, 'index.html'));
    });
}
app.use(error_1.notFound);
app.use(error_1.errorHandler);
// Cron diário às 09:00 — verificar quotas em atraso e enviar alertas
node_cron_1.default.schedule('0 9 * * *', () => {
    (0, quotaAlerts_1.runQuotaAlerts)().catch(err => console.error('[QuotaAlerts cron]', err));
});
exports.default = app;
//# sourceMappingURL=app.js.map