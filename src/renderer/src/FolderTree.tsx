import { useEffect, useState } from 'react'
import type { Folder } from '../../preload/types'
import ContextMenu, { type MenuNode } from './components/ContextMenu'
import {
  FolderIcon,
  AllItemsIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChevronRightIcon,
  MoreIcon
} from './components/icons'
import { folderColor } from './folderColor'

// Right-aligned muted count badge shown on scope / folder rows (hidden when 0).
function Count({ n }: { n: number }): React.JSX.Element | null {
  if (!n) return null
  return (
    <span className="nav-row__count" style={COUNT_STYLE}>
      {n}
    </span>
  )
}

// Left-sidebar folder tree: an "All items" root plus the nested folders, with inline
// create / rename / delete, per-row item counts, and colored folder icons.
export default function FolderTree({
  selectedFolderId,
  onSelectFolder,
  onFoldersChanged,
  folderCounts = {},
  allCount = 0
}: {
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
  onFoldersChanged?: () => void
  folderCounts?: Record<string, number>
  allCount?: number
}): React.JSX.Element {
  const [folders, setFolders] = useState<Folder[]>([])
  // Inline-input state: the parent under which we're adding (string id, or null
  // for a root). `undefined` = not adding. renamingId = the folder being renamed.
  const [addingParent, setAddingParent] = useState<string | null | undefined>(undefined)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  // Open right-click / kebab folder menu (null = closed).
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuNode[] } | null>(null)
  // Folder ids whose children are currently expanded (collapsed by default — open on toggle).
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false
    window.api.folders.list().then((list) => {
      if (!cancelled) setFolders(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Apply a returned folder list and let the container react (e.g. reload items).
  const commit = (next: Folder[]): void => {
    setFolders(next)
    onFoldersChanged?.()
  }

  // The id + all its ancestors — the branch that must stay open to reveal a folder.
  const branchOf = (id: string): Set<string> => {
    const out = new Set<string>()
    let cur: Folder | undefined = folders.find((f) => f.id === id)
    while (cur) {
      out.add(cur.id)
      cur = cur.parent_id ? folders.find((f) => f.id === cur!.parent_id) : undefined
    }
    return out
  }

  // Accordion: opening a folder keeps only its branch open, collapsing every other branch.
  const expandFolder = (id: string): void => setExpanded((prev) => (prev.has(id) ? prev : branchOf(id)))

  const toggleExpand = (id: string): void =>
    setExpanded((prev) => {
      if (prev.has(id)) {
        const next = new Set(prev)
        next.delete(id)
        return next
      }
      return branchOf(id)
    })

  // Selecting a folder collapses every other branch (accordion), opening only the selected one's
  // path. Selecting "All items" (null) collapses everything.
  const handleSelect = (id: string | null): void => {
    onSelectFolder(id)
    setExpanded(id ? branchOf(id) : new Set())
  }

  const startAdd = (parentId: string | null): void => {
    setAddingParent(parentId)
    setRenamingId(null)
    setDraft('')
    // Expand the parent so the inline add-input is visible under it.
    if (parentId) expandFolder(parentId)
  }

  const beginRename = (folder: Folder): void => {
    setRenamingId(folder.id)
    setAddingParent(undefined)
    setDraft(folder.name)
  }

  // Shared Add / Edit / Delete actions for the row kebab and the right-click menu.
  const folderMenuItems = (folder: Folder): MenuNode[] => [
    { kind: 'action', label: 'Add subfolder', icon: <PlusIcon />, onSelect: () => startAdd(folder.id) },
    { kind: 'action', label: 'Edit', icon: <PencilIcon />, onSelect: () => beginRename(folder) },
    { kind: 'separator' },
    { kind: 'action', label: 'Delete', icon: <TrashIcon />, danger: true, onSelect: () => void remove(folder) }
  ]

  const submitAdd = async (): Promise<void> => {
    const name = draft.trim()
    const parentId = addingParent === undefined ? null : addingParent
    setAddingParent(undefined)
    setDraft('')
    if (!name) return
    commit(await window.api.folders.create(name, parentId))
  }

  const submitRename = async (id: string): Promise<void> => {
    const name = draft.trim()
    setRenamingId(null)
    setDraft('')
    if (!name) return
    commit(await window.api.folders.rename(id, name))
  }

  const remove = async (folder: Folder): Promise<void> => {
    if (!window.confirm(`Delete "${folder.name}" and its subfolders? Items are not deleted.`)) {
      return
    }
    const next = await window.api.folders.delete(folder.id)
    // If the deleted folder (or a descendant) was selected, fall back to All items.
    if (selectedFolderId && !next.some((f) => f.id === selectedFolderId)) onSelectFolder(null)
    commit(next)
  }

  // Group children by parent for recursive rendering.
  const childrenOf = (parentId: string | null): Folder[] =>
    folders
      .filter((f) => f.parent_id === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))

  const renderRows = (parentId: string | null, depth: number): React.JSX.Element[] => {
    const rows: React.JSX.Element[] = []
    for (const folder of childrenOf(parentId)) {
      const selected = folder.id === selectedFolderId
      const hasChildren = folders.some((f) => f.parent_id === folder.id)
      const isOpen = expanded.has(folder.id)
      rows.push(
        <li key={folder.id}>
          {renamingId === folder.id ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => submitRename(folder.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitRename(folder.id)
                if (e.key === 'Escape') {
                  setRenamingId(null)
                  setDraft('')
                }
              }}
              style={{ ...INPUT_STYLE, marginLeft: depth * 18 }}
            />
          ) : (
            <div
              className="nav-row"
              onContextMenu={(e) => {
                e.preventDefault()
                setMenu({ x: e.clientX, y: e.clientY, items: folderMenuItems(folder) })
              }}
              style={{
                ...ROW_STYLE,
                paddingLeft: 6 + depth * 18,
                background: selected ? 'var(--color-surface-selected)' : 'transparent',
                color: selected ? 'var(--color-accent)' : 'var(--color-text)'
              }}
            >
              {/* Icon column: folder icon by default; on row-hover it swaps to the chevron toggle
                  (only for folders that have children). No separate chevron lane → icons align. */}
              <span
                className={`nav-row__glyph${hasChildren ? ' nav-row__glyph--expandable' : ''}`}
              >
                <span className="glyph-icon" style={{ display: 'inline-flex', color: folderColor(folder.id) }}>
                  <FolderIcon />
                </span>
                {hasChildren && (
                  <button
                    type="button"
                    className="glyph-toggle"
                    title={isOpen ? 'Collapse' : 'Expand'}
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                    aria-expanded={isOpen}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpand(folder.id)
                    }}
                  >
                    <ChevronRightIcon
                      size={12}
                      style={{
                        transform: isOpen ? 'rotate(90deg)' : 'none',
                        transition: 'transform var(--dur-fast) var(--ease-out)'
                      }}
                    />
                  </button>
                )}
              </span>
              <button
                type="button"
                onClick={() => handleSelect(folder.id)}
                title={folder.name}
                style={ROW_NAME_STYLE}
              >
                <span style={ROW_TEXT_STYLE}>{folder.name}</span>
              </button>
              <Count n={folderCounts[folder.id] ?? 0} />
              <span className="nav-row__actions" style={ROW_ACTIONS_STYLE}>
                <button
                  type="button"
                  title="More"
                  aria-label="Folder actions"
                  aria-haspopup="menu"
                  onClick={(e) => {
                    e.stopPropagation()
                    const r = e.currentTarget.getBoundingClientRect()
                    setMenu({ x: r.left, y: r.bottom + 4, items: folderMenuItems(folder) })
                  }}
                  style={ICON_BTN}
                >
                  <MoreIcon size={15} />
                </button>
              </span>
            </div>
          )}
          {/* Children + inline add-input live in an animatable wrapper (always mounted so both
              expand AND collapse animate via the grid-rows 0fr↔1fr transition). */}
          {(hasChildren || addingParent === folder.id) && (
            <div
              className={`folder-children${isOpen || addingParent === folder.id ? ' folder-children--open' : ''}`}
            >
              <ul className="folder-children__inner">
                {renderRows(folder.id, depth + 1)}
                {addingParent === folder.id && renderAddInput(folder.id, depth + 1)}
              </ul>
            </div>
          )}
        </li>
      )
    }
    return rows
  }

  const renderAddInput = (parentId: string | null, depth: number): React.JSX.Element => (
    <li key={`add-${parentId ?? 'root'}`}>
      <input
        autoFocus
        value={draft}
        placeholder="Folder name"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => submitAdd()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submitAdd()
          if (e.key === 'Escape') {
            setAddingParent(undefined)
            setDraft('')
          }
        }}
        style={{ ...INPUT_STYLE, marginLeft: depth * 18 }}
      />
    </li>
  )

  return (
    <nav style={ASIDE_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-faint)',
            textTransform: 'uppercase',
            letterSpacing: 0.5
          }}
        >
          Folders{folders.length ? ` (${folders.filter((f) => f.parent_id === null).length})` : ''}
        </span>
        <button type="button" title="New folder" onClick={() => startAdd(null)} style={{ ...ICON_BTN, marginLeft: 'auto' }}>
          <PlusIcon size={14} />
        </button>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        <li>
          <div
            className="nav-row"
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu({
                x: e.clientX,
                y: e.clientY,
                items: [{ kind: 'action', label: 'New folder', icon: <PlusIcon />, onSelect: () => startAdd(null) }]
              })
            }}
            style={{
              ...ROW_STYLE,
              paddingLeft: 6,
              background:
                selectedFolderId === null ? 'var(--color-surface-selected)' : 'transparent',
              color: selectedFolderId === null ? 'var(--color-accent)' : 'var(--color-text)'
            }}
          >
            <span className="nav-row__glyph">
              <AllItemsIcon />
            </span>
            <button type="button" onClick={() => handleSelect(null)} style={ROW_NAME_STYLE}>
              <span style={ROW_TEXT_STYLE}>All items</span>
            </button>
            <Count n={allCount} />
          </div>
        </li>
        {renderRows(null, 0)}
        {addingParent === null && renderAddInput(null, 0)}
      </ul>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </nav>
  )
}

const ASIDE_STYLE: React.CSSProperties = {
  // Width/scroll/background are owned by the shell sidebar pane (AppShell).
  width: '100%',
  boxSizing: 'border-box'
}

const COUNT_STYLE: React.CSSProperties = {
  flex: '0 0 auto',
  marginLeft: 4,
  fontSize: 11,
  color: 'var(--color-text-faint)',
  fontVariantNumeric: 'tabular-nums'
}

const ROW_STYLE: React.CSSProperties = {
  // Relative so the kebab can be absolutely positioned (out of flow) — that keeps the count column
  // at the same right edge on every row, whether or not the row has a kebab.
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  paddingRight: 8,
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
  // Out of flow (overlays the count, which hides on hover) so it never shifts the count column.
  position: 'absolute',
  right: 4,
  top: '50%',
  transform: 'translateY(-50%)',
  display: 'inline-flex',
  gap: 2
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
