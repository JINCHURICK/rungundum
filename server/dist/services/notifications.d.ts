export declare function createNotification(params: {
    clubId: string;
    userId: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
}): Promise<{
    link: string | null;
    type: string;
    userId: string;
    id: string;
    createdAt: Date;
    clubId: string;
    title: string;
    body: string | null;
    read: boolean;
}>;
export declare function createNotificationForAllMembers(params: {
    clubId: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
}): Promise<void>;
//# sourceMappingURL=notifications.d.ts.map