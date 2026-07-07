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

// Counts for the sidebar scope rows (mirrors src/main/services/items.ts SidebarCounts).
export interface SidebarCounts {
  all: number
  uncategorized: number
  untagged: number
}

// Result of exporting originals to disk (mirrors src/main/ipc/items.ts ExportResult).
export type ExportResult =
  | { ok: true; exported: number; failed: number }
  | { ok: false; cancelled: true }
  | { ok: false; error: string }

// Target image formats for Convert (value = output extension).
export type ConvertFormat = 'jpg' | 'png' | 'webp' | 'avif'

// Result of a convert request (mirrors src/main/ipc/items.ts ConvertResult).
export type ConvertResult =
  | { ok: true; converted: number; failed: number }
  | { ok: false; cancelled: true }
  | { ok: false; error: string }

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
  note?: string | null
  source_url?: string | null
}

// A set of byte-identical items sharing one content hash (mirrors items.ts DuplicateGroup).
export interface DuplicateGroup {
  hash: string
  items: Item[]
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
  // Exact tag filter (item must carry ALL listed tags). Driven by the sidebar Tags section.
  tagIds?: string[]
  // Nearest-color filter: target `#rrggbb` + max RGB Euclidean distance (service supplies a default).
  color?: string
  colorTolerance?: number
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

// A saved search / smart folder (mirrors src/main/services/smartFolders.ts SmartFolder).
// `criteria` is the persisted SearchCriteria re-applied through the existing search scope.
export interface SmartFolder {
  id: string
  name: string
  criteria: SearchCriteria
}

export interface IpcApi {
  getVersion: () => Promise<string>
  ping: () => Promise<string>
  // The OS platform string (process.platform), so the renderer can branch on macOS.
  platform: string
  // Resolve the OS path of a dropped File (Electron 32+ removed File.path).
  pathForFile: (file: File) => string
  // Window controls for the chrome-less custom title bar (Plan 05-02).
  window: {
    minimize: () => Promise<void>
    toggleMaximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    // main→renderer maximize-state event; returns an unsubscribe fn (mirrors import.onProgress).
    onMaximizeChange: (cb: (isMaximized: boolean) => void) => () => void
  }
  library: {
    create: (name: string) => Promise<LibraryResult>
    open: () => Promise<LibraryResult>
    openPath: (path: string) => Promise<LibraryResult>
    getActive: () => Promise<LibraryInfo | null>
    rename: (name: string) => Promise<LibraryResult>
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
    // Items in no folder / with no tag — the sidebar "Uncategorized" / "Untagged" scopes.
    listUncategorized: () => Promise<Item[]>
    listUntagged: () => Promise<Item[]>
    // Counts for the sidebar scope rows (All / Uncategorized / Untagged).
    sidebarCounts: () => Promise<SidebarCounts>
    get: (id: string) => Promise<FullItem | null>
    update: (id: string, patch: ItemPatch) => Promise<FullItem | null>
    // Permanently delete a batch of items (rows + on-disk files). Returns rows deleted.
    delete: (ids: string[]) => Promise<number>
    // Rename a batch (metadata `name` only). Returns rows changed.
    renameMany: (renames: { id: string; name: string }[]) => Promise<number>
    // Set the same rating (0..5) on a batch of items. Returns rows changed.
    rateMany: (ids: string[], rating: number) => Promise<number>
    // Export originals to disk (1 item → Save dialog, many → Choose-folder). Never mutates the library.
    export: (ids: string[]) => Promise<ExportResult>
    // Convert image originals to another format (jpg/png/webp/avif) and save to disk.
    convert: (ids: string[], format: ConvertFormat) => Promise<ConvertResult>
    // Backfill dominant-color palettes for image items missing one. Returns count populated.
    backfillPalettes: () => Promise<number>
    // Backfill SHA-256 content hashes for items missing one (all types). Returns count populated.
    backfillHashes: () => Promise<number>
    // Groups of byte-identical items (2+ sharing a content hash), oldest-first within each group.
    findDuplicates: () => Promise<DuplicateGroup[]>
    count: () => Promise<number>
    search: (criteria: SearchCriteria) => Promise<Item[]>
  }
  tags: {
    listAll: () => Promise<Tag[]>
    listForItem: (itemId: string) => Promise<Tag[]>
    add: (itemId: string, name: string) => Promise<Tag[]>
    // Add a tag (by name) to many items at once. Returns new links created.
    addToMany: (itemIds: string[], name: string) => Promise<number>
    remove: (itemId: string, tagId: string) => Promise<Tag[]>
    // Tags present on EVERY selected item (the intersection) — for the multi-item inspector.
    commonForItems: (ids: string[]) => Promise<Tag[]>
    // Unlink a tag from many items at once. Returns links removed.
    removeFromMany: (ids: string[], tagId: string) => Promise<number>
  }
  folders: {
    list: () => Promise<Folder[]>
    // Direct (non-recursive) item count per folder id; missing ids default to 0.
    counts: () => Promise<Record<string, number>>
    create: (name: string, parentId: string | null) => Promise<Folder[]>
    rename: (id: string, name: string) => Promise<Folder[]>
    delete: (id: string) => Promise<Folder[]>
    itemsIn: (folderId: string) => Promise<Item[]>
    forItem: (itemId: string) => Promise<Folder[]>
    assign: (itemId: string, folderId: string) => Promise<Folder[]>
    // Assign many items to a folder at once. Returns new links created.
    assignMany: (itemIds: string[], folderId: string) => Promise<number>
    unassign: (itemId: string, folderId: string) => Promise<Folder[]>
    // Folders containing EVERY selected item (the intersection) — for the multi-item inspector.
    commonForItems: (ids: string[]) => Promise<Folder[]>
    // Remove many items from a folder at once (items kept). Returns links removed.
    unassignMany: (ids: string[], folderId: string) => Promise<number>
  }
  smartFolders: {
    list: () => Promise<SmartFolder[]>
    // Save the current SearchCriteria under a name. Returns the canonical list.
    create: (name: string, criteria: SearchCriteria) => Promise<SmartFolder[]>
    rename: (id: string, name: string) => Promise<SmartFolder[]>
    delete: (id: string) => Promise<SmartFolder[]>
  }
}
