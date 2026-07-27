import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requirePermission, AuthRequest } from '../middleware/auth'
import { sendBulkSms, sendSms } from '../services/sms'

const router = Router()
router.use(authenticate)
router.use(requirePermission('SMS'))

// POST /api/sms/send — enviar SMS para membros específicos ou todos
router.post('/send', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      message: z.string().min(1).max(160),
      memberIds: z.array(z.string()).optional(), // vazio = todos os membros activos com telefone
    })
    const { message, memberIds } = schema.parse(req.body)

    const where: any = {
      clubId: req.user!.clubId,
      status: 'ACTIVE',
      phone: { not: null },
    }
    if (memberIds && memberIds.length > 0) {
      where.id = { in: memberIds }
    }

    const members = await prisma.member.findMany({ where, select: { id: true, fullName: true, phone: true } })
    const phones = members.map(m => m.phone!).filter(Boolean)

    if (phones.length === 0) {
      return res.status(400).json({ error: 'Nenhum membro com telemóvel configurado.' })
    }

    await sendBulkSms(phones, message)

    return res.json({ sent: phones.length, message: `SMS enviado para ${phones.length} membro(s).` })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/sms/member/:id — SMS directo para um membro
router.post('/member/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { message } = z.object({ message: z.string().min(1).max(160) }).parse(req.body)

    const member = await prisma.member.findFirst({
      where: { id: req.params.id, clubId: req.user!.clubId },
    })
    if (!member) return res.status(404).json({ error: 'Membro não encontrado' })
    if (!member.phone) return res.status(400).json({ error: 'O membro não tem telemóvel configurado.' })

    await sendSms(member.phone, message)
    return res.json({ message: 'SMS enviado.' })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

export default router
