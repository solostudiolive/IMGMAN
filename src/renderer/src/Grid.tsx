import { forwardRef, useState, type ComponentPropsWithoutRef } from 'react'
import { VirtuosoGrid } from 'react-virtuoso'
import type { Item } from '../../preload/types'

// VirtuosoGrid mounts only visible (+ overscan) cells. The List component is
// the scroll content — a responsive CSS grid; Item is a plain cell wrapper.
const List = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ style, children, ...props }, ref) => (
    <div
      ref={ref}
      {...props}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 10,
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
  onSelect
}: {
  items: Item[]
  selectedId: string | null
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

  return (
    <VirtuosoGrid
      style={{ height: '100%' }}
      data={items}
      components={{ List, Item: ItemContainer }}
      itemContent={(_index, item) => (
        <Cell item={item} selected={item.id === selectedId} onSelect={onSelect} />
      )}
    />
  )
}

function Cell({
  item,
  selected,
  onSelect
}: {
  item: Item
  selected: boolean
  onSelect: (id: string) => void
}) {
  const [failed, setFailed] = useState(false)
  const showThumb = item.type === 'image' && !failed

  return (
    <button
      onClick={() => onSelect(item.id)}
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
          aspectRatio: '1 / 1',
          borderRadius: 6,
          overflow: 'hidden',
          background: selected ? 'var(--color-surface-selected)' : 'var(--color-bg-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {showThumb ? (
          <img
            src={`imgman://thumb/${item.id}`}
            loading="lazy"
            onError={() => setFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
