import { isDatabaseOpen, getDb } from '../db'
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
