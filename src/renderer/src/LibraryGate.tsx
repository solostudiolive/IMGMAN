import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Item, LibraryInfo, LibraryResult, SearchCriteria, SmartFolder, Tag } from '../../preload/types'
import ImportZone from './ImportZone'
import Grid, { type GridHandle } from './Grid'
import Inspector from './Inspector'
import QuickPreview from './QuickPreview'
import FolderTree from './FolderTree'
import TagsList from './TagsList'
import SmartFolders from './SmartFolders'
import SearchBar from './SearchBar'
import AppShell from './components/AppShell'
import ContentToolbar from './components/ContentToolbar'
import SettingsModal from './components/SettingsModal'
import DuplicatesModal from './components/DuplicatesModal'
import ContextMenu, { type MenuNode } from './components/ContextMenu'
import BatchTagDialog from './components/BatchTagDialog'
import BatchRenameDialog from './components/BatchRenameDialog'
import MultiInspector from './components/MultiInspector'
import {
  EyeIcon,
  StarIcon,
  TagIcon,
  PencilIcon,
  FolderIcon,
  TrashIcon,
  PlusIcon
} from './components/icons'
import type { RenameInput } from './components/renameItems'
import { useGridView, compareItems } from './hooks/useGridView'
import { useSelection } from './hooks/useSelection'

// True when any search field constrains the results.
function isSearchActive(c: SearchCriteria): boolean {
  return (
    !!c.query?.trim() ||
    !!c.types?.length ||
    !!c.ext?.trim() ||
    !!c.minRating ||
    c.from != null ||
    c.to != null ||
    !!c.tagIds?.length ||
    !!c.color
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
  // Inline rename of the active library's display name.
  const [renamingLib, setRenamingLib] = useState(false)
  const [libNameDraft, setLibNameDraft] = useState('')
  // Browse state for the active library.
  const [items, setItems] = useState<Item[]>([])
  // Multi-select model; `primary` (last-clicked) drives the inspector + quick preview.
  const sel = useSelection()
  const [previewOpen, setPreviewOpen] = useState(false)
  // Active folder filter: null = "All items"; otherwise show that folder's items.
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  // Active search/filter criteria; when active it overrides the folder scope.
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({})
  // Saved searches ("smart folders") for the active library; LibraryGate owns the list so the
  // toolbar "Save search" control can refresh it alongside the sidebar section.
  const [smartFolders, setSmartFolders] = useState<SmartFolder[]>([])
  // All tags in the active library, for the sidebar Tags section. LibraryGate owns the list so
  // it can refresh after tag mutations (batch dialog, multi-inspector edits).
  const [allTags, setAllTags] = useState<Tag[]>([])
  // Settings modal visibility (Appearance + About).
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Find-duplicates modal visibility (launched from Settings → Library maintenance).
  const [duplicatesOpen, setDuplicatesOpen] = useState(false)
  // Open right-click item context menu (null = closed).
  const [itemMenu, setItemMenu] = useState<{ x: number; y: number; items: MenuNode[] } | null>(null)
  // Batch "Add tag…" dialog: the target item ids (null = closed).
  const [tagDialog, setTagDialog] = useState<string[] | null>(null)
  // Batch "Rename…" dialog: the target items (id/name/ext, in display order; null = closed).
  const [renameDialog, setRenameDialog] = useState<RenameInput[] | null>(null)
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
  // Current render order — range selection (shift-click) + keyboard nav walk this list.
  const orderedIds = useMemo(() => sortedItems.map((it) => it.id), [sortedItems])
  // The selected rows (display order) — drives the multi-item inspector.
  const selectedItems = useMemo(
    () => sortedItems.filter((it) => sel.selected.has(it.id)),
    [sortedItems, sel.selected]
  )
  // Imperative grid handle (scroll active into view) + latest column count for 2D nav.
  const gridRef = useRef<GridHandle>(null)
  const columnsRef = useRef(1)

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

  // Reload the active library's saved searches (empty when no library).
  const reloadSmartFolders = useCallback(async () => {
    setSmartFolders(active ? await window.api.smartFolders.list() : [])
  }, [active])

  // Reload the active library's tag list for the sidebar (empty when no library).
  const reloadTags = useCallback(async () => {
    setAllTags(active ? await window.api.tags.listAll() : [])
  }, [active])

  // After an edit that may create/remove tags (batch dialog, multi-inspector), refresh both the
  // grid and the sidebar tag list so a newly-created tag appears immediately.
  const reloadAfterTagEdit = useCallback(() => {
    reloadItems()
    reloadTags()
  }, [reloadItems, reloadTags])

  // Save the current search/filter criteria as a smart folder, then refresh the list.
  const saveCurrentSearch = useCallback(
    (name: string) => {
      void window.api.smartFolders.create(name, searchCriteria).then(setSmartFolders)
    },
    [searchCriteria]
  )

  // Search and folder scopes are mutually exclusive.
  const applySearch = useCallback((c: SearchCriteria) => {
    if (isSearchActive(c)) setSelectedFolderId(null)
    setSearchCriteria(c)
  }, [])
  const selectFolder = useCallback((id: string | null) => {
    setSearchCriteria({})
    setSelectedFolderId(id)
  }, [])
  // Sidebar Tags section: filter the grid to one tag via the search scope (or clear it).
  const selectTag = useCallback(
    (tagId: string | null) => applySearch(tagId ? { tagIds: [tagId] } : {}),
    [applySearch]
  )
  // The tag currently driving the grid (only when a lone tag filter is applied) — for sidebar highlight.
  const selectedTagId =
    searchCriteria.tagIds?.length === 1 && Object.keys(searchCriteria).length === 1
      ? searchCriteria.tagIds[0]
      : null

  // Permanently delete a batch (with confirm), then reload + clear selection. The prune effect
  // drops any stale ids; the inspector empties when primary is cleared.
  const deleteTargets = useCallback(
    async (ids: string[]): Promise<void> => {
      if (ids.length === 0) return
      const ok = window.confirm(
        `Delete ${ids.length} item${ids.length > 1 ? 's' : ''}? This removes the file${
          ids.length > 1 ? 's' : ''
        } from the library and cannot be undone.`
      )
      if (!ok) return
      await window.api.items.delete(ids)
      sel.clear()
      reloadItems()
    },
    [sel, reloadItems]
  )

  // Build + open the item right-click menu. Selection-aware: when the right-clicked item is part of
  // a multi-selection, batch actions act on the WHOLE selection; otherwise the item becomes the
  // single selection and actions act on just it. Batch ops use atomic main-side IPC.
  const openItemMenu = useCallback(
    async (id: string, x: number, y: number): Promise<void> => {
      const multi = sel.selected.has(id) && sel.selected.size > 1
      const targets = multi ? Array.from(sel.selected) : [id]
      if (!multi) sel.handleSelect(id, orderedIds, { ctrl: false, shift: false })

      const folders = await window.api.folders.list()
      const folderNodes: MenuNode[] = folders.length
        ? folders.map((f) => ({
            kind: 'action',
            label: f.name,
            icon: <FolderIcon />,
            onSelect: () => {
              void window.api.folders.assignMany(targets, f.id).then(reloadItems)
            }
          }))
        : [{ kind: 'action', label: 'No folders', disabled: true, onSelect: () => {} }]

      const menu: MenuNode[] = []
      if (targets.length === 1) {
        const only = targets[0]
        const rate = async (n: number): Promise<void> => {
          await window.api.items.update(only, { rating: n })
          reloadItems()
        }
        menu.push(
          { kind: 'action', label: 'Quick preview', icon: <EyeIcon />, onSelect: () => setPreviewOpen(true) },
          {
            kind: 'submenu',
            label: 'Rating',
            icon: <StarIcon />,
            items: [
              { kind: 'action', label: 'Clear', onSelect: () => void rate(0) },
              { kind: 'action', label: '★', onSelect: () => void rate(1) },
              { kind: 'action', label: '★★', onSelect: () => void rate(2) },
              { kind: 'action', label: '★★★', onSelect: () => void rate(3) },
              { kind: 'action', label: '★★★★', onSelect: () => void rate(4) },
              { kind: 'action', label: '★★★★★', onSelect: () => void rate(5) }
            ]
          }
        )
      }
      menu.push(
        { kind: 'action', label: 'Add tag…', icon: <TagIcon />, onSelect: () => setTagDialog(targets) },
        {
          kind: 'action',
          label: 'Rename…',
          icon: <PencilIcon />,
          onSelect: () => {
            const tset = new Set(targets)
            setRenameDialog(
              sortedItems
                .filter((it) => tset.has(it.id))
                .map((it) => ({ id: it.id, name: it.name, ext: it.ext }))
            )
          }
        },
        { kind: 'submenu', label: 'Add to folder', icon: <FolderIcon />, items: folderNodes },
        { kind: 'separator' },
        {
          kind: 'action',
          label: targets.length > 1 ? `Delete ${targets.length} items` : 'Delete item',
          icon: <TrashIcon />,
          danger: true,
          onSelect: () => void deleteTargets(targets)
        }
      )
      setItemMenu({ x, y, items: menu })
    },
    [sel, orderedIds, sortedItems, reloadItems, deleteTargets]
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  // A new library starts at the "All items" scope (folders + search are per-library).
  useEffect(() => {
    setSelectedFolderId(null)
    setSearchCriteria({})
    setRenamingLib(false)
  }, [active?.path])

  // Load (or clear) saved searches when the active library changes.
  useEffect(() => {
    reloadSmartFolders()
  }, [active?.path, reloadSmartFolders])

  // Load (or clear) the sidebar tag list when the active library changes.
  useEffect(() => {
    reloadTags()
  }, [active?.path, reloadTags])

  // Load (or clear) items whenever the active library or folder scope changes;
  // reset selection (reloadItems identity changes with selectedFolderId).
  useEffect(() => {
    sel.clear()
    setPreviewOpen(false)
    if (active) reloadItems()
    else setItems([])
  }, [active?.path, reloadItems])

  // A cleared selection can't have a preview open.
  useEffect(() => {
    if (!sel.primary) setPreviewOpen(false)
  }, [sel.primary])

  // Drop any selected ids that are no longer in the (filtered) list.
  useEffect(() => {
    sel.prune(orderedIds)
  }, [orderedIds])

  // Keyboard: Space/Enter toggle the primary's quick preview; Escape closes it (else clears
  // selection); Delete removes the selection; arrows navigate + select (2D in grid, 1D in
  // list/masonry); Shift+arrows extend; Ctrl/Cmd+A selects all; Home/End jump. Suppressed while
  // typing, the Settings modal is open, or a context menu / batch dialog owns the keyboard.
  useEffect(() => {
    if (!active || settingsOpen || duplicatesOpen || tagDialog || renameDialog || itemMenu) return
    const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return

      // Select all
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        if (orderedIds.length) sel.selectAll(orderedIds)
        return
      }
      if (e.ctrlKey || e.metaKey) return // leave other ctrl/cmd combos alone

      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault()
        if (sel.primary) setPreviewOpen((open) => !open)
        return
      }
      if (e.key === 'Escape') {
        if (previewOpen) setPreviewOpen(false)
        else sel.clear()
        return
      }
      if (e.key === 'Delete') {
        e.preventDefault()
        if (sel.selected.size > 0) void deleteTargets(Array.from(sel.selected))
        return
      }

      if (!orderedIds.length) return
      const cols = columnsRef.current
      const idx = sel.primary ? orderedIds.indexOf(sel.primary) : -1

      let next: number | null = null
      switch (e.key) {
        case 'ArrowLeft':
          next = idx === -1 ? 0 : clamp(idx - 1, 0, orderedIds.length - 1)
          break
        case 'ArrowRight':
          next = idx === -1 ? 0 : clamp(idx + 1, 0, orderedIds.length - 1)
          break
        case 'ArrowUp':
          next = idx === -1 ? 0 : clamp(idx - (viewMode === 'grid' ? cols : 1), 0, orderedIds.length - 1)
          break
        case 'ArrowDown':
          next = idx === -1 ? 0 : clamp(idx + (viewMode === 'grid' ? cols : 1), 0, orderedIds.length - 1)
          break
        case 'Home':
          next = 0
          break
        case 'End':
          next = orderedIds.length - 1
          break
        default:
          return
      }

      e.preventDefault()
      const nextId = orderedIds[next]
      sel.handleSelect(nextId, orderedIds, { ctrl: false, shift: e.shiftKey })
      gridRef.current?.scrollToId(nextId)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, sel, orderedIds, viewMode, previewOpen, settingsOpen, duplicatesOpen, tagDialog, renameDialog, itemMenu, deleteTargets])

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

  // Persist the inline library rename (no-op on empty / unchanged), then refresh name + recents.
  const submitLibraryRename = async () => {
    const trimmed = libNameDraft.trim()
    setRenamingLib(false)
    if (trimmed && trimmed !== active?.name) {
      await apply(await window.api.library.rename(trimmed))
    }
  }

  const previewItem =
    previewOpen && sel.primary ? sortedItems.find((it) => it.id === sel.primary) : null

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
                {renamingLib ? (
                  <input
                    autoFocus
                    value={libNameDraft}
                    onChange={(e) => setLibNameDraft(e.target.value)}
                    onBlur={submitLibraryRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitLibraryRename()
                      if (e.key === 'Escape') setRenamingLib(false)
                    }}
                    style={{
                      ...INPUT_STYLE,
                      width: '100%',
                      fontWeight: 'var(--fw-semibold)',
                      fontSize: 'var(--fs-md)'
                    }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div
                      title={active.path}
                      style={{
                        flex: 1,
                        minWidth: 0,
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
                      type="button"
                      title="Rename library"
                      aria-label="Rename library"
                      onClick={() => {
                        setLibNameDraft(active.name)
                        setRenamingLib(true)
                      }}
                      style={{
                        flex: '0 0 auto',
                        display: 'inline-flex',
                        background: 'none',
                        border: 'none',
                        padding: 2,
                        cursor: 'pointer',
                        color: 'var(--color-text-faint)'
                      }}
                    >
                      <PencilIcon size={13} />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => run(() => window.api.library.open())}
                  disabled={busy}
                  className="sidebar-switch-btn"
                >
                  <FolderIcon size={14} style={{ color: 'var(--color-accent)' }} />
                  Switch / Open…
                </button>
                {creating ? (
                  <input
                    autoFocus
                    value={name}
                    placeholder="New library name — press Enter"
                    disabled={busy}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => {
                      if (!name.trim()) setCreating(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitCreate()
                      if (e.key === 'Escape') {
                        setCreating(false)
                        setName('')
                      }
                    }}
                    style={{ ...INPUT_STYLE, width: '100%', marginTop: 'var(--space-2)' }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    disabled={busy}
                    className="sidebar-switch-btn"
                  >
                    <PlusIcon size={14} style={{ color: 'var(--color-accent)' }} />
                    New Library…
                  </button>
                )}
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
                <TagsList tags={allTags} selectedTagId={selectedTagId} onSelect={selectTag} />
                <SmartFolders
                  folders={smartFolders}
                  activeCriteria={searchCriteria}
                  searchActive={isSearchActive(searchCriteria)}
                  onSelect={applySearch}
                  onRename={(id, name) =>
                    void window.api.smartFolders.rename(id, name).then(setSmartFolders)
                  }
                  onDelete={async (f) => {
                    if (window.confirm(`Delete saved search "${f.name}"?`)) {
                      setSmartFolders(await window.api.smartFolders.delete(f.id))
                    }
                  }}
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
          toolbar={
            <SearchBar criteria={searchCriteria} onChange={applySearch} onSave={saveCurrentSearch} />
          }
          inspector={
            sel.selected.size > 1 ? (
              <MultiInspector items={selectedItems} onChanged={reloadAfterTagEdit} />
            ) : (
              <Inspector selectedId={sel.primary} />
            )
          }
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
                selectedCount={sel.selected.size}
                onThumbSize={setThumbSize}
                onSortField={setSortField}
                onSortDir={setSortDir}
                onViewMode={setViewMode}
              />
            </div>
            {/* Empty-space clear + rubber-band marquee are owned by Grid's background pointer
                handler (so a drag and a click don't conflict). */}
            <div style={{ flex: '1 1 auto', minHeight: 0, paddingTop: 'var(--space-3)' }}>
              <Grid
                ref={gridRef}
                items={sortedItems}
                selectedIds={sel.selected}
                thumbSize={thumbSize}
                viewMode={viewMode}
                onColumns={(n) => (columnsRef.current = n)}
                onSelect={(id, mods) => sel.handleSelect(id, orderedIds, mods)}
                onMarqueeSelect={(ids, additive) => sel.applyMarquee(ids, additive)}
                onBackgroundClick={() => sel.clear()}
                onItemContextMenu={openItemMenu}
              />
            </div>
          </div>
        </AppShell>
        {previewItem && <QuickPreview item={previewItem} onClose={() => setPreviewOpen(false)} />}
        {itemMenu && (
          <ContextMenu
            x={itemMenu.x}
            y={itemMenu.y}
            items={itemMenu.items}
            onClose={() => setItemMenu(null)}
          />
        )}
        {tagDialog && (
          <BatchTagDialog
            count={tagDialog.length}
            onSubmit={async (name) => {
              await window.api.tags.addToMany(tagDialog, name)
              reloadAfterTagEdit()
            }}
            onClose={() => setTagDialog(null)}
          />
        )}
        {renameDialog && (
          <BatchRenameDialog
            items={renameDialog}
            onApply={async (renames) => {
              if (renames.length) {
                await window.api.items.renameMany(renames)
                reloadItems()
              }
            }}
            onClose={() => setRenameDialog(null)}
          />
        )}
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onFindDuplicates={() => {
            setSettingsOpen(false)
            setDuplicatesOpen(true)
          }}
        />
        <DuplicatesModal
          open={duplicatesOpen}
          onClose={() => setDuplicatesOpen(false)}
          onChanged={reloadItems}
        />
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
