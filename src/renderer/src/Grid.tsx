import { forwardRef, useEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react'
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso'
import { VirtuosoMasonry } from '@virtuoso.dev/masonry'
import type { Item } from '../../preload/types'
import type { ViewMode } from './hooks/useGridView'
import { useElementWidth } from './hooks/useElementWidth'
import './Grid.css'

const GAP = 10

// VirtuosoGrid mounts only visible (+ overscan) cells. The List component is
// the scroll content — a responsive CSS grid; Item is a plain cell wrapper.
// Column width is driven by the `--imgman-thumb` custom property set on the
// VirtuosoGrid wrapper, so changing the thumbnail size reflows columns without
// recreating this component (which would remount the scroller).
const List = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ style, children, ...props }, ref) => (
    <div
      ref={ref}
      {...props}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(var(--imgman-thumb, 140px), 1fr))',
        gap: GAP,
        padding: 4,
        ...style
      }}
    >
      {children}
    </div>
  )
)
List.displayName = 'GridList'

const ItemContainer = ({ children, ...props }: ComponentPropsWithoutRef<'div'>) => (
  <div {...props}>{children}</div>
)

export default function Grid({
  items,
  selectedId,
  thumbSize,
  viewMode,
  onSelect
}: {
  items: Item[]
  selectedId: string | null
  thumbSize: number
  viewMode: ViewMode
  onSelect: (id: string) => void
}) {
  if (items.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-faint)',
          textAlign: 'center'
        }}
      >
        No items yet — drag files in, paste an image, or import a folder.
      </div>
    )
  }

  if (viewMode === 'masonry') {
    return <Masonry items={items} selectedId={selectedId} thumbSize={thumbSize} onSelect={onSelect} />
  }

  if (viewMode === 'list') {
    // The size slider scales the row thumbnail (and thus row height) within a list-friendly range.
    const rowThumb = Math.round(Math.min(80, Math.max(32, thumbSize * 0.4)))
    return (
      <Virtuoso
        style={{ height: '100%' }}
        data={items}
        itemContent={(_index, item) => (
          <ListRow
            item={item}
            selected={item.id === selectedId}
            rowThumb={rowThumb}
            onSelect={onSelect}
          />
        )}
      />
    )
  }

  return (
    <VirtuosoGrid
      style={{ height: '100%', ['--imgman-thumb' as string]: `${thumbSize}px` }}
      data={items}
      components={{ List, Item: ItemContainer }}
      itemContent={(_index, item) => (
        <Cell item={item} selected={item.id === selectedId} layout="grid" onSelect={onSelect} />
      )}
    />
  )
}

// Masonry: a virtualized waterfall where each tile keeps the item's natural aspect
// ratio. Column count is derived from the measured container width and the current
// thumbnail size; VirtuosoMasonry distributes items shortest-column-first.
type MasonryContext = { selectedId: string | null; onSelect: (id: string) => void }

function Masonry({
  items,
  selectedId,
  thumbSize,
  onSelect
}: {
  items: Item[]
  selectedId: string | null
  thumbSize: number
  onSelect: (id: string) => void
}) {
  const [ref, width] = useElementWidth()
  const columnCount = Math.max(1, Math.floor((width + GAP) / (thumbSize + GAP)))

  return (
    <div ref={ref} style={{ height: '100%' }}>
      {width > 0 && (
        <VirtuosoMasonry
          key={columnCount}
          style={{ height: '100%' }}
          columnCount={columnCount}
          data={items}
          context={{ selectedId, onSelect }}
          ItemContent={MasonryItem}
        />
      )}
    </div>
  )
}

function MasonryItem({
  data,
  context
}: {
  data: Item
  index: number
  context: MasonryContext
}) {
  return (
    <div style={{ padding: GAP / 2 }}>
      <Cell
        item={data}
        selected={data.id === context.selectedId}
        layout="masonry"
        onSelect={context.onSelect}
      />
    </div>
  )
}

// One details-list row: small thumbnail + name + type/format + dimensions + size + rating.
// Read-only (selection only); used by the virtualized Virtuoso list.
function ListRow({
  item,
  selected,
  rowThumb,
  onSelect
}: {
  item: Item
  selected: boolean
  rowThumb: number
  onSelect: (id: string) => void
}) {
  const [failed, setFailed] = useState(false)
  const showThumb = item.type === 'image' && !failed
  const dims = item.width && item.height ? `${item.width}×${item.height}` : '—'
  const type = item.ext ? `${item.type} · ${item.ext}` : item.type

  return (
    <button
      className={`list-row${selected ? ' list-row--selected' : ''}`}
      onClick={() => onSelect(item.id)}
      title={item.name}
    >
      <div className="list-row__thumb" style={{ width: rowThumb, height: rowThumb }}>
        {showThumb ? (
          <img src={`imgman://thumb/${item.id}`} loading="lazy" onError={() => setFailed(true)} />
        ) : (
          <Placeholder item={item} />
        )}
      </div>
      <span className="list-row__name">{item.name}</span>
      <span className="list-row__meta list-row__type">{type}</span>
      <span className="list-row__meta list-row__dims">{dims}</span>
      <span className="list-row__meta list-row__size">{formatBytes(item.size_bytes)}</span>
      <span className={`list-row__meta list-row__rating${item.rating ? '' : ' list-row__rating--empty'}`}>
        {item.rating ? '★'.repeat(item.rating) : '—'}
      </span>
    </button>
  )
}

// Human-readable byte size: B / KB / MB / GB, 0–1 decimals.
function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** i
  return `${i === 0 ? value : value.toFixed(value >= 10 || value % 1 === 0 ? 0 : 1)} ${units[i]}`
}

function Cell({
  item,
  selected,
  layout,
  onSelect
}: {
  item: Item
  selected: boolean
  layout: 'grid' | 'masonry'
  onSelect: (id: string) => void
}) {
  const [failed, setFailed] = useState(false)
  const [preview, setPreview] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showThumb = item.type === 'image' && !failed
  // Grid tiles are uniform squares; masonry tiles take the item's natural ratio
  // (square fallback when dimensions are unknown, e.g. non-images).
  const aspectRatio =
    layout === 'masonry' && item.width && item.height ? `${item.width} / ${item.height}` : '1 / 1'

  // Hover preview: GIFs animate, videos play inline (muted, looping). A short hover-intent
  // delay keeps fast sweeps / scrolling from loading originals.
  const isGif = item.type === 'image' && /(^|\.)gif$/i.test(item.ext)
  const isVideo = item.type === 'video'
  const canPreview = isGif || isVideo

  const clearHover = (): void => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }
  useEffect(() => clearHover, [])

  const onEnter = (): void => {
    if (!canPreview) return
    clearHover()
    hoverTimer.current = setTimeout(() => setPreview(true), 180)
  }
  const onLeave = (): void => {
    clearHover()
    setPreview(false)
  }

  const mediaStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' }

  return (
    <button
      onClick={() => onSelect(item.id)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      title={item.name}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: 4,
        width: '100%',
        background: 'none',
        border: `2px solid ${selected ? 'var(--color-accent)' : 'transparent'}`,
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'center'
      }}
    >
      <div
        style={{
          width: '100%',
          aspectRatio,
          borderRadius: 6,
          overflow: 'hidden',
          background: selected ? 'var(--color-surface-selected)' : 'var(--color-bg-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {preview && isVideo ? (
          <video src={`imgman://original/${item.id}`} muted loop autoPlay playsInline style={mediaStyle} />
        ) : preview && isGif ? (
          <img src={`imgman://original/${item.id}`} style={mediaStyle} />
        ) : showThumb ? (
          <img
            src={`imgman://thumb/${item.id}`}
            loading="lazy"
            onError={() => setFailed(true)}
            style={mediaStyle}
          />
        ) : (
          <Placeholder item={item} />
        )}
      </div>
      <span
        style={{
          fontSize: 11,
          color: 'var(--color-text-muted)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%'
        }}
      >
        {item.name}
      </span>
    </button>
  )
}

function Placeholder({ item }: { item: Item }) {
  const label = (item.ext || item.type).toUpperCase()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--color-text-faint)' }}>
      <span style={{ fontSize: 22 }}>{TYPE_GLYPH[item.type]}</span>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>{label}</span>
    </div>
  )
}

const TYPE_GLYPH: Record<Item['type'], string> = {
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  font: '🔤',
  doc: '📄',
  other: '📦'
}
