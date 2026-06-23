// Shared IPC types (no runtime/electron imports) so both the preload and the
// renderer can import them without pulling in the preload implementation.

export interface LibraryInfo {
  path: string
  name: string
}

export type LibraryResult =
  | { ok: true; library: LibraryInfo }
  | { ok: false; error: string }
  | { ok: false; cancelled: true }

export type ImportResult =
  | { ok: true; imported: number; failed: number }
  | { ok: false; error: string }
  | { ok: false; cancelled: true }

export interface ImportProgress {
  done: number
  total: number
}

export type ItemType = 'image' | 'video' | 'audio' | 'font' | 'doc' | 'other'

// A grid row (mirrors src/main/services/items.ts Item).
export interface Item {
  id: string
  name: string
  ext: string
  type: ItemType
  size_bytes: number
  width: number | null
  height: number | null
  rating: number
  created_at: number
  imported_at: number
}

// The full items row for the inspector (mirrors items.ts FullItem).
export interface FullItem extends Item {
  duration_ms: number | null
  palette: string | null
  source_url: string | null
  note: string | null
}

// Allow-listed mutable fields for items.update (mirrors items.ts ItemPatch).
export interface ItemPatch {
  rating?: number
}

// Search/filter criteria (mirrors src/main/services/search.ts SearchCriteria).
// Absent fields impose no constraint; query matches name/note/tag-name.
export interface SearchCriteria {
  query?: string
  types?: ItemType[]
  ext?: string
  minRating?: number
  from?: number | null
  to?: number | null
}

// A tag row (mirrors src/main/services/tags.ts Tag).
export interface Tag {
  id: string
  name: string
  color: string | null
}

// A folder row (mirrors src/main/services/folders.ts Folder). parent_id is null
// for roots; the renderer builds the nested tree from the flat list.
export interface Folder {
  id: string
  name: string
  parent_id: string | null
  sort_order: number | null
}

export interface IpcApi {
  getVersion: () => Promise<string>
  ping: () => Promise<string>
  // Resolve the OS path of a dropped File (Electron 32+ removed File.path).
  pathForFile: (file: File) => string
  library: {
    create: (name: string) => Promise<LibraryResult>
    open: () => Promise<LibraryResult>
    openPath: (path: string) => Promise<LibraryResult>
    getActive: () => Promise<LibraryInfo | null>
    listRecent: () => Promise<LibraryInfo[]>
  }
  import: {
    paths: (paths: string[]) => Promise<ImportResult>
    clipboard: () => Promise<ImportResult>
    folder: () => Promise<ImportResult>
    count: () => Promise<number>
    // Subscribe to batch progress; returns an unsubscribe function.
    onProgress: (cb: (p: ImportProgress) => void) => () => void
  }
  items: {
    list: () => Promise<Item[]>
    get: (id: string) => Promise<FullItem | null>
    update: (id: string, patch: ItemPatch) => Promise<FullItem | null>
    count: () => Promise<number>
    search: (criteria: SearchCriteria) => Promise<Item[]>
  }
  tags: {
    listAll: () => Promise<Tag[]>
    listForItem: (itemId: string) => Promise<Tag[]>
    add: (itemId: string, name: string) => Promise<Tag[]>
    remove: (itemId: string, tagId: string) => Promise<Tag[]>
  }
  folders: {
    list: () => Promise<Folder[]>
    create: (name: string, parentId: string | null) => Promise<Folder[]>
    rename: (id: string, name: string) => Promise<Folder[]>
    delete: (id: string) => Promise<Folder[]>
    itemsIn: (folderId: string) => Promise<Item[]>
    forItem: (itemId: string) => Promise<Folder[]>
    assign: (itemId: string, folderId: string) => Promise<Folder[]>
    unassign: (itemId: string, folderId: string) => Promise<Folder[]>
  }
}
