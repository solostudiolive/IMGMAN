import { useEffect, useState, type MouseEvent } from 'react'
import './TitleBar.css'

const isMac = window.api.platform === 'darwin'

// Small 10px glyphs for the window controls.
function MinIcon(): React.JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
    </svg>
  )
}

function MaxIcon(): React.JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function RestoreIcon(): React.JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M2.5 2.5 V0.5 H9.5 V7.5 H7.5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function CloseIcon(): React.JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0.5 0.5 L9.5 9.5 M9.5 0.5 L0.5 9.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}

export default function TitleBar(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    let active = true
    window.api.window.isMaximized().then((max) => {
      if (active) setIsMaximized(max)
    })
    const unsubscribe = window.api.window.onMaximizeChange(setIsMaximized)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  // Double-click the empty bar toggles maximize, but not when clicking the controls.
  const onDoubleClick = (e: MouseEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).closest('.titlebar__controls')) return
    window.api.window.toggleMaximize()
  }

  return (
    <div
      className={`titlebar${isMac ? ' titlebar--mac' : ''}`}
      onDoubleClick={onDoubleClick}
    >
      <span className="titlebar__title">IMGMAN</span>
      <div className="titlebar__spacer" />
      {!isMac && (
        <div className="titlebar__controls">
          <button
            className="titlebar__btn"
            title="Minimize"
            aria-label="Minimize"
            onClick={() => window.api.window.minimize()}
          >
            <MinIcon />
          </button>
          <button
            className="titlebar__btn"
            title={isMaximized ? 'Restore' : 'Maximize'}
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
            onClick={() => window.api.window.toggleMaximize()}
          >
            {isMaximized ? <RestoreIcon /> : <MaxIcon />}
          </button>
          <button
            className="titlebar__btn titlebar__btn--close"
            title="Close"
            aria-label="Close"
            onClick={() => window.api.window.close()}
          >
            <CloseIcon />
          </button>
        </div>
      )}
    </div>
  )
}
