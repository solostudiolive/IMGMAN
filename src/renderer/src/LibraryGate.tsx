import { useCallback, useEffect, useState } from 'react'
import type { Item, LibraryInfo, LibraryResult } from '../../preload/types'
import ImportZone from './ImportZone'
import Grid from './Grid'
import Inspector from './Inspector'
import QuickPreview from './QuickPreview'

export default function LibraryGate() {
  const [active, setActive] = useState<LibraryInfo | null>(null)
  const [recents, setRecents] = useState<LibraryInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Electron doesn't support window.prompt(), so collect the name inline.
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  // Browse state for the active library.
  const [items, setItems] = useState<Item[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const refresh = useCallback(async () => {
    setActive(await window.api.library.getActive())
    setRecents(await window.api.library.listRecent())
  }, [])

  const reloadItems = useCallback(async () => {
    setItems(await window.api.items.list())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Load (or clear) items whenever the active library changes; reset selection.
  useEffect(() => {
    setSelectedId(null)
    setPreviewOpen(false)
    if (active) reloadItems()
    else setItems([])
  }, [active?.path, reloadItems])

  // A cleared selection can't have a preview open.
  useEffect(() => {
    if (!selectedId) setPreviewOpen(false)
  }, [selectedId])

  // Space toggles the quick preview of the selected item; Escape closes it.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (selectedId) setPreviewOpen((open) => !open)
      } else if (e.key === 'Escape') {
        setPreviewOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, selectedId])

  // Apply a library:* result: update state on success, surface errors, ignore cancels.
  const apply = useCallback(
    async (result: LibraryResult) => {
      if (result.ok) {
        setError(null)
        await refresh()
      } else if (!('cancelled' in result)) {
        setError(result.error)
      }
    },
    [refresh]
  )

  const run = useCallback(
    async (fn: () => Promise<LibraryResult>) => {
      setBusy(true)
      try {
        await apply(await fn())
      } finally {
        setBusy(false)
      }
    },
    [apply]
  )

  const submitCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    await run(() => window.api.library.create(trimmed))
    setCreating(false)
    setName('')
  }

  const previewItem = previewOpen && selectedId ? items.find((it) => it.id === selectedId) : null

  if (active) {
    return (
      <section
        style={{ display: 'flex', flexDirection: 'column', gap: 12, height: 'calc(100vh - 120px)' }}
      >
        <header style={{ flex: '0 0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>{active.name}</h2>
            <span style={{ color: '#888', fontSize: 12 }}>{active.path}</span>
            <button
              style={{ marginLeft: 'auto' }}
              onClick={() => run(() => window.api.library.open())}
              disabled={busy}
            >
              Open a different library…
            </button>
          </div>
          <div style={{ marginTop: 10 }}>
            <ImportZone key={active.path} onChanged={reloadItems} />
          </div>
          <Recents
            recents={recents}
            active={active}
            busy={busy}
            onPick={(p) => run(() => window.api.library.openPath(p))}
          />
          {error && <p style={{ color: '#c00' }}>{error}</p>}
        </header>
        <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Grid items={items} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <Inspector selectedId={selectedId} />
        </div>
        {previewItem && (
          <QuickPreview item={previewItem} onClose={() => setPreviewOpen(false)} />
        )}
      </section>
    )
  }

  return (
    <section>
      <p>No library open. Create a new one or open an existing library folder.</p>
      {creating ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            autoFocus
            value={name}
            placeholder="Library name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCreate()
              if (e.key === 'Escape') {
                setCreating(false)
                setName('')
              }
            }}
          />
          <button onClick={submitCreate} disabled={busy || !name.trim()}>
            Choose folder & create…
          </button>
          <button
            onClick={() => {
              setCreating(false)
              setName('')
            }}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setCreating(true)} disabled={busy}>
            Create Library…
          </button>
          <button onClick={() => run(() => window.api.library.open())} disabled={busy}>
            Open Library…
          </button>
        </div>
      )}
      <Recents recents={recents} active={active} busy={busy} onPick={(p) => run(() => window.api.library.openPath(p))} />
      {error && <p style={{ color: '#c00' }}>{error}</p>}
    </section>
  )
}

function Recents({
  recents,
  active,
  busy,
  onPick
}: {
  recents: LibraryInfo[]
  active: LibraryInfo | null
  busy: boolean
  onPick: (path: string) => void
}) {
  if (recents.length === 0) return null
  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Recent libraries
      </h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {recents.map((r) => {
          const isActive = active?.path === r.path
          return (
            <li key={r.path} style={{ marginBottom: 4 }}>
              <button
                onClick={() => onPick(r.path)}
                disabled={busy || isActive}
                title={r.path}
                style={{ textAlign: 'left' }}
              >
                {r.name} {isActive ? '(active)' : ''}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
