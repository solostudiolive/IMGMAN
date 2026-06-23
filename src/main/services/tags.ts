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

/** Unlink a tag from an item (the tag row itself is kept). Returns remaining tags. */
export function removeTagFromItem(itemId: string, tagId: string): Tag[] {
  if (!isDatabaseOpen()) return []
  getDb().prepare('DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?').run(itemId, tagId)
  return listTagsForItem(itemId)
}
