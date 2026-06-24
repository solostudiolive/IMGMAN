import { ipcMain } from 'electron'
import {
  listAllTags,
  listTagsForItem,
  addTagToItem,
  addTagToMany,
  removeTagFromItem,
  commonTagsForItems,
  removeTagFromMany,
  type Tag
} from '../services/tags'

export function registerTagsIpc(): void {
  ipcMain.handle('tags:listAll', (): Tag[] => listAllTags())
  ipcMain.handle('tags:listForItem', (_e, itemId: string): Tag[] => listTagsForItem(itemId))
  ipcMain.handle('tags:add', (_e, itemId: string, name: string): Tag[] =>
    addTagToItem(itemId, name)
  )
  ipcMain.handle('tags:addToMany', (_e, itemIds: string[], name: string): number =>
    addTagToMany(itemIds, name)
  )
  ipcMain.handle('tags:remove', (_e, itemId: string, tagId: string): Tag[] =>
    removeTagFromItem(itemId, tagId)
  )
  ipcMain.handle('tags:commonForItems', (_e, ids: string[]): Tag[] => commonTagsForItems(ids))
  ipcMain.handle('tags:removeFromMany', (_e, ids: string[], tagId: string): number =>
    removeTagFromMany(ids, tagId)
  )
}
