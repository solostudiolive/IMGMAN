import { BrowserWindow, dialog, ipcMain, clipboard } from 'electron'
import { importPaths, importImageBuffer } from '../services/import'
import { importUrl } from '../services/urlImport'
import { countItems } from '../services/items'
import { getActiveLibrary } from '../services/library'

// Structured result mirroring the library:* IPC pattern (02-01).
export type ImportResult =
  | { ok: true; imported: number; failed: number }
  | { ok: false; error: string }
  | { ok: false; cancelled: true }

function noLibrary(): ImportResult {
  return { ok: false, error: 'No active library. Open or create a library first.' }
}

export function registerImportIpc(): void {
  // Import dropped file/folder paths (folders walked recursively), with progress.
  ipcMain.handle('import:paths', async (event, paths: string[]): Promise<ImportResult> => {
    if (!getActiveLibrary()) return noLibrary()
    try {
      const res = await importPaths(paths, (done, total) =>
        event.sender.send('import:progress', { done, total })
      )
      return { ok: true, imported: res.imported.length, failed: res.failed.length }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  // Import the current clipboard image, if any.
  ipcMain.handle('import:clipboard', async (): Promise<ImportResult> => {
    if (!getActiveLibrary()) return noLibrary()
    const img = clipboard.readImage()
    if (img.isEmpty()) return { ok: false, error: 'No image in clipboard.' }
    try {
      await importImageBuffer(img.toPNG())
      return { ok: true, imported: 1, failed: 0 }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  // Bulk import: pick a folder, import everything under it.
  ipcMain.handle('import:folder', async (event): Promise<ImportResult> => {
    if (!getActiveLibrary()) return noLibrary()
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: 'Choose a folder to import',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return { ok: false, cancelled: true }
    try {
      const res = await importPaths(result.filePaths, (done, total) =>
        event.sender.send('import:progress', { done, total })
      )
      return { ok: true, imported: res.imported.length, failed: res.failed.length }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  // Import content from a URL: validates, fetches, streams, and imports through the
  // same pipeline as dropped files. source_url is set to the original URL.
  ipcMain.handle('import:url', async (event, url: string): Promise<ImportResult> => {
    if (!getActiveLibrary()) return noLibrary()
    try {
      await importUrl(url, (done, total) =>
        event.sender.send('import:progress', { done, total })
      )
      return { ok: true, imported: 1, failed: 0 }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('items:count', (): number => countItems())
}
