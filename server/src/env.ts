import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// On Hostinger the app runs from a versioned build path — DATABASE_URL should be
// configured in hPanel → Node.js → Environment Variables, not via a .env file.
// This fallback scan exists for local dev and other environments.
const candidates = [
  path.join(__dirname, '..', '..', '..', '..', '..', '.env'),
  path.join(__dirname, '..', '..', '..', '..', '.env'),
  path.join(__dirname, '..', '..', '..', '.env'),
  path.join(__dirname, '..', '..', '.env'),
  process.env.HOME ? path.join(process.env.HOME, '.env') : null,
  path.join(process.cwd(), '.env'),
]

for (const candidate of candidates) {
  if (!candidate) continue
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate, override: false })
    break
  }
}

dotenv.config({ override: false })
