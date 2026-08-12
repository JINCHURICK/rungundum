import './prisma-patch' // MUST be first — patches Prisma before any Prisma code is loaded
import './env'
import app from './app'
import { prisma, recreatePrismaClient } from './lib/prisma'
import { calibrateClockOffset } from './services/cloudinary'

const socketPath = process.env.LSNODE_SOCKET
const PORT = parseInt(process.env.PORT ?? '3001', 10)

function isPrismaPanic(err: any) {
  return err?.name === 'PrismaClientRustPanicError'
}

process.on('unhandledRejection', (reason) => {
  if (isPrismaPanic(reason)) {
    console.error('[panic] Prisma engine panic (unhandledRejection) — recreating client')
    recreatePrismaClient()
    return
  }
  // Prisma initialization errors happen after engine panics — log but don't crash
  if ((reason as any)?.name === 'PrismaClientInitializationError') {
    console.error('[prisma] Initialization error (unhandledRejection) — request failed but server continues:', (reason as any)?.message)
    return
  }
  console.error('Unhandled rejection:', reason)
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  if (isPrismaPanic(err)) {
    console.error('[panic] Prisma engine panic (uncaughtException) — recreating client')
    recreatePrismaClient()
    return
  }
  if (err?.name === 'PrismaClientInitializationError') {
    console.error('[prisma] Initialization error (uncaughtException) — request failed but server continues:', err?.message)
    return
  }
  console.error('Uncaught exception:', err)
  process.exit(1)
})

prisma.$connect().catch(() => {})
calibrateClockOffset().catch(() => {})

if (socketPath) {
  app.listen(socketPath, () => {
    console.log(`🏍️  Rungundum Server running on socket ${socketPath}`)
  })
} else {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏍️  Rungundum Server running on http://0.0.0.0:${PORT}`)
  })
}
