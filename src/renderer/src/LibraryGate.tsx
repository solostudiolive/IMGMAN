import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Item, LibraryInfo, LibraryResult, SearchCriteria } from '../../preload/types'
import ImportZone from './ImportZone'
import Grid from './Grid'
import Inspector from './Inspector'
import QuickPreview from './QuickPreview'
import FolderTree from './FolderTree'
import SearchBar from './SearchBar'
import AppShell from './components/AppShell'
import ContentToolbar from './components/ContentToolbar'
import SettingsModal from './components/SettingsModal'
import { useGridView, compareItems } from './hooks/useGridView'

// True when any search field constrains the results.
function isSearchActive(c: SearchCriteria): boolean {
  return (
    !!c.query?.trim() ||
    !!c.types?.length ||
    !!c.ext?.trim() ||
    !!c.minRating ||
    c.from != null ||
    c.to != null
  )
}

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
  // Active folder filter: null = "All items"; otherwise show that folder's items.
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  // Active search/filter criteria; when active it overrides the folder scope.
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({})
  // Settings modal visibility (Appearance + About).
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Persisted grid view-state: thumbnail size + sort field/direction.
  const {
    thumbSize,
    sortField,
    sortDir,
    viewMode,
    setThumbSize,
    setSortField,
    setSortDir,
    setViewMode
  } = useGridView()

  // Sort is a pure view transform over the already-loaded scope (all-items / folder /
  // search), so one comparator covers every scope with no IPC change.
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => compareItems(a, b, sortField, sortDir)),
    [items, sortField, sortDir]
  )

  const refresh = useCallback(async () => {
    setActive(await window.api.library.getActive())
    setRecents(await window.api.library.listRecent())
  }, [])

  // Load the grid for the current scope (search wins over folder over all-items).
  const reloadItems = useCallback(async () => {
    let list: Item[]
    if (isSearchActive(searchCriteria)) list = await window.api.items.search(searchCriteria)
    else if (selectedFolderId) list = await window.api.folders.itemsIn(selectedFolderId)
    else list = await window.api.items.list()
    setItems(list)
  }, [searchCriteria, selectedFolderId])

  // Search and folder scopes are mutually exclusive.
  const applySearch = useCallback((c: SearchCriteria) => {
    if (isSearchActive(c)) setSelectedFolderId(null)
    setSearchCriteria(c)
  }, [])
  const selectFolder = useCallback((id: string | null) => {
    setSearchCriteria({})
    setSelectedFolderId(id)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // A new library starts at the "All items" scope (folders + search are per-library).
  useEffect(() => {
    setSelectedFolderId(null)
    setSearchCriteria({})
  }, [active?.path])

  // Load (or clear) items whenever the active library or folder scope changes;
  // reset selection (reloadItems identity changes with selectedFolderId).
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

  // If the selected item is no longer in the (filtered) list, clear the selection.
  useEffect(() => {
    if (selectedId && !items.some((it) => it.id === selectedId)) setSelectedId(null)
  }, [items, selectedId])

  // Space toggles the quick preview of the selected item; Escape closes it.
  // Suppressed while the Settings modal is open (it owns the keyboard then).
  useEffect(() => {
    if (!active || settingsOpen) return
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
  }, [active, selectedId, settingsOpen])

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

  const previewItem =
    previewOpen && selectedId ? sortedItems.find((it) => it.id === selectedId) : null

  if (active) {
    return (
      <>
        <AppShell
          sidebar={
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                padding: 'var(--space-2)',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ flex: '0 0 auto', marginBottom: 'var(--space-3)' }}>
                <div
                  title={active.path}
                  style={{
                    fontWeight: 'var(--fw-semibold)',
                    fontSize: 'var(--fs-md)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {active.name}
                </div>
                <button
                  onClick={() => run(() => window.api.library.open())}
                  disabled={busy}
                  style={SECONDARY_BTN}
                >
                  Switch / Open…
                </button>
                <Recents
                  recents={recents}
                  active={active}
                  busy={busy}
                  onPick={(p) => run(() => window.api.library.openPath(p))}
                />
              </div>
              <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto' }}>
                <FolderTree
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={selectFolder}
                  onFoldersChanged={reloadItems}
                />
              </div>
              <div
                style={{
                  flex: '0 0 auto',
                  marginTop: 'var(--space-2)',
                  paddingTop: 'var(--space-2)',
                  borderTop: '1px solid var(--color-border)'
                }}
              >
                <button onClick={() => setSettingsOpen(true)} style={SECONDARY_BTN}>
                  ⚙ Settings
                </button>
              </div>
            </div>
          }
          toolbar={<SearchBar criteria={searchCriteria} onChange={applySearch} />}
          inspector={<Inspector selectedId={selectedId} />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {error && (
              <p style={{ color: 'var(--color-danger)', margin: 'var(--space-2) var(--space-3)' }}>
                {error}
              </p>
            )}
            <div style={{ flex: '0 0 auto' }}>
              <ImportZone key={active.path} onChanged={reloadItems} />
            </div>
            <div style={{ flex: '0 0 auto' }}>
              <ContentToolbar
                thumbSize={thumbSize}
                sortField={sortField}
                sortDir={sortDir}
                viewMode={viewMode}
                count={sortedItems.length}
                onThumbSize={setThumbSize}
                onSortField={setSortField}
                onSortDir={setSortDir}
                onViewMode={setViewMode}
              />
            </div>
            <div style={{ flex: '1 1 auto', minHeight: 0 }}>
              <Grid
                items={sortedItems}
                selectedId={selectedId}
                thumbSize={thumbSize}
                viewMode={viewMode}
                onSelect={setSelectedId}
              />
            </div>
          </div>
        </AppShell>
        {previewItem && <QuickPreview item={previewItem} onClose={() => setPreviewOpen(false)} />}
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </>
    )
  }

  return (
    <>
      <section style={WELCOME_STYLE}>
      <div style={{ maxWidth: 460, width: '100%' }}>
        <h2 style={{ margin: '0 0 var(--space-2)' }}>IMGMAN</h2>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 0 }}>
          No library open. Create a new one or open an existing library folder.
        </p>
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
              style={INPUT_STYLE}
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
        <Recents
          recents={recents}
          active={active}
          busy={busy}
          onPick={(p) => run(() => window.api.library.openPath(p))}
        />
        {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
        <div style={{ marginTop: 'var(--space-4)' }}>
          <button
            onClick={() => setSettingsOpen(true)}
            style={{ ...SECONDARY_BTN, width: 'auto' }}
          >
            ⚙ Settings
          </button>
        </div>
      </div>
      </section>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
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
    <div style={{ marginTop: 'var(--space-4)' }}>
      <h3
        style={{
          fontSize: 'var(--fs-xs)',
          color: 'var(--color-text-faint)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          margin: '0 0 var(--space-1)'
        }}
      >
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
                style={{ ...SECONDARY_BTN, textAlign: 'left' }}
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

const WELCOME_STYLE: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-5)',
  background: 'var(--color-bg-content)'
}

const SECONDARY_BTN: React.CSSProperties = {
  marginTop: 'var(--space-1)',
  width: '100%',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-1) var(--space-2)',
  fontSize: 'var(--fs-sm)',
  cursor: 'pointer'
}

const INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-1) var(--space-2)',
  fontSize: 'var(--fs-sm)'
}
