import { randomUUID } from 'crypto'
import { isDatabaseOpen, getDb } from '../db'
import type { Item } from './items'

// A folder row (mirrors the folders table). parent_id is null for roots; the
// renderer builds the nested tree from the flat list. sort_order is unused in
// MVP (folders are ordered by name).
export interface Folder {
  id: string
  name: string
  parent_id: string | null
  sort_order: number | null
}

/** All folders in the active library, ordered by name (empty when no library). */
export function listFolders(): Folder[] {
  if (!isDatabaseOpen()) return []
  return getDb()
    .prepare('SELECT id, name, parent_id, sort_order FROM folders ORDER BY name COLLATE NOCASE')
    .all() as Folder[]
}

/**
 * Create a folder (optionally nested under parentId). Trimmed; blank names are a
 * no-op. Returns the full folder list afterward.
 */
export function createFolder(name: string, parentId: string | null): Folder[] {
  if (!isDatabaseOpen()) return []
  const trimmed = name.trim()
  if (!trimmed) return listFolders()
  getDb()
    .prepare('INSERT INTO folders (id, name, parent_id, sort_order) VALUES (?, ?, ?, NULL)')
    .run(randomUUID(), trimmed, parentId)
  return listFolders()
}

/** Rename a folder. Trimmed; blank names are a no-op. Returns the folder list. */
export function renameFolder(id: string, name: string): Folder[] {
  if (!isDatabaseOpen()) return []
  const trimmed = name.trim()
  if (!trimmed) return listFolders()
  getDb().prepare('UPDATE folders SET name = ? WHERE id = ?').run(trimmed, id)
  return listFolders()
}

/**
 * Delete a folder and all its descendants, plus their item_folders links. Items
 * themselves are never deleted. Descendants are collected in JS from the flat
 * list (no recursive SQL). Returns the remaining folder list.
 */
export function deleteFolder(id: string): Folder[] {
  if (!isDatabaseOpen()) return []
  const db = getDb()

  // Collect id + all descendants by walking the flat parent_id list.
  const all = listFolders()
  const childrenOf = new Map<string | null, string[]>()
  for (const f of all) {
    const list = childrenOf.get(f.parent_id) ?? []
    list.push(f.id)
    childrenOf.set(f.parent_id, list)
  }
  const toDelete: string[] = []
  const stack = [id]
  while (stack.length > 0) {
    const cur = stack.pop() as string
    toDelete.push(cur)
    for (const child of childrenOf.get(cur) ?? []) stack.push(child)
  }

  const run = db.transaction((ids: string[]) => {
    const delLinks = db.prepare('DELETE FROM item_folders WHERE folder_id = ?')
    const delFolder = db.prepare('DELETE FROM folders WHERE id = ?')
    for (const fid of ids) {
      delLinks.run(fid)
      delFolder.run(fid)
    }
  })
  run(toDelete)
  return listFolders()
}

/**
 * Items linked DIRECTLY to a folder (no descendant rollup), using the same
 * projection + ordering as items.listItems. Empty when no library open.
 */
export function listItemsInFolder(folderId: string): Item[] {
  if (!isDatabaseOpen()) return []
  return getDb()
    .prepare(
      `SELECT i.id, i.name, i.ext, i.type, i.size_bytes, i.width, i.height, i.rating,
              i.created_at, i.imported_at
       FROM items i
       JOIN item_folders f ON f.item_id = i.id
       WHERE f.folder_id = ?
       ORDER BY i.imported_at DESC`
    )
    .all(folderId) as Item[]
}

/** Folders an item belongs to, ordered by name (empty when no library). */
export function listFoldersForItem(itemId: string): Folder[] {
  if (!isDatabaseOpen()) return []
  return getDb()
    .prepare(
      `SELECT fo.id, fo.name, fo.parent_id, fo.sort_order
       FROM folders fo
       JOIN item_folders f ON f.folder_id = fo.id
       WHERE f.item_id = ?
       ORDER BY fo.name COLLATE NOCASE`
    )
    .all(itemId) as Folder[]
}

/** Assign an item to a folder (idempotent). Returns the item's folders. */
export function assignItemToFolder(itemId: string, folderId: string): Folder[] {
  if (!isDatabaseOpen()) return []
  getDb()
    .prepare('INSERT OR IGNORE INTO item_folders (item_id, folder_id) VALUES (?, ?)')
    .run(itemId, folderId)
  return listFoldersForItem(itemId)
}

/**
 * Assign MANY items to a folder in one transaction (each INSERT OR IGNORE, so re-assigning is a
 * no-op). Empty ids → no-op. Returns the number of NEW links created.
 */
export function assignManyToFolder(itemIds: string[], folderId: string): number {
  if (!isDatabaseOpen() || itemIds.length === 0) return 0
  const db = getDb()
  const run = db.transaction((itemIds: string[], folderId: string): number => {
    const link = db.prepare('INSERT OR IGNORE INTO item_folders (item_id, folder_id) VALUES (?, ?)')
    let n = 0
    for (const itemId of itemIds) n += link.run(itemId, folderId).changes
    return n
  })
  return run(itemIds, folderId)
}

/**
 * Folders that contain EVERY one of the given items (the intersection) — for the multi-item
 * inspector. Empty ids → []. Ordered by name.
 */
export function commonFoldersForItems(ids: string[]): Folder[] {
  if (!isDatabaseOpen() || ids.length === 0) return []
  const ph = ids.map(() => '?').join(',')
  return getDb()
    .prepare(
      `SELECT fo.id, fo.name, fo.parent_id, fo.sort_order
       FROM folders fo
       JOIN item_folders f ON f.folder_id = fo.id
       WHERE f.item_id IN (${ph})
       GROUP BY fo.id
       HAVING COUNT(DISTINCT f.item_id) = ?
       ORDER BY fo.name COLLATE NOCASE`
    )
    .all(...ids, ids.length) as Folder[]
}

/** Remove MANY items from a folder in one transaction (folder + items kept). Returns links removed. */
export function unassignManyFromFolder(ids: string[], folderId: string): number {
  if (!isDatabaseOpen() || ids.length === 0) return 0
  const db = getDb()
  const run = db.transaction((ids: string[], folderId: string): number => {
    const stmt = db.prepare('DELETE FROM item_folders WHERE item_id = ? AND folder_id = ?')
    let n = 0
    for (const id of ids) n += stmt.run(id, folderId).changes
    return n
  })
  return run(ids, folderId)
}

/** Unassign an item from a folder (folder + item both kept). Returns the item's folders. */
export function removeItemFromFolder(itemId: string, folderId: string): Folder[] {
  if (!isDatabaseOpen()) return []
  getDb()
    .prepare('DELETE FROM item_folders WHERE item_id = ? AND folder_id = ?')
    .run(itemId, folderId)
  return listFoldersForItem(itemId)
}
