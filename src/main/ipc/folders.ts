import { ipcMain, dialog, BrowserWindow } from 'electron'
import {
  listFolders,
  folderCounts,
  createFolder,
  renameFolder,
  deleteFolder,
  listItemsInFolder,
  listFoldersForItem,
  assignItemToFolder,
  assignManyToFolder,
  removeItemFromFolder,
  commonFoldersForItems,
  unassignManyFromFolder,
  type Folder
} from '../services/folders'
import { exportItemsToZip, type Item } from '../services/items'
import type { ExportResult } from './items'

export function registerFoldersIpc(): void {
  ipcMain.handle('folders:list', (): Folder[] => listFolders())
  ipcMain.handle('folders:counts', (): Record<string, number> => folderCounts())
  ipcMain.handle('folders:create', (_e, name: string, parentId: string | null): Folder[] =>
    createFolder(name, parentId)
  )
  ipcMain.handle('folders:rename', (_e, id: string, name: string): Folder[] =>
    renameFolder(id, name)
  )
  ipcMain.handle('folders:delete', (_e, id: string): Folder[] => deleteFolder(id))
  ipcMain.handle('folders:itemsIn', (_e, folderId: string): Item[] => listItemsInFolder(folderId))
  ipcMain.handle('folders:forItem', (_e, itemId: string): Folder[] => listFoldersForItem(itemId))
  ipcMain.handle('folders:assign', (_e, itemId: string, folderId: string): Folder[] =>
    assignItemToFolder(itemId, folderId)
  )
  ipcMain.handle('folders:assignMany', (_e, itemIds: string[], folderId: string): number =>
    assignManyToFolder(itemIds, folderId)
  )
  ipcMain.handle('folders:unassign', (_e, itemId: string, folderId: string): Folder[] =>
    removeItemFromFolder(itemId, folderId)
  )
  ipcMain.handle('folders:commonForItems', (_e, ids: string[]): Folder[] =>
    commonFoldersForItems(ids)
  )
  ipcMain.handle('folders:unassignMany', (_e, ids: string[], folderId: string): number =>
    unassignManyFromFolder(ids, folderId)
  )

  // Export all of a folder's items' originals into a single .zip the user picks. Never mutates
  // the library. Direct members only (mirrors the folder grid filter — no descendant rollup).
  ipcMain.handle('folders:export', async (event, folderId: string): Promise<ExportResult> => {
    const folder = listFolders().find((f) => f.id === folderId)
    const items = listItemsInFolder(folderId)
    if (items.length === 0) return { ok: false, error: 'This folder has no items to export.' }
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const zipBase = (folder?.name ?? 'folder').replace(/[\\/:*?"<>|]/g, '_').trim() || 'folder'
    const res = await dialog.showSaveDialog(win!, {
      title: `Export "${folder?.name ?? 'folder'}" as ZIP`,
      defaultPath: `${zipBase}.zip`,
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
}
