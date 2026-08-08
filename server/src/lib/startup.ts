const START_TIME = Date.now()
const WARMUP_MS = 300

const warmupDone: Promise<void> = new Promise(r => setTimeout(r, WARMUP_MS))

export function ensureWarmedUp(): Promise<void> {
  if (Date.now() - START_TIME >= WARMUP_MS) return Promise.resolve()
  return warmupDone
}
