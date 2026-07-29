import webPush from 'web-push'
import { prisma } from '../lib/prisma'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    'mailto:admin@rungundum.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

async function sendPush(userId: string, title: string, body?: string, link?: string) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return

  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (!subs.length) return

  const payload = JSON.stringify({ title, body, link })

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
      } catch (err: any) {
        // 410 Gone = browser revogou a subscrição, limpar da BD
        if (err?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        }
      }
    })
  )
}

export async function createNotification(params: {
  clubId: string
  userId: string
  type: string
  title: string
  body?: string
  link?: string
}) {
  const notification = await prisma.notification.create({ data: params })
  // Enviar push de forma assíncrona — não bloqueia a resposta HTTP
  sendPush(params.userId, params.title, params.body, params.link).catch(() => {})
  return notification
}

export async function createNotificationForAllMembers(params: {
  clubId: string
  type: string
  title: string
  body?: string
  link?: string
}) {
  const users = await prisma.user.findMany({
    where: { clubId: params.clubId },
    select: { id: true },
  })
  if (!users.length) return

  await prisma.notification.createMany({
    data: users.map((u) => ({ ...params, userId: u.id })),
  })

  // Push para cada utilizador
  users.forEach((u) => {
    sendPush(u.id, params.title, params.body, params.link).catch(() => {})
  })
}
