import { ipcMain } from 'electron'
import { listItems, getItem, type Item, type FullItem } from '../services/items'

export function registerItemsIpc(): void {
  ipcMain.handle('items:list', (): Item[] => listItems())
  ipcMain.handle('items:get', (_e, id: string): FullItem | null => getItem(id))
}
