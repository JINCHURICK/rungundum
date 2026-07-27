import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import 'dotenv/config'

import authRoutes from './routes/auth'
import clubRoutes from './routes/clubs'
import memberRoutes from './routes/members'
import raidRoutes from './routes/raids'
import participantRoutes from './routes/participants'
import pdfRoutes from './routes/pdf'
import publicRoutes from './routes/public'
import statsRoutes from './routes/stats'
import subscriptionRoutes from './routes/subscriptions'
import quotaRoutes from './routes/quotas'
import leagueRoutes from './routes/leagues'
import disciplinaryRoutes from './routes/disciplinary'
import smsRoutes from './routes/sms'
import platformAdminRoutes from './routes/platform-admin'
import treasuryRoutes from './routes/treasury'
import announcementsRoutes from './routes/announcements'
import positionsRoutes from './routes/positions'
import plansRoutes from './routes/plans'
import notificationsRoutes from './routes/notifications'
import { errorHandler, notFound } from './middleware/error'
import cron from 'node-cron'
import { runQuotaAlerts } from './services/quotaAlerts'

const app = express()

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // CSP gerido pelo frontend (Vite)
  crossOriginEmbedderPolicy: false,
}))

// CORS — apenas origem conhecida
const allowedOrigin = process.env.CLIENT_URL ?? 'http://localhost:5173'
app.use(cors({ origin: allowedOrigin, credentials: true }))

app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true, limit: '5mb' }))

// Rate limiter global — activo apenas em produção
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
  message: { error: 'Demasiadas requisições. Aguarda alguns minutos.' },
})
app.use(globalLimiter)

// Servir uploads locais — paths são IDs aleatórios (cuid/timestamp), não enumeráveis
// Em produção, usar Cloudinary que tem controlo de acesso próprio
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

app.get('/health', (_, res) => res.json({ status: 'ok', version: '1.0.1', timestamp: new Date().toISOString() }))

app.use('/api/auth', authRoutes)
app.use('/api/clubs', clubRoutes)
app.use('/api/members', memberRoutes)
app.use('/api/raids', raidRoutes)
app.use('/api/raids/:raidId/participants', participantRoutes)
app.use('/api/pdf', pdfRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/quotas', quotaRoutes)
app.use('/api/leagues', leagueRoutes)
app.use('/api/disciplinary', disciplinaryRoutes)
app.use('/api/sms', smsRoutes)
app.use('/api/platform-admin', platformAdminRoutes)
app.use('/api/treasury', treasuryRoutes)
app.use('/api/announcements', announcementsRoutes)
app.use('/api/positions', positionsRoutes)
app.use('/api/plans', plansRoutes)
app.use('/api/notifications', notificationsRoutes)

// Em produção, o Express serve o frontend React compilado
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist')
  app.use(express.static(clientDist))
  // SPA fallback — só para rotas que não começam com /api/
  app.get(/^(?!\/api\/).*/, (_, res) => res.sendFile(path.join(clientDist, 'index.html')))
}

app.use(notFound)
app.use(errorHandler)

// Cron diário às 09:00 — verificar quotas em atraso e enviar alertas
cron.schedule('0 9 * * *', () => {
  runQuotaAlerts().catch(err => console.error('[QuotaAlerts cron]', err))
})

export default app
