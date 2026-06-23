import Database from 'better-sqlite3'
// Vite inlines the SQL text at build time (?raw), so it ships inside the
// bundle — no separate asset to copy into the packaged app.
import schema from './schema.sql?raw'

const SCHEMA_VERSION = 1

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
  // schema.sql uses CREATE ... IF NOT EXISTS, so exec is a no-op on later runs.
  database.exec(schema)
  database.pragma(`user_version = ${SCHEMA_VERSION}`)
}
