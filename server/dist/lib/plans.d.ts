export type PlanKey = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
export interface PlanLimits {
    maxMembers: number;
    maxRaidsPerMonth: number;
    emailNotifications: boolean;
    leaguesEnabled: boolean;
    trialDays: number;
}
export declare const PLAN_LIMITS: Record<PlanKey, PlanLimits>;
export declare const PLAN_LABELS: Record<PlanKey, string>;
export declare const PLAN_PRICES: Record<PlanKey, {
    monthly: number | null;
    annual: number | null;
}>;
export declare function getEffectiveLimits(plan: PlanKey, planStatus: string, trialEndsAt: Date | null): PlanLimits;
//# sourceMappingURL=plans.d.ts.map