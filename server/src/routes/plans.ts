import { Router } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/plans — público, sem autenticação
router.get('/', async (_req, res) => {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { priceMonthlyKz: 'asc' },
    select: {
      id: true, code: true, name: true,
      priceMonthlyKz: true, priceAnnualKz: true,
      memberLimit: true, isActive: true,
    },
  })
  return res.json(plans)
})

export default router
