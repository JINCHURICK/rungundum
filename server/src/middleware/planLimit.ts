import { prisma } from '../lib/prisma'

interface LimitError {
  error: string
  nextPlanCode: string | null
  activeMembers: number
  memberLimit: number
}

export async function checkPlanLimit(clubId: string): Promise<LimitError | null> {
  const subscription = await prisma.subscription.findUnique({
    where: { clubId },
    include: { plan: true },
  })

  // sem subscrição ou status que bloqueia escrita → não limitar aqui (outro middleware trata)
  if (!subscription) return null
  if (subscription.status === 'CANCELLED') return null

  const limit = subscription.plan.memberLimit
  if (limit === null) return null  // plano ilimitado

  const activeCount = await prisma.member.count({
    where: { clubId, status: 'ACTIVE' },
  })

  if (activeCount < limit) return null  // dentro do limite

  // encontrar próximo plano sugerido
  const nextPlan = await prisma.plan.findFirst({
    where: {
      isActive: true,
      OR: [
        { memberLimit: { gt: limit } },
        { memberLimit: null },
      ],
    },
    orderBy: { priceMonthlyKz: 'asc' },
  })

  return {
    error: `O teu clube cresceu! Passa ao plano ${nextPlan?.name ?? 'superior'} para adicionar mais membros.`,
    nextPlanCode: nextPlan?.code ?? null,
    activeMembers: activeCount,
    memberLimit: limit,
  }
}
