import { useEffect, useMemo, useState } from 'react'
import {
  computeRenames,
  specError,
  type RenameInput,
  type RenameSpec
} from './renameItems'

const PREVIEW_CAP = 50

// Batch-rename dialog: Pattern ({name}/{ext}/{n} + start + pad) or Find & Replace (literal/regex,
// case-sensitive). Computes a live old→new preview; Apply sends only changed, non-blank names.
// Mirrors BatchTagDialog's backdrop/panel + self-owned Escape (so the global grid handler stays quiet).
export default function BatchRenameDialog({
  items,
  onApply,
  onClose
}: {
  items: RenameInput[]
  onApply: (renames: { id: string; name: string }[]) => void
  onClose: () => void
}): React.JSX.Element {
  const [mode, setMode] = useState<'pattern' | 'replace'>('pattern')
  const [template, setTemplate] = useState('{name}')
  const [start, setStart] = useState(1)
  const [pad, setPad] = useState(2)
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [regex, setRegex] = useState(false)

  const spec: RenameSpec = useMemo(
    () =>
      mode === 'pattern'
        ? { mode, template, start, pad }
        : { mode, find, replace, caseSensitive, regex },
    [mode, template, start, pad, find, replace, caseSensitive, regex]
  )

  const error = specError(spec)
  const preview = useMemo(() => computeRenames(items, spec), [items, spec])
  const changes = preview.filter((r) => r.name.trim() && r.name !== r.oldName)
  const canApply = !error && changes.length > 0

  // Escape closes; stop propagation so LibraryGate's global key handler doesn't also fire.
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

  const apply = (): void => {
    if (!canApply) return
    onApply(changes.map(({ id, name }) => ({ id, name })))
    onClose()
  }

  return (
    <div style={BACKDROP} onClick={onClose}>
      <div
        style={PANEL}
        role="dialog"
        aria-modal="true"
        aria-label="Rename items"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={TITLE}>
          Rename {items.length} item{items.length > 1 ? 's' : ''}
        </h2>

        <div style={SEGMENT} role="group" aria-label="Rename mode">
          {(['pattern', 'replace'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              style={{ ...SEGMENT_BTN, ...(mode === m ? SEGMENT_BTN_ON : null) }}
            >
              {m === 'pattern' ? 'Pattern' : 'Find & Replace'}
            </button>
          ))}
        </div>

        {mode === 'pattern' ? (
          <div style={FIELDS}>
            <label style={LABEL}>
              Template
              <input
                autoFocus
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && apply()}
                style={INPUT}
              />
            </label>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-faint)' }}>
              Tokens: {'{name}'} · {'{ext}'} · {'{n}'}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <label style={{ ...LABEL, flex: 1 }}>
                Start at
                <input
                  type="number"
                  value={start}
                  onChange={(e) => setStart(parseInt(e.target.value, 10) || 0)}
                  style={INPUT}
                />
              </label>
              <label style={{ ...LABEL, flex: 1 }}>
                Pad digits
                <input
                  type="number"
                  min={0}
                  value={pad}
                  onChange={(e) => setPad(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  style={INPUT}
                />
              </label>
            </div>
          </div>
        ) : (
          <div style={FIELDS}>
            <label style={LABEL}>
              Find
              <input
                autoFocus
                value={find}
                onChange={(e) => setFind(e.target.value)}
                style={INPUT}
              />
            </label>
            <label style={LABEL}>
              Replace with
              <input
                value={replace}
                onChange={(e) => setReplace(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && apply()}
                style={INPUT}
              />
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <label style={CHECK}>
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={(e) => setCaseSensitive(e.target.checked)}
                />
                Case-sensitive
              </label>
              <label style={CHECK}>
                <input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} />
                Use regex
              </label>
            </div>
            {error && <div style={ERROR}>{error}</div>}
          </div>
        )}

        <div style={PREVIEW_BOX}>
          {preview.slice(0, PREVIEW_CAP).map((r) => {
            const changed = r.name.trim() && r.name !== r.oldName
            return (
              <div key={r.id} style={PREVIEW_ROW}>
                <span style={PREVIEW_OLD}>{r.oldName}</span>
                <span style={{ color: 'var(--color-text-faint)' }}>→</span>
                <span style={{ ...PREVIEW_NEW, color: changed ? 'var(--color-text)' : 'var(--color-text-faint)' }}>
                  {r.name.trim() || '(empty — skipped)'}
                </span>
              </div>
            )
          })}
          {preview.length > PREVIEW_CAP && (
            <div style={{ padding: '4px 0', color: 'var(--color-text-faint)', fontSize: 'var(--fs-xs)' }}>
              +{preview.length - PREVIEW_CAP} more…
            </div>
          )}
        </div>

        <div style={ACTIONS}>
          <span style={{ flex: 1, fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)' }}>
            {changes.length} of {items.length} will change
          </span>
          <button type="button" onClick={onClose} style={SECONDARY_BTN}>
            Cancel
          </button>
          <button type="button" onClick={apply} disabled={!canApply} style={PRIMARY_BTN}>
            Rename
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
  justifyContent: 'center'
}

const PANEL: React.CSSProperties = {
  width: 480,
  maxWidth: '92vw',
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-2)',
  padding: 'var(--space-4)',
  boxSizing: 'border-box'
}

const TITLE: React.CSSProperties = {
  margin: '0 0 var(--space-3)',
  fontSize: 'var(--fs-md)',
  fontWeight: 'var(--fw-semibold)',
  color: 'var(--color-text)'
}

const SEGMENT: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  padding: 2,
  marginBottom: 'var(--space-3)',
  background: 'var(--color-bg-app)',
  borderRadius: 'var(--radius-md)',
  width: 'fit-content'
}

const SEGMENT_BTN: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-text-muted)',
  borderRadius: 'var(--radius-sm)',
  padding: 'var(--space-1) var(--space-3)',
  fontSize: 'var(--fs-sm)',
  cursor: 'pointer'
}

const SEGMENT_BTN_ON: React.CSSProperties = {
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-text)',
  boxShadow: 'var(--shadow-1)'
}

const FIELDS: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  marginBottom: 'var(--space-3)'
}

const LABEL: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 'var(--fs-xs)',
  color: 'var(--color-text-muted)'
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

const CHECK: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 'var(--fs-sm)',
  color: 'var(--color-text)',
  cursor: 'pointer'
}

const ERROR: React.CSSProperties = {
  color: 'var(--color-danger)',
  fontSize: 'var(--fs-xs)'
}

const PREVIEW_BOX: React.CSSProperties = {
  maxHeight: 200,
  overflow: 'auto',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-2)',
  background: 'var(--color-bg-app)'
}

const PREVIEW_ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: '2px 0',
  fontSize: 'var(--fs-xs)'
}

const PREVIEW_OLD: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  color: 'var(--color-text-muted)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
}

const PREVIEW_NEW: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
}

const ACTIONS: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
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
