import { prisma } from '../lib/prisma'

export async function createNotification(params: {
  clubId: string
  userId: string
  type: string
  title: string
  body?: string
  link?: string
}) {
  return prisma.notification.create({ data: params })
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
}
