import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // Keep native/node deps (better-sqlite3) external — never bundle them.
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: 'src/renderer',
    // Pin the dev server to a fixed, IMGMAN-dedicated port. Without this, Vite falls back to
    // 5174+ whenever 5173 is busy, so the dev origin (http://localhost:PORT) shifts between runs —
    // and because the theme preference lives in origin-scoped localStorage, it appears "not saved"
    // after a restart that landed on a different port. strictPort fails loudly instead of silently
    // drifting, keeping the origin — and therefore persistence — stable across dev launches.
    server: {
      port: 5273,
      strictPort: true
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
