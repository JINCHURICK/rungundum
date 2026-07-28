"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_PRICES = exports.PLAN_LABELS = exports.PLAN_LIMITS = void 0;
exports.getEffectiveLimits = getEffectiveLimits;
exports.PLAN_LIMITS = {
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
};
exports.PLAN_LABELS = {
    FREE: 'Gratuito',
    STARTER: 'Starter',
    PRO: 'Pro',
    ENTERPRISE: 'Enterprise',
};
exports.PLAN_PRICES = {
    FREE: { monthly: 0, annual: 0 },
    STARTER: { monthly: 9, annual: 89 },
    PRO: { monthly: 19, annual: 189 },
    ENTERPRISE: { monthly: null, annual: null }, // contacto
};
function getEffectiveLimits(plan, planStatus, trialEndsAt) {
    // Trial usa os limites PRO gratuitamente
    if (planStatus === 'TRIAL' && trialEndsAt && trialEndsAt > new Date()) {
        return exports.PLAN_LIMITS.PRO;
    }
    if (planStatus === 'EXPIRED' || planStatus === 'CANCELLED') {
        return exports.PLAN_LIMITS.FREE;
    }
    return exports.PLAN_LIMITS[plan] ?? exports.PLAN_LIMITS.FREE;
}
//# sourceMappingURL=plans.js.map