import { v2 as cloudinary } from 'cloudinary'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const UPLOADS_DIR = path.resolve(path.join(__dirname, '..', '..', 'uploads'))

// Converte qualquer string para slug seguro para filesystem (sem acentos, sem espacos)
export function slugify(str: string): string {
  return str
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'sem-nome'
}

// Magic bytes para validacao de tipo real de ficheiro
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
      // Validacao extra para WebP: bytes 8-11 devem ser "WEBP"
      if (sig.mime === 'image/webp') {
        if (buffer.slice(8, 12).toString('ascii') !== 'WEBP') continue
      }
      return sig.mime
    }
  }
  throw new Error('Tipo de ficheiro nao permitido. Apenas JPEG, PNG, GIF ou WebP sao aceites.')
}

// Valida imagens OU PDF -- para documentos como comprovantes de pagamento
export function validateDocumentBuffer(buffer: Buffer): string {
  // Tentar como imagem primeiro
  try { return validateImageBuffer(buffer) } catch {}
  // PDF: magic bytes %PDF = 0x25 0x50 0x44 0x46
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf'
  }
  throw new Error('Tipo de ficheiro nao permitido. Apenas JPEG, PNG, WebP ou PDF sao aceites.')
}

// Optimiza imagem: auto-roda (EXIF), redimensiona ate 1500px, converte para WebP q85
async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(1500, 1500, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function saveLocally(buffer: Buffer, folder: string, detectedMime: string): string {
  const ext = detectedMime === 'image/png' ? 'png' : detectedMime === 'image/gif' ? 'gif' : detectedMime === 'image/webp' ? 'webp' : detectedMime === 'application/pdf' ? 'pdf' : 'jpg'
  // Pasta normalizada e verificada dentro de UPLOADS_DIR
  const safeFolder = folder.replace(/\.\./g, '').replace(/[^a-zA-Z0-9/_-]/g, '')
  const dir = path.join(UPLOADS_DIR, safeFolder)
  const resolvedDir = path.resolve(dir)
  if (!resolvedDir.startsWith(UPLOADS_DIR + path.sep) && resolvedDir !== UPLOADS_DIR) {
    throw new Error('Caminho de upload invalido.')
  }
  ensureDir(resolvedDir)
  // Nome baseado no hash do conteudo: mesma imagem = mesmo ficheiro (deduplicacao automatica)
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 24)
  const filename = `${hash}.${ext}`
  const filePath = path.join(resolvedDir, filename)
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, buffer)
  }
  return `/uploads/${safeFolder}/${filename}`
}

// Cache de imagens para PDFs: evita re-descarregar a mesma foto em geracoes consecutivas
const _pdfImageCache = new Map<string, { data: string; expires: number }>()
const _CACHE_TTL = 15 * 60 * 1000 // 15 minutos
const _CACHE_MAX = 100

function _getCached(url: string): string | null {
  const entry = _pdfImageCache.get(url)
  if (!entry) return null
  if (Date.now() > entry.expires) { _pdfImageCache.delete(url); return null }
  return entry.data
}

function _setCached(url: string, data: string): void {
  if (_pdfImageCache.size >= _CACHE_MAX) {
    const oldest = _pdfImageCache.keys().next().value
    if (oldest) _pdfImageCache.delete(oldest)
  }
  _pdfImageCache.set(url, { data, expires: Date.now() + _CACHE_TTL })
}

// Para URLs do Cloudinary, pede versao reduzida (300x300) que descarrega muito mais rapido
function _cloudinaryThumb(url: string): string {
  if (!url.includes('res.cloudinary.com')) return url
  return url.replace('/upload/', '/upload/w_300,h_300,c_fill,f_jpg,q_75/')
}

/**
 * Converte qualquer URL de imagem para data URI que o Puppeteer consegue renderizar.
 * URLs externas (Cloudinary) sao redimensionadas e cacheadas em memoria.
 * URLs locais sao lidas do disco.
 * Protegido contra path traversal.
 */
export async function resolveImageForPuppeteer(url: string | null | undefined): Promise<string | null> {
  if (!url) return null

  if (url.startsWith('http')) {
    const cached = _getCached(url)
    if (cached) return cached

    try {
      const fetchUrl = _cloudinaryThumb(url)
      const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) return null
      const buffer = Buffer.from(await res.arrayBuffer())
      const ct = res.headers.get('content-type') ?? 'image/jpeg'
      const mime = ct.split(';')[0].trim()
      const dataUri = `data:${mime};base64,${buffer.toString('base64')}`
      _setCached(url, dataUri)
      return dataUri
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

// Offset entre o relogio do sistema e o UTC real (em ms).
let clockOffsetMs = 0

export async function calibrateClockOffset(): Promise<void> {
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
        console.warn(`[cloudinary] clock offset: ${Math.round(clockOffsetMs / 1000)}s`)
      }
      return
    } catch { /* tenta proxima fonte */ }
  }
  console.warn('[cloudinary] calibracao falhou em todas as fontes')
}

function getRealTimestampSeconds(): number {
  return Math.round((Date.now() + clockOffsetMs) / 1000)
}

function handleStaleRequest(errorMessage: string): number | null {
  const match = errorMessage.match(/reported time is (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)
  if (!match) return null
  const ourSentMs = new Date(match[1] + ' +0000').getTime()
  const correctedMs = ourSentMs + 61 * 60 * 1000
  clockOffsetMs = correctedMs - Date.now()
  console.warn(`[cloudinary] Stale request -- offset auto-corrigido para ${Math.round(clockOffsetMs / 1000)}s`)
  return Math.round(correctedMs / 1000)
}

async function _doCloudinaryUpload(
  buffer: Buffer,
  folder: string,
  resourceType: 'image' | 'raw' | 'auto',
  extraOptions: Record<string, any> = {},
): Promise<string> {
  function doUpload(timestamp: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType, timestamp, ...extraOptions },
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
    if (typeof err?.message === 'string' && err.message.includes('Stale request')) {
      const correctedTs = handleStaleRequest(err.message)
      if (correctedTs) return await withTimeout(doUpload(correctedTs))
    }
    throw err
  }
}

export async function uploadToCloudinary(buffer: Buffer, folder: string): Promise<string> {
  validateImageBuffer(buffer) // valida magic bytes antes de processar
  const optimized = await optimizeImage(buffer)
  return saveLocally(optimized, folder, 'image/webp')
}

// Para comprovantes de pagamento -- aceita imagens e PDF.
// Imagens sao optimizadas; PDFs sao guardados directamente.
export async function uploadDocumentToCloudinary(buffer: Buffer, folder: string): Promise<string> {
  const detectedMime = validateDocumentBuffer(buffer)
  if (detectedMime === 'application/pdf') {
    return saveLocally(buffer, folder, detectedMime)
  }
  const optimized = await optimizeImage(buffer)
  return saveLocally(optimized, folder, 'image/webp')
}
