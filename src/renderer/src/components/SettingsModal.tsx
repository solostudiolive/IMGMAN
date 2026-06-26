import { useEffect, useState } from 'react'
import { useTheme } from '../theme/ThemeProvider'
import type { ThemePreference } from '../theme/theme'
import './SettingsModal.css'

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' }
]

// Settings dialog: Appearance (theme) + About. Presentational; the parent owns `open`.
// Mirrors QuickPreview's overlay/close pattern but self-owns its Escape handler.
export default function SettingsModal({
  open,
  onClose,
  onFindDuplicates
}: {
  open: boolean
  onClose: () => void
  // Open the Find-duplicates dialog (owned by the parent, which also reloads the grid after deletes).
  onFindDuplicates?: () => void
}): React.JSX.Element | null {
  const { preference, resolved, setPreference } = useTheme()
  const [version, setVersion] = useState<string | null>(null)
  // Color backfill ("Extract colors") state: busy while running, then the populated count.
  const [colorBusy, setColorBusy] = useState(false)
  const [colorResult, setColorResult] = useState<number | null>(null)

  const extractColors = async (): Promise<void> => {
    setColorBusy(true)
    setColorResult(null)
    try {
      setColorResult(await window.api.items.backfillPalettes())
    } finally {
      setColorBusy(false)
    }
  }

  // Load the app version when the modal opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    window.api.getVersion().then((v) => {
      if (!cancelled) setVersion(v)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  // Escape closes the modal; stop propagation so LibraryGate's window handler doesn't also fire.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="settings__backdrop" onClick={onClose}>
      <div
        className="settings__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings__header">
          <h2 className="settings__title">Settings</h2>
          <button type="button" className="settings__close" title="Close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <section className="settings__section">
          <h3 className="settings__section-title">Appearance</h3>
          <div className="settings__row">
            <span className="settings__label">Theme</span>
            <div className="settings__segment" role="group" aria-label="Theme">
              {THEME_OPTIONS.map((opt) => {
                const on = preference === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`settings__segment-btn${on ? ' settings__segment-btn--on' : ''}`}
                    aria-pressed={on}
                    onClick={() => setPreference(opt.value)}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
          {preference === 'system' && (
            <p className="settings__caption">Following system · currently {resolved}</p>
          )}
        </section>

        <section className="settings__section">
          <h3 className="settings__section-title">Library maintenance</h3>
          <div className="settings__row">
            <span className="settings__label">Colors</span>
            <button
              type="button"
              className="settings__segment-btn"
              disabled={colorBusy}
              onClick={() => void extractColors()}
            >
              {colorBusy ? 'Extracting…' : 'Extract colors for existing items'}
            </button>
          </div>
          {colorResult !== null && (
            <p className="settings__caption">Done — {colorResult} updated</p>
          )}
          <div className="settings__row">
            <span className="settings__label">Duplicates</span>
            <button
              type="button"
              className="settings__segment-btn"
              onClick={() => onFindDuplicates?.()}
            >
              Find duplicates…
            </button>
          </div>
        </section>

        <section className="settings__section">
          <h3 className="settings__section-title">About</h3>
          <div className="settings__row">
            <span className="settings__label">IMGMAN</span>
            <span className="settings__value">Version {version ?? '…'}</span>
          </div>
          <div className="settings__row">
            <span className="settings__label">Platform</span>
            <span className="settings__value">{window.api.platform}</span>
          </div>
        </section>
      </div>
    </div>
  )
}
