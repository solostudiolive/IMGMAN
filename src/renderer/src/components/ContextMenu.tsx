import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './ContextMenu.css'

// A node in a context menu. Presentational only — actions carry their own onSelect; the menu
// knows nothing about selection or IPC.
export type MenuNode =
  | { kind: 'action'; label: string; icon?: string; danger?: boolean; disabled?: boolean; onSelect: () => void }
  | { kind: 'submenu'; label: string; icon?: string; items: MenuNode[] }
  | { kind: 'separator' }

export interface ContextMenuProps {
  x: number
  y: number
  items: MenuNode[]
  onClose: () => void
}

// Reusable right-click menu. Rendered through a portal so it escapes pane overflow/clipping;
// positioned at a viewport point (clientX/clientY) and flipped to stay on screen. Dismisses on
// Escape (swallowed so it doesn't reach the global grid handler), outside mousedown, scroll,
// resize, or window blur — and after any action runs, via the caller's onClose.
export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    const dismiss = (): void => onClose()
    document.addEventListener('mousedown', onDocMouseDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    window.addEventListener('blur', dismiss)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('blur', dismiss)
    }
  }, [onClose])

  return createPortal(
    <div ref={rootRef}>
      <MenuPanel x={x} y={y} items={items} onClose={onClose} />
    </div>,
    document.body
  )
}

// One menu surface (the root list or a submenu flyout). Positions itself at (x, y) and flips to
// stay within the viewport.
function MenuPanel({
  x,
  y,
  items,
  onClose
}: {
  x: number
  y: number
  items: MenuNode[]
  onClose: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const margin = 4
    let left = x
    let top = y
    if (left + rect.width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - rect.width - margin)
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - rect.height - margin)
    }
    setPos({ left, top })
  }, [x, y, items])

  return (
    <div ref={ref} className="context-menu" style={{ left: pos.left, top: pos.top }} role="menu">
      {items.map((node, i) => {
        if (node.kind === 'separator') {
          return <div key={i} className="context-menu__sep" role="separator" />
        }
        if (node.kind === 'submenu') {
          return (
            <SubmenuRow
              key={i}
              node={node}
              open={openIdx === i}
              onOpen={() => setOpenIdx(i)}
              onClose={onClose}
            />
          )
        }
        return (
          <button
            key={i}
            type="button"
            role="menuitem"
            className={`context-menu__item${node.danger ? ' context-menu__item--danger' : ''}`}
            disabled={node.disabled}
            aria-disabled={node.disabled}
            onMouseEnter={() => setOpenIdx(null)}
            onClick={() => {
              if (node.disabled) return
              node.onSelect()
              onClose()
            }}
          >
            {node.icon && <span className="context-menu__icon">{node.icon}</span>}
            <span className="context-menu__label">{node.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// A submenu parent row plus its flyout (one level). The flyout opens to the row's right; MenuPanel's
// own viewport-flip keeps it on screen when there's no room.
function SubmenuRow({
  node,
  open,
  onOpen,
  onClose
}: {
  node: Extract<MenuNode, { kind: 'submenu' }>
  open: boolean
  onOpen: () => void
  onClose: () => void
}): React.JSX.Element {
  const rowRef = useRef<HTMLButtonElement>(null)
  const [flyout, setFlyout] = useState<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setFlyout(null)
      return
    }
    const el = rowRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setFlyout({ x: r.right, y: r.top })
  }, [open])

  return (
    <div className="context-menu__submenu" onMouseEnter={onOpen}>
      <button
        ref={rowRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        className="context-menu__item context-menu__item--parent"
      >
        {node.icon && <span className="context-menu__icon">{node.icon}</span>}
        <span className="context-menu__label">{node.label}</span>
        <span className="context-menu__chevron">▸</span>
      </button>
      {open && flyout && (
        <MenuPanel x={flyout.x} y={flyout.y} items={node.items} onClose={onClose} />
      )}
    </div>
  )
}
