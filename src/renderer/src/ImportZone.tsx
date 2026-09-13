import { useCallback, useEffect, useRef, useState } from 'react'
import type { ImportProgress, ImportResult } from '../../preload/types'
import { UploadIcon, ClipboardIcon, LinkIcon } from './components/icons'
import './ImportZone.css'

export default function ImportZone({
  onChanged,
  onUrlImport
}: {
  onChanged?: () => void
  onUrlImport?: () => void
} = {}) {
  const [count, setCount] = useState<number | null>(null)
  // Window-level drag overlay: shown while files are dragged anywhere over the app once the
  // library already has items (so the big inline card can collapse to a slim strip).
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // dragenter/dragleave fire on every child crossing; a depth counter tells us when the
  // pointer has truly left the window vs. just moved between elements.
  const dragDepth = useRef(0)

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
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setProgress(null)
        setBusy(false)
        await refreshCount()
        onChanged?.()
      }
    },
    [refreshCount, onChanged]
  )

  const importPaths = useCallback(
    (e: React.DragEvent) => {
      const paths = Array.from(e.dataTransfer.files).map((f) => window.api.pathForFile(f))
      if (paths.length) run(() => window.api.import.paths(paths))
    },
    [run]
  )

  const onPaste = useCallback(() => {
    run(() => window.api.import.clipboard())
  }, [run])

  const hasItems = (count ?? 0) > 0

  // Window-level drag detection so a file can be dropped anywhere over the grid, not just on the
  // card. Only wired once the library has items (empty state already shows a full-size dropzone).
  useEffect(() => {
    if (!hasItems) return
    const hasFiles = (e: DragEvent): boolean =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onEnter = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      dragDepth.current += 1
      setDragOver(true)
    }
    const onOver = (e: DragEvent): void => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onLeave = (): void => {
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragOver(false)
    }
    const onDropWin = (e: DragEvent): void => {
      dragDepth.current = 0
      setDragOver(false)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDropWin)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDropWin)
    }
  }, [hasItems])

  const actions = (
    <>
      <button
        type="button"
        className="import-btn import-btn--primary"
        onClick={() => run(() => window.api.import.folder())}
        disabled={busy}
      >
        <UploadIcon size={14} />
        Import folder...
      </button>
      <button
        type="button"
        className="import-btn import-btn--secondary"
        onClick={onPaste}
        disabled={busy}
      >
        Paste image
      </button>
      {onUrlImport && (
        <button
          type="button"
          className="import-btn import-btn--secondary"
          onClick={onUrlImport}
          disabled={busy}
          title="Import a file from a URL"
        >
          <LinkIcon size={14} />
          Import from URL
        </button>
      )}
    </>
  )

  // Compact chip variants used in the populated-library strip (subtler than the empty-state hero).
  const stripActions = (
    <>
      <button
        type="button"
        className="import-chip import-chip--accent"
        onClick={() => run(() => window.api.import.folder())}
        disabled={busy}
        title="Import a folder of files"
      >
        <UploadIcon size={14} />
        Import
      </button>
      <button
        type="button"
        className="import-chip"
        onClick={onPaste}
        disabled={busy}
        title="Paste image from clipboard"
      >
        <ClipboardIcon size={14} />
        Paste
      </button>
      {onUrlImport && (
        <button
          type="button"
          className="import-chip"
          onClick={onUrlImport}
          disabled={busy}
          title="Import a file from a URL"
        >
          <LinkIcon size={14} />
          Import URL
        </button>
      )}
    </>
  )

  const statusLine = (
    <>
      {progress && (
        <p className="import-status import-status--progress">
          {progress.total != null
            ? `Importing ${progress.done}/${progress.total}…`
            : `Downloading ${progress.done} B…`}
        </p>
      )}
      {status && !progress && <p className="import-status import-status--ok">{status}</p>}
      {error && <p className="import-status import-status--error">{error}</p>}
    </>
  )

  // Empty library: a full welcoming dropzone. This is the first-run hero.
  if (!hasItems) {
    return (
      <div>
        <div
          tabIndex={0}
          className={`import-zone${dragOver ? ' import-zone--dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            importPaths(e)
          }}
          onPaste={onPaste}
        >
          <span className="import-zone__badge">
            <UploadIcon size={17} />
          </span>
          <p className="import-zone__title">Drop files to import</p>
          <p className="import-zone__hint">
            Drag files or folders here, paste an image (<kbd>Ctrl/Cmd</kbd> + <kbd>V</kbd>), or import
            a folder.
          </p>
          <div className="import-zone__actions">{actions}</div>
          <p className="import-zone__count">{count === null ? '...' : count} items in this library</p>
        </div>
        {statusLine}
      </div>
    )
  }

  // Populated library: a slim strip that reclaims the grid's vertical space. The big dropzone
  // returns as a full-window overlay only while files are being dragged in.
  return (
    <>
      <div className="import-strip">
        <div className="import-strip__actions">{stripActions}</div>
        <span className="import-strip__hint">or drop files anywhere</span>
        {statusLine}
        <span className="import-strip__count">
          {count} item{count === 1 ? '' : 's'}
        </span>
      </div>

      {dragOver && (
        <div
          className="import-overlay"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            dragDepth.current = 0
            setDragOver(false)
            importPaths(e)
          }}
        >
          <div className="import-overlay__card">
            <span className="import-zone__badge">
              <UploadIcon size={20} />
            </span>
            <p className="import-zone__title">Drop to import</p>
            <p className="import-zone__hint">Release anywhere to add files to this library.</p>
          </div>
        </div>
      )}
    </>
  )
}
