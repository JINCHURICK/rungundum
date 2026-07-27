import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { sendQuotaReminderSms } from './sms'
import { sendQuotaAlertEmail } from './email'

// ── tipos ────────────────────────────────────────────────────────────────────

export interface QuotaAlertConfig {
  enabled: boolean
  firstAlertMonths: number      // 1 mês → lembrete amigável
  secondAlertMonths: number     // 2 meses → alerta urgente
  disciplinaryMonths: number    // 3 meses → aviso disciplinar + processo auto
  suspensionRiskMonths: number  // 5 meses → risco de suspensão
}

export const DEFAULT_ALERT_CONFIG: QuotaAlertConfig = {
  enabled: true,
  firstAlertMonths: 1,
  secondAlertMonths: 2,
  disciplinaryMonths: 3,
  suspensionRiskMonths: 5,
}

// ── níveis de alerta (1–4, crescente) ────────────────────────────────────────
// 1 = lembrete, 2 = urgente, 3 = disciplinar, 4 = risco suspensão

export function getAlertLevel(monthsOverdue: number, cfg: QuotaAlertConfig): number {
  if (monthsOverdue >= cfg.suspensionRiskMonths) return 4
  if (monthsOverdue >= cfg.disciplinaryMonths)   return 3
  if (monthsOverdue >= cfg.secondAlertMonths)    return 2
  if (monthsOverdue >= cfg.firstAlertMonths)     return 1
  return 0
}

// ── utilitário: meses em atraso no ano corrente ───────────────────────────────
function calcMonthsOverdue(monthsPaid: number, quotaYear: number): number {
  const now     = new Date()
  const thisYear = now.getFullYear()

  if (quotaYear < thisYear) {
    // ano anterior: todos os meses não pagos são atraso
    return Math.max(0, 12 - monthsPaid)
  }
  if (quotaYear > thisYear) return 0

  const currentMonth = now.getMonth() + 1  // 1–12
  return Math.max(0, currentMonth - monthsPaid)
}

// ── mensagens por nível ───────────────────────────────────────────────────────

function buildSms(level: number, p: {
  memberName: string; clubName: string; monthsOverdue: number; year: number; monthlyAmount: number
}): string {
  const { memberName: name, clubName: club, monthsOverdue: m, year, monthlyAmount } = p
  const meses = m === 1 ? '1 mes' : `${m} meses`
  const valor = (monthlyAmount * m).toLocaleString()

  switch (level) {
    case 1:
      return `${club} | Ola ${name}! Notamos que tens ${meses} de quota de ${year} por regularizar (${valor} Kz). Se ja trataste, ignora esta mensagem. Boa estrada!`
    case 2:
      return `${club} | ${name}, tens ${meses} de quota de ${year} em atraso (${valor} Kz). Por favor regulariza a tua situacao o mais breve possivel. Para esclarecimentos contacta o tesoureiro.`
    case 3:
      return `${club} | ${name}, tens ${meses} de quota de ${year} em atraso. A direccao solicita que apresentes justificacao formal ate 10 dias. O nao cumprimento pode resultar em processo disciplinar e suspensao.`
    case 4:
      return `${club} | ${name}, tens ${meses} de quota de ${year} por pagar. A direccao deliberou que corres risco de suspensao e eventual remocao do clube. Regulariza urgentemente ou contacta a direccao.`
    default:
      return ''
  }
}

// ── função principal ──────────────────────────────────────────────────────────

export async function runQuotaAlerts(clubId?: string): Promise<{ processed: number; alertsSent: number; disciplinaryCreated: number }> {
  const currentYear = new Date().getFullYear()
  let processed = 0, alertsSent = 0, disciplinaryCreated = 0

  // buscar clubes (todos ou específico)
  const clubs = await prisma.club.findMany({
    where: clubId ? { id: clubId } : undefined,
    select: { id: true, name: true, defaultSettings: true },
  })

  for (const club of clubs) {
    const settings = (club.defaultSettings ?? {}) as Record<string, any>
    const cfg: QuotaAlertConfig = { ...DEFAULT_ALERT_CONFIG, ...(settings.quotaAlertConfig ?? {}) }

    if (!cfg.enabled) continue

    // membros activos com quota no ano corrente
    const quotas = await prisma.memberQuota.findMany({
      where: {
        member: { clubId: club.id, status: { in: ['ACTIVE'] } },
        year: currentYear,
        dueAmount: { gt: 0 },
      },
      include: {
        member: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
    })

    for (const quota of quotas) {
      processed++
      const monthsOverdue = calcMonthsOverdue(quota.monthsPaid, quota.year)
      if (monthsOverdue === 0) continue

      const level = getAlertLevel(monthsOverdue, cfg)
      if (level === 0) continue

      // só envia se o nível actual for maior que o último enviado
      const lastLevel = quota.lastAlertLevel ?? 0
      if (level <= lastLevel) continue

      // verificar que passaram pelo menos 7 dias desde o último alerta
      if (quota.lastAlertAt) {
        const daysSince = (Date.now() - quota.lastAlertAt.getTime()) / 86_400_000
        if (daysSince < 7) continue
      }

      const member     = quota.member
      const memberName = member.nickname ?? member.fullName
      const phone      = member.phone
      const email      = member.user?.email

      // enviar SMS
      if (phone) {
        await sendQuotaReminderSms({
          phone,
          memberName,
          clubName: club.name,
          year: quota.year,
          monthlyAmount: quota.dueAmount,
          monthsOverdue,
          level,
        }).catch(() => {})
        alertsSent++
      }

      // enviar email
      if (email) {
        await sendQuotaAlertEmail({
          to: email,
          memberName,
          clubName: club.name,
          year: quota.year,
          monthsOverdue,
          monthlyAmount: quota.dueAmount,
          level,
        }).catch(() => {})
      }

      // nível disciplinar → criar processo automático se não existir
      if (level >= 3) {
        const title = `Falta de pagamento de quotas ${quota.year}`
        const existing = await prisma.disciplinaryProcess.findFirst({
          where: { clubId: club.id, memberId: member.id, title, status: { in: ['OPEN', 'REVIEWING'] } },
        })

        if (!existing) {
          // usar primeiro admin/capitão como createdBy
          const admin = await prisma.user.findFirst({
            where: { clubId: club.id, role: { in: ['ADMIN', 'CAPTAIN'] } },
          })
          if (admin) {
            await prisma.disciplinaryProcess.create({
              data: {
                clubId:      club.id,
                memberId:    member.id,
                title,
                description: `O membro ${member.fullName} acumula ${monthsOverdue} ${monthsOverdue === 1 ? 'mês' : 'meses'} de quota em atraso no ano ${quota.year}. Processo aberto automaticamente pelo sistema de alertas.`,
                severity:    monthsOverdue >= cfg.suspensionRiskMonths ? 'SERIOUS' : 'MODERATE',
                status:      'OPEN',
                createdById: admin.id,
              },
            })
            disciplinaryCreated++
          }
        }
      }

      // actualizar registo do último alerta
      await prisma.memberQuota.update({
        where: { id: quota.id },
        data: { lastAlertLevel: level, lastAlertAt: new Date() },
      })
    }
  }

  console.log(`[QuotaAlerts] processed=${processed} alertsSent=${alertsSent} disciplinaryCreated=${disciplinaryCreated}`)
  return { processed, alertsSent, disciplinaryCreated }
}

// ── helpers de config ─────────────────────────────────────────────────────────

export async function getAlertConfig(clubId: string): Promise<QuotaAlertConfig> {
  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { defaultSettings: true } })
  const s    = (club?.defaultSettings ?? {}) as Record<string, any>
  return { ...DEFAULT_ALERT_CONFIG, ...(s.quotaAlertConfig ?? {}) }
}

export async function saveAlertConfig(clubId: string, cfg: QuotaAlertConfig): Promise<void> {
  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { defaultSettings: true } })
  const s    = (club?.defaultSettings ?? {}) as Record<string, any>
  await prisma.club.update({
    where: { id: clubId },
    data:  { defaultSettings: { ...s, quotaAlertConfig: cfg as unknown as Prisma.InputJsonValue } },
  })
}

// buildSms é usado no sms.ts — re-exportar para testes
export { buildSms }
