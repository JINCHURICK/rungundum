import './env'
import app from './app'

const socketPath = process.env.LSNODE_SOCKET
const PORT = parseInt(process.env.PORT ?? '3001', 10)

if (socketPath) {
  app.listen(socketPath, () => {
    console.log(`🏍️  Rungundum Server running on socket ${socketPath}`)
  })
} else {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏍️  Rungundum Server running on http://0.0.0.0:${PORT}`)
  })
}
