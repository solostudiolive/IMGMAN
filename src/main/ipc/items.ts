import { ipcMain } from 'electron'
import {
  listItems,
  getItem,
  updateItem,
  deleteItems,
  renameItems,
  rateItems,
  backfillPalettes,
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
  ipcMain.handle('items:delete', (_e, ids: string[]): number => deleteItems(ids))
  ipcMain.handle('items:renameMany', (_e, renames: { id: string; name: string }[]): number =>
    renameItems(renames)
  )
  ipcMain.handle('items:rateMany', (_e, ids: string[], rating: number): number =>
    rateItems(ids, rating)
  )
  ipcMain.handle('items:search', (_e, criteria: SearchCriteria): Item[] => searchItems(criteria))
  ipcMain.handle('items:backfillPalettes', (): Promise<number> => backfillPalettes())
}
