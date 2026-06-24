import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'

// Window-control IPC for the chrome-less custom title bar. The owning window is resolved
// per call from the sender (no captured/stale BrowserWindow reference). Main also emits
// 'window:maximizeChanged' from src/main/index.ts on maximize/unmaximize so the renderer's
// maximize/restore icon tracks OS-driven state changes (Win+Up, snap).
function senderWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

export function registerWindowIpc(): void {
  ipcMain.handle('window:minimize', (event) => {
    senderWindow(event)?.minimize()
  })

  ipcMain.handle('window:toggleMaximize', (event) => {
    const win = senderWindow(event)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.handle('window:close', (event) => {
    senderWindow(event)?.close()
  })

  ipcMain.handle('window:isMaximized', (event) => senderWindow(event)?.isMaximized() ?? false)
}
