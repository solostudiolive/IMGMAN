import { useEffect, useMemo, useState } from 'react'
import type { FullItem } from '../../preload/types'
import TagEditor from './TagEditor'
import FolderAssigner from './FolderAssigner'
import QuickPreview from './QuickPreview'
import { TypeIcon } from './components/icons'

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

export default function Inspector({ selectedId }: { selectedId: string | null }): React.JSX.Element {
  const [item, setItem] = useState<FullItem | null>(null)
  const [thumbFailed, setThumbFailed] = useState(false)
  // Full-size lightbox toggled by clicking the preview thumbnail.
  const [zoomed, setZoomed] = useState(false)

  // Load the full record whenever the selection changes (clear when none).
  useEffect(() => {
    let cancelled = false
    setThumbFailed(false)
    setZoomed(false)
    if (!selectedId) {
      setItem(null)
      return
    }
    window.api.items.get(selectedId).then((row) => {
      if (!cancelled) setItem(row)
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
      </div>

      <h3
        style={{
          margin: '0 0 10px',
          fontSize: 14,
          wordBreak: 'break-word',
          color: 'var(--color-text)'
        }}
      >
        {item.name}
      </h3>

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
        <Row label="Source" value={item.source_url} />
        <Row label="Note" value={item.note} />
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
                  borderRadius: 'var(--radius-sm, 4px)',
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
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n === value ? 0 : n)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            // Star-yellow is an intentional fixed affordance color; empty uses a token.
            color: n <= value ? '#f5b301' : 'var(--color-border-strong)'
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
