export declare function sendTwoFactorCode(params: {
    to: string;
    code: string;
    clubName: string;
}): Promise<void>;
export declare function sendPasswordReset(params: {
    to: string;
    resetUrl: string;
    clubName: string;
}): Promise<void>;
export declare function sendAccountInvite(params: {
    to: string;
    memberName: string;
    clubName: string;
    inviteUrl: string;
}): Promise<void>;
export declare function sendRaidPublished(params: {
    to: string;
    memberName: string;
    raidTitle: string;
    raidDate: string;
    clubName: string;
    publicUrl: string;
}): Promise<void>;
export declare function sendEmailVerification(params: {
    to: string;
    clubName: string;
    verifyUrl: string;
}): Promise<void>;
export declare function sendQuotaReminder(params: {
    to: string;
    memberName: string;
    clubName: string;
    year: number;
    amount: number;
    appUrl: string;
}): Promise<void>;
export declare function sendQuotaPaid(params: {
    to: string;
    memberName: string;
    clubName: string;
    year: number;
    amount: number;
}): Promise<void>;
export declare function sendTrialExpiring(params: {
    to: string;
    clubName: string;
    daysLeft: number;
    appUrl: string;
}): Promise<void>;
export declare function sendQuotaAlertEmail(params: {
    to: string;
    memberName: string;
    clubName: string;
    year: number;
    monthsOverdue: number;
    monthlyAmount: number;
    level: number;
}): Promise<void>;
export declare function sendUpgradeRequest(params: {
    to: string;
    clubName: string;
    clubLocation: string;
    currentPlan: string;
    requestedPlan: string;
    clubAdminEmail: string;
    adminUrl: string;
}): Promise<void>;
export declare function sendRaidInvite(params: {
    to: string;
    memberName: string;
    raidTitle: string;
    raidDate: string;
    clubName: string;
    confirmUrl: string;
}): Promise<void>;
export declare function sendRaidReminder(params: {
    to: string;
    memberName: string;
    raidTitle: string;
    raidDate: string;
    clubName: string;
    confirmUrl: string;
}): Promise<void>;
//# sourceMappingURL=email.d.ts.map