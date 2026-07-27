import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2] ?? 'danielmotaviegas@gmail.com'

  const user = await prisma.user.update({
    where: { email },
    data: { platformAdmin: true },
    select: { id: true, email: true, platformAdmin: true },
  })

  console.log(`✅ platformAdmin activado para: ${user.email}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
