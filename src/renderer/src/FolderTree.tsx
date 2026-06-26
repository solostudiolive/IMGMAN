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

// Left-sidebar folder tree: an "All items" root plus the nested folders, with
// inline create / rename / delete. Built from the flat folders list (grouped by
// parent_id). Each mutation reconciles to the returned list and notifies the
// container (so the grid filter can reload).
export default function FolderTree({
  selectedFolderId,
  onSelectFolder,
  onFoldersChanged
}: {
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
  onFoldersChanged?: () => void
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

  const expandFolder = (id: string): void =>
    setExpanded((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })

  const toggleExpand = (id: string): void =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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
              style={{ ...INPUT_STYLE, marginLeft: depth * 12 }}
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
                paddingLeft: 6 + depth * 12,
                background: selected ? 'var(--color-surface-selected)' : 'transparent',
                color: selected ? 'var(--color-accent)' : 'var(--color-text)'
              }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  title={isOpen ? 'Collapse' : 'Expand'}
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                  aria-expanded={isOpen}
                  onClick={() => toggleExpand(folder.id)}
                  style={CHEVRON_BTN}
                >
                  <ChevronRightIcon
                    size={12}
                    style={{
                      transform: isOpen ? 'rotate(90deg)' : 'none',
                      transition: 'transform var(--dur-fast) var(--ease-out)'
                    }}
                  />
                </button>
              ) : (
                <span style={CHEVRON_SPACER} />
              )}
              <button
                type="button"
                onClick={() => onSelectFolder(folder.id)}
                title={folder.name}
                style={ROW_NAME_STYLE}
              >
                <FolderIcon />
                <span style={ROW_TEXT_STYLE}>{folder.name}</span>
              </button>
              <span style={ROW_ACTIONS_STYLE}>
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
        </li>
      )
      // Children only when expanded; an inline add-input if we're adding under this folder.
      if (isOpen) {
        rows.push(...renderRows(folder.id, depth + 1))
      }
      if (addingParent === folder.id) {
        rows.push(renderAddInput(folder.id, depth + 1))
      }
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
        style={{ ...INPUT_STYLE, marginLeft: depth * 12 }}
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
            <button type="button" onClick={() => onSelectFolder(null)} style={ROW_NAME_STYLE}>
              <AllItemsIcon />
              <span style={ROW_TEXT_STYLE}>All items</span>
            </button>
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

// Disclosure toggle + a same-width spacer so leaf rows align with togglable ones.
const CHEVRON_BTN: React.CSSProperties = {
  flex: '0 0 auto',
  width: 16,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: 'var(--color-text-faint)'
}

const CHEVRON_SPACER: React.CSSProperties = { flex: '0 0 auto', width: 16 }

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
