import { randomUUID } from 'crypto'
import { mkdir, copyFile, writeFile, stat, readdir } from 'fs/promises'
import { join, basename, extname } from 'path'
import sharp from 'sharp'
import { getDb } from '../db'
import { getActiveLibrary, imagesDir } from './library'

export type ItemType = 'image' | 'video' | 'audio' | 'font' | 'doc' | 'other'

// Extension → type. Real thumbnails only for images/GIFs (sharp); everything
// else is imported with correct classification but generic handling (no ffmpeg).
const TYPE_BY_EXT: Record<string, ItemType> = {
  // image
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
  bmp: 'image', tiff: 'image', tif: 'image', svg: 'image', avif: 'image', heic: 'image',
  // video
  mp4: 'video', mov: 'video', webm: 'video', mkv: 'video', avi: 'video', m4v: 'video',
  // audio
  mp3: 'audio', wav: 'audio', flac: 'audio', ogg: 'audio', aac: 'audio', m4a: 'audio',
  // font
  ttf: 'font', otf: 'font', woff: 'font', woff2: 'font',
  // doc
  pdf: 'doc'
}

export function classifyType(ext: string): ItemType {
  return TYPE_BY_EXT[ext.toLowerCase()] ?? 'other'
}

export interface ImportedItem {
  id: string
  name: string
  ext: string
  type: ItemType
  width: number | null
  height: number | null
}

const THUMB_MAX = 512

// A single active library and DB — resolve the images root or throw a clear error.
function imagesRoot(): string {
  const lib = getActiveLibrary()
  if (!lib) throw new Error('No active library. Open or create a library first.')
  return imagesDir(lib.path)
}

// Prepared INSERT, created lazily against the active connection.
function insertItem(item: {
  id: string; name: string; ext: string; type: ItemType
  size_bytes: number; width: number | null; height: number | null
  created_at: number; imported_at: number; source_url: string | null
}): void {
  getDb()
    .prepare(
      `INSERT INTO items
        (id, name, ext, type, size_bytes, width, height, duration_ms, palette, rating, source_url, note, created_at, imported_at)
       VALUES
        (@id, @name, @ext, @type, @size_bytes, @width, @height, NULL, NULL, 0, @source_url, NULL, @created_at, @imported_at)`
    )
    .run(item)
}

// Write the per-item metadata.json (redundant w/ DB for portability, PROJECT.md §6).
async function writeMetadata(dir: string, record: object): Promise<void> {
  await writeFile(join(dir, 'metadata.json'), JSON.stringify(record, null, 2), 'utf-8')
}

/**
 * Import one file by absolute path: copy the untouched original into
 * images/<id>/original.<ext>, generate thumbnail.webp for images, write
 * metadata.json, and insert the items row. Throws on failure so the batch
 * caller can collect it without aborting the rest.
 */
export async function importFile(absPath: string): Promise<ImportedItem> {
  const stats = await stat(absPath)
  const id = randomUUID()
  const name = basename(absPath)
  const ext = extname(absPath).replace(/^\./, '').toLowerCase()
  const type = classifyType(ext)

  const dir = join(imagesRoot(), id)
  await mkdir(dir, { recursive: true })

  const originalName = ext ? `original.${ext}` : 'original'
  await copyFile(absPath, join(dir, originalName))

  let width: number | null = null
  let height: number | null = null
  if (type === 'image') {
    try {
      const meta = await sharp(absPath).metadata()
      width = meta.width ?? null
      height = meta.height ?? null
      // GIFs: sharp reads the first frame by default — fine for a static thumb.
      await sharp(absPath)
        .resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(join(dir, 'thumbnail.webp'))
    } catch {
      // Unreadable/unsupported image bytes: keep the original + row, skip the thumb.
      width = null
      height = null
    }
  }

  const createdAt = Math.floor(stats.birthtimeMs || stats.mtimeMs)
  const importedAt = Date.now()
  const record = {
    id, name, ext, type,
    size_bytes: stats.size,
    width, height,
    duration_ms: null,
    palette: null,
    rating: 0,
    source_url: null,
    note: null,
    created_at: createdAt,
    imported_at: importedAt
  }
  await writeMetadata(dir, record)
  insertItem({
    id, name, ext, type,
    size_bytes: stats.size,
    width, height,
    created_at: createdAt,
    imported_at: importedAt,
    source_url: null
  })

  return { id, name, ext, type, width, height }
}

/**
 * Import raw image bytes (clipboard paste). Always written as original.png.
 */
export async function importImageBuffer(buf: Buffer, suggestedName?: string): Promise<ImportedItem> {
  const id = randomUUID()
  const name = suggestedName ?? `Pasted ${id.slice(0, 8)}.png`
  const ext = 'png'
  const type: ItemType = 'image'

  const dir = join(imagesRoot(), id)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'original.png'), buf)

  let width: number | null = null
  let height: number | null = null
  try {
    const meta = await sharp(buf).metadata()
    width = meta.width ?? null
    height = meta.height ?? null
    await sharp(buf)
      .resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(join(dir, 'thumbnail.webp'))
  } catch {
    width = null
    height = null
  }

  const now = Date.now()
  const record = {
    id, name, ext, type,
    size_bytes: buf.length,
    width, height,
    duration_ms: null,
    palette: null,
    rating: 0,
    source_url: null,
    note: null,
    created_at: now,
    imported_at: now
  }
  await writeMetadata(dir, record)
  insertItem({
    id, name, ext, type,
    size_bytes: buf.length,
    width, height,
    created_at: now,
    imported_at: now,
    source_url: null
  })

  return { id, name, ext, type, width, height }
}

// Recursively gather files under a directory (skip hidden entries).
async function walk(dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(full, out)
    } else if (entry.isFile()) {
      out.push(full)
    }
  }
}

export interface ImportBatchResult {
  imported: ImportedItem[]
  failed: { path: string; error: string }[]
}

/**
 * Import a mix of file and directory paths. Directories are walked recursively.
 * A failure on one file is collected, never aborts the batch. onProgress is
 * called after each file with (done, total).
 */
export async function importPaths(
  paths: string[],
  onProgress?: (done: number, total: number) => void
): Promise<ImportBatchResult> {
  // Expand directories into their files first so total is accurate.
  const files: string[] = []
  for (const p of paths) {
    try {
      const s = await stat(p)
      if (s.isDirectory()) {
        await walk(p, files)
      } else if (s.isFile()) {
        files.push(p)
      }
    } catch (e) {
      // Path vanished between drop and import — record and move on.
      files.push(p)
    }
  }

  const result: ImportBatchResult = { imported: [], failed: [] }
  const total = files.length
  let done = 0
  for (const file of files) {
    try {
      result.imported.push(await importFile(file))
    } catch (e) {
      result.failed.push({ path: file, error: e instanceof Error ? e.message : String(e) })
    }
    done++
    onProgress?.(done, total)
  }
  return result
}
