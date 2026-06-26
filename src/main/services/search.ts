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
  tagIds?: string[] // exact tag filter (item must carry ALL listed tags)
  color?: string // target dominant color as `#rrggbb` — nearest-color post-filter over items.palette
  colorTolerance?: number // max RGB Euclidean distance to a palette color (default below)
}

// Default color match radius (RGB Euclidean distance) when `color` is set without a tolerance —
// a mid "close" match. The SearchBar offers Exact(25) / Close(60) / Loose(110).
const DEFAULT_COLOR_TOLERANCE = 60

// Escape LIKE wildcards so user input is matched literally (paired with ESCAPE '\').
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

// Parse `#rgb` / `#rrggbb` (case-insensitive, optional leading #) → {r,g,b}; null on bad input.
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff }
}

// True if any color in the stored palette JSON is within `tol` RGB-distance of the target.
// A NULL/empty/invalid palette never matches (defensive parse — never throws).
function paletteMatchesColor(
  paletteJson: string | null,
  target: { r: number; g: number; b: number },
  tol: number
): boolean {
  if (!paletteJson) return false
  let arr: unknown
  try {
    arr = JSON.parse(paletteJson)
  } catch {
    return false
  }
  if (!Array.isArray(arr) || arr.length === 0) return false
  const maxSq = tol * tol
  for (const entry of arr) {
    if (typeof entry !== 'string') continue
    const c = parseHex(entry)
    if (!c) continue
    const dr = c.r - target.r
    const dg = c.g - target.g
    const db = c.b - target.b
    if (dr * dr + dg * dg + db * db <= maxSq) return true
  }
  return false
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

  // Exact tag filter (sidebar Tags section). AND semantics: the item must carry every listed
  // tag — a GROUP BY / HAVING count over item_tags. For a single tag this is plain membership.
  if (criteria.tagIds && criteria.tagIds.length > 0) {
    conds.push(
      `id IN (SELECT item_id FROM item_tags WHERE tag_id IN (${criteria.tagIds.map(() => '?').join(',')})
         GROUP BY item_id HAVING COUNT(DISTINCT tag_id) = ?)`
    )
    values.push(...criteria.tagIds, criteria.tagIds.length)
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

  // Nearest-color filter rides as a JS post-pass over the already-ordered rows (no SQL color math).
  // Only when a valid color is set do we also SELECT `palette`; otherwise the query + projection are
  // byte-identical to before this field existed.
  const target = criteria.color ? parseHex(criteria.color) : null
  const baseCols = 'id, name, ext, type, size_bytes, width, height, rating, created_at, imported_at'
  const cols = target ? `${baseCols}, palette` : baseCols

  const rows = getDb()
    .prepare(`SELECT ${cols} FROM items ${where} ORDER BY imported_at DESC`)
    .all(...values) as Array<Item & { palette?: string | null }>

  if (!target) return rows as Item[]

  const tol = criteria.colorTolerance ?? DEFAULT_COLOR_TOLERANCE
  return rows
    .filter((r) => paletteMatchesColor(r.palette ?? null, target, tol))
    .map(({ palette: _palette, ...item }) => item as Item)
}
