import { useCallback, useRef, useState, type ReactNode } from 'react'
import './AppShell.css'

interface AppShellProps {
  sidebar: ReactNode
  toolbar?: ReactNode
  inspector?: ReactNode
  children: ReactNode
}

const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 420
const INSPECTOR_MIN = 240
const INSPECTOR_MAX = 560

const KEYS = {
  sidebarW: 'imgman.shell.sidebarW',
  inspectorW: 'imgman.shell.inspectorW',
  sidebarCollapsed: 'imgman.shell.sidebarCollapsed',
  inspectorCollapsed: 'imgman.shell.inspectorCollapsed'
} as const

function readNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw != null) {
      const n = Number(raw)
      if (Number.isFinite(n)) return n
    }
  } catch {
    /* localStorage unavailable */
  }
  return fallback
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === 'true') return true
    if (raw === 'false') return false
  } catch {
    /* localStorage unavailable */
  }
  return fallback
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* best effort */
  }
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

type Side = 'sidebar' | 'inspector'

export default function AppShell({
  sidebar,
  toolbar,
  inspector,
  children
}: AppShellProps): React.JSX.Element {
  const [sidebarW, setSidebarW] = useState(() =>
    clamp(readNumber(KEYS.sidebarW, 240), SIDEBAR_MIN, SIDEBAR_MAX)
  )
  const [inspectorW, setInspectorW] = useState(() =>
    clamp(readNumber(KEYS.inspectorW, 300), INSPECTOR_MIN, INSPECTOR_MAX)
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readBool(KEYS.sidebarCollapsed, false)
  )
  const [inspectorCollapsed, setInspectorCollapsed] = useState(() =>
    readBool(KEYS.inspectorCollapsed, false)
  )
  const [dragging, setDragging] = useState<Side | null>(null)

  const drag = useRef<{ side: Side; startX: number; startW: number } | null>(null)

  const onMouseDown = useCallback(
    (side: Side) =>
      (e: React.MouseEvent): void => {
        e.preventDefault()
        drag.current = {
          side,
          startX: e.clientX,
          startW: side === 'sidebar' ? sidebarW : inspectorW
        }
        setDragging(side)

        const onMove = (ev: MouseEvent): void => {
          const d = drag.current
          if (!d) return
          // Sidebar grows as the cursor moves right; inspector grows as it moves left.
          const delta = d.side === 'sidebar' ? ev.clientX - d.startX : d.startX - ev.clientX
          if (d.side === 'sidebar') {
            const w = clamp(d.startW + delta, SIDEBAR_MIN, SIDEBAR_MAX)
            setSidebarW(w)
            write(KEYS.sidebarW, String(w))
          } else {
            const w = clamp(d.startW + delta, INSPECTOR_MIN, INSPECTOR_MAX)
            setInspectorW(w)
            write(KEYS.inspectorW, String(w))
          }
        }
        const onUp = (): void => {
          drag.current = null
          setDragging(null)
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      },
    [sidebarW, inspectorW]
  )

  const toggleSidebar = (): void => {
    setSidebarCollapsed((c) => {
      const next = !c
      write(KEYS.sidebarCollapsed, String(next))
      return next
    })
  }
  const toggleInspector = (): void => {
    setInspectorCollapsed((c) => {
      const next = !c
      write(KEYS.inspectorCollapsed, String(next))
      return next
    })
  }

  const showInspector = inspector != null && !inspectorCollapsed

  return (
    <div className="shell">
      {!sidebarCollapsed && (
        <>
          <div className="shell__sidebar" style={{ width: sidebarW }}>
            <div className="shell__pane-body">{sidebar}</div>
          </div>
          <div
            className={`shell__splitter${dragging === 'sidebar' ? ' shell__splitter--active' : ''}`}
            onMouseDown={onMouseDown('sidebar')}
            role="separator"
            aria-orientation="vertical"
          />
        </>
      )}

      <div className="shell__content">
        <div className="shell__toolbar">
          <button
            className="shell__toggle"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            {sidebarCollapsed ? '»' : '«'}
          </button>
          <div className="shell__toolbar-mid">{toolbar}</div>
          {inspector != null && (
            <button
              className="shell__toggle"
              onClick={toggleInspector}
              title={inspectorCollapsed ? 'Show inspector' : 'Hide inspector'}
              aria-label={inspectorCollapsed ? 'Show inspector' : 'Hide inspector'}
            >
              {inspectorCollapsed ? '«' : '»'}
            </button>
          )}
        </div>
        <div className="shell__body">{children}</div>
      </div>

      {showInspector && (
        <>
          <div
            className={`shell__splitter${dragging === 'inspector' ? ' shell__splitter--active' : ''}`}
            onMouseDown={onMouseDown('inspector')}
            role="separator"
            aria-orientation="vertical"
          />
          <div className="shell__inspector" style={{ width: inspectorW }}>
            <div className="shell__pane-body">{inspector}</div>
          </div>
        </>
      )}
    </div>
  )
}
