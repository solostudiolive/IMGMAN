import { ipcMain } from 'electron'
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
import type { Item } from '../services/items'

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
}
