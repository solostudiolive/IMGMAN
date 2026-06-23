import { ipcMain } from 'electron'
import {
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  listItemsInFolder,
  listFoldersForItem,
  assignItemToFolder,
  removeItemFromFolder,
  type Folder
} from '../services/folders'
import type { Item } from '../services/items'

export function registerFoldersIpc(): void {
  ipcMain.handle('folders:list', (): Folder[] => listFolders())
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
  ipcMain.handle('folders:unassign', (_e, itemId: string, folderId: string): Folder[] =>
    removeItemFromFolder(itemId, folderId)
  )
}
