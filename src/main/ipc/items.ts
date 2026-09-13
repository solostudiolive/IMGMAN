import { ipcMain, dialog, BrowserWindow } from 'electron'
import { copyFileSync } from 'fs'
import {
  listItems,
  listUncategorized,
  listUntagged,
  sidebarCounts,
  getItem,
  updateItem,
  deleteItems,
  renameItems,
  rateItems,
  backfillPalettes,
  backfillHashes,
  backfillMediaThumbnails,
  findDuplicateGroups,
  itemExportInfo,
  exportItemsToDir,
  exportItemsToZip,
  itemBaseName,
  convertItemTo,
  convertItemsToDir,
  type Item,
  type FullItem,
  type ItemPatch,
  type DuplicateGroup,
  type SidebarCounts,
  type ConvertFormat
} from '../services/items'
import { searchItems, type SearchCriteria } from '../services/search'

// Result of an export request. `cancelled` set when the user dismisses the dialog.
export type ExportResult =
  | { ok: true; exported: number; failed: number }
  | { ok: false; cancelled: true }
  | { ok: false; error: string }

// Result of a convert request (transcode originals to another image format).
export type ConvertResult =
  | { ok: true; converted: number; failed: number }
  | { ok: false; cancelled: true }
  | { ok: false; error: string }

export function registerItemsIpc(): void {
  ipcMain.handle('items:list', (): Item[] => listItems())
  ipcMain.handle('items:listUncategorized', (): Item[] => listUncategorized())
  ipcMain.handle('items:listUntagged', (): Item[] => listUntagged())
  ipcMain.handle('items:sidebarCounts', (): SidebarCounts => sidebarCounts())
  ipcMain.handle('items:get', (_e, id: string): FullItem | null => getItem(id))
  ipcMain.handle('items:update', (_e, id: string, patch: ItemPatch): FullItem | null =>
    updateItem(id, patch)
  )
  ipcMain.handle('items:delete', (_e, ids: string[]): number => deleteItems(ids))
  ipcMain.handle('items:renameMany', (_e, renames: { id: string; name: string }[]): number =>
    renameItems(renames)
  )
  ipcMain.handle('items:rateMany', (_e, ids: string[], rating: number): number =>
    rateItems(ids, rating)
  )
  ipcMain.handle('items:search', (_e, criteria: SearchCriteria): Item[] => searchItems(criteria))
  ipcMain.handle('items:backfillPalettes', (): Promise<number> => backfillPalettes())
  ipcMain.handle('items:backfillHashes', (): Promise<number> => backfillHashes())
  ipcMain.handle('items:backfillMediaThumbnails', (): Promise<number> => backfillMediaThumbnails())
  ipcMain.handle('items:findDuplicates', (): DuplicateGroup[] => findDuplicateGroups())

  // Export originals to disk. A single item opens a Save dialog (pick file + name); multiple items
  // open a Choose-folder dialog and copy each as `name.ext`. Never mutates the library.
  ipcMain.handle('items:export', async (event, ids: string[]): Promise<ExportResult> => {
    if (!Array.isArray(ids) || ids.length === 0) return { ok: false, cancelled: true }
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined

    if (ids.length === 1) {
      const info = itemExportInfo(ids[0])
      if (!info) return { ok: false, error: 'The original file could not be found.' }
      const res = await dialog.showSaveDialog(win!, {
        title: 'Export image',
        defaultPath: info.filename
      })
      if (res.canceled || !res.filePath) return { ok: false, cancelled: true }
      try {
        copyFileSync(info.path, res.filePath)
        return { ok: true, exported: 1, failed: 0 }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }

    const res = await dialog.showOpenDialog(win!, {
      title: `Export ${ids.length} items to a folder`,
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return { ok: false, cancelled: true }
    try {
      const { exported, failed } = exportItemsToDir(ids, res.filePaths[0])
      return { ok: true, exported, failed }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  // Export EVERY item's original in the active library into one .zip the user picks.
  ipcMain.handle('items:exportAllZip', async (event): Promise<ExportResult> => {
    const items = listItems()
    if (items.length === 0) return { ok: false, error: 'The library has no items to export.' }
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const res = await dialog.showSaveDialog(win!, {
      title: 'Export all items as ZIP',
      defaultPath: 'library-export.zip',
      filters: [{ name: 'Zip archive', extensions: ['zip'] }]
    })
    if (res.canceled || !res.filePath) return { ok: false, cancelled: true }
    try {
      const { exported, failed } = await exportItemsToZip(
        items.map((i) => i.id),
        res.filePath
      )
      return { ok: true, exported, failed }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  // Convert originals to another image format via sharp. Single item → Save dialog (name.<format>);
  // multiple → Choose-folder. Writes new files only; the library originals are untouched.
  ipcMain.handle(
    'items:convert',
    async (event, ids: string[], format: ConvertFormat): Promise<ConvertResult> => {
      if (!Array.isArray(ids) || ids.length === 0) return { ok: false, cancelled: true }
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined

      if (ids.length === 1) {
        const base = itemBaseName(ids[0])
        if (!base) return { ok: false, error: 'The original file could not be found.' }
        const res = await dialog.showSaveDialog(win!, {
          title: 'Convert image',
          defaultPath: `${base}.${format}`
        })
        if (res.canceled || !res.filePath) return { ok: false, cancelled: true }
        try {
          await convertItemTo(ids[0], format, res.filePath)
          return { ok: true, converted: 1, failed: 0 }
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) }
        }
      }

      const res = await dialog.showOpenDialog(win!, {
        title: `Convert ${ids.length} items to ${format.toUpperCase()}`,
        properties: ['openDirectory', 'createDirectory']
      })
      if (res.canceled || res.filePaths.length === 0) return { ok: false, cancelled: true }
      try {
        const { converted, failed } = await convertItemsToDir(ids, format, res.filePaths[0])
        return { ok: true, converted, failed }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }
  )
}
