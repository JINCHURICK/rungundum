import { prisma } from './prisma'

export type NotificationMode = 'BOTH' | 'SMS_ONLY' | 'EMAIL_ONLY' | 'NONE'

export async function getNotificationMode(clubId: string): Promise<{ sms: boolean; email: boolean }> {
  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { defaultSettings: true } })
  const settings = (club?.defaultSettings ?? {}) as Record<string, any>
  const mode: NotificationMode = settings.notificationMode ?? 'BOTH'
  return {
    sms:   mode === 'BOTH' || mode === 'SMS_ONLY',
    email: mode === 'BOTH' || mode === 'EMAIL_ONLY',
  }
}
