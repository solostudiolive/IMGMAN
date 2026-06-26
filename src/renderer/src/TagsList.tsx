import { useState } from 'react'
import type { Tag } from '../../preload/types'
import { TagIcon, ChevronRightIcon } from './components/icons'

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
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: collapsed ? 'none' : 'block' }}>
        {tags.map((tag) => {
          const active = tag.id === selectedTagId
          return (
            <li key={tag.id}>
              <div
                className="nav-row"
                style={{
                  ...ROW_STYLE,
                  paddingLeft: 6,
                  background: active ? 'var(--color-surface-selected)' : 'transparent',
                  color: active ? 'var(--color-accent)' : 'var(--color-text)'
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelect(active ? null : tag.id)}
                  title={tag.name}
                  style={ROW_NAME_STYLE}
                >
                  <TagIcon />
                  <span style={ROW_TEXT_STYLE}>{tag.name}</span>
                </button>
              </div>
            </li>
          )
        })}
      </ul>
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

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--fs-sm)',
  minHeight: 30
}

const ROW_NAME_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  textAlign: 'left',
  background: 'none',
  border: 'none',
  padding: '3px 0',
  cursor: 'pointer',
  color: 'inherit'
}

const ROW_TEXT_STYLE: React.CSSProperties = {
  minWidth: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
}
