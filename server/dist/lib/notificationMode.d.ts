export type NotificationMode = 'BOTH' | 'SMS_ONLY' | 'EMAIL_ONLY' | 'NONE';
export declare function getNotificationMode(clubId: string): Promise<{
    sms: boolean;
    email: boolean;
}>;
//# sourceMappingURL=notificationMode.d.ts.map