"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
exports.createNotificationForAllMembers = createNotificationForAllMembers;
const web_push_1 = __importDefault(require("web-push"));
const prisma_1 = require("../lib/prisma");
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    web_push_1.default.setVapidDetails('mailto:admin@rungundum.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}
async function sendPush(userId, title, body, link) {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY)
        return;
    const subs = await prisma_1.prisma.pushSubscription.findMany({ where: { userId } });
    if (!subs.length)
        return;
    const payload = JSON.stringify({ title, body, link });
    await Promise.all(subs.map(async (sub) => {
        try {
            await web_push_1.default.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        }
        catch (err) {
            // 410 Gone = browser revogou a subscrição, limpar da BD
            if (err?.statusCode === 410) {
                await prisma_1.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => { });
            }
        }
    }));
}
async function createNotification(params) {
    const notification = await prisma_1.prisma.notification.create({ data: params });
    // Enviar push de forma assíncrona — não bloqueia a resposta HTTP
    sendPush(params.userId, params.title, params.body, params.link).catch(() => { });
    return notification;
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
    // Push para cada utilizador
    users.forEach((u) => {
        sendPush(u.id, params.title, params.body, params.link).catch(() => { });
    });
}
//# sourceMappingURL=notifications.js.map