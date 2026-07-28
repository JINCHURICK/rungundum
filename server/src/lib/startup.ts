const START_TIME = Date.now()
const WARMUP_MS = 2000

// Single shared promise — all held requests await the same timer
const warmupDone: Promise<void> = new Promise(r => setTimeout(r, WARMUP_MS))

export function ensureWarmedUp(): Promise<void> {
  if (Date.now() - START_TIME >= WARMUP_MS) return Promise.resolve()
  return warmupDone
}
