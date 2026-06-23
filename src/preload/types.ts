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
}
