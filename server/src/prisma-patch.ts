import fs from 'fs'
import path from 'path'
import https from 'https'
import { createGunzip } from 'zlib'

// Must run before any Prisma code is loaded.
// Fixes "PANIC: timer has gone away" on Hostinger shared hosting.

// Limit Tokio worker threads — helps on restricted shared hosting environments
if (!process.env.TOKIO_WORKER_THREADS) {
  process.env.TOKIO_WORKER_THREADS = '1'
}

// Attempt to switch to the binary engine (isolated child process, no timer issues).
// If the binary engine is missing, download it in the background so the next
// restart can use it. The current process may still use library engine + TOKIO fix.
if (process.platform === 'linux') {
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
    try {
      fs.copyFileSync(binaryInEngines, binaryInClient)
      binaryPath = binaryInClient
    } catch {
      binaryPath = binaryInEngines
    }
  }

  if (binaryPath) {
    activateBinaryEngine(binaryPath)
  } else {
    console.warn('[compat] Binary engine not found; TOKIO_WORKER_THREADS=1 active. Downloading in background...')
    downloadBinaryEngine(binaryInClient, CLIENT_DIR).catch(err => {
      console.error('[compat] Download failed:', (err as Error).message)
    })
  }

  function activateBinaryEngine(bp: string) {
    try { fs.chmodSync(bp, 0o755) } catch {}
    process.env.PRISMA_QUERY_ENGINE_BINARY = bp

    const indexPath = path.join(CLIENT_DIR, 'index.js')
    if (fs.existsSync(indexPath)) {
      try {
        const original = fs.readFileSync(indexPath, 'utf-8')
        const patched  = original.replace(/"engineType":\s*"library"/g, '"engineType":"binary"')
        if (patched !== original) {
          fs.writeFileSync(indexPath, patched, 'utf-8')
          console.log('[compat] Prisma: switched to binary engine →', bp)
        } else {
          console.log('[compat] Prisma: binary engine already active')
        }
      } catch (err) {
        console.error('[compat] Failed to patch Prisma index.js:', (err as Error).message)
      }
    }
  }

  async function downloadBinaryEngine(destPath: string, clientDir: string): Promise<void> {
    // Resolve engine version from the installed @prisma/engines package
    let version = ''
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const engines = require('@prisma/engines') as { enginesVersion?: string }
      version = engines.enginesVersion ?? ''
    } catch {}

    if (!version) {
      try {
        const idx = fs.readFileSync(path.join(clientDir, 'index.js'), 'utf-8')
        const m = idx.match(/"engineVersion":\s*"([a-f0-9]{40})"/)
        version = m?.[1] ?? ''
      } catch {}
    }

    if (!version) {
      console.error('[compat] Cannot determine Prisma engine version — skipping download')
      return
    }

    const url = `https://binaries.prisma.sh/all_commits/${version}/debian-openssl-1.1.x/query-engine.gz`
    console.log('[compat] Downloading binary engine:', version.slice(0, 12) + '...')

    const tmpPath = destPath + '.tmp.gz'

    await new Promise<void>((resolve, reject) => {
      https.get(url, (res) => {
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return }
        const gunzip = createGunzip()
        const out    = fs.createWriteStream(destPath + '.tmp')
        res.pipe(gunzip).pipe(out)
        out.on('finish', () => { out.close(); resolve() })
        out.on('error', reject)
        gunzip.on('error', reject)
      }).on('error', reject)
    }).catch(e => { try { fs.unlinkSync(tmpPath) } catch {} throw e })

    fs.renameSync(destPath + '.tmp', destPath)
    fs.chmodSync(destPath, 0o755)
    console.log('[compat] Binary engine downloaded — restart server to activate it')
  }
}
