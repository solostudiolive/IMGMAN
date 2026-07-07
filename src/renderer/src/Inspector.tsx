import { useEffect, useMemo, useState } from 'react'
import type { FullItem } from '../../preload/types'
import TagEditor from './TagEditor'
import FolderAssigner from './FolderAssigner'
import QuickPreview from './QuickPreview'
import { TypeIcon, DownloadIcon } from './components/icons'
import Select from './components/Select'
import { baseName, withExt } from './displayName'

function formatBytes(n: number): string {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  const value = n / Math.pow(1024, i)
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`
}

function formatDate(ms: number | null): string | null {
  if (!ms) return null
  return new Date(ms).toLocaleString()
}

export default function Inspector({
  selectedId,
  onChanged
}: {
  selectedId: string | null
  // Fired after a rename so the grid caption / list refreshes to match.
  onChanged?: () => void
}): React.JSX.Element {
  const [item, setItem] = useState<FullItem | null>(null)
  const [thumbFailed, setThumbFailed] = useState(false)
  // Full-size lightbox toggled by clicking the preview thumbnail.
  const [zoomed, setZoomed] = useState(false)
  // Editable name draft (Eagle-style inline rename). Synced to the loaded item.
  const [nameDraft, setNameDraft] = useState('')
  // Editable Notes + Source URL drafts (Eagle inspector fields).
  const [noteDraft, setNoteDraft] = useState('')
  const [urlDraft, setUrlDraft] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)

  // Load the full record whenever the selection changes (clear when none).
  useEffect(() => {
    let cancelled = false
    setThumbFailed(false)
    setZoomed(false)
    setExportMsg(null)
    if (!selectedId) {
      setItem(null)
      return
    }
    window.api.items.get(selectedId).then((row) => {
      if (!cancelled) {
        setItem(row)
        setNameDraft(row ? baseName(row.name, row.ext) : '')
        setNoteDraft(row?.note ?? '')
        setUrlDraft(row?.source_url ?? '')
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  // Parse the stored palette JSON defensively → array of #rrggbb (empty when none / non-image).
  const colors = useMemo<string[]>(() => {
    try {
      const parsed = JSON.parse(item?.palette ?? '[]')
      return Array.isArray(parsed) ? (parsed as string[]) : []
    } catch {
      return []
    }
  }, [item?.palette])

  // While the lightbox is open, Escape closes it. Capture + stopPropagation so LibraryGate's
  // window-level handler (which owns Space/Escape for its own quick preview) doesn't also fire.
  useEffect(() => {
    if (!zoomed) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setZoomed(false)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [zoomed])

  if (!selectedId || !item) {
    return (
      <aside style={ASIDE_STYLE}>
        <div
          style={{
            color: 'var(--color-text-faint)',
            fontSize: 13,
            padding: 12,
            textAlign: 'center'
          }}
        >
          Select an item to see details.
        </div>
      </aside>
    )
  }

  const showThumb = item.type === 'image' && !thumbFailed
  const dims = item.width && item.height ? `${item.width} × ${item.height}` : null
  const created = formatDate(item.created_at)
  const imported = formatDate(item.imported_at)

  // Optimistically update, persist, then reconcile to the canonical DB row.
  // On failure, revert and surface — never leave a phantom rating that vanishes
  // on the next selection.
  const setRating = async (n: number): Promise<void> => {
    const prev = item.rating
    setItem({ ...item, rating: n })
    try {
      const row = await window.api.items.update(item.id, { rating: n })
      if (row) setItem(row)
      else setItem((cur) => (cur ? { ...cur, rating: prev } : cur))
    } catch (err) {
      console.error('Failed to save rating:', err)
      setItem((cur) => (cur ? { ...cur, rating: prev } : cur))
    }
  }

  // Commit the inline rename. The field edits the base name (no extension); the stored `name`
  // keeps its `.<ext>`. No-op on empty / unchanged; refresh the grid on success.
  const currentBase = baseName(item.name, item.ext)
  const commitName = async (): Promise<void> => {
    const nextBase = nameDraft.trim()
    if (!nextBase || nextBase === currentBase) {
      setNameDraft(currentBase)
      return
    }
    const fullName = withExt(nextBase, item.ext)
    setItem({ ...item, name: fullName })
    try {
      await window.api.items.renameMany([{ id: item.id, name: fullName }])
      onChanged?.()
    } catch (err) {
      console.error('Failed to rename:', err)
      setItem((cur) => (cur ? { ...cur, name: item.name } : cur))
      setNameDraft(currentBase)
    }
  }

  // Persist Notes / Source URL on blur (skip when unchanged). Reconcile to the returned row.
  const commitNote = async (): Promise<void> => {
    if ((item.note ?? '') === noteDraft) return
    const row = await window.api.items.update(item.id, { note: noteDraft })
    if (row) setItem(row)
  }
  const commitUrl = async (): Promise<void> => {
    if ((item.source_url ?? '') === urlDraft) return
    const row = await window.api.items.update(item.id, { source_url: urlDraft })
    if (row) setItem(row)
  }

  const doExport = async (): Promise<void> => {
    setExporting(true)
    setExportMsg(null)
    try {
      const res = await window.api.items.export([item.id])
      if (res.ok) setExportMsg(`Exported ${res.exported} file${res.exported === 1 ? '' : 's'}.`)
      else if (!('cancelled' in res)) setExportMsg(res.error)
    } finally {
      setExporting(false)
    }
  }

  const doConvert = async (format: 'jpg' | 'png' | 'webp' | 'avif'): Promise<void> => {
    setExportMsg(null)
    const res = await window.api.items.convert([item.id], format)
    if (res.ok) setExportMsg(`Converted to ${format.toUpperCase()}.`)
    else if (!('cancelled' in res)) setExportMsg(res.error)
  }

  return (
    <aside style={ASIDE_STYLE}>
      <div
        className={showThumb ? 'inspector-thumb' : undefined}
        onClick={() => showThumb && setZoomed(true)}
        title={showThumb ? 'Click to enlarge' : undefined}
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 8,
          overflow: 'hidden',
          position: 'relative',
          background: 'var(--color-bg-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
          cursor: showThumb ? 'zoom-in' : 'default'
        }}
      >
        {showThumb ? (
          <>
            <img
              className="inspector-thumb__img"
              src={`imgman://thumb/${item.id}`}
              onError={() => setThumbFailed(true)}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            <span className="inspector-thumb__hint" aria-hidden>
              ⤢
            </span>
          </>
        ) : (
          <TypeIcon type={item.type} size={48} style={{ color: 'var(--color-text-faint)' }} />
        )}
        {item.ext && (
          // Eagle-style format badge in the corner of the preview.
          <span className="inspector-badge">{item.ext.toUpperCase()}</span>
        )}
      </div>

      {/* Inline-editable filename (rename). Enter/blur commits, Escape reverts. */}
      <input
        className="inspector-name"
        value={nameDraft}
        onChange={(e) => setNameDraft(e.target.value)}
        onBlur={() => void commitName()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          else if (e.key === 'Escape') {
            setNameDraft(currentBase)
            e.currentTarget.blur()
          }
        }}
        aria-label="File name"
        spellCheck={false}
      />

      <textarea
        className="inspector-note"
        value={noteDraft}
        placeholder="Notes…"
        rows={2}
        onChange={(e) => setNoteDraft(e.target.value)}
        onBlur={() => void commitNote()}
        aria-label="Notes"
      />
      <div className="inspector-url">
        <input
          value={urlDraft}
          placeholder="Source URL…"
          spellCheck={false}
          onChange={(e) => setUrlDraft(e.target.value)}
          onBlur={() => void commitUrl()}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          aria-label="Source URL"
        />
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noreferrer"
            title="Open source"
            className="inspector-url__link"
          >
            ↗
          </a>
        )}
      </div>

      <dl style={{ margin: 0, fontSize: 11, color: 'var(--color-text-muted)' }}>
        <Row label="Type" value={item.type} />
        <Row label="Format" value={item.ext ? item.ext.toUpperCase() : null} />
        <Row label="Dimensions" value={dims} />
        <Row label="Size" value={formatBytes(item.size_bytes)} />
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '4px 0',
            borderTop: '1px solid var(--color-border)',
            alignItems: 'center'
          }}
        >
          <dt style={{ flex: '0 0 84px', color: 'var(--color-text-faint)' }}>Rating</dt>
          <dd style={{ margin: 0, flex: 1 }}>
            <StarRating value={item.rating} onChange={setRating} />
          </dd>
        </div>
        <Row label="Created" value={created} />
        <Row label="Imported" value={imported} />
      </dl>

      {colors.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px 0', fontSize: 12 }}>
          <div style={{ color: 'var(--color-text-faint)', marginBottom: 6 }}>Colors</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {colors.map((color, i) => (
              <span
                key={`${color}-${i}`}
                title={color}
                style={{
                  width: 18,
                  height: 18,
                  // Eagle uses circular color dots.
                  borderRadius: 'var(--radius-pill)',
                  // The swatch background is the literal extracted color (intentional, not a token).
                  background: color,
                  border: '1px solid var(--color-border)'
                }}
              />
            ))}
          </div>
        </div>
      )}

      <FolderAssigner itemId={item.id} />
      <TagEditor itemId={item.id} />

      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          className="inspector-export"
          onClick={() => void doExport()}
          disabled={exporting}
        >
          <DownloadIcon size={15} />
          {exporting ? 'Exporting…' : 'Export'}
        </button>
        {item.type === 'image' && (
          <div style={{ marginTop: 8 }}>
            <Select
              value=""
              placeholder="Convert to…"
              ariaLabel="Convert to format"
              options={[
                { value: 'jpg', label: 'JPG' },
                { value: 'png', label: 'PNG' },
                { value: 'webp', label: 'WEBP' },
                { value: 'avif', label: 'AVIF' }
              ]}
              onChange={(f) => void doConvert(f as 'jpg' | 'png' | 'webp' | 'avif')}
            />
          </div>
        )}
        {exportMsg && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 11,
              color: 'var(--color-text-muted)',
              textAlign: 'center'
            }}
          >
            {exportMsg}
          </p>
        )}
      </div>

      {zoomed && <QuickPreview item={item} onClose={() => setZoomed(false)} />}
    </aside>
  )
}

// Five clickable stars. Click a star to set the rating; click the current
// top star again to clear back to 0.
function StarRating({
  value,
  onChange
}: {
  value: number
  onChange: (n: number) => void
}): React.JSX.Element {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="star-btn"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n === value ? 0 : n)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            // Star-yellow is an intentional fixed affordance color; empty uses a visible muted token
            // (border-strong was near-invisible in dark mode).
            color: n <= value ? '#f5b301' : 'var(--color-text-faint)'
          }}
        >
          {n <= value ? '★' : '☆'}
        </button>
      ))}
    </span>
  )
}

// Omit rows with no value rather than rendering blanks.
function Row({ label, value }: { label: string; value: string | null }): React.JSX.Element | null {
  if (!value) return null
  return (
    <div
      style={{ display: 'flex', gap: 8, padding: '4px 0', borderTop: '1px solid var(--color-border)' }}
    >
      <dt style={{ flex: '0 0 84px', color: 'var(--color-text-faint)' }}>{label}</dt>
      <dd style={{ margin: 0, wordBreak: 'break-word', flex: 1, color: 'var(--color-text)' }}>
        {value}
      </dd>
    </div>
  )
}

const ASIDE_STYLE: React.CSSProperties = {
  // Width/scroll/background/border are owned by the shell inspector pane (AppShell).
  width: '100%',
  padding: 12,
  boxSizing: 'border-box'
}
