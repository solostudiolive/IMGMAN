import { useEffect, useMemo, useState } from 'react'
import type { Item, ItemType, Tag, Folder } from '../../../preload/types'

const DATALIST_ID = 'multi-tag-suggestions'

const TYPE_LABEL: Record<ItemType, string> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  font: 'font',
  doc: 'doc',
  other: 'other'
}

function formatBytes(n: number): string {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  const value = n / Math.pow(1024, i)
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`
}

// Editable inspector for a multi-selection (2+ items). The aggregate header (count, total size,
// per-type breakdown) and the common rating are computed renderer-side from the passed Item[] —
// the grid already carries rating/size/type. Common tags/folders (the INTERSECTION across all
// selected) are fetched via the dedicated read channels. Every edit applies to the WHOLE selection
// in one transaction, then refetches the common lists and calls onChanged() to reload the grid.
export default function MultiInspector({
  items,
  onChanged
}: {
  items: Item[]
  onChanged: () => void
}): React.JSX.Element {
  const ids = useMemo(() => items.map((it) => it.id), [items])
  // Stable key so re-selection (same size, different members) refetches the common lists.
  const idsKey = ids.join(',')

  const [commonTags, setCommonTags] = useState<Tag[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [commonFolders, setCommonFolders] = useState<Folder[]>([])
  const [allFolders, setAllFolders] = useState<Folder[]>([])
  const [draft, setDraft] = useState('')

  // Aggregate header values (free — derived from the items prop).
  const totalSize = items.reduce((sum, it) => sum + it.size_bytes, 0)
  const typeCounts = useMemo(() => {
    const counts = new Map<ItemType, number>()
    for (const it of items) counts.set(it.type, (counts.get(it.type) ?? 0) + 1)
    return Array.from(counts.entries())
  }, [items])
  // Common rating: the shared value when every item agrees, else null ("Mixed").
  const commonRating = items.every((it) => it.rating === items[0].rating) ? items[0].rating : null

  // Refetch the common tag/folder intersections + suggestion pools for the current selection.
  const reloadCommon = async (): Promise<void> => {
    const [cTags, aTags, cFolders, aFolders] = await Promise.all([
      window.api.tags.commonForItems(ids),
      window.api.tags.listAll(),
      window.api.folders.commonForItems(ids),
      window.api.folders.list()
    ])
    setCommonTags(cTags)
    setAllTags(aTags)
    setCommonFolders(cFolders)
    setAllFolders(aFolders)
  }

  useEffect(() => {
    let cancelled = false
    setDraft('')
    Promise.all([
      window.api.tags.commonForItems(ids),
      window.api.tags.listAll(),
      window.api.folders.commonForItems(ids),
      window.api.folders.list()
    ]).then(([cTags, aTags, cFolders, aFolders]) => {
      if (cancelled) return
      setCommonTags(cTags)
      setAllTags(aTags)
      setCommonFolders(cFolders)
      setAllFolders(aFolders)
    })
    return () => {
      cancelled = true
    }
    // idsKey captures membership; ids is derived from the same items.
  }, [idsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Set the same rating on all selected; clicking the current common top star clears to 0.
  const setRating = async (n: number): Promise<void> => {
    const value = n === commonRating ? 0 : n
    await window.api.items.rateMany(ids, value)
    onChanged()
  }

  const addTag = async (): Promise<void> => {
    const name = draft.trim()
    if (!name) return
    setDraft('')
    await window.api.tags.addToMany(ids, name)
    await reloadCommon()
    onChanged()
  }

  const removeTag = async (tagId: string): Promise<void> => {
    await window.api.tags.removeFromMany(ids, tagId)
    await reloadCommon()
    onChanged()
  }

  const assignFolder = async (folderId: string): Promise<void> => {
    if (!folderId) return
    await window.api.folders.assignMany(ids, folderId)
    await reloadCommon()
    onChanged()
  }

  const unassignFolder = async (folderId: string): Promise<void> => {
    await window.api.folders.unassignMany(ids, folderId)
    await reloadCommon()
    onChanged()
  }

  // Only folders the selection isn't ALREADY entirely in are assignable.
  const commonFolderIds = new Set(commonFolders.map((f) => f.id))
  const availableFolders = allFolders.filter((f) => !commonFolderIds.has(f.id))

  return (
    <aside style={ASIDE_STYLE}>
      <div
        style={{
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-elevated)',
          padding: 'var(--space-3)',
          marginBottom: 'var(--space-3)'
        }}
      >
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-text)' }}>
          {items.length} items selected
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {formatBytes(totalSize)} total
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-1)',
            marginTop: 'var(--space-2)'
          }}
        >
          {typeCounts.map(([type, count]) => (
            <span key={type} style={TYPE_PILL_STYLE}>
              {TYPE_LABEL[type]} · {count}
            </span>
          ))}
        </div>
      </div>

      <Section label="Rating">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <StarRating value={commonRating ?? 0} onChange={setRating} />
          {commonRating === null && (
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-faint)' }}>Mixed</span>
          )}
        </div>
      </Section>

      <Section label="Tags" note="shown: tags on all selected">
        {commonTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--space-2)' }}>
            {commonTags.map((tag) => (
              <span key={tag.id} style={CHIP_STYLE}>
                {tag.name}
                <button
                  type="button"
                  aria-label={`Remove ${tag.name} from all`}
                  onClick={() => void removeTag(tag.id)}
                  style={CHIP_REMOVE_STYLE}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          value={draft}
          list={DATALIST_ID}
          placeholder="Add a tag to all…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void addTag()
            }
          }}
          style={INPUT_STYLE}
        />
        <datalist id={DATALIST_ID}>
          {allTags.map((tag) => (
            <option key={tag.id} value={tag.name} />
          ))}
        </datalist>
      </Section>

      <Section label="Folders" note="shown: folders containing all selected">
        {commonFolders.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--space-2)' }}>
            {commonFolders.map((folder) => (
              <span key={folder.id} style={CHIP_STYLE}>
                📁 {folder.name}
                <button
                  type="button"
                  aria-label={`Remove all from ${folder.name}`}
                  onClick={() => void unassignFolder(folder.id)}
                  style={CHIP_REMOVE_STYLE}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {allFolders.length === 0 ? (
          <div style={{ color: 'var(--color-text-faint)', fontSize: 'var(--fs-xs)' }}>
            No folders — create one in the sidebar.
          </div>
        ) : (
          <select
            className="modern-select"
            value=""
            onChange={(e) => void assignFolder(e.target.value)}
            disabled={availableFolders.length === 0}
          >
            <option value="" disabled>
              {availableFolders.length === 0 ? 'In all folders' : 'Add all to folder…'}
            </option>
            {availableFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        )}
      </Section>
    </aside>
  )
}

function Section({
  label,
  note,
  children
}: {
  label: string
  note?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      style={{
        borderTop: '1px solid var(--color-border)',
        padding: 'var(--space-2) 0',
        fontSize: 'var(--fs-sm)'
      }}
    >
      <div style={{ color: 'var(--color-text-faint)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--space-1)' }}>
        {label}
      </div>
      {note && (
        <div style={{ color: 'var(--color-text-faint)', fontSize: 'var(--fs-xs)', marginBottom: 6 }}>
          {note}
        </div>
      )}
      {children}
    </div>
  )
}

// Mirrors the single Inspector's StarRating. Click a star to set; click the current top star to clear.
function StarRating({
  value,
  onChange
}: {
  value: number
  onChange: (n: number) => void
}): React.JSX.Element {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            // Star-yellow is an intentional fixed affordance color; empty uses a token.
            color: n <= value ? '#f5b301' : 'var(--color-border-strong)'
          }}
        >
          {n <= value ? '★' : '☆'}
        </button>
      ))}
    </span>
  )
}

const ASIDE_STYLE: React.CSSProperties = {
  // Width/scroll/background/border are owned by the shell inspector pane (AppShell).
  width: '100%',
  padding: 12,
  boxSizing: 'border-box'
}

const TYPE_PILL_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 'var(--radius-pill, 999px)',
  background: 'var(--color-bg-content)',
  color: 'var(--color-text-muted)',
  fontSize: 'var(--fs-xs)'
}

const CHIP_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 'var(--radius-pill, 999px)',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  fontSize: 11
}

const CHIP_REMOVE_STYLE: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: 'var(--color-text-faint)',
  fontSize: 13,
  lineHeight: 1
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: 'var(--space-1) var(--space-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-text)',
  fontSize: 12
}
