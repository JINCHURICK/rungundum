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
 * Converte URL local para data URI que o Puppeteer consegue renderizar.
 * Protegido contra path traversal.
 */
export function resolveImageForPuppeteer(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('http')) return url

  const relativePart = url.replace(/^\/uploads\//, '')
  const localPath = path.resolve(path.join(UPLOADS_DIR, relativePart))

  // Prevenir path traversal — o caminho resolvido deve estar dentro de UPLOADS_DIR
  if (!localPath.startsWith(UPLOADS_DIR + path.sep)) return null
  if (!fs.existsSync(localPath)) return null

  const buffer = fs.readFileSync(localPath)
  const ext = path.extname(localPath).toLowerCase().slice(1)
  const mimeType = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg'
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

export async function uploadToCloudinary(buffer: Buffer, folder: string): Promise<string> {
  // Validar magic bytes antes de qualquer upload
  const detectedMime = validateImageBuffer(buffer)

  const hasCloudinary = process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_KEY.trim() !== ''

  if (!hasCloudinary) {
    return saveLocally(buffer, folder, detectedMime)
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
      (error, result) => {
        if (error) return reject(error)
        resolve(result!.secure_url)
      }
    )
    stream.end(buffer)
  })
}
