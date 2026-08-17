"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotificationMode = getNotificationMode;
const prisma_1 = require("./prisma");
async function getNotificationMode(clubId) {
    const club = await prisma_1.prisma.club.findUnique({ where: { id: clubId }, select: { defaultSettings: true } });
    const settings = (club?.defaultSettings ?? {});
    const mode = settings.notificationMode ?? 'BOTH';
    return {
        sms: mode === 'BOTH' || mode === 'SMS_ONLY',
        email: mode === 'BOTH' || mode === 'EMAIL_ONLY',
    };
}
//# sourceMappingURL=notificationMode.js.map