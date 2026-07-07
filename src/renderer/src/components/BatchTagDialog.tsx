import { useEffect, useRef, useState } from 'react'
import type { Tag } from '../../../preload/types'

// Small modal for adding one tag (by name) to a batch of items. Presentational: the parent owns
// the target ids and performs the tags:addToMany call in onSubmit. Mirrors SettingsModal's
// backdrop/panel + self-owned Escape (so LibraryGate's global key handler never fires while open).
export default function BatchTagDialog({
  count,
  onSubmit,
  onClose
}: {
  count: number
  onSubmit: (name: string) => void
  onClose: () => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [allTags, setAllTags] = useState<Tag[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    window.api.tags.listAll().then((tags) => {
      if (!cancelled) setAllTags(tags)
    })
    inputRef.current?.focus()
    return () => {
      cancelled = true
    }
  }, [])

  // Escape closes; stop propagation so the global grid handler doesn't also fire.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (): void => {
    const trimmed = name.trim()
    if (trimmed) onSubmit(trimmed)
    onClose()
  }

  return (
    <div style={BACKDROP} onClick={onClose}>
      <div style={PANEL} role="dialog" aria-modal="true" aria-label="Add tag" onClick={(e) => e.stopPropagation()}>
        <h2 style={TITLE}>
          Add tag to {count} item{count > 1 ? 's' : ''}
        </h2>
        <input
          ref={inputRef}
          type="text"
          value={name}
          list="batch-tag-suggestions"
          placeholder="Tag name…"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          style={INPUT}
        />
        <datalist id="batch-tag-suggestions">
          {allTags.map((t) => (
            <option key={t.id} value={t.name} />
          ))}
        </datalist>
        <div style={ACTIONS}>
          <button type="button" onClick={onClose} style={SECONDARY_BTN}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!name.trim()} style={PRIMARY_BTN}>
            Add tag
          </button>
        </div>
      </div>
    </div>
  )
}

const BACKDROP: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1100,
  background: 'rgba(0, 0, 0, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: 'imgman-fade-in var(--dur-fast) var(--ease-out)'
}

const PANEL: React.CSSProperties = {
  width: 360,
  maxWidth: '90vw',
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-2)',
  padding: 'var(--space-4)',
  boxSizing: 'border-box',
  animation: 'imgman-scale-in var(--dur-fast) var(--ease-out)'
}

const TITLE: React.CSSProperties = {
  margin: '0 0 var(--space-3)',
  fontSize: 'var(--fs-md)',
  fontWeight: 'var(--fw-semibold)',
  color: 'var(--color-text)'
}

const INPUT: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--color-bg-app)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-2)',
  fontSize: 'var(--fs-sm)'
}

const ACTIONS: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 'var(--space-2)',
  marginTop: 'var(--space-4)'
}

const SECONDARY_BTN: React.CSSProperties = {
  background: 'var(--color-bg-app)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-1) var(--space-3)',
  fontSize: 'var(--fs-sm)',
  cursor: 'pointer'
}

const PRIMARY_BTN: React.CSSProperties = {
  background: 'var(--color-accent)',
  color: 'var(--color-accent-contrast)',
  border: '1px solid var(--color-accent)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-1) var(--space-3)',
  fontSize: 'var(--fs-sm)',
  cursor: 'pointer'
}
