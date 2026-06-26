import { useCallback, useEffect, useRef, useState } from 'react'
import type { ImportResult } from '../../preload/types'
import { UploadIcon } from './components/icons'
import './ImportZone.css'

export default function ImportZone({ onChanged }: { onChanged?: () => void } = {}) {
  const [count, setCount] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const zoneRef = useRef<HTMLDivElement>(null)

  const refreshCount = useCallback(async () => {
    setCount(await window.api.import.count())
  }, [])

  useEffect(() => {
    refreshCount()
    const unsub = window.api.import.onProgress((p) => setProgress(p))
    return unsub
  }, [refreshCount])

  // Run an import call: manage busy state, surface results, refresh the count.
  const run = useCallback(
    async (fn: () => Promise<ImportResult>) => {
      setBusy(true)
      setError(null)
      setStatus(null)
      try {
        const res = await fn()
        if (res.ok) {
          setStatus(`Imported ${res.imported}${res.failed ? `, ${res.failed} failed` : ''}.`)
        } else if (!('cancelled' in res)) {
          setError(res.error)
        }
      } finally {
        setProgress(null)
        setBusy(false)
        await refreshCount()
        onChanged?.()
      }
    },
    [refreshCount, onChanged]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const paths = Array.from(e.dataTransfer.files).map((f) => window.api.pathForFile(f))
      if (paths.length) run(() => window.api.import.paths(paths))
    },
    [run]
  )

  const onPaste = useCallback(() => {
    run(() => window.api.import.clipboard())
  }, [run])

  return (
    <div>
      <div
        ref={zoneRef}
        tabIndex={0}
        className={`import-zone${dragging ? ' import-zone--dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onPaste={onPaste}
      >
        <span className="import-zone__badge">
          <UploadIcon size={17} />
        </span>
        <p className="import-zone__title">Drop files to import</p>
        <p className="import-zone__hint">
          Drag files or folders here, paste an image (<kbd>Ctrl/Cmd</kbd> + <kbd>V</kbd>), or import a
          folder.
        </p>
        <div className="import-zone__actions">
          <button
            type="button"
            className="import-btn import-btn--primary"
            onClick={() => run(() => window.api.import.folder())}
            disabled={busy}
          >
            <UploadIcon size={14} />
            Import folder…
          </button>
          <button
            type="button"
            className="import-btn import-btn--secondary"
            onClick={onPaste}
            disabled={busy}
          >
            Paste image
          </button>
        </div>
        <p className="import-zone__count">
          {count === null ? '…' : count} item{count === 1 ? '' : 's'} in this library
        </p>
      </div>

      {progress && (
        <p className="import-status import-status--progress">
          Importing {progress.done}/{progress.total}…
        </p>
      )}
      {status && !progress && <p className="import-status import-status--ok">{status}</p>}
      {error && <p className="import-status import-status--error">{error}</p>}
    </div>
  )
}
