import { useEffect, useRef, useState } from 'react'
import type { SearchCriteria, ItemType } from '../../preload/types'
import './SearchBar.css'

const TYPES: ItemType[] = ['image', 'video', 'audio', 'font', 'doc', 'other']

// Header search + filters. Controlled by `criteria`; every control emits an
// updated copy via onChange. The text query is debounced locally so typing
// doesn't refire the search per keystroke; the other filters apply immediately.
// The "advanced" filters (format / rating / date range) live in a popover so the
// toolbar stays compact.
export default function SearchBar({
  criteria,
  onChange,
  onSave
}: {
  criteria: SearchCriteria
  onChange: (c: SearchCriteria) => void
  // When provided and a search is active, shows a "Save search" control that saves the
  // current criteria under the given name (used to create a smart folder).
  onSave?: (name: string) => void
}): React.JSX.Element {
  const [text, setText] = useState(criteria.query ?? '')
  const [menu, setMenu] = useState<'type' | 'filters' | null>(null)
  // Inline save-name input: null = hidden, string = the in-progress name.
  const [saveName, setSaveName] = useState<string | null>(null)
  const typeRef = useRef<HTMLDivElement>(null)
  const filtersRef = useRef<HTMLDivElement>(null)

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

  // Close whichever dropdown is open on outside click or Escape.
  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent): void => {
      const t = e.target as Node
      if (typeRef.current?.contains(t) || filtersRef.current?.contains(t)) return
      setMenu(null)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMenu(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

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

  // Count of active "advanced" (popover) filters — drives the badge.
  const advCount =
    (criteria.ext?.trim() ? 1 : 0) +
    (criteria.minRating ? 1 : 0) +
    (criteria.from != null ? 1 : 0) +
    (criteria.to != null ? 1 : 0)

  const typeCount = criteria.types?.length ?? 0
  const anyActive = !!criteria.query?.trim() || typeCount > 0 || advCount > 0

  return (
    <div className="searchbar">
      <div className="searchbar__field">
        <SearchIcon />
        <input
          type="search"
          value={text}
          placeholder="Search name, note, tags…"
          onChange={(e) => setText(e.target.value)}
        />
        {text && (
          <button type="button" className="searchbar__clear-input" title="Clear search" onClick={() => setText('')}>
            ×
          </button>
        )}
      </div>

      <div className="searchbar__filters" ref={typeRef}>
        <button
          type="button"
          className={`searchbar__filterbtn${typeCount ? ' searchbar__filterbtn--on' : ''}`}
          aria-expanded={menu === 'type'}
          onClick={() => setMenu((m) => (m === 'type' ? null : 'type'))}
        >
          Type
          {typeCount > 0 && <span className="searchbar__badge">{typeCount}</span>}
          <Chevron />
        </button>

        {menu === 'type' && (
          <div className="searchbar__menu" role="listbox" aria-label="Filter by type">
            {TYPES.map((t) => {
              const on = criteria.types?.includes(t) ?? false
              return (
                <button
                  key={t}
                  type="button"
                  className={`searchbar__option${on ? ' searchbar__option--on' : ''}`}
                  role="option"
                  aria-selected={on}
                  onClick={() => toggleType(t)}
                >
                  <span className="searchbar__check">✓</span>
                  {t}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="searchbar__filters" ref={filtersRef}>
        <button
          type="button"
          className={`searchbar__filterbtn${advCount ? ' searchbar__filterbtn--on' : ''}`}
          aria-expanded={menu === 'filters'}
          onClick={() => setMenu((m) => (m === 'filters' ? null : 'filters'))}
        >
          <FilterIcon />
          Filters
          {advCount > 0 && <span className="searchbar__badge">{advCount}</span>}
        </button>

        {menu === 'filters' && (
          <div className="searchbar__popover" role="dialog" aria-label="Filters">
            <div className="searchbar__group">
              <label className="searchbar__label" htmlFor="filter-format">
                Format
              </label>
              <input
                id="filter-format"
                className="searchbar__input"
                type="text"
                value={criteria.ext ?? ''}
                placeholder="e.g. png"
                onChange={(e) => onChange({ ...criteria, ext: e.target.value || undefined })}
              />
            </div>

            <div className="searchbar__group">
              <label className="searchbar__label" htmlFor="filter-rating">
                Minimum rating
              </label>
              <select
                id="filter-rating"
                className="searchbar__input searchbar__select"
                value={criteria.minRating ?? 0}
                onChange={(e) =>
                  onChange({ ...criteria, minRating: Number(e.target.value) || undefined })
                }
              >
                <option value={0}>Any rating</option>
                <option value={1}>1+ ★</option>
                <option value={2}>2+ ★</option>
                <option value={3}>3+ ★</option>
                <option value={4}>4+ ★</option>
                <option value={5}>5 ★</option>
              </select>
            </div>

            <div className="searchbar__group">
              <span className="searchbar__label">Imported</span>
              <div className="searchbar__row">
                <input
                  className="searchbar__input"
                  type="date"
                  value={toInputDate(criteria.from)}
                  onChange={(e) => onChange({ ...criteria, from: parseDate(e.target.value, false) })}
                  title="Imported from"
                />
                <input
                  className="searchbar__input"
                  type="date"
                  value={toInputDate(criteria.to)}
                  onChange={(e) => onChange({ ...criteria, to: parseDate(e.target.value, true) })}
                  title="Imported to"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {onSave && anyActive && (
        saveName === null ? (
          <button type="button" className="searchbar__clearall" onClick={() => setSaveName('')}>
            Save search
          </button>
        ) : (
          <input
            autoFocus
            className="searchbar__input"
            type="text"
            value={saveName}
            placeholder="Name this search…"
            onChange={(e) => setSaveName(e.target.value)}
            onBlur={() => setSaveName(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const name = saveName.trim()
                if (name) onSave(name)
                setSaveName(null)
              }
              if (e.key === 'Escape') setSaveName(null)
            }}
          />
        )
      )}

      {anyActive && (
        <button type="button" className="searchbar__clearall" onClick={() => onChange({})}>
          Clear all
        </button>
      )}
    </div>
  )
}

function SearchIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function Chevron(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline
        points="6 9 12 15 18 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FilterIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="17" x2="14" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
