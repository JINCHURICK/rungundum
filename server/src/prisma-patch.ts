import fs from 'fs'
import path from 'path'

// Must run before any Prisma code is loaded.
// Fixes "PANIC: timer has gone away" on Hostinger shared hosting.

// Limit Tokio worker threads — helps on restricted shared hosting environments
if (!process.env.TOKIO_WORKER_THREADS) {
  process.env.TOKIO_WORKER_THREADS = '1'
}

// Attempt to switch Prisma from library engine (embeds Rust/Tokio in .so.node)
// to binary engine (standalone child process with its own isolated Tokio runtime).
// The binary engine is not affected by the parent process's timer restrictions.
if (process.platform === 'linux') {
  // From server/dist/ go up 2 levels to reach the project node_modules/
  const NODE_MODULES = path.resolve(__dirname, '..', '..', 'node_modules')
  const CLIENT_DIR   = path.join(NODE_MODULES, '.prisma', 'client')
  const ENGINES_DIR  = path.join(NODE_MODULES, '@prisma', 'engines')
  const BINARY_NAME  = 'query-engine-debian-openssl-1.1.x'

  const binaryInClient  = path.join(CLIENT_DIR, BINARY_NAME)
  const binaryInEngines = path.join(ENGINES_DIR, BINARY_NAME)

  let binaryPath: string | null = null

  if (fs.existsSync(binaryInClient)) {
    binaryPath = binaryInClient
  } else if (fs.existsSync(binaryInEngines)) {
    // Copy to .prisma/client/ so Prisma finds it in the expected location
    try {
      fs.copyFileSync(binaryInEngines, binaryInClient)
      binaryPath = binaryInClient
    } catch {
      binaryPath = binaryInEngines // fall back to using it in place
    }
  }

  if (binaryPath) {
    // Ensure execute permission
    try { fs.chmodSync(binaryPath, 0o755) } catch {}

    // Override the binary engine path via env var (Prisma checks this at runtime)
    process.env.PRISMA_QUERY_ENGINE_BINARY = binaryPath

    // Patch the generated client to declare engineType = binary
    // (the generated index.js has "engineType":"library" baked in from prisma generate)
    const indexPath = path.join(CLIENT_DIR, 'index.js')
    if (fs.existsSync(indexPath)) {
      try {
        const original = fs.readFileSync(indexPath, 'utf-8')
        const patched  = original.replace(/"engineType":\s*"library"/g, '"engineType":"binary"')
        if (patched !== original) {
          fs.writeFileSync(indexPath, patched, 'utf-8')
          console.log('[compat] Prisma: switched to binary engine →', binaryPath)
        } else {
          console.log('[compat] Prisma: binary engine already active')
        }
      } catch (err) {
        console.error('[compat] Failed to patch Prisma index.js:', (err as Error).message)
      }
    }
  } else {
    console.warn('[compat] Binary engine not found; library engine active (TOKIO_WORKER_THREADS=1 applied)')
  }
}
