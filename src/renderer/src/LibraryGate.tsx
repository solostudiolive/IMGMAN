import { useCallback, useEffect, useState } from 'react'
import type { LibraryInfo, LibraryResult } from '../../preload/types'
import ImportZone from './ImportZone'

export default function LibraryGate() {
  const [active, setActive] = useState<LibraryInfo | null>(null)
  const [recents, setRecents] = useState<LibraryInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Electron doesn't support window.prompt(), so collect the name inline.
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const refresh = useCallback(async () => {
    setActive(await window.api.library.getActive())
    setRecents(await window.api.library.listRecent())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

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

  if (active) {
    return (
      <section>
        <h2 style={{ margin: '0 0 4px' }}>{active.name}</h2>
        <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>{active.path}</p>
        <ImportZone key={active.path} />
        <p style={{ marginTop: 16 }}>
          <button onClick={() => run(() => window.api.library.open())} disabled={busy}>
            Open a different library…
          </button>
        </p>
        <Recents recents={recents} active={active} busy={busy} onPick={(p) => run(() => window.api.library.openPath(p))} />
        {error && <p style={{ color: '#c00' }}>{error}</p>}
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
