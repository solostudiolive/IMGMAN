import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './Select.css'

export interface SelectOption {
  value: string
  label: string
}

// A themed replacement for the native <select>: a styled trigger plus an in-place popover list
// (native option lists are OS-rendered and can't be themed). Opens below the trigger, flips above
// when there isn't room. Closes on select / outside-click / Escape.
export default function Select({
  value,
  options,
  placeholder,
  disabled,
  ariaLabel,
  onChange
}: {
  value: string
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
  onChange: (value: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [flipUp, setFlipUp] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)
  const label = selected?.label ?? placeholder ?? 'Select…'

  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  // Flip the menu above the trigger when the space below is too small.
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return
    const r = rootRef.current.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    const needed = Math.min(options.length * 32 + 8, 240)
    setFlipUp(below < needed && r.top > below)
  }, [open, options.length])

  const pick = (v: string): void => {
    onChange(v)
    setOpen(false)
  }

  return (
    <div className="ui-select" ref={rootRef}>
      <button
        type="button"
        className={`ui-select__trigger${open ? ' ui-select__trigger--open' : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`ui-select__value${selected ? '' : ' ui-select__value--placeholder'}`}>
          {label}
        </span>
        <span className="ui-select__chevron" aria-hidden>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          ref={menuRef}
          className={`ui-select__menu${flipUp ? ' ui-select__menu--up' : ''}`}
          role="listbox"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`ui-select__option${o.value === value ? ' ui-select__option--selected' : ''}`}
              onClick={() => pick(o.value)}
            >
              <span className="ui-select__option-label">{o.label}</span>
              {o.value === value && <span className="ui-select__check" aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
