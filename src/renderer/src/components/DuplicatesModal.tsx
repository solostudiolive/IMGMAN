import { useEffect, useState } from 'react'
import type { DuplicateGroup, PerceptualDuplicateGroup } from '../../../preload/types'
import { TypeIcon } from './icons'
import './DuplicatesModal.css'

function formatBytes(n: number): string {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  const value = n / Math.pow(1024, i)
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`
}

// Find-duplicates dialog: scans for byte-identical files (content hash), groups them, and lets the
// user delete the redundant copies (defaults to keeping the newest in each group). Reuses the
// Phase-7 items:delete. Parent (LibraryGate) owns `open` + reloads the grid via onChanged.
export default function DuplicatesModal({
  open,
  onClose,
  onChanged
}: {
  open: boolean
  onClose: () => void
  onChanged: () => void
}): React.JSX.Element | null {
  const [busy, setBusy] = useState(false)
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [pGroups, setPGroups] = useState<PerceptualDuplicateGroup[]>([])
  // 'exact' shows byte-identical duplicates; 'near' shows perceptual near-duplicates.
  const [tab, setTab] = useState<'exact' | 'near'>('exact')
  // Item ids checked for deletion.
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  // Default selection: every item EXCEPT the newest in each group (groups are oldest-first, so the
  // newest is the last item — keep it, pre-select the rest).
  const defaultSelection = (gs: DuplicateGroup[]): Set<string> => {
    const ids = new Set<string>()
    for (const g of gs) g.items.slice(0, -1).forEach((it) => ids.add(it.id))
    return ids
  }

  // Scan on open: backfill hashes + perceptual hashes so pre-existing libraries are covered,
  // then fetch both duplicate groupings.
  const scan = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.items.backfillHashes()
      const gs = await window.api.items.findDuplicates()
      setGroups(gs)
      setSelected(defaultSelection(gs))

      await window.api.items.backfillPerceptualHashes()
      const pgs = await window.api.items.findPerceptualDuplicates()
      setPGroups(pgs)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void scan()
    // Re-scan each time the dialog is opened.
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes; stop propagation so LibraryGate's window handler doesn't also fire.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open) return null

  const toggle = (id: string): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Both tabs share the selection model (groups.items are Item[]). `activeGroups` is the
  // currently-rendered set; `selected`/`toggle` operate over whichever tab is shown.
  const activeGroups = tab === 'near' ? pGroups : groups
  const activeItems = activeGroups.flatMap((g) => g.items)
  const selectedItems = activeItems.filter((it) => selected.has(it.id))
  const reclaimable = selectedItems.reduce((sum, it) => sum + it.size_bytes, 0)

  // Reset selection when the tab changes so cross-tab checkboxes don't bleed.
  useEffect(() => {
    setSelected(new Set())
  }, [tab])

  const deleteSelected = async (): Promise<void> => {
    const ids = [...selected]
    if (ids.length === 0) return
    if (!window.confirm(`Delete ${ids.length} duplicate file${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) {
      return
    }
    setBusy(true)
    try {
      await window.api.items.delete(ids)
      onChanged()
      // Re-group from the now-reduced set (no need to re-backfill).
      const gs = await window.api.items.findDuplicates()
      setGroups(gs)
      setSelected(defaultSelection(gs))
      const pgs = await window.api.items.findPerceptualDuplicates()
      setPGroups(pgs)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dups__backdrop" onClick={onClose}>
      <div
        className="dups__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Find duplicates"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dups__header">
          <h2 className="dups__title">Find duplicates</h2>
          <button type="button" className="dups__close" title="Close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Tab switcher: exact (byte-identical) vs near (perceptual). */}
        <div className="dups__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'exact'}
            className={`dups__tab${tab === 'exact' ? ' dups__tab--active' : ''}`}
            onClick={() => setTab('exact')}
          >
            Exact
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'near'}
            className={`dups__tab${tab === 'near' ? ' dups__tab--active' : ''}`}
            onClick={() => setTab('near')}
          >
            Near-duplicates
          </button>
        </div>

        <div className="dups__summary">
          {busy
            ? 'Scanning…'
            : activeGroups.length === 0
              ? `${tab === 'near' ? 'No near-duplicates' : 'No duplicates'} found.`
              : `${activeGroups.length} group${activeGroups.length > 1 ? 's' : ''} · ${selected.size} selected · ${formatBytes(reclaimable)} reclaimable`}
        </div>

        <div className="dups__body">
          {!busy &&
            activeGroups.map((g) => (
              <div key={'representative' in g ? g.representative : g.hash} className="dups__group">
                {g.items.map((it, idx) => {
                  const isNewest = idx === g.items.length - 1
                  return (
                    <label key={it.id} className="dups__item" title={it.name}>
                      <input
                        type="checkbox"
                        checked={selected.has(it.id)}
                        onChange={() => toggle(it.id)}
                      />
                      <span className="dups__thumb">
                        {it.type === 'image' ? (
                          <img src={`imgman://thumb/${it.id}`} alt="" />
                        ) : (
                          <TypeIcon type={it.type} size={28} />
                        )}
                      </span>
                      <span className="dups__meta">
                        <span className="dups__name">{it.name}</span>
                        <span className="dups__sub">
                          {formatBytes(it.size_bytes)}
                          {isNewest && <span className="dups__badge">newest</span>}
                          {tab === 'near' && 'distance' in g && <span className="dups__badge">Δ {g.distance}</span>}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            ))}
        </div>

        <div className="dups__footer">
          <button type="button" className="dups__btn dups__btn--ghost" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button
            type="button"
            className="dups__btn dups__btn--danger"
            onClick={() => void deleteSelected()}
            disabled={busy || selected.size === 0}
          >
            Delete selected ({selected.size})
          </button>
        </div>
      </div>
    </div>
  )
}
