import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  const club = await prisma.club.upsert({
    where: { id: 'seed-club-001' },
    update: {},
    create: {
      id: 'seed-club-001',
      name: 'Moto Clube Demo',
      acronym: 'MCD',
      location: 'Luanda',
      country: 'AO',
      motto: 'Sempre na Estrada',
      accentColor: '#dc2626',
      defaultSettings: {
        maxSpeed: 90,
        minDistance: 3,
        radioChannel: 'PMR446 Canal 6',
      },
    },
  })

  const passwordHash = await bcrypt.hash('admin123', 12)
  const user = await prisma.user.upsert({
    where: { email: 'admin@motoclubedemo.pt' },
    update: {},
    create: {
      clubId: club.id,
      email: 'admin@motoclubedemo.pt',
      passwordHash,
      role: 'ADMIN',
    },
  })

  await prisma.member.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      clubId: club.id,
      userId: user.id,
      fullName: 'Administrador Demo',
      nickname: 'Admin',
      status: 'ACTIVE',
      memberNumber: '001',
    },
  })

  // ── Planos ────────────────────────────────────────────────────────────────
  const planDefs = [
    { code: 'arranque', name: 'Arranque',        priceMonthlyKz: 10000, priceAnnualKz: 100000, memberLimit: 15   },
    { code: 'comitiva', name: 'Comitiva',         priceMonthlyKz: 18000, priceAnnualKz: 180000, memberLimit: 35   },
    { code: 'raid',     name: 'Raid',             priceMonthlyKz: 30000, priceAnnualKz: 300000, memberLimit: 75   },
    { code: 'nacional', name: 'Estrada Nacional', priceMonthlyKz: 50000, priceAnnualKz: 500000, memberLimit: null },
  ]
  for (const p of planDefs) {
    await prisma.plan.upsert({
      where:  { code: p.code },
      update: { name: p.name, priceMonthlyKz: p.priceMonthlyKz, priceAnnualKz: p.priceAnnualKz, memberLimit: p.memberLimit, isActive: true },
      create: { ...p, isActive: true },
    })
  }

  // ── Subscrição de trial para o clube demo ─────────────────────────────────
  const comitivaPlan = await prisma.plan.findUnique({ where: { code: 'comitiva' } })
  if (comitivaPlan) {
    await prisma.subscription.upsert({
      where:  { clubId: club.id },
      update: {},
      create: {
        clubId:             club.id,
        planId:             comitivaPlan.id,
        billingCycle:       'MONTHLY',
        status:             'TRIAL',
        currentPeriodStart: new Date(),
        currentPeriodEnd:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
  }

  console.log('✅ Seed concluído!')
  console.log('   Email: admin@motoclubedemo.pt')
  console.log('   Senha: admin123')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
