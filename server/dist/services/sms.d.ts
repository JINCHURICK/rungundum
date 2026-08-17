export declare function sendSms(phone: string, message: string): Promise<void>;
export declare function sendBulkSms(phones: string[], message: string): Promise<void>;
export declare function sendQuotaReminderSms(p: {
    phone: string;
    memberName: string;
    clubName: string;
    year: number;
    monthlyAmount: number;
    monthsOverdue?: number;
    level?: number;
}): Promise<void>;
export declare function sendQuotaPaidSms(p: {
    phone: string;
    memberName: string;
    clubName: string;
    monthsPaid: number;
    amount: number;
    year: number;
}): Promise<void>;
export declare function sendSuspensionSms(p: {
    phone: string;
    memberName: string;
    clubName: string;
    reason: string;
    startDate: string;
    endDate: string;
}): Promise<void>;
export declare function sendSuspensionLiftedSms(p: {
    phone: string;
    memberName: string;
    clubName: string;
}): Promise<void>;
export declare function sendFineSms(p: {
    phone: string;
    memberName: string;
    clubName: string;
    reason: string;
    amount: number;
}): Promise<void>;
export declare function sendRaidConfirmedSms(p: {
    phone: string;
    memberName: string;
    raidTitle: string;
    raidDate: string;
    clubName: string;
}): Promise<void>;
//# sourceMappingURL=sms.d.ts.map