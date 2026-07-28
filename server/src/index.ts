import './prisma-patch' // MUST be first — patches Prisma before any Prisma code is loaded
import './env'
import app from './app'
import { recreatePrismaClient } from './lib/prisma'

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
  console.error('Unhandled rejection:', reason)
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  if (isPrismaPanic(err)) {
    console.error('[panic] Prisma engine panic (uncaughtException) — recreating client')
    recreatePrismaClient()
    return
  }
  console.error('Uncaught exception:', err)
  process.exit(1)
})

if (socketPath) {
  app.listen(socketPath, () => {
    console.log(`🏍️  Rungundum Server running on socket ${socketPath}`)
  })
} else {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏍️  Rungundum Server running on http://0.0.0.0:${PORT}`)
  })
}
