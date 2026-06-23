import { isDatabaseOpen, getDb } from '../db'
import type { Item } from './items'
import type { ItemType } from './import'

// Search/filter criteria. Absent fields are simply not constrained. query is
// matched (case-insensitively, as a substring) against name, note, and tag names.
export interface SearchCriteria {
  query?: string
  types?: ItemType[] // OR'd among themselves
  ext?: string // exact format match (lowercased)
  minRating?: number // rating >= this
  from?: number | null // imported_at >= from (ms epoch)
  to?: number | null // imported_at <= to (ms epoch)
}

// Escape LIKE wildcards so user input is matched literally (paired with ESCAPE '\').
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

/**
 * Search + filter items. Builds a parameterized WHERE from the provided fields
 * (absent fields impose no constraint) and returns the grid Item projection,
 * newest first. Empty criteria returns all items. Empty when no library open.
 */
export function searchItems(criteria: SearchCriteria): Item[] {
  if (!isDatabaseOpen()) return []

  const conds: string[] = []
  const values: unknown[] = []

  const query = criteria.query?.trim()
  if (query) {
    const pattern = `%${escapeLike(query)}%`
    conds.push(
      `(name LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\' OR id IN
         (SELECT it.item_id FROM item_tags it JOIN tags t ON t.id = it.tag_id
          WHERE t.name LIKE ? ESCAPE '\\'))`
    )
    values.push(pattern, pattern, pattern)
  }

  if (criteria.types && criteria.types.length > 0) {
    conds.push(`type IN (${criteria.types.map(() => '?').join(',')})`)
    values.push(...criteria.types)
  }

  const ext = criteria.ext?.trim()
  if (ext) {
    conds.push('ext = ?')
    values.push(ext.toLowerCase())
  }

  if (criteria.minRating && criteria.minRating > 0) {
    conds.push('rating >= ?')
    values.push(criteria.minRating)
  }

  if (criteria.from != null) {
    conds.push('imported_at >= ?')
    values.push(criteria.from)
  }
  if (criteria.to != null) {
    conds.push('imported_at <= ?')
    values.push(criteria.to)
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
  return getDb()
    .prepare(
      `SELECT id, name, ext, type, size_bytes, width, height, rating, created_at, imported_at
       FROM items
       ${where}
       ORDER BY imported_at DESC`
    )
    .all(...values) as Item[]
}
