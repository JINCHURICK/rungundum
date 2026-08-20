import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requirePermission, AuthRequest } from '../middleware/auth'
import { createNotificationForAllMembers } from '../services/notifications'
import { sendBulkSms } from '../services/sms'
import { getNotificationMode } from '../lib/notificationMode'

async function notifyMembers(clubId: string, clubName: string, title: string, body: string, notify: 'sms' | 'email' | 'both') {
  const members = await prisma.member.findMany({
    where: { clubId, status: 'ACTIVE' },
    include: { user: { select: { email: true } } },
  })

  const { sms: canSms, email: canEmail } = await getNotificationMode(clubId)
  const preview = body.length > 100 ? body.slice(0, 97) + '...' : body
  const smsMsg = `${clubName} | ${title}: ${preview}`

  if ((notify === 'sms' || notify === 'both') && canSms) {
    const phones = members.map(m => m.phone).filter(Boolean) as string[]
    if (phones.length > 0) sendBulkSms(phones, smsMsg).catch(() => {})
  }

  if ((notify === 'email' || notify === 'both') && canEmail) {
    const { sendAnnouncementEmail } = await import('../services/email')
    for (const m of members) {
      if (!m.user?.email) continue
      sendAnnouncementEmail({
        to: m.user.email,
        memberName: m.nickname ?? m.fullName,
        clubName,
        title,
        body,
      }).catch(() => {})
    }
  }
}

const router = Router()
router.use(authenticate)

// GET /api/announcements
router.get('/', async (req: AuthRequest, res: Response) => {
  const announcements = await prisma.announcement.findMany({
    where: { clubId: req.user!.clubId },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
  })
  return res.json(announcements)
})

// POST /api/announcements
router.post('/', requirePermission('ANNOUNCEMENTS_WRITE'), async (req: AuthRequest, res: Response) => {
  try {
    const data = z.object({
      title:  z.string().min(1),
      body:   z.string().min(1),
      pinned: z.boolean().default(false),
      notify: z.enum(['none', 'sms', 'email', 'both']).default('none'),
    }).parse(req.body)

    const ann = await prisma.announcement.create({
      data: {
        clubId:      req.user!.clubId,
        title:       data.title,
        body:        data.body,
        pinned:      data.pinned,
        createdById: req.user!.userId,
      },
    })

    createNotificationForAllMembers({
      clubId: req.user!.clubId,
      type: 'ANNOUNCEMENT',
      title: data.pinned ? `📌 ${data.title}` : data.title,
      body: data.body.length > 100 ? data.body.slice(0, 97) + '…' : data.body,
      link: '/announcements',
    }).catch(() => {})

    if (data.notify !== 'none') {
      const club = await prisma.club.findUnique({ where: { id: req.user!.clubId }, select: { name: true } })
      notifyMembers(req.user!.clubId, club?.name ?? 'Clube', data.title, data.body, data.notify).catch(() => {})
    }

    return res.status(201).json(ann)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// PATCH /api/announcements/:id
router.patch('/:id', requirePermission('ANNOUNCEMENTS_WRITE'), async (req: AuthRequest, res: Response) => {
  try {
    const ann = await prisma.announcement.findFirst({ where: { id: req.params.id, clubId: req.user!.clubId } })
    if (!ann) return res.status(404).json({ error: 'Comunicado não encontrado' })

    const data = z.object({
      title:  z.string().min(1).optional(),
      body:   z.string().min(1).optional(),
      pinned: z.boolean().optional(),
    }).parse(req.body)

    const updated = await prisma.announcement.update({ where: { id: ann.id }, data })
    return res.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// DELETE /api/announcements/:id
router.delete('/:id', requirePermission('ANNOUNCEMENTS_WRITE'), async (req: AuthRequest, res: Response) => {
  const ann = await prisma.announcement.findFirst({ where: { id: req.params.id, clubId: req.user!.clubId } })
  if (!ann) return res.status(404).json({ error: 'Comunicado não encontrado' })
  await prisma.announcement.delete({ where: { id: ann.id } })
  return res.status(204).send()
})

export default router
