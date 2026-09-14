import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api'
import { baseName } from '../displayName'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

// pdfjs-dist ships its own worker file. In the sandboxed Electron renderer we
// point GlobalWorkerOptions.workerSrc at the bundled worker so PDF.js can spawn
// it without a network fetch (CSP allows worker-src 'self' after the index.html
// update). Vite's ?url import resolves from node_modules and returns a proper
// dev-server or build-time URL (new URL() with a bare specifier would resolve
// relative to the current module and miss node_modules).
if (typeof window !== 'undefined' && workerUrl) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
}

export default function PdfViewer({ src, fileName }: { src: string; fileName: string }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState<PDFPageProxy | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Extract the item id from the imgman://original/<id> URL, then read the bytes
  // via the preload IPC bridge (avoids fetch() CORS issues with the custom scheme
  // in the dev-server origin).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setPdf(null)
    setPage(null)
    setPageNum(1)
    setPageCount(0)

    ;(async () => {
      try {
        const id = src.split('/').pop()
        if (!id) {
          throw new Error('Could not extract item id from src')
        }
        const data = await window.api.items.original(id)
        if (!data || data.length === 0) {
          throw new Error('File not found on disk')
        }
        const loadingTask = pdfjsLib.getDocument({ data })
        const doc = await loadingTask.promise
        if (cancelled) {
          void loadingTask.destroy()
          return
        }
        setPdf(doc)
        setPageCount(doc.numPages)
        setLoading(false)
      } catch (err: unknown) {
        if (!cancelled) {
          console.error('PDF load error:', err)
          setError(err instanceof Error ? err.message : 'Failed to load PDF')
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [src])

  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    setError(null)

    ;(async () => {
      try {
        const p = await pdf.getPage(pageNum)
        if (cancelled) return
        setPage(p)
        const vp = p.getViewport({ scale: 1 })
        void vp // viewport computed on render below
      } catch (err: unknown) {
        if (!cancelled) {
          console.error('PDF page error:', err)
          setError(err instanceof Error ? err.message : 'Failed to load page')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pdf, pageNum])

  useEffect(() => {
    if (!page || !canvasRef.current) {
      setLoading(true)
      return
    }
    setLoading(false)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const renderViewport = page.getViewport({ scale: 1 })
    canvas.width = renderViewport.width
    canvas.height = renderViewport.height

    const renderTask = page.render({
      canvas,
      canvasContext: ctx,
      viewport: renderViewport
    })

    return () => {
      void renderTask.cancel()
    }
  }, [page])

  // Keyboard navigation (ArrowLeft/ArrowRight) — LibraryGate only forwards
  // Space/Escape for quick-preview; this lightbox has its own key handler
  // because it's a focused viewing surface, not a background overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLButtonElement) return // ignore when typing in controls
      if (e.key === 'ArrowLeft' && pageNum > 1) {
        e.preventDefault()
        setPageNum((n) => Math.max(n - 1, 1))
      } else if (e.key === 'ArrowRight' && pageNum < pageCount) {
        e.preventDefault()
        setPageNum((n) => Math.min(n + 1, pageCount))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pageNum, pageCount])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        overflow: 'auto'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {error ? (
        <div style={{ textAlign: 'center', opacity: 0.7 }}>
          <div style={{ marginBottom: 12, fontSize: 13 }}>Error loading PDF</div>
          <div style={{ fontSize: 12, opacity: 0.6, wordBreak: 'break-word' }}>{error}</div>
        </div>
      ) : (
        <>
          {pageCount > 0 && (
            <div
              style={{
                marginBottom: 12,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPageNum((n) => Math.max(n - 1, 1))
                }}
                disabled={pageNum <= 1}
                style={{
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  borderRadius: 4,
                  padding: '4px 12px',
                  cursor: pageNum <= 1 ? 'default' : 'pointer'
                }}
              >
                Prev
              </button>
              <span style={{ fontSize: 12, opacity: 0.8 }}>
                Page {pageNum} of {pageCount}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPageNum((n) => Math.min(n + 1, pageCount))
                }}
                disabled={pageNum >= pageCount}
                style={{
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  borderRadius: 4,
                  padding: '4px 12px',
                  cursor: pageNum >= pageCount ? 'default' : 'pointer'
                }}
              >
                Next
              </button>
            </div>
          )}
          {loading && !page ? (
            <div style={{ fontSize: 13, opacity: 0.6 }}>Rendering page...</div>
          ) : (
            <canvas
              ref={canvasRef}
              style={{
                maxWidth: '100%',
                maxHeight: 'calc(100% - 60px)',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                // Ensure the canvas doesn't capture clicks meant for the buttons below it.
                pointerEvents: 'none'
              }}
            />
          )}
          <div style={{ marginTop: 8, fontSize: 11, opacity: 0.5 }}>{baseName(fileName)}</div>
        </>
      )}
    </div>
  )
}
