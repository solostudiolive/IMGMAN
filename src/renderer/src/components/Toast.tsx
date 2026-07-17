import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Lightweight global toast: any module calls showToast(...); a single <ToastHost/> (mounted once
// near the app root) renders the stack via a portal and auto-dismisses each entry. No dependency,
// no context — a module-level subscriber list keeps callers decoupled from React.

export type ToastKind = 'info' | 'success' | 'error'

interface Toast {
  id: number
  message: string
  kind: ToastKind
}

type Listener = (toasts: Toast[]) => void

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<Listener>()

function emit(): void {
  for (const l of listeners) l(toasts)
}

/** Show a toast. Returns nothing; it auto-dismisses after `durationMs` (default 4s). */
export function showToast(message: string, kind: ToastKind = 'info', durationMs = 4000): void {
  const id = nextId++
  toasts = [...toasts, { id, message, kind }]
  emit()
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }, durationMs)
}

// Mount ONCE (App root). Subscribes to the module store and renders the toast stack.
export function ToastHost(): React.JSX.Element | null {
  const [items, setItems] = useState<Toast[]>(toasts)

  useEffect(() => {
    listeners.add(setItems)
    return () => {
      listeners.delete(setItems)
    }
  }, [])

  if (items.length === 0) return null

  return createPortal(
    <div style={STACK_STYLE} role="status" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          style={{ ...TOAST_STYLE, borderLeft: `3px solid ${accentFor(t.kind)}` }}
        >
          {t.message}
        </div>
      ))}
    </div>,
    document.body
  )
}

function accentFor(kind: ToastKind): string {
  if (kind === 'success') return 'var(--color-success, #22c55e)'
  if (kind === 'error') return 'var(--color-danger, #ef4444)'
  return 'var(--color-accent)'
}

const STACK_STYLE: React.CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  maxWidth: 360,
  pointerEvents: 'none'
}

const TOAST_STYLE: React.CSSProperties = {
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 14px',
  fontSize: 'var(--fs-sm)',
  lineHeight: 1.4,
  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.28)',
  pointerEvents: 'auto'
}
