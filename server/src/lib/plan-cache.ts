import fs from 'fs'
import path from 'path'

// Resolves to server/data/ regardless of whether running from src or dist
const CACHE_DIR = path.join(__dirname, '..', '..', 'data')
const CACHE_FILE = path.join(CACHE_DIR, 'plan-configs.json')

export function readPlanCache(): any[] | null {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
  } catch {
    return null
  }
}

export function writePlanCache(configs: any[]): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify(configs, null, 2), 'utf-8')
  } catch (err) {
    console.error('plan-cache write failed:', err)
  }
}
