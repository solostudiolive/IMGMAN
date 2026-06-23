import { app, ipcMain } from 'electron'
import { registerLibraryIpc } from './library'
import { registerImportIpc } from './import'
import { registerItemsIpc } from './items'

/**
 * Central registration point for all main-process IPC handlers.
 * Every channel here must have a matching, typed wrapper in src/preload/index.ts.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:ping', () => 'pong')

  registerLibraryIpc()
  registerImportIpc()
  registerItemsIpc()
}
