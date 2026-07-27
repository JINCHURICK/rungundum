export type PlanKey = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'

export interface PlanLimits {
  maxMembers: number
  maxRaidsPerMonth: number
  emailNotifications: boolean
  leaguesEnabled: boolean
  trialDays: number
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  FREE: {
    maxMembers: 10,
    maxRaidsPerMonth: 3,
    emailNotifications: false,
    leaguesEnabled: false,
    trialDays: 0,
  },
  STARTER: {
    maxMembers: 30,
    maxRaidsPerMonth: 10,
    emailNotifications: true,
    leaguesEnabled: true,
    trialDays: 0,
  },
  PRO: {
    maxMembers: Infinity,
    maxRaidsPerMonth: Infinity,
    emailNotifications: true,
    leaguesEnabled: true,
    trialDays: 0,
  },
  ENTERPRISE: {
    maxMembers: Infinity,
    maxRaidsPerMonth: Infinity,
    emailNotifications: true,
    leaguesEnabled: true,
    trialDays: 0,
  },
}

export const PLAN_LABELS: Record<PlanKey, string> = {
  FREE: 'Gratuito',
  STARTER: 'Starter',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
}

export const PLAN_PRICES: Record<PlanKey, { monthly: number | null; annual: number | null }> = {
  FREE: { monthly: 0, annual: 0 },
  STARTER: { monthly: 9, annual: 89 },
  PRO: { monthly: 19, annual: 189 },
  ENTERPRISE: { monthly: null, annual: null }, // contacto
}

export function getEffectiveLimits(plan: PlanKey, planStatus: string, trialEndsAt: Date | null): PlanLimits {
  // Trial usa os limites PRO gratuitamente
  if (planStatus === 'TRIAL' && trialEndsAt && trialEndsAt > new Date()) {
    return PLAN_LIMITS.PRO
  }
  if (planStatus === 'EXPIRED' || planStatus === 'CANCELLED') {
    return PLAN_LIMITS.FREE
  }
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE
}
