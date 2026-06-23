import { isDatabaseOpen, getDb } from '../db'

/** Number of items in the active library (0 when no library is open). */
export function countItems(): number {
  if (!isDatabaseOpen()) return 0
  const row = getDb().prepare('SELECT count(*) AS n FROM items').get() as { n: number }
  return row.n
}
