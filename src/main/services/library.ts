import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from 'fs'
import { join, basename } from 'path'
import { openDatabase, closeDatabase } from '../db'

export const LIBRARY_DIR_SUFFIX = '.library'
const FORMAT_VERSION = 1

export interface LibraryInfo {
  path: string
  name: string
}

interface LibrarySettings {
  name: string
  createdAt: number
  formatVersion: number
}

let active: LibraryInfo | null = null

// --- Path helpers (the on-disk format, root PROJECT.md §6) ---
export const dbPath = (libPath: string): string => join(libPath, 'metadata.db')
export const settingsPath = (libPath: string): string => join(libPath, 'settings.json')
export const imagesDir = (libPath: string): string => join(libPath, 'images')
export const thumbsCacheDir = (libPath: string): string => join(libPath, 'thumbnails-cache')

/** A folder is a library if it exists and has either metadata.db or settings.json. */
export function isLibrary(libPath: string): boolean {
  try {
    if (!existsSync(libPath) || !statSync(libPath).isDirectory()) return false
    return existsSync(dbPath(libPath)) || existsSync(settingsPath(libPath))
  } catch {
    return false
  }
}

function readSettings(libPath: string): LibrarySettings | null {
  try {
    return JSON.parse(readFileSync(settingsPath(libPath), 'utf-8')) as LibrarySettings
  } catch {
    return null
  }
}

/**
 * Create `<name>.library/` under parentDir with the full folder structure and an
 * initialized DB, then make it active. Rejects if the target already exists.
 */
export function createLibrary(parentDir: string, name: string): LibraryInfo {
  const cleanName = name.trim()
  if (!cleanName) throw new Error('Library name cannot be empty.')

  const folderName = cleanName.endsWith(LIBRARY_DIR_SUFFIX)
    ? cleanName
    : `${cleanName}${LIBRARY_DIR_SUFFIX}`
  const libPath = join(parentDir, folderName)

  if (existsSync(libPath)) {
    throw new Error(`A folder named "${folderName}" already exists here.`)
  }

  mkdirSync(libPath, { recursive: true })
  mkdirSync(imagesDir(libPath), { recursive: true })
  mkdirSync(thumbsCacheDir(libPath), { recursive: true })

  const settings: LibrarySettings = {
    name: cleanName,
    createdAt: Date.now(),
    formatVersion: FORMAT_VERSION
  }
  writeFileSync(settingsPath(libPath), JSON.stringify(settings, null, 2), 'utf-8')

  // Opening applies the schema (idempotent) and sets the active connection.
  openDatabase(dbPath(libPath))
  active = { path: libPath, name: cleanName }
  return active
}

/**
 * Open an existing library folder, close any current DB, and make it active.
 * Throws a descriptive error if the folder is not a valid library.
 */
export function openLibrary(libPath: string): LibraryInfo {
  if (!isLibrary(libPath)) {
    throw new Error('That folder is not an IMGMAN library (no metadata.db / settings.json).')
  }

  openDatabase(dbPath(libPath))
  const name = readSettings(libPath)?.name ?? basename(libPath).replace(/\.library$/, '')
  active = { path: libPath, name }
  return active
}

export function getActiveLibrary(): LibraryInfo | null {
  return active
}

export function closeActiveLibrary(): void {
  closeDatabase()
  active = null
}
