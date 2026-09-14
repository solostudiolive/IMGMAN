import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api'
import type { PageViewport } from 'pdfjs-dist/types/src/display/page_viewport'
import { baseName } from '../displayName'

// pdfjs-dist ships its own worker file. In the sandboxed Electron renderer we
// point GlobalWorkerOptions.workerSrc at the bundled worker so PDF.js can spawn
// it without a network fetch (CSP allows worker-src 'self' after the index.html
// update). This matches how the main-process mediaThumbnail.ts initializes the
// library, just with a real worker instead of null (the renderer has a DOM).
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href
}

export default function PdfViewer({ src, fileName }: { src: string; fileName: string }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState<PDFPageProxy | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load the PDF document once. We can't pass an `imgman://` URL directly to
  // getDocument — PDF.js rejects non-standard protocols (only http/https/ftp are
  // valid). Instead we fetch the bytes via the protocol handler and pass a
  // Uint8Array as `data`, mirroring the main-process mediaThumbnail.ts pattern.
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
        const response = await fetch(src)
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
        }
        const arrayBuffer = await response.arrayBuffer()
        const data = new Uint8Array(arrayBuffer)

        // getDocument with inline data never touches the network / worker fetch.
        const loadingTask = pdfjsLib.getDocument({ data })
        const doc = await loadingTask.promise
        if (cancelled) {
          void loadingTask.destroy()
          return
        }
        setPdf(doc)
        setPageCount(doc.numPages)
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

  // When the document loads, fetch the current page and read its viewport.
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
        setViewport({ width: Math.round(vp.width), height: Math.round(vp.height) })
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

  // Render the current page to the canvas whenever the page or viewport changes.
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

    // Clean up any ongoing render on unmount / page change.
    return () => {
      void renderTask.cancel()
    }
  }, [page])

  const prevPage = (): void => setPageNum((n) => Math.max(n - 1, 1))
  const nextPage = (): void => setPageNum((n) => Math.min(n + 1, pageCount))

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
                onClick={prevPage}
                disabled={pageNum <= 1}
                style={{
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  borderRadius: 4,
                  padding: '2px 10px',
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
                onClick={nextPage}
                disabled={pageNum >= pageCount}
                style={{
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  borderRadius: 4,
                  padding: '2px 10px',
                  cursor: pageNum >= pageCount ? 'default' : 'pointer'
                }}
              >
                Next
              </button>
            </div>
          )}
          {loading && !page ? (
            <div style={{ fontSize: 13, opacity: 0.6 }}>Rendering page…</div>
          ) : (
            <canvas
              ref={canvasRef}
              style={{
                maxWidth: '100%',
                maxHeight: 'calc(100% - 40px)',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain'
              }}
            />
          )}
          <div style={{ marginTop: 12, fontSize: 11, opacity: 0.5 }}>{baseName(fileName)}</div>
        </>
      )}
    </div>
  )
}
