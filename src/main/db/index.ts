import Database from 'better-sqlite3'
// Vite inlines the SQL text at build time (?raw), so it ships inside the
// bundle — no separate asset to copy into the packaged app.
import schema from './schema.sql?raw'

const SCHEMA_VERSION = 3

// A single active connection: exactly one library is open at a time.
let db: Database.Database | null = null

/**
 * Open metadata.db at an explicit path (inside the active library), apply
 * pragmas and the idempotent schema, and make it the active connection.
 * Any previously-open connection is closed first so we never leak handles or
 * leave WAL on the wrong file when switching libraries.
 */
export function openDatabase(dbPath: string): Database.Database {
  closeDatabase()

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)
  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('No active library database. Open or create a library first.')
  return db
}

export function isDatabaseOpen(): boolean {
  return db !== null
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

function runMigrations(database: Database.Database): void {
  // schema.sql uses CREATE ... IF NOT EXISTS, so exec is a no-op on later runs. Fresh DBs get every
  // column from the CREATE; existing DBs need explicit ALTERs for columns added after their creation.
  database.exec(schema)

  // v2: items.content_hash (duplicate detection). CREATE ... IF NOT EXISTS won't add a column to an
  // already-existing items table, so add it idempotently — guarded on table_info, not user_version,
  // so it self-heals regardless of how the DB got to its current shape.
  const cols = database.prepare('PRAGMA table_info(items)').all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === 'content_hash')) {
    database.exec('ALTER TABLE items ADD COLUMN content_hash TEXT')
  }
  if (!cols.some((c) => c.name === 'phash')) {
    database.exec('ALTER TABLE items ADD COLUMN phash TEXT')
  }

  database.pragma(`user_version = ${SCHEMA_VERSION}`)
}
