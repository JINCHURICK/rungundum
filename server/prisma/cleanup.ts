import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 A limpar dados históricos...')

  // 1 — dependentes de participants
  const ci = await prisma.checklistItem.deleteMany()
  console.log(`  checklist_items: ${ci.count}`)

  // 2 — dependentes de raids e members
  const pt = await prisma.participant.deleteMany()
  console.log(`  participants: ${pt.count}`)

  // 3 — dependentes de raids
  const rp = await prisma.routePoint.deleteMany()
  console.log(`  route_points: ${rp.count}`)

  const ph = await prisma.raidPhoto.deleteMany()
  console.log(`  raid_photos: ${ph.count}`)

  const cp = await prisma.contingencyPlan.deleteMany()
  console.log(`  contingency_plans: ${cp.count}`)

  // 4 — raids
  const rd = await prisma.raid.deleteMany()
  console.log(`  raids: ${rd.count}`)

  // 5 — quotas
  const qp = await prisma.quotaPayment.deleteMany()
  console.log(`  quota_payments: ${qp.count}`)

  const mq = await prisma.memberQuota.deleteMany()
  console.log(`  member_quotas: ${mq.count}`)

  // 6 — tesouraria
  const tx = await prisma.transaction.deleteMany()
  console.log(`  transactions: ${tx.count}`)

  // 7 — disciplinar (fines e suspensions primeiro)
  const fn = await prisma.fine.deleteMany()
  console.log(`  fines: ${fn.count}`)

  const sp = await prisma.suspension.deleteMany()
  console.log(`  suspensions: ${sp.count}`)

  const dp = await prisma.disciplinaryProcess.deleteMany()
  console.log(`  disciplinary_processes: ${dp.count}`)

  // 8 — comunicados e cargos
  const an = await prisma.announcement.deleteMany()
  console.log(`  announcements: ${an.count}`)

  const pos = await prisma.clubPosition.deleteMany()
  console.log(`  club_positions: ${pos.count}`)

  // 9 — ligas
  const le = await prisma.leagueEntry.deleteMany()
  console.log(`  league_entries: ${le.count}`)

  const lg = await prisma.league.deleteMany()
  console.log(`  leagues: ${lg.count}`)

  // 10 — contactos de emergência
  const ec = await prisma.emergencyContact.deleteMany()
  console.log(`  emergency_contacts: ${ec.count}`)

  // 11 — veículos (depois de participants já eliminados)
  const vh = await prisma.vehicle.deleteMany()
  console.log(`  vehicles: ${vh.count}`)

  // 12 — membros
  const mb = await prisma.member.deleteMany()
  console.log(`  members: ${mb.count}`)

  // 13 — utilizadores MEMBER e GUEST (ADMIN e CAPTAIN ficam para manter acesso)
  const us = await prisma.user.deleteMany({
    where: { role: { in: ['MEMBER', 'GUEST'] } },
  })
  console.log(`  users (MEMBER/GUEST): ${us.count}`)

  console.log('\n✅ Limpeza concluída. Clubes, admins, planos e subscrições mantidos.')
}

main()
  .catch((e) => { console.error('❌ Erro:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
