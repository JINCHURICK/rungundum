import dotenv from 'dotenv'
import path from 'path'

// __dirname = .../nodejs/server/dist  →  5 levels up = /home/USER/
// LiteSpeed does not always set HOME, so we derive the home dir from __dirname.
const homedirFromScript = path.join(__dirname, '..', '..', '..', '..', '..')
dotenv.config({ path: path.join(homedirFromScript, '.env'), override: false })

// Fallback for local dev where HOME is available
const homePath = process.env.HOME
if (homePath) {
  dotenv.config({ path: path.join(homePath, '.env'), override: false })
}

// Final fallback: CWD .env
dotenv.config({ override: false })
