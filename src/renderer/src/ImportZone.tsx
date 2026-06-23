import { useCallback, useEffect, useRef, useState } from 'react'
import type { ImportResult } from '../../preload/types'

export default function ImportZone() {
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
      }
    },
    [refreshCount]
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
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onPaste={onPaste}
        style={{
          padding: 32,
          border: `2px dashed ${dragging ? '#3b82f6' : '#ccc'}`,
          borderRadius: 8,
          background: dragging ? '#eff6ff' : 'transparent',
          textAlign: 'center',
          color: '#666',
          outline: 'none',
          transition: 'background 0.1s, border-color 0.1s'
        }}
      >
        <p style={{ margin: '0 0 8px', fontSize: 15 }}>
          {count === null ? '…' : count} item{count === 1 ? '' : 's'} in this library
        </p>
        <p style={{ margin: '0 0 12px', fontSize: 13 }}>
          Drag files or folders here, paste an image (Ctrl/Cmd+V), or import a folder.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={() => run(() => window.api.import.folder())} disabled={busy}>
            Import folder…
          </button>
          <button onClick={onPaste} disabled={busy}>
            Paste image
          </button>
        </div>
      </div>

      {progress && (
        <p style={{ color: '#3b82f6', fontSize: 13, marginTop: 12 }}>
          Importing {progress.done}/{progress.total}…
        </p>
      )}
      {status && !progress && (
        <p style={{ color: '#16a34a', fontSize: 13, marginTop: 12 }}>{status}</p>
      )}
      {error && <p style={{ color: '#c00', fontSize: 13, marginTop: 12 }}>{error}</p>}
    </div>
  )
}
