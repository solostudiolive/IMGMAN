import { useEffect, useState } from 'react'
import type { Tag } from '../../preload/types'
import ContextMenu, { type MenuNode } from './components/ContextMenu'
import { TrashIcon } from './components/icons'

// A unique datalist id is fine as a constant — only one TagEditor renders at a time
// (it lives in the single inspector). Suggestions are scoped by the input's `list`.
const DATALIST_ID = 'tag-suggestions'

// Inspector tag editor: chips for the item's current tags (each removable) plus an
// add input backed by a datalist of all existing tag names. Reconciles to the list
// returned by each mutation (the canonical post-write state), reverting on failure.
export default function TagEditor({ itemId }: { itemId: string }): React.JSX.Element {
  const [tags, setTags] = useState<Tag[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [draft, setDraft] = useState('')
  // Open right-click tag-chip context menu (null = closed).
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuNode[] } | null>(null)

  // (Re)load this item's tags and the suggestion pool when the selection changes.
  useEffect(() => {
    let cancelled = false
    setDraft('')
    Promise.all([window.api.tags.listForItem(itemId), window.api.tags.listAll()]).then(
      ([forItem, all]) => {
        if (cancelled) return
        setTags(forItem)
        setAllTags(all)
      }
    )
    return () => {
      cancelled = true
    }
  }, [itemId])

  const add = async (): Promise<void> => {
    const name = draft.trim()
    if (!name) return
    setDraft('')
    try {
      const next = await window.api.tags.add(itemId, name)
      setTags(next)
      // A new tag may have been created — refresh suggestions.
      setAllTags(await window.api.tags.listAll())
    } catch (err) {
      console.error('Failed to add tag:', err)
    }
  }

  const remove = async (tagId: string): Promise<void> => {
    const prev = tags
    setTags((cur) => cur.filter((t) => t.id !== tagId)) // optimistic
    try {
      setTags(await window.api.tags.remove(itemId, tagId))
    } catch (err) {
      console.error('Failed to remove tag:', err)
      setTags(prev) // revert
    }
  }

  return (
    <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px 0', fontSize: 12 }}>
      <div style={{ color: 'var(--color-text-faint)', fontWeight: 'var(--fw-bold)', marginBottom: 6 }}>
        Tags
      </div>

      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {tags.map((tag) => (
            <span
              key={tag.id}
              style={CHIP_STYLE}
              onContextMenu={(e) => {
                e.preventDefault()
                setMenu({
                  x: e.clientX,
                  y: e.clientY,
                  items: [
                    {
                      kind: 'action',
                      label: 'Remove from item',
                      icon: <TrashIcon />,
                      danger: true,
                      onSelect: () => void remove(tag.id)
                    }
                  ]
                })
              }}
            >
              {tag.name}
              <button
                type="button"
                aria-label={`Remove ${tag.name}`}
                onClick={() => remove(tag.id)}
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
        placeholder="Add a tag…"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void add()
          }
        }}
        style={INPUT_STYLE}
      />
      <datalist id={DATALIST_ID}>
        {allTags.map((tag) => (
          <option key={tag.id} value={tag.name} />
        ))}
      </datalist>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}

const CHIP_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 'var(--radius-pill)',
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
  padding: '4px 8px',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 12
}
