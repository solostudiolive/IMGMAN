import { useEffect, useState } from 'react'
import type { FullItem, ItemType } from '../../preload/types'
import TagEditor from './TagEditor'
import FolderAssigner from './FolderAssigner'

// Type glyphs for the preview fallback (mirrors Grid's set).
const TYPE_GLYPH: Record<ItemType, string> = {
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  font: '🔤',
  doc: '📄',
  other: '📦'
}

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

  // Load the full record whenever the selection changes (clear when none).
  useEffect(() => {
    let cancelled = false
    setThumbFailed(false)
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

  if (!selectedId || !item) {
    return (
      <aside style={ASIDE_STYLE}>
        <div style={{ color: '#999', fontSize: 13, padding: 12, textAlign: 'center' }}>
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
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12
        }}
      >
        {showThumb ? (
          <img
            src={`imgman://thumb/${item.id}`}
            onError={() => setThumbFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <span style={{ fontSize: 40 }}>{TYPE_GLYPH[item.type]}</span>
        )}
      </div>

      <h3 style={{ margin: '0 0 10px', fontSize: 14, wordBreak: 'break-word' }}>{item.name}</h3>

      <dl style={{ margin: 0, fontSize: 12, color: '#444' }}>
        <Row label="Type" value={`${item.type}${item.ext ? ` · ${item.ext.toUpperCase()}` : ''}`} />
        <Row label="Dimensions" value={dims} />
        <Row label="Size" value={formatBytes(item.size_bytes)} />
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '4px 0',
            borderTop: '1px solid #f0f0f0',
            alignItems: 'center'
          }}
        >
          <dt style={{ flex: '0 0 84px', color: '#999' }}>Rating</dt>
          <dd style={{ margin: 0, flex: 1 }}>
            <StarRating value={item.rating} onChange={setRating} />
          </dd>
        </div>
        <Row label="Created" value={created} />
        <Row label="Imported" value={imported} />
        <Row label="Source" value={item.source_url} />
        <Row label="Note" value={item.note} />
      </dl>

      <TagEditor itemId={item.id} />
      <FolderAssigner itemId={item.id} />
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
            color: n <= value ? '#f59e0b' : '#d1d5db'
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
    <div style={{ display: 'flex', gap: 8, padding: '4px 0', borderTop: '1px solid #f0f0f0' }}>
      <dt style={{ flex: '0 0 84px', color: '#999' }}>{label}</dt>
      <dd style={{ margin: 0, wordBreak: 'break-word', flex: 1 }}>{value}</dd>
    </div>
  )
}

const ASIDE_STYLE: React.CSSProperties = {
  flex: '0 0 280px',
  width: 280,
  height: '100%',
  overflowY: 'auto',
  padding: 12,
  borderLeft: '1px solid #eee',
  boxSizing: 'border-box'
}
