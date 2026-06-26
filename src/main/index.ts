import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { closeActiveLibrary, openLibrary } from './services/library'
import { getLastOpened } from './config'
import { registerIpcHandlers } from './ipc'
import { registerImgmanScheme, registerImgmanProtocol } from './protocol'
import appIcon from '../../resources/icon.png?asset'

// Privileged scheme must be registered before the app is ready.
registerImgmanScheme()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    // Floor the window size so the three-pane shell (fixed-width sidebar ~240 + inspector ~300 +
    // splitters) always keeps a usable center area — the window stops resizing here instead of
    // crushing the grid. Panes themselves are fixed (flex: 0 0 auto); the center absorbs resize.
    minWidth: 900,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    title: 'IMGMAN',
    icon: appIcon,
    // Chrome-less custom title bar (Plan 05-02). On macOS keep the native traffic lights
    // via titleBarStyle 'hidden' (inset); elsewhere go fully frameless and draw our own
    // controls. resizable stays default (true) so the frameless window resizes from edges.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hidden' as const, trafficLightPosition: { x: 12, y: 11 } }
      : { frame: false }),
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

  // Keep the renderer's maximize/restore icon in sync, including OS-driven changes
  // (Win+Up, edge snap) that don't go through window:toggleMaximize.
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximizeChanged', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximizeChanged', false))

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
