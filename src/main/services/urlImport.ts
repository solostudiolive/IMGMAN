import { randomUUID } from 'crypto'
import { mkdir, writeFile, stat, rm } from 'fs/promises'
import { join } from 'path'
import { lookup } from 'node:dns/promises'
import net from 'node:net'
import { Readable, Transform } from 'node:stream'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import sharp from 'sharp'
import { getActiveLibrary, imagesDir } from './library'
import { extractPalette, paletteToJson } from './palette'
import { hashFile } from './hash'
import { extractMediaThumbnail } from './mediaThumbnail'
import { classifyType, insertItem, type ItemType, type ImportedItem } from './import'

// Thumbnail max dimension (mirrors import.ts' THUMB_MAX — not exported, so duplicated here).
const THUMB_MAX = 512

export const URL_IMPORT_CONFIG = {
  maxSizeBytes: 50 * 1024 * 1024, // 50 MB
  maxRedirects: 5,
  timeoutMs: 30000,
}

export interface ImportProgress {
  done: number
  total: number | null // null when content-length is unknown
}

/**
 * Resolve hostname to IP addresses and check if any are private/loopback.
 * Fail-closed: if DNS resolution fails, block the URL (safer to reject than allow).
 */
async function isPrivateIp(hostname: string): Promise<boolean> {
  const isLocalhost = hostname === 'localhost'
  if (isLocalhost) return true

  try {
    const result = await lookup(hostname)
    const ip = result.address
    const parsed = net.isIP(ip)
    if (parsed === 0) return false // not an IP — shouldn't happen from lookup, but guard anyway

    if (parsed === 4) {
      const parts = ip.split('.').map(Number)
      // Loopback 127.0.0.0/8
      if (parts[0] === 127) return true
      // Private 10.0.0.0/8
      if (parts[0] === 10) return true
      // Private 172.16.0.0/12
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
      // Private 192.168.0.0/16
      if (parts[0] === 192 && parts[1] === 168) return true
      // Link-local 169.254.0.0/16
      if (parts[0] === 169 && parts[1] === 254) return true
      // Unspecified 0.0.0.0
      if (ip === '0.0.0.0') return true
    }

    if (parsed === 6) {
      // Loopback ::1
      if (ip === '::1') return true
      // Unique local fc00::/7
      if (ip.startsWith('fc') || ip.startsWith('fd')) return true
      // Link-local fe80::/10
      if (ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')) return true
    }

    return false
  } catch {
    // DNS resolution failed — fail closed.
    return true
  }
}

// Extract file extension from pathname, or derive from content-type as fallback.
function extractExt(pathname: string, contentType?: string): string {
  const fromPath = pathname.split('/').pop()?.split('.').pop()?.toLowerCase() || ''
  if (fromPath && fromPath.length >= 2 && fromPath.length <= 5) return fromPath

  // Fallback: derive extension from content-type.
  if (contentType) {
    const mime = contentType.split(';')[0].trim()
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
      'image/tiff': 'tif',
      'image/svg+xml': 'svg',
      'image/avif': 'avif',
      'image/heic': 'heic',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/webm': 'webm',
      'video/x-matroska': 'mkv',
      'video/x-msvideo': 'avi',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/flac': 'flac',
      'audio/mp4': 'm4a',
      'application/pdf': 'pdf',
      'font/ttf': 'ttf',
      'font/otf': 'otf',
      'font/woff': 'woff',
      'font/woff2': 'woff2',
    }
    const mapped = extMap[mime]
    if (mapped) return mapped
  }

  return ''
}

/**
 * Validate a URL before fetching. Blocks loopback, private IPs, file:// scheme,
 * and non-allow-listed file types. Returns the parsed URL on success.
 */
export async function validateUrl(rawUrl: string): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL.')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are allowed.')
  }

  // Check hostname before DNS resolution.
  if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.localhost')) {
    throw new Error('Localhost URLs are blocked.')
  }

  // Block private/loopback IPs (resolves via DNS, fail-closed).
  const privateIp = await isPrivateIp(parsed.hostname)
  if (privateIp) {
    throw new Error('Private or internal network addresses are blocked.')
  }

  // Check the file extension against the allow-list.
  const ext = extractExt(parsed.pathname)
  if (ext && classifyType(ext) === 'other') {
    throw new Error(`File type ".${ext}" is not supported.`)
  }

  return parsed
}

async function imagesRoot(): Promise<string> {
  const lib = getActiveLibrary()
  if (!lib) throw new Error('No active library. Open or create a library first.')
  return imagesDir(lib.path)
}

/**
 * Fetch a URL with redirect following (capped at maxRedirects). Each redirect
 * target is re-validated to prevent SSRF bypass. Returns the final response.
 */
async function fetchWithRedirect(
  rawUrl: string,
  maxRedirects: number
): Promise<{ response: Response; effectiveUrl: string }> {
  let url = rawUrl
  let redirects = 0

  while (true) {
    // Validate each redirect target to prevent SSRF bypass.
    await validateUrl(url)

    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(URL_IMPORT_CONFIG.timeoutMs),
    })

    if (response.ok && !response.body) {
      return { response, effectiveUrl: url }
    }

    // Handle redirects (3xx with Location header).
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) {
        throw new Error('Server returned a redirect without a Location header.')
      }
      const nextUrl = new URL(location, url).href
      redirects++
      if (redirects > maxRedirects) {
        throw new Error(`Too many redirects (max ${maxRedirects}).`)
      }
      url = nextUrl
      continue
    }

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}.`)
    }

    if (!response.body) {
      throw new Error('Response has no body.')
    }

    return { response, effectiveUrl: url }
  }
}

/**
 * Import content from a URL: validates, fetches, streams to disk, then runs
 * the same thumbnail/palette/hash pipeline as importFile. The source_url is
 * set to the original URL on the imported item.
 */
export async function importUrl(
  rawUrl: string,
  onProgress?: (done: number, total: number | null) => void
): Promise<ImportedItem> {
  // Validate before any network request.
  await validateUrl(rawUrl)

  const { response } = await fetchWithRedirect(rawUrl, URL_IMPORT_CONFIG.maxRedirects)

  // Determine extension: from URL path first, then content-type as fallback.
  const contentType = response.headers.get('content-type') ?? undefined
  const ext = extractExt(rawUrl, contentType)

  // After content-type fallback, check the type is allow-listed.
  if (classifyType(ext) === 'other') {
    throw new Error(`File type ".${ext}" is not supported.`)
  }

  // Check size cap.
  const contentLength = response.headers.get('content-length')
  const total = contentLength ? parseInt(contentLength, 10) : null
  if (total !== null && total > URL_IMPORT_CONFIG.maxSizeBytes) {
    throw new Error(`File is too large (max ${(URL_IMPORT_CONFIG.maxSizeBytes / 1024 / 1024).toFixed(0)} MB).`)
  }

  // Set up the item directory.
  const id = randomUUID()
  const type: ItemType = classifyType(ext)
  const dir = join(await imagesRoot(), id)
  await mkdir(dir, { recursive: true })
  const originalName = ext ? `original.${ext}` : 'original'
  const absPath = join(dir, originalName)

  let bytesWritten = 0
  let sizeExceeded = false

  try {
    const webStream = response.body
    if (!webStream) {
      throw new Error('Response body is not readable.')
    }

    const writeStream = createWriteStream(absPath)

    // Check for size cap via byte counting.
    const countingStream = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytesWritten += chunk.length
        if (bytesWritten > URL_IMPORT_CONFIG.maxSizeBytes) {
          sizeExceeded = true
          writeStream.destroy()
          callback(new Error('File too large during download.'))
          return
        }
        onProgress?.(bytesWritten, total)
        callback(null, chunk)
      },
    })

    // Web ReadableStream → Node stream. Use fromWeb; cast avoids TS lib version mismatch
    // between DOM's ReadableStream<Uint8Array> and Node's web-stream overloads.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeStream = (Readable as any).fromWeb(webStream)

    await pipeline(nodeStream, countingStream, writeStream)
  } catch (e) {
    // Clean up partial file on failure.
    await rm(absPath, { force: true })
    if (sizeExceeded) {
      throw new Error(`File is too large (max ${(URL_IMPORT_CONFIG.maxSizeBytes / 1024 / 1024).toFixed(0)} MB).`)
    }
    throw e
  }

  // Get file stats now that it's written.
  const stats = await stat(absPath)

  // Extract metadata using the same pipeline as importFile.
  let width: number | null = null
  let height: number | null = null
  let palette: string | null = null
  let durationMs: number | null = null

  if (type === 'image') {
    try {
      const meta = await sharp(absPath).metadata()
      width = meta.width ?? null
      height = meta.height ?? null
      await sharp(absPath)
        .resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(join(dir, 'thumbnail.webp'))
      palette = paletteToJson(await extractPalette(absPath))
    } catch {
      width = null
      height = null
      palette = null
    }
  }

  // Media thumbnails for video/audio/pdf/font.
  if (type !== 'image' && type !== 'other') {
    try {
      const meta = await extractMediaThumbnail(type, absPath, join(dir, 'thumbnail.webp'))
      if (meta) {
        if (meta.width) width = meta.width
        if (meta.height) height = meta.height
        durationMs = meta.durationMs
      }
    } catch {
      // Silently skip — import still succeeds.
    }
  }

  // Content hash of the original bytes.
  let contentHash: string | null = null
  try {
    contentHash = await hashFile(absPath)
  } catch {
    contentHash = null
  }

  onProgress?.(bytesWritten, null) // final: total unknown if we hit content-length fallback

  const now = Date.now()
  const createdAt = Math.floor(stats.birthtimeMs || stats.mtimeMs) || now
  const name = `${id}${ext ? `.${ext}` : ''}`

  const record = {
    id,
    name,
    ext,
    type,
    size_bytes: stats.size,
    width,
    height,
    duration_ms: durationMs,
    palette,
    content_hash: contentHash,
    rating: 0,
    source_url: rawUrl,
    note: null,
    created_at: createdAt,
    imported_at: now,
  }

  await writeFile(join(dir, 'metadata.json'), JSON.stringify(record, null, 2), 'utf-8')

  insertItem({
    id,
    name,
    ext,
    type,
    size_bytes: stats.size,
    width,
    height,
    duration_ms: durationMs,
    palette,
    content_hash: contentHash,
    created_at: createdAt,
    imported_at: now,
    source_url: rawUrl,
  })

  return { id, name, ext, type, width, height }
}
