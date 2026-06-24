import { rmSync } from 'fs'
import { join } from 'path'
import { isDatabaseOpen, getDb } from '../db'
import { getActiveLibrary, imagesDir } from './library'
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

// Allow-listed mutable fields for items:update. Extend as later slices need
// (note, etc.) — only keys handled below ever reach SQL.
export interface ItemPatch {
  rating?: number
}

/** Number of items in the active library (0 when no library is open). */
export function countItems(): number {
  if (!isDatabaseOpen()) return 0
  const row = getDb().prepare('SELECT count(*) AS n FROM items').get() as { n: number }
  return row.n
}

/** All items in the active library, newest first (empty when no library open). */
export function listItems(): Item[] {
  if (!isDatabaseOpen()) return []
  return getDb()
    .prepare(
      `SELECT id, name, ext, type, size_bytes, width, height, rating, created_at, imported_at
       FROM items
       ORDER BY imported_at DESC`
    )
    .all() as Item[]
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
