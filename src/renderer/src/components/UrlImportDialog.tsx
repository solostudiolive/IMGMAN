import { useEffect, useState } from 'react'
import type { ImportResult, ImportProgress } from '../../../preload/types'
import './UrlImportDialog.css'

// URL import dialog: a modal where the user pastes a URL and the app fetches
// + imports it through the same pipeline as dropped files. Mirrors SettingsModal's
// backdrop/panel/close pattern but is driven by a typed IPC call.
export default function UrlImportDialog({
  open,
  onClose,
  onImported
}: {
  open: boolean
  onClose: () => void
  onImported: () => void
}): React.JSX.Element | null {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState<ImportProgress | null>(null)

  // Escape closes the dialog (if not busy); stop propagation so LibraryGate's
  // window-level handler doesn't also fire.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (busy) {
          e.preventDefault()
          e.stopPropagation()
          return // don't close while importing
        }
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose, busy])

  // Clear error/progress when the dialog opens.
  useEffect(() => {
    if (!open) {
      setError(null)
      setStatus(null)
      setProgress(null)
      setUrl('')
    }
  }, [open])

  // Listen for progress events from the main process.
  useEffect(() => {
    if (!open) return
    const unsub = window.api.import.onProgress((p) => setProgress(p))
    return unsub
  }, [open])

  const submit = async (): Promise<void> => {
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Please enter a URL.')
      return
    }
    setBusy(true)
    setError(null)
    setStatus(null)
    setProgress(null)

    try {
      const result: ImportResult = await window.api.import.url(trimmed)
      if (result.ok) {
        setStatus('Imported.')
        setUrl('')
        onImported()
      } else if ('cancelled' in result) {
        // Dialog cancelled by user — don't show an error.
      } else {
        setError(result.error)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="url-dialog__backdrop" onClick={onClose}>
      <div
        className="url-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Import from URL"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="url-dialog__header">
          <h2 className="url-dialog__title">Import from URL</h2>
          <button type="button" className="url-dialog__close" title="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="url-dialog__body">
          <label htmlFor="url-import-input" className="url-dialog__label">
            Paste a URL to an image, video, document, or font:
          </label>
          <input
            id="url-import-input"
            type="url"
            placeholder="https://example.com/photo.jpg"
            value={url}
            disabled={busy}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy && url.trim()) {
                e.preventDefault()
                void submit()
              }
            }}
            autoFocus
            className="url-dialog__input"
          />
          {progress && (
            <p className="url-dialog__progress">
              {progress.total != null
                ? `Downloading ${progress.done}/${progress.total} bytes...`
                : `Downloaded ${progress.done} bytes...`}
            </p>
          )}
          {error && <p className="url-dialog__error">{error}</p>}
          {status && <p className="url-dialog__status">{status}</p>}
          <button
            type="button"
            className="url-dialog__submit"
            disabled={busy || !url.trim()}
            onClick={() => void submit()}
          >
            {busy ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
