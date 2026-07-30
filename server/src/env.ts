import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Try every plausible .env location on Hostinger and log each attempt
const candidates = [
  path.join(__dirname, '..', '..', '..', '..', '..', '.env'), // 5 up (domains/domain.com/nodejs/server/dist)
  path.join(__dirname, '..', '..', '..', '..', '.env'),       // 4 up
  path.join(__dirname, '..', '..', '..', '.env'),              // 3 up
  process.env.HOME ? path.join(process.env.HOME, '.env') : null,
  path.join(process.cwd(), '.env'),
]

for (const candidate of candidates) {
  if (!candidate) continue
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate, override: false })
    console.log(`[env] Loaded .env from: ${candidate}`)
    break
  }
}

// Final catch-all
dotenv.config({ override: false })

if (!process.env.DATABASE_URL) {
  console.error('[env] WARNING: DATABASE_URL is not set — tried paths:', candidates.filter(Boolean))
} else {
  console.log('[env] DATABASE_URL is set')
}
