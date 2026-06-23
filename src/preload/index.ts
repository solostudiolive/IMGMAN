import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcApi, ImportProgress, ItemPatch, SearchCriteria } from './types'

// The typed surface exposed to the renderer as `window.api`.
// Request/response uses invoke/handle (not send/on). The raw ipcRenderer is
// never exposed. Typed against IpcApi to keep it in sync with the handlers in
// src/main/ipc/*.
const api: IpcApi = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  ping: (): Promise<string> => ipcRenderer.invoke('app:ping'),
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  library: {
    create: (name: string) => ipcRenderer.invoke('library:create', name),
    open: () => ipcRenderer.invoke('library:open'),
    openPath: (path: string) => ipcRenderer.invoke('library:openPath', path),
    getActive: () => ipcRenderer.invoke('library:getActive'),
    listRecent: () => ipcRenderer.invoke('library:listRecent')
  },
  import: {
    paths: (paths: string[]) => ipcRenderer.invoke('import:paths', paths),
    clipboard: () => ipcRenderer.invoke('import:clipboard'),
    folder: () => ipcRenderer.invoke('import:folder'),
    count: () => ipcRenderer.invoke('items:count'),
    onProgress: (cb: (p: ImportProgress) => void): (() => void) => {
      const listener = (_e: unknown, p: ImportProgress): void => cb(p)
      ipcRenderer.on('import:progress', listener)
      return () => ipcRenderer.removeListener('import:progress', listener)
    }
  },
  items: {
    list: () => ipcRenderer.invoke('items:list'),
    get: (id: string) => ipcRenderer.invoke('items:get', id),
    update: (id: string, patch: ItemPatch) => ipcRenderer.invoke('items:update', id, patch),
    count: () => ipcRenderer.invoke('items:count'),
    search: (criteria: SearchCriteria) => ipcRenderer.invoke('items:search', criteria)
  },
  tags: {
    listAll: () => ipcRenderer.invoke('tags:listAll'),
    listForItem: (itemId: string) => ipcRenderer.invoke('tags:listForItem', itemId),
    add: (itemId: string, name: string) => ipcRenderer.invoke('tags:add', itemId, name),
    remove: (itemId: string, tagId: string) => ipcRenderer.invoke('tags:remove', itemId, tagId)
  },
  folders: {
    list: () => ipcRenderer.invoke('folders:list'),
    create: (name: string, parentId: string | null) =>
      ipcRenderer.invoke('folders:create', name, parentId),
    rename: (id: string, name: string) => ipcRenderer.invoke('folders:rename', id, name),
    delete: (id: string) => ipcRenderer.invoke('folders:delete', id),
    itemsIn: (folderId: string) => ipcRenderer.invoke('folders:itemsIn', folderId),
    forItem: (itemId: string) => ipcRenderer.invoke('folders:forItem', itemId),
    assign: (itemId: string, folderId: string) =>
      ipcRenderer.invoke('folders:assign', itemId, folderId),
    unassign: (itemId: string, folderId: string) =>
      ipcRenderer.invoke('folders:unassign', itemId, folderId)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // Fallback path if contextIsolation is ever disabled (it isn't, by default).
  // @ts-ignore — window.api is declared in index.d.ts
  window.api = api
}
