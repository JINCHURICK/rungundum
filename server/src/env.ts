import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Log to stderr so it appears in hPanel error log
console.error(`[env] __dirname=${__dirname} cwd=${process.cwd()} HOME=${process.env.HOME ?? '(not set)'}`)

const candidates = [
  path.join(__dirname, '..', '..', '..', '..', '..', '.env'), // 5 up
  path.join(__dirname, '..', '..', '..', '..', '.env'),       // 4 up
  path.join(__dirname, '..', '..', '..', '.env'),              // 3 up
  path.join(__dirname, '..', '..', '.env'),                    // 2 up (server root)
  process.env.HOME ? path.join(process.env.HOME, '.env') : null,
  path.join(process.cwd(), '.env'),
]

let loaded = false
for (const candidate of candidates) {
  if (!candidate) continue
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate, override: false })
    console.error(`[env] Loaded .env from: ${candidate}`)
    loaded = true
    break
  }
}

if (!loaded) {
  // No file found by path scan — try plain dotenv (reads from CWD/.env)
  dotenv.config({ override: false })
}

if (!process.env.DATABASE_URL) {
  console.error('[env] WARNING: DATABASE_URL still not set after all attempts. Candidates tried:', candidates.filter(Boolean).join(' | '))
} else {
  console.error('[env] DATABASE_URL is set OK')
}
