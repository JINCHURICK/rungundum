export interface QuotaAlertConfig {
    enabled: boolean;
    firstAlertMonths: number;
    secondAlertMonths: number;
    disciplinaryMonths: number;
    suspensionRiskMonths: number;
}
export declare const DEFAULT_ALERT_CONFIG: QuotaAlertConfig;
export declare function getAlertLevel(monthsOverdue: number, cfg: QuotaAlertConfig): number;
declare function buildSms(level: number, p: {
    memberName: string;
    clubName: string;
    monthsOverdue: number;
    year: number;
    monthlyAmount: number;
}): string;
export declare function runQuotaAlerts(clubId?: string): Promise<{
    processed: number;
    alertsSent: number;
    disciplinaryCreated: number;
}>;
export declare function getAlertConfig(clubId: string): Promise<QuotaAlertConfig>;
export declare function saveAlertConfig(clubId: string, cfg: QuotaAlertConfig): Promise<void>;
export { buildSms };
//# sourceMappingURL=quotaAlerts.d.ts.map