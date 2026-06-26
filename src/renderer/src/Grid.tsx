import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentPropsWithoutRef
} from 'react'
import {
  Virtuoso,
  VirtuosoGrid,
  type VirtuosoHandle,
  type VirtuosoGridHandle
} from 'react-virtuoso'
import { VirtuosoMasonry } from '@virtuoso.dev/masonry'
import type { Item } from '../../preload/types'
import type { ViewMode } from './hooks/useGridView'
import type { SelectMods } from './hooks/useSelection'
import { useElementWidth } from './hooks/useElementWidth'
import { TypeIcon } from './components/icons'
import './Grid.css'

// Imperative handle the container (LibraryGate) uses to scroll the keyboard-active item
// into view. Masonry has no scroll handle, so scrollToId is a no-op there.
export type GridHandle = { scrollToId: (id: string) => void }

const modsFrom = (e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): SelectMods => ({
  ctrl: e.ctrlKey || e.metaKey,
  shift: e.shiftKey
})

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

export interface GridProps {
  items: Item[]
  selectedIds: Set<string>
  thumbSize: number
  viewMode: ViewMode
  onSelect: (id: string, mods: SelectMods) => void
  onColumns?: (cols: number) => void
  // Rubber-band marquee: a drag over empty space selects intersecting cells (additive with
  // Shift/Ctrl); a plain background press (no drag) is a background click.
  onMarqueeSelect?: (ids: string[], additive: boolean) => void
  onBackgroundClick?: () => void
  // Right-click on a cell → report the item id + cursor point for a context menu (07-04).
  onItemContextMenu?: (id: string, x: number, y: number) => void
}

const Grid = forwardRef<GridHandle, GridProps>(function Grid(
  {
    items,
    selectedIds,
    thumbSize,
    viewMode,
    onSelect,
    onColumns,
    onMarqueeSelect,
    onBackgroundClick,
    onItemContextMenu
  },
  ref
) {
  // Measure the container so keyboard nav knows the column count in every mode.
  const [wrapRef, width] = useElementWidth()
  const listRef = useRef<VirtuosoHandle>(null)
  const gridRef = useRef<VirtuosoGridHandle>(null)

  const columns =
    viewMode === 'list' ? 1 : Math.max(1, Math.floor((width + GAP) / (thumbSize + GAP)))

  useEffect(() => {
    onColumns?.(columns)
  }, [columns, onColumns])

  useImperativeHandle(
    ref,
    () => ({
      scrollToId: (id: string): void => {
        const index = items.findIndex((it) => it.id === id)
        if (index < 0) return
        if (viewMode === 'list') listRef.current?.scrollToIndex({ index })
        else if (viewMode === 'grid') gridRef.current?.scrollToIndex({ index })
        // masonry: no scroll handle — no-op
      }
    }),
    [items, viewMode]
  )

  // Rubber-band marquee. A left-button press on EMPTY space (not on a [data-item-id] cell)
  // starts a drag; once it crosses a small threshold we draw a rectangle and select every
  // mounted cell it intersects (additive when Shift/Ctrl/Cmd is held). A press that never
  // crosses the threshold is a plain background click → onBackgroundClick. Hit-testing uses
  // CLIENT-coord getBoundingClientRect(); the overlay is positioned relative to the wrapper.
  // Only on-screen (mounted) cells can be caught, and there is no auto-scroll during the drag.
  const [marquee, setMarquee] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)

  const onWrapperMouseDown = (e: React.MouseEvent): void => {
    if (e.button !== 0) return
    const el = wrapRef.current
    if (!el) return
    // A press on a cell (or any of its children) is a click/selection, not a marquee.
    if ((e.target as HTMLElement).closest('[data-item-id]')) return

    const startX = e.clientX
    const startY = e.clientY
    const additive = e.shiftKey || e.ctrlKey || e.metaKey
    let dragging = false

    const hitTest = (l: number, t: number, r: number, b: number): string[] => {
      const ids: string[] = []
      el.querySelectorAll<HTMLElement>('[data-item-id]').forEach((node) => {
        const box = node.getBoundingClientRect()
        if (box.left < r && box.right > l && box.top < b && box.bottom > t) {
          const id = node.getAttribute('data-item-id')
          if (id) ids.push(id)
        }
      })
      return ids
    }

    const onMove = (ev: MouseEvent): void => {
      const l = Math.min(startX, ev.clientX)
      const t = Math.min(startY, ev.clientY)
      const r = Math.max(startX, ev.clientX)
      const b = Math.max(startY, ev.clientY)
      if (!dragging && Math.max(r - l, b - t) < 4) return // below threshold → not a drag yet
      dragging = true
      const wrap = el.getBoundingClientRect()
      setMarquee({ left: l - wrap.left, top: t - wrap.top, width: r - l, height: b - t })
      onMarqueeSelect?.(hitTest(l, t, r, b), additive)
    }

    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!dragging) onBackgroundClick?.()
      setMarquee(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  let content: React.JSX.Element
  if (items.length === 0) {
    content = (
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
  } else if (viewMode === 'masonry') {
    content = (
      <Masonry
        items={items}
        selectedIds={selectedIds}
        thumbSize={thumbSize}
        onSelect={onSelect}
        onItemContextMenu={onItemContextMenu}
      />
    )
  } else if (viewMode === 'list') {
    // The size slider scales the row thumbnail (and thus row height) within a list-friendly range.
    const rowThumb = Math.round(Math.min(80, Math.max(32, thumbSize * 0.4)))
    content = (
      <Virtuoso
        ref={listRef}
        style={{ height: '100%' }}
        data={items}
        itemContent={(_index, item) => (
          <ListRow
            item={item}
            selected={selectedIds.has(item.id)}
            rowThumb={rowThumb}
            onSelect={onSelect}
            onItemContextMenu={onItemContextMenu}
          />
        )}
      />
    )
  } else {
    content = (
      <VirtuosoGrid
        ref={gridRef}
        style={{ height: '100%', ['--imgman-thumb' as string]: `${thumbSize}px` }}
        data={items}
        components={{ List, Item: ItemContainer }}
        itemContent={(_index, item) => (
          <Cell
            item={item}
            selected={selectedIds.has(item.id)}
            layout="grid"
            onSelect={onSelect}
            onItemContextMenu={onItemContextMenu}
          />
        )}
      />
    )
  }

  return (
    <div
      ref={wrapRef}
      style={{ height: '100%', position: 'relative' }}
      onMouseDown={onWrapperMouseDown}
    >
      {content}
      {marquee && (
        <div
          className="marquee"
          style={{
            left: marquee.left,
            top: marquee.top,
            width: marquee.width,
            height: marquee.height
          }}
        />
      )}
    </div>
  )
})

export default Grid

// Masonry: a virtualized waterfall where each tile keeps the item's natural aspect
// ratio. Column count is derived from the measured container width and the current
// thumbnail size; VirtuosoMasonry distributes items shortest-column-first.
type MasonryContext = {
  selectedIds: Set<string>
  onSelect: (id: string, mods: SelectMods) => void
  onItemContextMenu?: (id: string, x: number, y: number) => void
}

function Masonry({
  items,
  selectedIds,
  thumbSize,
  onSelect,
  onItemContextMenu
}: {
  items: Item[]
  selectedIds: Set<string>
  thumbSize: number
  onSelect: (id: string, mods: SelectMods) => void
  onItemContextMenu?: (id: string, x: number, y: number) => void
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
          context={{ selectedIds, onSelect, onItemContextMenu }}
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
        selected={context.selectedIds.has(data.id)}
        layout="masonry"
        onSelect={context.onSelect}
        onItemContextMenu={context.onItemContextMenu}
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
  onSelect,
  onItemContextMenu
}: {
  item: Item
  selected: boolean
  rowThumb: number
  onSelect: (id: string, mods: SelectMods) => void
  onItemContextMenu?: (id: string, x: number, y: number) => void
}) {
  const [failed, setFailed] = useState(false)
  const showThumb = item.type === 'image' && !failed
  const dims = item.width && item.height ? `${item.width}×${item.height}` : '—'
  const type = item.ext ? `${item.type} · ${item.ext}` : item.type

  return (
    <button
      className={`list-row${selected ? ' list-row--selected' : ''}`}
      data-item-id={item.id}
      onClick={(e) => onSelect(item.id, modsFrom(e))}
      onContextMenu={(e) => {
        e.preventDefault()
        onItemContextMenu?.(item.id, e.clientX, e.clientY)
      }}
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
  onSelect,
  onItemContextMenu
}: {
  item: Item
  selected: boolean
  layout: 'grid' | 'masonry'
  onSelect: (id: string, mods: SelectMods) => void
  onItemContextMenu?: (id: string, x: number, y: number) => void
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
      data-item-id={item.id}
      onClick={(e) => onSelect(item.id, modsFrom(e))}
      onContextMenu={(e) => {
        e.preventDefault()
        onItemContextMenu?.(item.id, e.clientX, e.clientY)
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      title={item.name}
      className={`grid-cell${selected ? ' grid-cell--selected' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        padding: 4,
        width: '100%',
        background: 'none',
        cursor: 'pointer',
        textAlign: 'center'
      }}
    >
      <div
        style={{
          width: '100%',
          aspectRatio,
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          background: 'var(--color-bg-elevated)',
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
          // Eagle highlights the selected filename with a blue pill; others are muted.
          color: selected ? 'var(--color-accent-contrast)' : 'var(--color-text-muted)',
          background: selected ? 'var(--color-accent)' : 'transparent',
          borderRadius: 'var(--radius-sm)',
          padding: '1px 6px',
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--color-text-faint)' }}>
      <TypeIcon type={item.type} size={28} />
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>{label}</span>
    </div>
  )
}
