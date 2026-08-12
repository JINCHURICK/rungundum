import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { readPlanCache } from '../lib/plan-cache'

const router = Router()

// GET /api/plans/public — reads from file cache (no Prisma); empty if not configured
// File cache is written by PUT /api/platform-admin/plan-configs
router.get('/public', (_req, res) => {
  const cached = readPlanCache()
  const configs = cached ?? []
  return res.json(
    configs
      .filter((c: any) => c.active !== false)
      .sort((a: any, b: any) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
  )
})

// GET /api/plans — legado
router.get('/', async (_req, res) => {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { priceMonthlyKz: 'asc' },
    select: { id: true, code: true, name: true, priceMonthlyKz: true, priceAnnualKz: true, memberLimit: true, isActive: true },
  })
  return res.json(plans)
})

export default router
