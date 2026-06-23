import { ipcMain } from 'electron'
import {
  listItems,
  getItem,
  updateItem,
  type Item,
  type FullItem,
  type ItemPatch
} from '../services/items'
import { searchItems, type SearchCriteria } from '../services/search'

export function registerItemsIpc(): void {
  ipcMain.handle('items:list', (): Item[] => listItems())
  ipcMain.handle('items:get', (_e, id: string): FullItem | null => getItem(id))
  ipcMain.handle('items:update', (_e, id: string, patch: ItemPatch): FullItem | null =>
    updateItem(id, patch)
  )
  ipcMain.handle('items:search', (_e, criteria: SearchCriteria): Item[] => searchItems(criteria))
}
