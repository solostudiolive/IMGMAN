import { ipcMain } from 'electron'
import {
  listAllTags,
  listTagsForItem,
  addTagToItem,
  removeTagFromItem,
  type Tag
} from '../services/tags'

export function registerTagsIpc(): void {
  ipcMain.handle('tags:listAll', (): Tag[] => listAllTags())
  ipcMain.handle('tags:listForItem', (_e, itemId: string): Tag[] => listTagsForItem(itemId))
  ipcMain.handle('tags:add', (_e, itemId: string, name: string): Tag[] =>
    addTagToItem(itemId, name)
  )
  ipcMain.handle('tags:remove', (_e, itemId: string, tagId: string): Tag[] =>
    removeTagFromItem(itemId, tagId)
  )
}
