import dotenv from 'dotenv'
import path from 'path'

// In production, load from home directory (persists across deploys)
// In development, load from local .env
const homePath = process.env.HOME
if (homePath) {
  dotenv.config({ path: path.join(homePath, '.env'), override: false })
}
dotenv.config({ override: false })
