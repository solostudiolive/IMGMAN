import { useState } from 'react'
import type { Tag } from '../../preload/types'
import { ChevronRightIcon } from './components/icons'

// Left-sidebar "Tags" section: lists every tag in the library and filters the grid to items
// carrying that tag on click (via SearchCriteria.tagIds, the same search scope folders/saved
// searches use). Presentational — LibraryGate owns the list + selection state. Clicking the
// already-selected tag clears the filter. Mirrors FolderTree / SmartFolders row styling.
export default function TagsList({
  tags,
  selectedTagId,
  onSelect
}: {
  tags: Tag[]
  // The single tag currently driving the grid filter (null when not tag-filtering).
  selectedTagId: string | null
  // Toggle a tag filter: pass the id to apply, or null to clear.
  onSelect: (tagId: string | null) => void
}): React.JSX.Element | null {
  // Collapse/expand the whole Tags section (header acts as the toggle).
  const [collapsed, setCollapsed] = useState(false)

  if (tags.length === 0) return null

  return (
    <nav style={ASIDE_STYLE}>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        title={collapsed ? 'Show tags' : 'Hide tags'}
        style={HEADER_STYLE}
      >
        <ChevronRightIcon
          size={11}
          style={{
            color: 'var(--color-text-faint)',
            transform: collapsed ? 'none' : 'rotate(90deg)',
            transition: 'transform var(--dur-fast) var(--ease-out)'
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-faint)',
            textTransform: 'uppercase',
            letterSpacing: 0.5
          }}
        >
          Tags ({tags.length})
        </span>
      </button>
      <div style={{ ...CLOUD_STYLE, display: collapsed ? 'none' : 'flex' }}>
        {tags.map((tag) => {
          const active = tag.id === selectedTagId
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onSelect(active ? null : tag.id)}
              title={tag.name}
              className="tag-chip"
              style={{
                ...CHIP_STYLE,
                // Non-active fill + hover come from CSS (.tag-chip); active accent is inline so it wins.
                background: active ? 'var(--color-accent)' : undefined,
                color: active ? 'var(--color-accent-contrast)' : 'var(--color-text)'
              }}
            >
              <span style={ROW_TEXT_STYLE}>{tag.name}</span>
              {tag.count != null && (
                <span
                  style={{
                    ...COUNT_STYLE,
                    color: active ? 'var(--color-accent-contrast)' : 'var(--color-text-faint)'
                  }}
                >
                  {tag.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

const ASIDE_STYLE: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box'
}

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  width: '100%',
  margin: '10px 0 6px',
  padding: 0,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left'
}

// Tags flow as a wrapping chip cloud (no icons), like a "popular tags" widget.
const CLOUD_STYLE: React.CSSProperties = {
  flexWrap: 'wrap',
  gap: 6,
  padding: '2px 0 4px'
}

// Each tag renders as a solid filled pill button (uppercase label + count) that hugs its content.
const CHIP_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  maxWidth: '100%',
  minWidth: 0,
  padding: '4px 10px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-pill)',
  cursor: 'pointer',
  textAlign: 'left'
}

const ROW_TEXT_STYLE: React.CSSProperties = {
  minWidth: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: 10,
  fontWeight: 'var(--fw-medium)',
  textTransform: 'uppercase',
  letterSpacing: 0.5
}

// Item count, de-emphasized next to the tag name.
const COUNT_STYLE: React.CSSProperties = {
  flex: '0 0 auto',
  fontSize: 10,
  fontVariantNumeric: 'tabular-nums'
}
