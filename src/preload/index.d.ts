// Global augmentation so the renderer sees window.api typed.
// Shared shapes live in ./types (importable without the preload runtime).
import type { IpcApi } from './types'

declare global {
  interface Window {
    api: IpcApi
  }
}

export {}
