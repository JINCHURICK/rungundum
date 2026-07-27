import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// ── plan config migration (same logic as platform-admin.ts) ──────────────────
function migrateLegacyPlanConfig(c: any): any {
  let pricingTiers = c.pricingTiers
  if (!pricingTiers) {
    const months = c.periodMonths ?? 12
    pricingTiers = (c.price !== null && c.price !== undefined && c.price > 0)
      ? [{ months, pricePerMonth: Math.round(c.price / months), totalPrice: c.price, label: months === 1 ? 'Mensal' : months === 12 ? 'Anual' : `${months} meses` }]
      : []
  }
  const autoFeatures: string[] = []
  if (c.maxMembers !== null && c.maxMembers !== undefined) autoFeatures.push(`Até ${c.maxMembers} membros`)
  else autoFeatures.push('Membros ilimitados')
  if (c.maxRaidsPerMonth !== null && c.maxRaidsPerMonth !== undefined) autoFeatures.push(`${c.maxRaidsPerMonth} raids/mês`)
  else autoFeatures.push('Raids ilimitados')
  if (c.emailNotifications) autoFeatures.push('Notificações por email')
  const { price, periodMonths, ...rest } = c
  return {
    ...rest,
    contactOnly: c.contactOnly ?? (c.price === null && !pricingTiers.length),
    highlight:   c.highlight ?? false,
    features:    c.features ?? autoFeatures,
    pricingTiers,
  }
}

// GET /api/public/plan-configs — sem autenticação, usado pela landing page
router.get('/plan-configs', async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } })
    if (!settings) return res.json([])
    const raw = settings.planConfigs as any[]
    if (!raw?.length) return res.json([])
    const configs = raw
      .map(migrateLegacyPlanConfig)
      .filter((c: any) => c.active)
      .sort((a: any, b: any) => a.displayOrder - b.displayOrder)
    return res.json(configs)
  } catch {
    return res.json([])
  }
})

// GET /api/public/raids/:token
router.get('/raids/:token', async (req: Request, res: Response) => {
  const raid = await prisma.raid.findUnique({
    where: { publicToken: req.params.token },
    include: {
      club: { select: { name: true, acronym: true, logoUrl: true, accentColor: true } },
      routePoints: { orderBy: { order: 'asc' } },
      participants: {
        where: { status: 'CONFIRMED' },
        include: {
          member: { select: { fullName: true, nickname: true, photoUrl: true } },
          vehicle: { select: { brand: true, model: true } },
        },
        orderBy: { role: 'asc' },
      },
    },
  })

  if (!raid) return res.status(404).json({ error: 'Raid não encontrado' })
  if (!['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(raid.status)) {
    return res.status(404).json({ error: 'Raid não disponível' })
  }

  return res.json(raid)
})

export default router
