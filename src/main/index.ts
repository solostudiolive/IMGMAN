import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { closeActiveLibrary, openLibrary } from './services/library'
import { getLastOpened } from './config'
import { registerIpcHandlers } from './ipc'
import { registerImgmanScheme, registerImgmanProtocol } from './protocol'

// Privileged scheme must be registered before the app is ready.
registerImgmanScheme()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    title: 'IMGMAN',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // contextIsolation on + nodeIntegration off keeps the renderer sandboxed;
      // the renderer only reaches the main process through the typed `window.api` bridge.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Open external links in the OS browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite injects ELECTRON_RENDERER_URL in dev (Vite dev server w/ HMR).
  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerImgmanProtocol()
  registerIpcHandlers()

  // No fixed userData DB anymore: reopen the last-used library if it's still valid.
  // Otherwise the app starts with no active library and the renderer shows the gate.
  const last = getLastOpened()
  if (last) {
    try {
      openLibrary(last)
    } catch {
      // stale/missing library — ignore; user picks one from the gate
    }
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  closeActiveLibrary()
})
