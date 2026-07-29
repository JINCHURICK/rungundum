import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /api/notifications/vapid-key — pública, não requer auth
router.get('/vapid-key', (_req: Request, res: Response) => {
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key) return res.status(503).json({ error: 'Push não configurado neste servidor' })
  return res.json({ publicKey: key })
})

router.use(authenticate)

// GET /api/notifications — últimas 30 notificações do utilizador
router.get('/', async (req: AuthRequest, res: Response) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  const unreadCount = await prisma.notification.count({
    where: { userId: req.user!.userId, read: false },
  })
  return res.json({ notifications, unreadCount })
})

// PATCH /api/notifications/:id/read — marcar uma como lida
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user!.userId },
    data: { read: true },
  })
  return res.json({ ok: true })
})

// POST /api/notifications/read-all — marcar todas como lidas
router.post('/read-all', async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.userId, read: false },
    data: { read: true },
  })
  return res.json({ ok: true })
})

// POST /api/notifications/push-subscribe — registar subscrição Web Push
router.post('/push-subscribe', async (req: AuthRequest, res: Response) => {
  const { endpoint, p256dh, auth } = req.body
  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: 'Dados de subscrição inválidos' })
  }

  // Apagar subscrição antiga com o mesmo endpoint (rotação de chaves do browser)
  await prisma.pushSubscription.deleteMany({
    where: { userId: req.user!.userId, auth },
  })

  await prisma.pushSubscription.create({
    data: { userId: req.user!.userId, endpoint, p256dh, auth },
  })

  return res.json({ ok: true })
})

// DELETE /api/notifications/push-subscribe — remover subscrição
router.delete('/push-subscribe', async (req: AuthRequest, res: Response) => {
  const { endpoint } = req.body
  if (!endpoint) return res.status(400).json({ error: 'Endpoint em falta' })

  await prisma.pushSubscription.deleteMany({
    where: { userId: req.user!.userId },
  })

  return res.json({ ok: true })
})

export default router
