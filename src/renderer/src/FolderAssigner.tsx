import { useEffect, useState } from 'react'
import type { Folder } from '../../preload/types'
import Select from './components/Select'
import { FolderIcon } from './components/icons'
import { folderColor } from './folderColor'

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
    <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px 0', marginTop: 12, fontSize: 12 }}>
      <div style={{ color: 'var(--color-text-faint)', fontWeight: 'var(--fw-bold)', marginBottom: 6 }}>
        Folders
      </div>

      {folders.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {folders.map((folder) => (
            <span key={folder.id} className="chip">
              <span className="chip__icon" style={{ color: folderColor(folder.id) }}>
                <FolderIcon size={13} />
              </span>
              <span className="chip__label">{folder.name}</span>
              <button
                type="button"
                className="chip__remove"
                aria-label={`Remove from ${folder.name}`}
                onClick={() => remove(folder.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {allFolders.length === 0 ? (
        <div style={{ color: 'var(--color-text-faint)' }}>No folders — create one in the sidebar.</div>
      ) : (
        <Select
          value=""
          placeholder={available.length === 0 ? 'In all folders' : 'Add to folder…'}
          disabled={available.length === 0}
          ariaLabel="Add to folder"
          options={available.map((f) => ({ value: f.id, label: f.name }))}
          onChange={(id) => void assign(id)}
        />
      )}
    </div>
  )
}

