import { randomUUID } from 'crypto'
import { isDatabaseOpen, getDb } from '../db'

// A tag row (mirrors the tags table; color is unused in MVP).
export interface Tag {
  id: string
  name: string
  color: string | null
}

/** All tags in the active library, ordered by name (empty when no library). */
export function listAllTags(): Tag[] {
  if (!isDatabaseOpen()) return []
  return getDb()
    .prepare('SELECT id, name, color FROM tags ORDER BY name COLLATE NOCASE')
    .all() as Tag[]
}

/** Tags linked to one item, ordered by name (empty when no library). */
export function listTagsForItem(itemId: string): Tag[] {
  if (!isDatabaseOpen()) return []
  return getDb()
    .prepare(
      `SELECT t.id, t.name, t.color
       FROM tags t
       JOIN item_tags it ON it.tag_id = t.id
       WHERE it.item_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(itemId) as Tag[]
}

/**
 * Add a tag (by name) to an item, creating the tag if new. Trimmed; blank names
 * are a no-op. The tag row is de-duplicated by exact name; the link is INSERT OR
 * IGNORE so re-adding is a no-op. Returns the item's tags afterward.
 */
export function addTagToItem(itemId: string, name: string): Tag[] {
  if (!isDatabaseOpen()) return []
  const trimmed = name.trim()
  if (!trimmed) return listTagsForItem(itemId)

  const db = getDb()
  const link = db.transaction((itemId: string, name: string) => {
    let row = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as
      | { id: string }
      | undefined
    if (!row) {
      const id = randomUUID()
      db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, NULL)').run(id, name)
      row = { id }
    }
    db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)').run(
      itemId,
      row.id
    )
  })
  link(itemId, trimmed)
  return listTagsForItem(itemId)
}

/**
 * Add a tag (by name) to MANY items in one transaction: lookup-or-insert the tag once, then
 * INSERT OR IGNORE a link for each item (so re-adding is a no-op). Trimmed; blank name / empty ids
 * are a no-op. Returns the number of NEW links created.
 */
export function addTagToMany(itemIds: string[], name: string): number {
  if (!isDatabaseOpen()) return 0
  const trimmed = name.trim()
  if (!trimmed || itemIds.length === 0) return 0

  const db = getDb()
  const run = db.transaction((itemIds: string[], name: string): number => {
    let row = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as
      | { id: string }
      | undefined
    if (!row) {
      const id = randomUUID()
      db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, NULL)').run(id, name)
      row = { id }
    }
    const link = db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)')
    let n = 0
    for (const itemId of itemIds) n += link.run(itemId, row.id).changes
    return n
  })
  return run(itemIds, trimmed)
}

/**
 * Tags present on EVERY one of the given items (the intersection) — for the multi-item inspector.
 * Empty ids → []. Returns rows ordered by name.
 */
export function commonTagsForItems(ids: string[]): Tag[] {
  if (!isDatabaseOpen() || ids.length === 0) return []
  const ph = ids.map(() => '?').join(',')
  return getDb()
    .prepare(
      `SELECT t.id, t.name, t.color
       FROM tags t
       JOIN item_tags it ON it.tag_id = t.id
       WHERE it.item_id IN (${ph})
       GROUP BY t.id
       HAVING COUNT(DISTINCT it.item_id) = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(...ids, ids.length) as Tag[]
}

/** Unlink a tag from MANY items in one transaction (the tag row is kept). Returns links removed. */
export function removeTagFromMany(ids: string[], tagId: string): number {
  if (!isDatabaseOpen() || ids.length === 0) return 0
  const db = getDb()
  const run = db.transaction((ids: string[], tagId: string): number => {
    const stmt = db.prepare('DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?')
    let n = 0
    for (const id of ids) n += stmt.run(id, tagId).changes
    return n
  })
  return run(ids, tagId)
}

/** Unlink a tag from an item (the tag row itself is kept). Returns remaining tags. */
export function removeTagFromItem(itemId: string, tagId: string): Tag[] {
  if (!isDatabaseOpen()) return []
  getDb().prepare('DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?').run(itemId, tagId)
  return listTagsForItem(itemId)
}
