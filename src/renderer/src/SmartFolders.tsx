import { useState } from 'react'
import type { SearchCriteria, SmartFolder } from '../../preload/types'
import ContextMenu, { type MenuNode } from './components/ContextMenu'
import { SmartFolderIcon, PencilIcon, TrashIcon } from './components/icons'

// Left-sidebar "Smart Folders" section: saved searches that re-apply their SearchCriteria
// through the existing search scope on click. Presentational — LibraryGate owns the list and
// the create/rename/delete handlers (so the toolbar "Save search" control can refresh it too).
// Mirrors FolderTree's row/inline-rename/ContextMenu patterns and tokens.
export default function SmartFolders({
  folders,
  activeCriteria,
  searchActive,
  onSelect,
  onRename,
  onDelete
}: {
  folders: SmartFolder[]
  activeCriteria: SearchCriteria
  searchActive: boolean
  onSelect: (criteria: SearchCriteria) => void
  onRename: (id: string, name: string) => void
  onDelete: (folder: SmartFolder) => void
}): React.JSX.Element | null {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuNode[] } | null>(null)

  if (folders.length === 0) return null

  // Best-effort structural match: criteria objects are built consistently (SearchBar / saved
  // JSON), so a stringify compare is enough to highlight the applied saved search. Not a
  // normalized deep-equal (key order / undefined-vs-absent could differ).
  const activeKey = searchActive ? JSON.stringify(activeCriteria) : null

  const submitRename = (id: string): void => {
    const name = draft.trim()
    setRenamingId(null)
    setDraft('')
    if (name) onRename(id, name)
  }

  return (
    <nav style={ASIDE_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0 6px' }}>
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-faint)',
            textTransform: 'uppercase',
            letterSpacing: 0.5
          }}
        >
          Smart Folders
        </span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {folders.map((folder) => {
          const active = activeKey !== null && JSON.stringify(folder.criteria) === activeKey
          return (
            <li key={folder.id}>
              {renamingId === folder.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => submitRename(folder.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitRename(folder.id)
                    if (e.key === 'Escape') {
                      setRenamingId(null)
                      setDraft('')
                    }
                  }}
                  style={INPUT_STYLE}
                />
              ) : (
                <div
                  className="nav-row"
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setMenu({
                      x: e.clientX,
                      y: e.clientY,
                      items: [
                        {
                          kind: 'action',
                          label: 'Rename',
                          icon: <PencilIcon />,
                          onSelect: () => {
                            setRenamingId(folder.id)
                            setDraft(folder.name)
                          }
                        },
                        { kind: 'separator' },
                        {
                          kind: 'action',
                          label: 'Delete',
                          icon: <TrashIcon />,
                          danger: true,
                          onSelect: () => onDelete(folder)
                        }
                      ]
                    })
                  }}
                  style={{
                    ...ROW_STYLE,
                    paddingLeft: 6,
                    background: active ? 'var(--color-surface-selected)' : 'transparent',
                    color: active ? 'var(--color-accent)' : 'var(--color-text)'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(folder.criteria)}
                    title={folder.name}
                    style={ROW_NAME_STYLE}
                  >
                    <SmartFolderIcon />
                    <span style={ROW_TEXT_STYLE}>{folder.name}</span>
                  </button>
                  <span style={ROW_ACTIONS_STYLE}>
                    <button
                      type="button"
                      title="Rename"
                      onClick={() => {
                        setRenamingId(folder.id)
                        setDraft(folder.name)
                      }}
                      style={ICON_BTN}
                    >
                      <PencilIcon size={13} />
                    </button>
                    <button type="button" title="Delete" onClick={() => onDelete(folder)} style={ICON_BTN}>
                      <TrashIcon size={13} />
                    </button>
                  </span>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </nav>
  )
}

const ASIDE_STYLE: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box'
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

const ROW_ACTIONS_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  gap: 2,
  flex: '0 0 auto'
}

const ICON_BTN: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '0 2px',
  cursor: 'pointer',
  color: 'var(--color-text-muted)',
  fontSize: 12,
  lineHeight: 1
}

const INPUT_STYLE: React.CSSProperties = {
  width: '90%',
  boxSizing: 'border-box',
  padding: '3px 5px',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 5,
  fontSize: 12
}
