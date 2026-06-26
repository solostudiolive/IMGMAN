import { randomUUID } from 'crypto'
import { isDatabaseOpen, getDb } from '../db'
import type { SearchCriteria } from './search'

// A saved search ("smart folder"): a named, persisted SearchCriteria. Stored in the
// existing smart_folders table — the `rules` column holds the criteria as JSON.
export interface SmartFolder {
  id: string
  name: string
  criteria: SearchCriteria
}

// Parse the stored `rules` JSON defensively — a malformed row must never crash the list.
function parseCriteria(rules: string | null): SearchCriteria {
  try {
    return JSON.parse(rules ?? '{}') as SearchCriteria
  } catch {
    return {}
  }
}

/** All saved searches in the active library, ordered by name (empty when no library). */
export function listSmartFolders(): SmartFolder[] {
  if (!isDatabaseOpen()) return []
  const rows = getDb()
    .prepare('SELECT id, name, rules FROM smart_folders ORDER BY name COLLATE NOCASE')
    .all() as { id: string; name: string; rules: string | null }[]
  return rows.map((r) => ({ id: r.id, name: r.name, criteria: parseCriteria(r.rules) }))
}

/**
 * Save the given criteria under a name. Trimmed; blank names are a no-op.
 * Returns the full list afterward.
 */
export function createSmartFolder(name: string, criteria: SearchCriteria): SmartFolder[] {
  if (!isDatabaseOpen()) return []
  const trimmed = name.trim()
  if (!trimmed) return listSmartFolders()
  getDb()
    .prepare('INSERT INTO smart_folders (id, name, rules) VALUES (?, ?, ?)')
    .run(randomUUID(), trimmed, JSON.stringify(criteria ?? {}))
  return listSmartFolders()
}

/** Rename a saved search. Trimmed; blank names are a no-op. Returns the list. */
export function renameSmartFolder(id: string, name: string): SmartFolder[] {
  if (!isDatabaseOpen()) return []
  const trimmed = name.trim()
  if (!trimmed) return listSmartFolders()
  getDb().prepare('UPDATE smart_folders SET name = ? WHERE id = ?').run(trimmed, id)
  return listSmartFolders()
}

/** Delete a saved search (items + search state untouched). Returns the list. */
export function deleteSmartFolder(id: string): SmartFolder[] {
  if (!isDatabaseOpen()) return []
  getDb().prepare('DELETE FROM smart_folders WHERE id = ?').run(id)
  return listSmartFolders()
}
