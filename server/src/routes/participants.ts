import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { getDefaultChecklist } from '../services/checklist'
import { sendRaidReminder } from '../services/email'
import { getNotificationMode } from '../lib/notificationMode'

const router = Router({ mergeParams: true })
router.use(authenticate)

// GET /api/raids/:raidId/participants
router.get('/', async (req: AuthRequest, res: Response) => {
  const raid = await prisma.raid.findFirst({ where: { id: req.params.raidId, clubId: req.user!.clubId } })
  if (!raid) return res.status(404).json({ error: 'Raid não encontrado' })

  const participants = await prisma.participant.findMany({
    where: { raidId: req.params.raidId },
    include: {
      member: { select: { id: true, fullName: true, nickname: true, photoUrl: true, phone: true } },
      vehicle: true,
      checklistItems: true,
    },
  })
  return res.json(participants)
})

// POST /api/raids/:raidId/participants/:participantId/confirm
router.post('/:participantId/confirm', async (req: AuthRequest, res: Response) => {
  const participant = await prisma.participant.findFirst({
    where: { id: req.params.participantId, raidId: req.params.raidId },
    include: { member: true },
  })
  if (!participant) return res.status(404).json({ error: 'Participante não encontrado' })

  // Only the member themselves or an admin/captain can confirm
  const isOwn = participant.member.userId === req.user!.userId
  const isAdmin = ['ADMIN', 'CAPTAIN'].includes(req.user!.role)
  if (!isOwn && !isAdmin) return res.status(403).json({ error: 'Sem permissão' })

  const { vehicleId } = req.body
  const schema = z.object({ vehicleId: z.string().optional() })
  const data = schema.parse(req.body)

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.participant.update({
      where: { id: req.params.participantId },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), vehicleId: data.vehicleId },
    })

    // Create default checklist items if not yet created
    const existing = await tx.checklistItem.count({ where: { participantId: p.id } })
    if (existing === 0) {
      const items = getDefaultChecklist(p.id)
      await tx.checklistItem.createMany({ data: items })
    }
    return p
  })

  return res.json(updated)
})

// PATCH /api/raids/:raidId/participants/:participantId/checklist
router.patch('/:participantId/checklist', async (req: AuthRequest, res: Response) => {
  const participant = await prisma.participant.findFirst({
    where: { id: req.params.participantId, raidId: req.params.raidId },
    include: { member: true },
  })
  if (!participant) return res.status(404).json({ error: 'Participante não encontrado' })

  const isOwn = participant.member.userId === req.user!.userId
  const isAdmin = ['ADMIN', 'CAPTAIN'].includes(req.user!.role)
  if (!isOwn && !isAdmin) return res.status(403).json({ error: 'Sem permissão' })

  const schema = z.object({
    items: z.array(z.object({ id: z.string(), checked: z.boolean() })),
  })
  const { items } = schema.parse(req.body)

  // Carregar os IDs válidos deste participante antes de actualizar (previne IDOR)
  const allItems = await prisma.checklistItem.findMany({ where: { participantId: req.params.participantId } })
  const validIds = new Set(allItems.map((i) => i.id))
  const forbidden = items.filter((item) => !validIds.has(item.id))
  if (forbidden.length > 0) return res.status(403).json({ error: 'Item não pertence a este participante' })

  await Promise.all(
    items.map((item) =>
      prisma.checklistItem.update({
        where: { id: item.id },
        data: { checked: item.checked, checkedAt: item.checked ? new Date() : null },
      })
    )
  )

  // Recarregar estado actualizado
  const updatedItems = await prisma.checklistItem.findMany({ where: { participantId: req.params.participantId } })
  const allChecked = updatedItems.every((i) => i.checked)

  if (allChecked) {
    await prisma.participant.update({
      where: { id: req.params.participantId },
      data: { checklistCompletedAt: new Date() },
    })
  }

  return res.json({ items: updatedItems, complete: allChecked })
})

// POST /api/raids/:raidId/participants/:participantId/decline
router.post('/:participantId/decline', async (req: AuthRequest, res: Response) => {
  const participant = await prisma.participant.findFirst({
    where: { id: req.params.participantId, raidId: req.params.raidId },
    include: { member: true },
  })
  if (!participant) return res.status(404).json({ error: 'Participante não encontrado' })

  const isOwn = participant.member.userId === req.user!.userId
  const isAdmin = ['ADMIN', 'CAPTAIN'].includes(req.user!.role)
  if (!isOwn && !isAdmin) return res.status(403).json({ error: 'Sem permissão' })

  const updated = await prisma.participant.update({
    where: { id: req.params.participantId },
    data: { status: 'DECLINED' },
  })
  return res.json(updated)
})

// PATCH /api/raids/:raidId/participants/:participantId — editar função e/ou moto
router.patch('/:participantId', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  const participant = await prisma.participant.findFirst({
    where: { id: req.params.participantId, raidId: req.params.raidId },
  })
  if (!participant) return res.status(404).json({ error: 'Participante não encontrado' })

  const schema = z.object({
    role: z.enum(['LEADER', 'TAIL', 'MEMBER', 'MECHANIC', 'SUPPORT']).optional(),
    vehicleId: z.string().nullable().optional(),
  })
  const data = schema.parse(req.body)

  const updated = await prisma.participant.update({
    where: { id: req.params.participantId },
    data,
    include: {
      member: { select: { id: true, fullName: true, nickname: true, photoUrl: true, phone: true } },
      vehicle: true,
      checklistItems: true,
    },
  })
  return res.json(updated)
})

// POST /api/raids/:raidId/participants — adicionar participante
router.post('/', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  const raid = await prisma.raid.findFirst({ where: { id: req.params.raidId, clubId: req.user!.clubId } })
  if (!raid) return res.status(404).json({ error: 'Raid não encontrado' })

  const schema = z.object({
    memberId: z.string(),
    role: z.enum(['LEADER', 'TAIL', 'MEMBER', 'MECHANIC', 'SUPPORT']).default('MEMBER'),
  })
  const data = schema.parse(req.body)

  const existing = await prisma.participant.findFirst({ where: { raidId: req.params.raidId, memberId: data.memberId } })
  if (existing) return res.status(409).json({ error: 'Membro já adicionado' })

  const participant = await prisma.participant.create({
    data: { raidId: req.params.raidId, memberId: data.memberId, role: data.role, status: 'PENDING' },
    include: {
      member: { select: { id: true, fullName: true, nickname: true, photoUrl: true, phone: true } },
      vehicle: true,
      checklistItems: true,
    },
  })
  return res.status(201).json(participant)
})

// DELETE /api/raids/:raidId/participants/:participantId
router.delete('/:participantId', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  const participant = await prisma.participant.findFirst({
    where: { id: req.params.participantId, raidId: req.params.raidId },
  })
  if (!participant) return res.status(404).json({ error: 'Participante não encontrado' })

  await prisma.participant.delete({ where: { id: req.params.participantId } })
  return res.status(204).send()
})

// POST /api/raids/:raidId/participants/remind
router.post('/remind', requireRole('ADMIN', 'CAPTAIN'), async (req: AuthRequest, res: Response) => {
  const raid = await prisma.raid.findFirst({
    where: { id: req.params.raidId, clubId: req.user!.clubId },
    include: { club: true },
  })
  if (!raid) return res.status(404).json({ error: 'Raid não encontrado' })

  const pending = await prisma.participant.findMany({
    where: { raidId: req.params.raidId, status: 'PENDING' },
    include: {
      member: {
        select: { fullName: true, nickname: true, user: { select: { email: true } } },
      },
    },
  })

  const confirmUrl = `${process.env.CLIENT_URL ?? 'http://localhost:5173'}/raids/${raid.id}`
  const raidDate = raid.date.toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' })
  const { email: canEmail } = await getNotificationMode(req.user!.clubId)
  const toNotify = canEmail ? pending.filter((p) => p.member.user?.email) : []

  if (toNotify.length > 0) {
    await Promise.allSettled(
      toNotify.map((p) =>
        sendRaidReminder({
          to: p.member.user!.email,
          memberName: p.member.nickname ?? p.member.fullName,
          raidTitle: raid.title,
          raidDate,
          clubName: raid.club.name,
          confirmUrl,
        })
      )
    )
  }

  return res.json({ message: `${toNotify.length} lembrete(s) enviado(s)`, count: toNotify.length })
})

export default router
