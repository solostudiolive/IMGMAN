import { rmSync, existsSync, readdirSync, copyFileSync, createWriteStream } from 'fs'
import { join } from 'path'
import { ZipArchive, type ArchiverError } from 'archiver'
import sharp from 'sharp'
import { isDatabaseOpen, getDb } from '../db'
import { getActiveLibrary, imagesDir } from './library'
import { extractPalette, paletteToJson } from './palette'
import { hashFile } from './hash'
import { extractMediaThumbnail } from './mediaThumbnail'
import { pHashImage, pHashDistance, PHASH_DUPLICATE_THRESHOLD } from './pHash'
import type { ItemType } from './import'

// A row projected for the grid (subset of the items table).
export interface Item {
  id: string
  name: string
  ext: string
  type: ItemType
  size_bytes: number
  width: number | null
  height: number | null
  duration_ms: number | null
  rating: number
  created_at: number
  imported_at: number
}

// The full items row, for the inspector (adds the fields the grid omits).
export interface FullItem extends Item {
  duration_ms: number | null
  palette: string | null
  source_url: string | null
  note: string | null
}

// Allow-listed mutable fields for items:update. Only keys handled in updateItem() ever reach SQL.
export interface ItemPatch {
  rating?: number
  note?: string | null
  source_url?: string | null
}

/** Number of items in the active library (0 when no library is open). */
export function countItems(): number {
  if (!isDatabaseOpen()) return 0
  const row = getDb().prepare('SELECT count(*) AS n FROM items').get() as { n: number }
  return row.n
}

// Shared column list + ordering for grid projections (listItems / listUncategorized / listUntagged).
const ITEM_COLS = `id, name, ext, type, size_bytes, width, height, duration_ms, rating, created_at, imported_at`

/** All items in the active library, newest first (empty when no library open). */
export function listItems(): Item[] {
  if (!isDatabaseOpen()) return []
  return getDb()
    .prepare(`SELECT ${ITEM_COLS} FROM items ORDER BY imported_at DESC`)
    .all() as Item[]
}

/** Items in no folder ("Uncategorized"), newest first. */
export function listUncategorized(): Item[] {
  if (!isDatabaseOpen()) return []
  return getDb()
    .prepare(
      `SELECT ${ITEM_COLS} FROM items
       WHERE id NOT IN (SELECT item_id FROM item_folders)
       ORDER BY imported_at DESC`
    )
    .all() as Item[]
}

/** Items with no tag ("Untagged"), newest first. */
export function listUntagged(): Item[] {
  if (!isDatabaseOpen()) return []
  return getDb()
    .prepare(
      `SELECT ${ITEM_COLS} FROM items
       WHERE id NOT IN (SELECT item_id FROM item_tags)
       ORDER BY imported_at DESC`
    )
    .all() as Item[]
}

// Counts for the sidebar's top scope rows.
export interface SidebarCounts {
  all: number
  uncategorized: number
  untagged: number
}

/** Item counts for the sidebar scope rows (All / Uncategorized / Untagged). */
export function sidebarCounts(): SidebarCounts {
  if (!isDatabaseOpen()) return { all: 0, uncategorized: 0, untagged: 0 }
  const db = getDb()
  const all = (db.prepare('SELECT count(*) AS n FROM items').get() as { n: number }).n
  const uncategorized = (
    db
      .prepare('SELECT count(*) AS n FROM items WHERE id NOT IN (SELECT item_id FROM item_folders)')
      .get() as { n: number }
  ).n
  const untagged = (
    db
      .prepare('SELECT count(*) AS n FROM items WHERE id NOT IN (SELECT item_id FROM item_tags)')
      .get() as { n: number }
  ).n
  return { all, uncategorized, untagged }
}

/** The full record for one item, or null (unknown id / no library open). */
export function getItem(id: string): FullItem | null {
  if (!isDatabaseOpen()) return null
  const row = getDb()
    .prepare(
      `SELECT id, name, ext, type, size_bytes, width, height, duration_ms, palette,
              rating, source_url, note, created_at, imported_at
       FROM items
       WHERE id = ?`
    )
    .get(id) as FullItem | undefined
  return row ?? null
}

/**
 * Apply an allow-listed patch to one item and return the persisted row (or null
 * for unknown id / no library open). Column names are never interpolated from
 * input — only recognized keys build the SET clause.
 */
export function updateItem(id: string, patch: ItemPatch): FullItem | null {
  if (!isDatabaseOpen()) return null

  const sets: string[] = []
  const values: unknown[] = []
  if (patch.rating !== undefined) {
    sets.push('rating = ?')
    values.push(Math.max(0, Math.min(5, Math.round(patch.rating))))
  }
  if (patch.note !== undefined) {
    sets.push('note = ?')
    const note = patch.note?.trim()
    values.push(note ? note : null)
  }
  if (patch.source_url !== undefined) {
    sets.push('source_url = ?')
    const url = patch.source_url?.trim()
    values.push(url ? url : null)
  }

  if (sets.length > 0) {
    getDb()
      .prepare(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`)
      .run(...values, id)
  }

  return getItem(id)
}

/**
 * Permanently delete a batch of items: their item_tags + item_folders links and the items rows
 * (in one transaction — FKs are not ON DELETE CASCADE, so links must go first), then their on-disk
 * `images/<id>/` folders (originals + thumbnails). File removal is best-effort after the DB commits
 * (the DB is the source of truth; a leftover dir is harmless). Returns the number of rows deleted.
 */
export function deleteItems(ids: string[]): number {
  if (!isDatabaseOpen() || ids.length === 0) return 0
  const db = getDb()

  const run = db.transaction((ids: string[]): number => {
    const delTags = db.prepare('DELETE FROM item_tags WHERE item_id = ?')
    const delFolders = db.prepare('DELETE FROM item_folders WHERE item_id = ?')
    const delItem = db.prepare('DELETE FROM items WHERE id = ?')
    let n = 0
    for (const id of ids) {
      delTags.run(id)
      delFolders.run(id)
      n += delItem.run(id).changes
    }
    return n
  })
  const deleted = run(ids)

  const lib = getActiveLibrary()
  if (lib) {
    const root = imagesDir(lib.path)
    for (const id of ids) {
      try {
        rmSync(join(root, id), { recursive: true, force: true })
      } catch {
        /* best-effort: the DB row is already gone */
      }
    }
  }
  return deleted
}

/**
 * Backfill dominant-color palettes for image items that don't have one yet. For each such item,
 * extract from its stored original (falling back to the thumbnail) and persist the #rrggbb JSON to
 * items.palette. Per-item failures are skipped. Idempotent (only touches palette IS NULL rows).
 * Returns the number of items populated. Async (sharp decode).
 */
export async function backfillPalettes(): Promise<number> {
  if (!isDatabaseOpen()) return 0
  const lib = getActiveLibrary()
  if (!lib) return 0
  const root = imagesDir(lib.path)
  const db = getDb()
  const rows = db
    .prepare("SELECT id, ext FROM items WHERE type = 'image' AND palette IS NULL")
    .all() as { id: string; ext: string | null }[]
  const update = db.prepare('UPDATE items SET palette = ? WHERE id = ?')

  let n = 0
  for (const row of rows) {
    try {
      const dir = join(root, row.id)
      const original = join(dir, row.ext ? `original.${row.ext}` : 'original')
      const path = existsSync(original) ? original : join(dir, 'thumbnail.webp')
      if (!existsSync(path)) continue
      const json = paletteToJson(await extractPalette(path))
      if (json) {
        update.run(json, row.id)
        n++
      }
    } catch {
      // Skip this item; a missing/unreadable file shouldn't abort the backfill.
    }
  }
  return n
}

// Resolve an item's stored ORIGINAL file (images/<id>/original.<ext>, or an `original*` fallback when
// no ext was recorded). Returns null when nothing matches. Hashing must use the original bytes — never
// the thumbnail — so this never falls back to thumbnail.webp.
function originalPath(dir: string, ext: string | null): string | null {
  if (ext) {
    const p = join(dir, `original.${ext}`)
    return existsSync(p) ? p : null
  }
  try {
    const f = readdirSync(dir).find((n) => n === 'original' || n.startsWith('original.'))
    return f ? join(dir, f) : null
  } catch {
    return null
  }
}

/**
 * Backfill SHA-256 content hashes for items that don't have one yet (ALL types, not just images).
 * Streams each stored original; per-item failures (missing/unreadable file) are skipped, never fatal.
 * Idempotent (only touches content_hash IS NULL rows). Returns the number populated. Async (file IO).
 */
export async function backfillHashes(): Promise<number> {
  if (!isDatabaseOpen()) return 0
  const lib = getActiveLibrary()
  if (!lib) return 0
  const root = imagesDir(lib.path)
  const db = getDb()
  const rows = db
    .prepare('SELECT id, ext FROM items WHERE content_hash IS NULL')
    .all() as { id: string; ext: string | null }[]
  const update = db.prepare('UPDATE items SET content_hash = ? WHERE id = ?')

  let n = 0
  for (const row of rows) {
    try {
      const path = originalPath(join(root, row.id), row.ext)
      if (!path) continue
      update.run(await hashFile(path), row.id)
      n++
    } catch {
      // Missing/unreadable file — leave content_hash NULL and move on.
    }
  }
  return n
}

/**
 * Backfill real thumbnails for media items (video/audio/font/doc) that don't have one yet
 * (detected by width IS NULL, since media thumbnails always set width on success).
 * Reads each item's stored original via originalPath, calls extractMediaThumbnail,
 * and persists width/height/duration_ms. Per-item failures are skipped. Idempotent.
 * Returns the number of items populated. Async (ffmpeg.wasm / pdfjs / opentype).
 */
export async function backfillMediaThumbnails(): Promise<number> {
  if (!isDatabaseOpen()) return 0
  const lib = getActiveLibrary()
  if (!lib) return 0
  const root = imagesDir(lib.path)
  const db = getDb()
  const rows = db
    .prepare("SELECT id, ext, type FROM items WHERE type IN ('video','audio','font','doc') AND width IS NULL")
    .all() as { id: string; ext: string | null; type: ItemType }[]
  const update = db.prepare('UPDATE items SET width = ?, height = ?, duration_ms = ? WHERE id = ?')

  let n = 0
  for (const row of rows) {
    try {
      const dir = join(root, row.id)
      const original = originalPath(dir, row.ext)
      if (!original) continue
      const meta = await extractMediaThumbnail(row.type, original, join(dir, 'thumbnail.webp'))
      if (meta) {
        update.run(meta.width, meta.height, meta.durationMs, row.id)
        n++
      }
    } catch {
      // Skip this item; a missing/unreadable file shouldn't abort the backfill.
    }
  }
  return n
}

// A set of items sharing one content hash (i.e. byte-identical duplicates).
export interface DuplicateGroup {
  hash: string
  items: Item[]
}

// A set of near-duplicate images whose perceptual hashes are within Hamming distance.
export interface PerceptualDuplicateGroup {
  representative: string // the phash of the representative (first) item in the group
  distance: number // max Hamming distance from the representative to the farthest group member
  items: Item[]
}

/**
 * Duplicate groups: items sharing a non-NULL content_hash, only where 2+ items share it. Each group's
 * items are oldest-first (imported_at ASC) so the UI can default to "keep the newest, delete the rest".
 * Empty when no library / no duplicates. (Run backfillHashes first to cover pre-hash rows.)
 */
export function findDuplicateGroups(): DuplicateGroup[] {
  if (!isDatabaseOpen()) return []
  const rows = getDb()
    .prepare(
      `SELECT id, name, ext, type, size_bytes, width, height, rating, created_at, imported_at, content_hash
       FROM items
       WHERE content_hash IN (
         SELECT content_hash FROM items WHERE content_hash IS NOT NULL
         GROUP BY content_hash HAVING COUNT(*) > 1
       )
       ORDER BY content_hash, imported_at ASC`
    )
    .all() as Array<Item & { content_hash: string }>

  const groups: DuplicateGroup[] = []
  for (const { content_hash, ...item } of rows) {
    const last = groups[groups.length - 1]
    if (last && last.hash === content_hash) last.items.push(item as Item)
    else groups.push({ hash: content_hash, items: [item as Item] })
  }
  return groups
}

/**
 * Backfill perceptual hashes for IMAGE items that don't have one yet. For each such item,
 * compute a 64-bit DCT pHash from its stored original via pHashImage and persist it to
 * items.phash. Per-item failures (missing/unreadable file, non-image) are skipped, never fatal.
 * Idempotent (only touches phash IS NULL rows). Returns the number of items populated. Async (sharp).
 */
export async function backfillPerceptualHashes(): Promise<number> {
  if (!isDatabaseOpen()) return 0
  const lib = getActiveLibrary()
  if (!lib) return 0
  const root = imagesDir(lib.path)
  const db = getDb()
  const rows = db
    .prepare("SELECT id, ext FROM items WHERE type = 'image' AND phash IS NULL")
    .all() as { id: string; ext: string | null }[]
  const update = db.prepare('UPDATE items SET phash = ? WHERE id = ?')

  let n = 0
  for (const row of rows) {
    try {
      const path = originalPath(join(root, row.id), row.ext)
      if (!path) continue
      const hash = await pHashImage(path)
      if (hash) {
        update.run(hash, row.id)
        n++
      }
    } catch {
      // Skip this item; a missing/unreadable file shouldn't abort the backfill.
    }
  }
  return n
}

/**
 * Find near-duplicate image groups via perceptual hashing. Reads all items with a phash,
 * clusters them by Hamming distance (≤ PHASH_DUPLICATE_THRESHOLD): items within range of a
 * group's representative form one cluster; transitive merges combine overlapping clusters
 * (union-find). Each group's items are oldest-first (imported_at ASC); empty when no library
 * or fewer than 2 images with phash. Returns PerceptualDuplicateGroup[].
 */
export function findPerceptualDuplicateGroups(): PerceptualDuplicateGroup[] {
  if (!isDatabaseOpen()) return []
  const rows = getDb()
    .prepare(
      `SELECT id, name, ext, type, size_bytes, width, height, rating, created_at, imported_at, phash
       FROM items
       WHERE type = 'image' AND phash IS NOT NULL
       ORDER BY imported_at ASC`
    )
    .all() as Array<Item & { phash: string }>

  if (rows.length < 2) return []

  // Union-find over indices. Transitivity: if A≈B and B≈C, all three share a group even if A≠C.
  const parent: number[] = rows.map((_, i) => i)
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  const union = (a: number, b: number): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  // Naive O(n²) pairwise distance — acceptable at 10k-ish images; optimize with LSH only if needed.
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const d = pHashDistance(rows[i].phash, rows[j].phash)
      if (d !== null && d <= PHASH_DUPLICATE_THRESHOLD) union(i, j)
    }
  }

  // Bucket indices by their union-find root.
  const clusters = new Map<number, number[]>()
  for (let i = 0; i < rows.length; i++) {
    const r = find(i)
    let c = clusters.get(r)
    if (!c) {
      c = []
      clusters.set(r, c)
    }
    c.push(i)
  }

  // Keep only clusters with 2+ members; build PerceptualDuplicateGroup sorted oldest-first.
  const groups: PerceptualDuplicateGroup[] = []
  for (const cluster of clusters.values()) {
    if (cluster.length < 2) continue
    const items: Item[] = []
    let maxDist = 0
    const rep = rows[cluster[0]].phash
    for (const idx of cluster) {
      const { phash, ...item } = rows[idx]
      items.push(item as Item)
      const d = pHashDistance(phash, rep)
      if (d !== null && d > maxDist) maxDist = d
    }
    groups.push({ representative: rep, distance: maxDist, items })
  }
  return groups
}

// Strip characters illegal in Windows/macOS filenames so an item's display name is safe on disk.
function safeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/, '').trim()
  return cleaned || 'export'
}

/**
 * Resolve one item's stored ORIGINAL file plus the filename it should export as (`name.ext`).
 * Returns null for unknown id / no library / missing file.
 */
export function itemExportInfo(id: string): { path: string; filename: string } | null {
  if (!isDatabaseOpen()) return null
  const lib = getActiveLibrary()
  if (!lib) return null
  const row = getDb()
    .prepare('SELECT id, name, ext FROM items WHERE id = ?')
    .get(id) as { id: string; name: string; ext: string | null } | undefined
  if (!row) return null
  const src = originalPath(join(imagesDir(lib.path), row.id), row.ext)
  if (!src) return null
  const ext = row.ext ? `.${row.ext}` : ''
  return { path: src, filename: `${safeFilename(row.name)}${ext}` }
}

/**
 * Copy each item's original file into `destDir`, using its display name (`name.ext`). Colliding
 * names get a ` (n)` suffix so nothing is silently overwritten. Returns counts. Used for multi-item
 * export; single-item export copies to an explicit path via the IPC layer.
 */
export function exportItemsToDir(ids: string[], destDir: string): { exported: number; failed: number } {
  let exported = 0
  let failed = 0
  const used = new Set<string>()
  for (const id of ids) {
    const info = itemExportInfo(id)
    if (!info) {
      failed++
      continue
    }
    const dot = info.filename.lastIndexOf('.')
    const base = dot > 0 ? info.filename.slice(0, dot) : info.filename
    const ext = dot > 0 ? info.filename.slice(dot) : ''
    let name = info.filename
    let n = 1
    while (used.has(name.toLowerCase()) || existsSync(join(destDir, name))) {
      name = `${base} (${n})${ext}`
      n++
    }
    used.add(name.toLowerCase())
    try {
      copyFileSync(info.path, join(destDir, name))
      exported++
    } catch {
      failed++
    }
  }
  return { exported, failed }
}

// Export the given items' ORIGINALS into a single .zip at destZipPath. Names are de-duplicated
// the same way as the dir export (missing files are counted as failed, never abort the archive).
// Resolves once the archive is fully written to disk.
export function exportItemsToZip(
  ids: string[],
  destZipPath: string
): Promise<{ exported: number; failed: number }> {
  return new Promise((resolve, reject) => {
    let exported = 0
    let failed = 0
    const used = new Set<string>()
    const output = createWriteStream(destZipPath)
    const archive = new ZipArchive({ zlib: { level: 9 } })

    output.on('close', () => resolve({ exported, failed }))
    archive.on('warning', (err: ArchiverError) => {
      if (err.code !== 'ENOENT') reject(err)
    })
    archive.on('error', reject)
    archive.pipe(output)

    for (const id of ids) {
      const info = itemExportInfo(id)
      if (!info || !existsSync(info.path)) {
        failed++
        continue
      }
      const dot = info.filename.lastIndexOf('.')
      const base = dot > 0 ? info.filename.slice(0, dot) : info.filename
      const ext = dot > 0 ? info.filename.slice(dot) : ''
      let name = info.filename
      let n = 1
      while (used.has(name.toLowerCase())) {
        name = `${base} (${n})${ext}`
        n++
      }
      used.add(name.toLowerCase())
      archive.file(info.path, { name })
      exported++
    }

    void archive.finalize()
  })
}

// Target formats offered by the "Convert" action. Value doubles as the output file extension.
export type ConvertFormat = 'jpg' | 'png' | 'webp' | 'avif'

// Apply the chosen output encoder to a sharp pipeline.
function encodeAs(pipe: sharp.Sharp, format: ConvertFormat): sharp.Sharp {
  switch (format) {
    case 'jpg':
      return pipe.jpeg({ quality: 90 })
    case 'png':
      return pipe.png()
    case 'webp':
      return pipe.webp({ quality: 82 })
    case 'avif':
      return pipe.avif({ quality: 50 })
  }
}

/** The base filename (no extension) for an item — used to suggest a converted file's name. */
export function itemBaseName(id: string): string | null {
  if (!isDatabaseOpen()) return null
  const row = getDb().prepare('SELECT name, ext FROM items WHERE id = ?').get(id) as
    | { name: string; ext: string | null }
    | undefined
  if (!row) return null
  const suffix = row.ext ? `.${row.ext}`.toLowerCase() : ''
  const base =
    suffix && row.name.toLowerCase().endsWith(suffix) ? row.name.slice(0, -suffix.length) : row.name
  return safeFilename(base)
}

/**
 * Convert one item's original image to `format`, writing to `destPath`. Sharp decodes the stored
 * original and re-encodes; throws (caught by the IPC layer) on a non-image / unreadable source.
 */
export async function convertItemTo(
  id: string,
  format: ConvertFormat,
  destPath: string
): Promise<boolean> {
  const info = itemExportInfo(id)
  if (!info) return false
  await encodeAs(sharp(info.path), format).toFile(destPath)
  return true
}

/**
 * Convert many items to `format` into `destDir` (each as `base.format`, collision-safe). Per-item
 * failures (non-images, decode errors) are counted, never fatal. Async (sharp decode).
 */
export async function convertItemsToDir(
  ids: string[],
  format: ConvertFormat,
  destDir: string
): Promise<{ converted: number; failed: number }> {
  let converted = 0
  let failed = 0
  const used = new Set<string>()
  for (const id of ids) {
    const base = itemBaseName(id)
    const info = base ? itemExportInfo(id) : null
    if (!base || !info) {
      failed++
      continue
    }
    let name = `${base}.${format}`
    let n = 1
    while (used.has(name.toLowerCase()) || existsSync(join(destDir, name))) {
      name = `${base} (${n}).${format}`
      n++
    }
    used.add(name.toLowerCase())
    try {
      await encodeAs(sharp(info.path), format).toFile(join(destDir, name))
      converted++
    } catch {
      failed++
    }
  }
  return { converted, failed }
}

/**
 * Set the same rating (clamped 0..5) on a batch of items in one transaction. Returns rows changed.
 */
export function rateItems(ids: string[], rating: number): number {
  if (!isDatabaseOpen() || ids.length === 0) return 0
  const value = Math.max(0, Math.min(5, Math.round(rating)))
  const db = getDb()
  const run = db.transaction((ids: string[]): number => {
    const stmt = db.prepare('UPDATE items SET rating = ? WHERE id = ?')
    let n = 0
    for (const id of ids) n += stmt.run(value, id).changes
    return n
  })
  return run(ids)
}

/**
 * Rename a batch of items in one transaction (metadata only — updates the `name` column; the on-disk
 * `images/<id>/original.<ext>` file and the `ext` are never touched). Trimmed; blank names are
 * skipped. Returns the number of rows changed.
 */
export function renameItems(renames: { id: string; name: string }[]): number {
  if (!isDatabaseOpen() || renames.length === 0) return 0
  const db = getDb()
  const run = db.transaction((renames: { id: string; name: string }[]): number => {
    const stmt = db.prepare('UPDATE items SET name = ? WHERE id = ?')
    let n = 0
    for (const { id, name } of renames) {
      const trimmed = name.trim()
      if (!trimmed) continue
      n += stmt.run(trimmed, id).changes
    }
    return n
  })
  return run(renames)
}
