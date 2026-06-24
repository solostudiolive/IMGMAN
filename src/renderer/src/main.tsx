// Token + base stylesheets are imported here so they are global. Imports hoist and run
// before the statements below, so the CSS is injected first; applyStoredTheme() then sets
// data-theme before React renders (and before first paint) → no flash-of-unstyled-content.
// Note: the CSP blocks an inline <head> script, but this 'self' module is allowed to do it.
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
