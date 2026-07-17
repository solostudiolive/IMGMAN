// Token + base stylesheets are imported here so they are global. Imports hoist and run
// before the statements below, so the CSS is injected first; applyStoredTheme() then sets
// data-theme before React renders (and before first paint) → no flash-of-unstyled-content.
// Note: the CSP blocks an inline <head> script, but this 'self' module is allowed to do it.
// Play (self-hosted via @fontsource — bundled by Vite as same-origin woff2, CSP/offline-safe;
// no CDN). Imported before the token/base CSS so the @font-face rules are registered first.
// Play ships only 400 (regular) and 700 (bold); medium/semibold token weights fall back to these.
import '@fontsource/play/400.css'
import '@fontsource/play/700.css'
import './styles/tokens.css'
import './styles/base.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './theme/ThemeProvider'
import { applyStoredTheme } from './theme/theme'

applyStoredTheme()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
