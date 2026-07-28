"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
exports.createNotificationForAllMembers = createNotificationForAllMembers;
const prisma_1 = require("../lib/prisma");
async function createNotification(params) {
    return prisma_1.prisma.notification.create({ data: params });
}
async function createNotificationForAllMembers(params) {
    const users = await prisma_1.prisma.user.findMany({
        where: { clubId: params.clubId },
        select: { id: true },
    });
    if (!users.length)
        return;
    await prisma_1.prisma.notification.createMany({
        data: users.map((u) => ({ ...params, userId: u.id })),
    });
}
//# sourceMappingURL=notifications.js.map