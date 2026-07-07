import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './Select.css'

// Themed tag entry: a text input plus an in-place suggestion popover (replaces the native
// <datalist>, which is OS-rendered and can't match the app). Type to filter existing tags; click a
// suggestion or press Enter to add. Reuses the Select popover styles.
export default function TagInput({
  suggestions,
  placeholder = 'Add a tag…',
  onAdd
}: {
  suggestions: string[]
  placeholder?: string
  onAdd: (name: string) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [flipUp, setFlipUp] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const q = draft.trim().toLowerCase()
  const matches = suggestions
    .filter((s) => (q ? s.toLowerCase().includes(q) : true))
    .filter((s) => s.toLowerCase() !== q) // hide an exact match (Enter already covers it)
    .slice(0, 8)
  const showMenu = open && matches.length > 0

  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  useLayoutEffect(() => {
    if (!showMenu || !rootRef.current) return
    const r = rootRef.current.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    const needed = Math.min(matches.length * 32 + 8, 240)
    setFlipUp(below < needed && r.top > below)
  }, [showMenu, matches.length])

  const commit = (name: string): void => {
    const n = name.trim()
    if (n) onAdd(n)
    setDraft('')
    setActive(0)
    setOpen(false)
  }

  return (
    <div className="ui-select" ref={rootRef}>
      <input
        type="text"
        className="ui-select__trigger"
        style={{ paddingRight: 10 }}
        value={draft}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => {
          setDraft(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit(showMenu && matches[active] ? matches[active] : draft)
          } else if (e.key === 'ArrowDown' && showMenu) {
            e.preventDefault()
            setActive((a) => Math.min(matches.length - 1, a + 1))
          } else if (e.key === 'ArrowUp' && showMenu) {
            e.preventDefault()
            setActive((a) => Math.max(0, a - 1))
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {showMenu && (
        <div className={`ui-select__menu${flipUp ? ' ui-select__menu--up' : ''}`} role="listbox">
          {matches.map((s, i) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={i === active}
              className={`ui-select__option${i === active ? ' ui-select__option--selected' : ''}`}
              onMouseEnter={() => setActive(i)}
              // mousedown (not click) so it fires before the input's blur closes the menu.
              onMouseDown={(e) => {
                e.preventDefault()
                commit(s)
              }}
            >
              <span className="ui-select__option-label">{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
