import { BrowserWindow, dialog, ipcMain } from 'electron'
import {
  createLibrary,
  openLibrary,
  getActiveLibrary,
  renameActiveLibrary,
  readLibraryName,
  type LibraryInfo
} from '../services/library'
import { addRecent, removeRecent, getRecentLibraries } from '../config'

// Structured result so the renderer can show errors instead of catching rejections.
export type LibraryResult =
  | { ok: true; library: LibraryInfo }
  | { ok: false; error: string }
  | { ok: false; cancelled: true }

function ok(library: LibraryInfo): LibraryResult {
  return { ok: true, library }
}

function fail(error: unknown): LibraryResult {
  return { ok: false, error: error instanceof Error ? error.message : String(error) }
}

export function registerLibraryIpc(): void {
  // Create: pick a parent folder, create `<name>.library` inside it.
  ipcMain.handle('library:create', async (event, name: string): Promise<LibraryResult> => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: 'Choose where to create the library',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return { ok: false, cancelled: true }

    try {
      const lib = createLibrary(result.filePaths[0], name)
      addRecent(lib.path)
      return ok(lib)
    } catch (e) {
      return fail(e)
    }
  })

  // Open: pick a library folder.
  ipcMain.handle('library:open', async (event): Promise<LibraryResult> => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: 'Open a library folder',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return { ok: false, cancelled: true }

    try {
      const lib = openLibrary(result.filePaths[0])
      addRecent(lib.path)
      return ok(lib)
    } catch (e) {
      return fail(e)
    }
  })

  // Open a known recent path without a dialog.
  ipcMain.handle('library:openPath', (_event, libPath: string): LibraryResult => {
    try {
      const lib = openLibrary(libPath)
      addRecent(lib.path)
      return ok(lib)
    } catch (e) {
      removeRecent(libPath) // stale recent — drop it
      return fail(e)
    }
  })

  ipcMain.handle('library:getActive', (): LibraryInfo | null => getActiveLibrary())

  // Rename the active library's display name (settings.json only; path unchanged).
  ipcMain.handle('library:rename', (_event, name: string): LibraryResult => {
    try {
      return ok(renameActiveLibrary(name))
    } catch (e) {
      return fail(e)
    }
  })

  // Return recents as {path,name} for display (name from settings.json, falling back to folder).
  ipcMain.handle('library:listRecent', (): Array<{ path: string; name: string }> =>
    getRecentLibraries().map((p) => ({ path: p, name: readLibraryName(p) }))
  )
}
