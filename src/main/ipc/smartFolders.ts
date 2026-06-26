import { ipcMain } from 'electron'
import {
  listSmartFolders,
  createSmartFolder,
  renameSmartFolder,
  deleteSmartFolder,
  type SmartFolder
} from '../services/smartFolders'
import type { SearchCriteria } from '../services/search'

export function registerSmartFoldersIpc(): void {
  ipcMain.handle('smartFolders:list', (): SmartFolder[] => listSmartFolders())
  ipcMain.handle('smartFolders:create', (_e, name: string, criteria: SearchCriteria): SmartFolder[] =>
    createSmartFolder(name, criteria)
  )
  ipcMain.handle('smartFolders:rename', (_e, id: string, name: string): SmartFolder[] =>
    renameSmartFolder(id, name)
  )
  ipcMain.handle('smartFolders:delete', (_e, id: string): SmartFolder[] => deleteSmartFolder(id))
}
