import dotenv from 'dotenv'
dotenv.config({ override: true })
import app from './app'

const PORT = parseInt(process.env.PORT ?? '3001', 10)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏍️  Rungundum Server running on http://0.0.0.0:${PORT}`)
})
