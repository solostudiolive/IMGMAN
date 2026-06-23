import { useEffect, useState } from 'react'
import type { SearchCriteria, ItemType } from '../../preload/types'

const TYPES: ItemType[] = ['image', 'video', 'audio', 'font', 'doc', 'other']

// Header search + filters. Controlled by `criteria`; every control emits an
// updated copy via onChange. The text query is debounced locally so typing
// doesn't refire the search per keystroke; the other filters apply immediately.
export default function SearchBar({
  criteria,
  onChange
}: {
  criteria: SearchCriteria
  onChange: (c: SearchCriteria) => void
}): React.JSX.Element {
  const [text, setText] = useState(criteria.query ?? '')

  // Keep the local input in sync when criteria is reset externally (e.g. Clear,
  // or selecting a folder wipes the search).
  useEffect(() => {
    setText(criteria.query ?? '')
  }, [criteria.query])

  // Debounce propagation of the text query (~200ms).
  useEffect(() => {
    if ((criteria.query ?? '') === text) return
    const id = setTimeout(() => onChange({ ...criteria, query: text }), 200)
    return () => clearTimeout(id)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleType = (t: ItemType): void => {
    const set = new Set(criteria.types ?? [])
    if (set.has(t)) set.delete(t)
    else set.add(t)
    onChange({ ...criteria, types: set.size ? [...set] : undefined })
  }

  // Parse a yyyy-mm-dd date input into ms epoch; `end` snaps to end-of-day for
  // an inclusive upper bound. Empty string → null (no bound).
  const parseDate = (value: string, end: boolean): number | null => {
    if (!value) return null
    const ms = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}`).getTime()
    return Number.isNaN(ms) ? null : ms
  }
  const toInputDate = (ms: number | null | undefined): string =>
    ms == null ? '' : new Date(ms).toISOString().slice(0, 10)

  const active =
    !!criteria.query?.trim() ||
    !!criteria.types?.length ||
    !!criteria.ext?.trim() ||
    !!criteria.minRating ||
    criteria.from != null ||
    criteria.to != null

  return (
    <div style={ROW_STYLE}>
      <input
        type="search"
        value={text}
        placeholder="Search name, note, tags…"
        onChange={(e) => setText(e.target.value)}
        style={{ ...INPUT_STYLE, flex: '1 1 200px', minWidth: 160 }}
      />

      <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {TYPES.map((t) => (
          <label key={t} style={CHECK_LABEL}>
            <input
              type="checkbox"
              checked={criteria.types?.includes(t) ?? false}
              onChange={() => toggleType(t)}
            />
            {t}
          </label>
        ))}
      </div>

      <input
        type="text"
        value={criteria.ext ?? ''}
        placeholder="format (png)"
        onChange={(e) => onChange({ ...criteria, ext: e.target.value || undefined })}
        style={{ ...INPUT_STYLE, width: 96 }}
      />

      <select
        value={criteria.minRating ?? 0}
        onChange={(e) => onChange({ ...criteria, minRating: Number(e.target.value) || undefined })}
        style={{ ...INPUT_STYLE, width: 90 }}
        title="Minimum rating"
      >
        <option value={0}>Any ★</option>
        <option value={1}>1+ ★</option>
        <option value={2}>2+ ★</option>
        <option value={3}>3+ ★</option>
        <option value={4}>4+ ★</option>
        <option value={5}>5 ★</option>
      </select>

      <input
        type="date"
        value={toInputDate(criteria.from)}
        onChange={(e) => onChange({ ...criteria, from: parseDate(e.target.value, false) })}
        style={{ ...INPUT_STYLE, width: 140 }}
        title="Imported from"
      />
      <input
        type="date"
        value={toInputDate(criteria.to)}
        onChange={(e) => onChange({ ...criteria, to: parseDate(e.target.value, true) })}
        style={{ ...INPUT_STYLE, width: 140 }}
        title="Imported to"
      />

      {active && (
        <button type="button" onClick={() => onChange({})} style={CLEAR_STYLE}>
          Clear
        </button>
      )}
    </div>
  )
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
  marginTop: 10
}

const INPUT_STYLE: React.CSSProperties = {
  padding: '4px 6px',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  fontSize: 12,
  boxSizing: 'border-box'
}

const CHECK_LABEL: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  fontSize: 11,
  color: '#555'
}

const CLEAR_STYLE: React.CSSProperties = {
  fontSize: 12,
  padding: '4px 8px',
  cursor: 'pointer'
}
