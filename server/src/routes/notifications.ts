import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
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

export default router
