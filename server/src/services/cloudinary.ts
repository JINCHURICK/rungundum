import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs'
import path from 'path'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const UPLOADS_DIR = path.resolve(path.join(__dirname, '..', '..', 'uploads'))

// Magic bytes para validação de tipo real de ficheiro
const IMAGE_SIGNATURES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: 'image/gif',  bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF87a ou GIF89a
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF + WEBP a bytes 8-11
]

export function validateImageBuffer(buffer: Buffer): string {
  for (const sig of IMAGE_SIGNATURES) {
    const offset = sig.offset ?? 0
    const match = sig.bytes.every((b, i) => buffer[offset + i] === b)
    if (match) {
      // Validação extra para WebP: bytes 8-11 devem ser "WEBP"
      if (sig.mime === 'image/webp') {
        if (buffer.slice(8, 12).toString('ascii') !== 'WEBP') continue
      }
      return sig.mime
    }
  }
  throw new Error('Tipo de ficheiro não permitido. Apenas JPEG, PNG, GIF ou WebP são aceites.')
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function saveLocally(buffer: Buffer, folder: string, detectedMime: string): string {
  const ext = detectedMime === 'image/png' ? 'png' : detectedMime === 'image/gif' ? 'gif' : detectedMime === 'image/webp' ? 'webp' : 'jpg'
  // Pasta normalizada e verificada dentro de UPLOADS_DIR
  const safeFolder = folder.replace(/\.\./g, '').replace(/[^a-zA-Z0-9/_-]/g, '')
  const dir = path.join(UPLOADS_DIR, safeFolder)
  const resolvedDir = path.resolve(dir)
  if (!resolvedDir.startsWith(UPLOADS_DIR + path.sep) && resolvedDir !== UPLOADS_DIR) {
    throw new Error('Caminho de upload inválido.')
  }
  ensureDir(resolvedDir)
  const filename = `${Date.now()}.${ext}`
  fs.writeFileSync(path.join(resolvedDir, filename), buffer)
  return `/uploads/${safeFolder}/${filename}`
}

/**
 * Converte qualquer URL de imagem para data URI que o Puppeteer consegue renderizar.
 * URLs externas (Cloudinary, etc.) são descarregadas pelo Node.js.
 * URLs locais são lidas do disco.
 * Protegido contra path traversal.
 */
export async function resolveImageForPuppeteer(url: string | null | undefined): Promise<string | null> {
  if (!url) return null

  if (url.startsWith('http')) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) return null
      const buffer = Buffer.from(await res.arrayBuffer())
      const ct = res.headers.get('content-type') ?? 'image/jpeg'
      const mime = ct.split(';')[0].trim()
      return `data:${mime};base64,${buffer.toString('base64')}`
    } catch {
      return null
    }
  }

  const relativePart = url.replace(/^\/uploads\//, '')
  const localPath = path.resolve(path.join(UPLOADS_DIR, relativePart))

  if (!localPath.startsWith(UPLOADS_DIR + path.sep)) return null
  if (!fs.existsSync(localPath)) return null

  const buffer = fs.readFileSync(localPath)
  const ext = path.extname(localPath).toLowerCase().slice(1)
  const mimeType = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg'
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

// Offset entre o relógio do sistema e o UTC real (em ms).
// Corrigido automaticamente ao receber erro "Stale request" do Cloudinary.
let clockOffsetMs = 0

export async function calibrateClockOffset(): Promise<void> {
  // Tenta várias fontes de tempo em sequência
  const sources: Array<() => Promise<number>> = [
    async () => {
      const res = await fetch('https://worldtimeapi.org/api/timezone/UTC', { signal: AbortSignal.timeout(4000) })
      const d = await res.json() as { utc_datetime: string }
      return new Date(d.utc_datetime).getTime()
    },
    async () => {
      const res = await fetch('https://timeapi.io/api/time/current/zone?timeZone=UTC', { signal: AbortSignal.timeout(4000) })
      const d = await res.json() as { dateTime: string }
      return new Date(d.dateTime + 'Z').getTime()
    },
    async () => {
      // Usa o header Date de qualquer resposta HTTPS — funciona mesmo com Cloudinary
      const res = await fetch('https://api.cloudinary.com/', { method: 'HEAD', signal: AbortSignal.timeout(4000) })
      const dateHeader = res.headers.get('date')
      if (!dateHeader) throw new Error('sem Date header')
      return new Date(dateHeader).getTime()
    },
  ]

  for (const source of sources) {
    try {
      const before = Date.now()
      const realUtc = await source()
      const after = Date.now()
      clockOffsetMs = realUtc - Math.round((before + after) / 2)
      if (Math.abs(clockOffsetMs) > 5000) {
        console.warn(`[cloudinary] clock offset: ${Math.round(clockOffsetMs / 1000)}s — timestamps corrigidos`)
      }
      return
    } catch { /* tenta próxima fonte */ }
  }
  console.warn('[cloudinary] calibração falhou em todas as fontes — a usar relógio do sistema')
}

function getRealTimestampSeconds(): number {
  return Math.round((Date.now() + clockOffsetMs) / 1000)
}

// Extrai o timestamp enviado da mensagem de erro "Stale request"
// e auto-corrige o offset para uploads futuros.
function handleStaleRequest(errorMessage: string): number | null {
  const match = errorMessage.match(/reported time is (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)
  if (!match) return null
  const ourSentMs = new Date(match[1] + ' +0000').getTime()
  // O Cloudinary exige que o timestamp esteja a menos de 1h do UTC real.
  // Adicionamos 61 minutos ao timestamp que enviámos para ficar dentro da janela.
  const correctedMs = ourSentMs + 61 * 60 * 1000
  clockOffsetMs = correctedMs - Date.now()
  console.warn(`[cloudinary] Stale request — offset auto-corrigido para ${Math.round(clockOffsetMs / 1000)}s`)
  return Math.round(correctedMs / 1000)
}

export async function uploadToCloudinary(buffer: Buffer, folder: string): Promise<string> {
  // Validar magic bytes antes de qualquer upload
  const detectedMime = validateImageBuffer(buffer)

  const hasCloudinary = process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_KEY.trim() !== ''

  if (!hasCloudinary) {
    return saveLocally(buffer, folder, detectedMime)
  }

  function doUpload(timestamp: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }], timestamp },
        (error, result) => {
          if (error) return reject(error)
          resolve(result!.secure_url)
        }
      )
      stream.end(buffer)
    })
  }

  const withTimeout = (p: Promise<string>) => Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Cloudinary upload timeout (30s)')), 30_000)),
  ])

  try {
    return await withTimeout(doUpload(getRealTimestampSeconds()))
  } catch (err: any) {
    // Se o relógio do sistema estiver dessincronizado, auto-corrige e tenta uma vez mais
    if (typeof err?.message === 'string' && err.message.includes('Stale request')) {
      const correctedTs = handleStaleRequest(err.message)
      if (correctedTs) return await withTimeout(doUpload(correctedTs))
    }
    throw err
  }
}
