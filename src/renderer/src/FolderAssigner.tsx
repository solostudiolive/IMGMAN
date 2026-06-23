import { useEffect, useState } from 'react'
import type { Folder } from '../../preload/types'

// Inspector section mirroring TagEditor: chips for the folders the selected item
// is in (each removable) plus a <select> to assign it to another folder. Folders
// are created in the sidebar, not here. Reconciles to the list each mutation returns.
export default function FolderAssigner({ itemId }: { itemId: string }): React.JSX.Element {
  const [folders, setFolders] = useState<Folder[]>([])
  const [allFolders, setAllFolders] = useState<Folder[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([window.api.folders.forItem(itemId), window.api.folders.list()]).then(
      ([forItem, all]) => {
        if (cancelled) return
        setFolders(forItem)
        setAllFolders(all)
      }
    )
    return () => {
      cancelled = true
    }
  }, [itemId])

  const assign = async (folderId: string): Promise<void> => {
    if (!folderId) return
    try {
      setFolders(await window.api.folders.assign(itemId, folderId))
    } catch (err) {
      console.error('Failed to assign folder:', err)
    }
  }

  const remove = async (folderId: string): Promise<void> => {
    const prev = folders
    setFolders((cur) => cur.filter((f) => f.id !== folderId)) // optimistic
    try {
      setFolders(await window.api.folders.unassign(itemId, folderId))
    } catch (err) {
      console.error('Failed to remove from folder:', err)
      setFolders(prev) // revert
    }
  }

  // Only folders the item is NOT already in are assignable.
  const assignedIds = new Set(folders.map((f) => f.id))
  const available = allFolders.filter((f) => !assignedIds.has(f.id))

  return (
    <div style={{ borderTop: '1px solid #f0f0f0', padding: '8px 0', fontSize: 12 }}>
      <div style={{ color: '#999', marginBottom: 6 }}>Folders</div>

      {folders.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {folders.map((folder) => (
            <span key={folder.id} style={CHIP_STYLE}>
              📁 {folder.name}
              <button
                type="button"
                aria-label={`Remove from ${folder.name}`}
                onClick={() => remove(folder.id)}
                style={CHIP_REMOVE_STYLE}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {allFolders.length === 0 ? (
        <div style={{ color: '#bbb' }}>No folders — create one in the sidebar.</div>
      ) : (
        <select
          value=""
          onChange={(e) => void assign(e.target.value)}
          disabled={available.length === 0}
          style={SELECT_STYLE}
        >
          <option value="" disabled>
            {available.length === 0 ? 'In all folders' : 'Add to folder…'}
          </option>
          {available.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

const CHIP_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 6px',
  borderRadius: 10,
  background: '#ecfdf5',
  color: '#065f46',
  fontSize: 11
}

const CHIP_REMOVE_STYLE: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: '#9ca3af',
  fontSize: 13,
  lineHeight: 1
}

const SELECT_STYLE: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '4px 6px',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  fontSize: 12,
  background: '#fff'
}
