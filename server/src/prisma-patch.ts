import fs from 'fs'
import path from 'path'

// Mitigates "PANIC: timer has gone away" on Hostinger shared hosting.
// Must be set before any Prisma code is loaded.
if (!process.env.TOKIO_WORKER_THREADS) {
  process.env.TOKIO_WORKER_THREADS = '1'
}

if (process.platform === 'linux') {
  // Previous versions of this patch wrote "engineType":"binary" into the generated client.
  // The library.js runtime only accepts "library", causing PrismaClientValidationError.
  // Undo that change so the library engine (with TOKIO_WORKER_THREADS=1) can start.
  const CLIENT_DIR = path.resolve(__dirname, '..', '..', 'node_modules', '.prisma', 'client')
  const indexPath  = path.join(CLIENT_DIR, 'index.js')

  if (fs.existsSync(indexPath)) {
    try {
      const original = fs.readFileSync(indexPath, 'utf-8')
      const restored = original.replace(/"engineType":\s*"binary"/g, '"engineType": "library"')
      if (restored !== original) {
        fs.writeFileSync(indexPath, restored, 'utf-8')
        console.log('[compat] Prisma: restored library engine (binary patch undone)')
      }
    } catch (err) {
      console.error('[compat] Failed to restore Prisma index.js:', (err as Error).message)
    }
  }
}
