import './env'
import app from './app'
import { prisma } from './lib/prisma'

const socketPath = process.env.LSNODE_SOCKET
const PORT = parseInt(process.env.PORT ?? '3001', 10)

async function start() {
  // Inicializar a ligação ao MySQL antes de aceitar requests
  // (evita o PANIC: timer has gone away do Prisma quando requests chegam antes do engine inicializar)
  await prisma.$connect()

  if (socketPath) {
    app.listen(socketPath, () => {
      console.log(`🏍️  Rungundum Server running on socket ${socketPath}`)
    })
  } else {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🏍️  Rungundum Server running on http://0.0.0.0:${PORT}`)
    })
  }
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
