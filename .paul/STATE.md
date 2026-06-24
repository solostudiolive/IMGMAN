# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-06-23)

**Core value:** A fast, offline-first local "second brain" — collect, organize, search, and browse tens of thousands of visual assets in under a second, with full data ownership.
**Current focus:** v1.0 — Eagle Parity (Phases 5–9): full Eagle-app look, feel, and feature parity, reusing the v0.1 backend.

## Current Position

Milestone: v1.0 — Eagle Parity 🚧 In Progress (3 of 5 phases complete)
Phase: 8 of 9 (Organize power features) — Not started (ready to plan)
Plan: Not started
Status: Ready to plan Phase 8
Last activity: 2026-06-24 — Phase 7 (Selection & interaction) COMPLETE + transitioned to Phase 8. Closed Plan 07-07 (editable multi-item inspector — FINAL): MultiInspector (selection > 1) with renderer-side aggregate header + Mixed-aware batch rating + common-tags/folders (INTERSECTION) chips; five new batch/aggregate IPC channels wired end-to-end. PROJECT.md + ROADMAP evolved; single feat(07-selection-interaction) commit created bundling 07-01…07-07.

Progress:
- v1.0 Eagle Parity: [██████░░░░] 60% (3 of 5 phases complete; Phase 8 next)
- Phase 7: [██████████] 100% (7 of 7 plans complete) ✅

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Phase 7 complete — loop closed; ready to PLAN Phase 8]
```

Note: Phase 7 COMPLETE (7/7): 07-01 multi-select ✓, 07-02 keyboard nav ✓, 07-03 marquee ✓, 07-04
context menus ✓, 07-05 batch delete/tag/move ✓, 07-06 batch rename ✓, 07-07 multi-item inspector ✓.
Single `feat(07-selection-interaction): …` commit bundled all seven plans (first Phase-7 commit).
Next: /paul:plan for Phase 8 (Organize power features — smart folders / saved searches, color
extraction + color search, find duplicates; scans run in workers).

## Accumulated Context

### Decisions
- 2026-06-24: Multi-item inspector (07-07) — a NEW `components/MultiInspector` (shown when `sel.selected.size > 1`, gated in LibraryGate via a `selectedItems` memo) editing the WHOLE selection. Header aggregates (count · total size · per-type breakdown · common-rating) are computed RENDERER-side from the already-loaded `Item[]` (free); only the shared tag/folder lists are fetched. "Common" = the strict INTERSECTION via a dynamic `IN (?,?,…)` + `HAVING COUNT(DISTINCT item_id) = ids.length` (no tri-state/partial chips, no per-item drill-down). FIVE new channels (service→ipc→preload→IpcApi): `items:rateMany(ids,rating)` (clamp 0..5, one txn), `tags:commonForItems(ids)`/`tags:removeFromMany(ids,tagId)`, `folders:commonForItems(ids)`/`folders:unassignMany(ids,folderId)` — each batch mutation one `db.transaction` returning a count; the "add" side REUSES existing `tags:addToMany`/`folders:assignMany` (07-05). StarRating shows "Mixed" when ratings differ (commonRating null), sets all on click. After any edit: refetch the common lists + `onChanged()` (reload grid). Token-styled (no legacy hex). Single Inspector / TagEditor / FolderAssigner untouched; no schema change; no new deps. | Phase 7 (07-07) | FINAL Phase-7 plan — triggered the transition + the single `feat(07-selection-interaction)` commit. Intersection-read + atomic-batch-mutate pair reusable for Phase 8 selection-driven surfaces.
- 2026-06-24: Batch rename (07-06) — new atomic IPC `items:renameMany({id,name}[])` (one `db.transaction` of `UPDATE items SET name`, trimmed/non-empty only, returns count) — a DEDICATED channel, NOT ItemPatch/items:update (which is rating-only). Rename is METADATA-ONLY: writes the `name` column; the on-disk `images/<id>/original.<ext>` file and `ext` are never touched (re-rename to revert; no undo). New names are computed RENDERER-side for an instant preview via a pure helper `components/renameItems.ts` (`computeName`/`computeRenames`/`specError`): Pattern mode replaces tokens `{name}`/`{ext}`/`{n}` (with a start number + zero-pad), Find&Replace mode does literal (split/join or escaped regex) or JS-`RegExp` replace with a case-sensitive toggle; invalid regex → `specError` message → dialog disables Apply (computeName falls back to the original). `BatchRenameDialog` (token modal mirroring BatchTagDialog, self-owns Escape) shows a live old→new preview (capped 50 rows) and applies only changed/non-blank names. "Rename…" added to the item menu (single + multi), mapping target ids → sorted Item rows so the sequence follows display order. No schema change; no new deps. | Phase 7 (07-06) | Completes the batch-action set (delete/tag/move/rename); pure-helper + token-modal + atomic-persist shape reusable for future bulk edits. 07-07 multi-item inspector is the FINAL plan.
- 2026-06-24: Batch operations (07-05) — three ATOMIC main-side batch IPC channels, each one `db.transaction(...)` returning a count, mirroring the existing service→ipc→preload→IpcApi triad: `items:delete(ids)` (deleteItems: delete item_tags + item_folders links THEN items rows in the txn — FKs are NOT ON DELETE CASCADE — then best-effort `rmSync(images/<id>, {recursive,force})` AFTER commit; permanent, confirm-only, no trash/undo; items_fts left alone as it's unwired), `tags:addToMany(ids,name)` (lookup-or-insert tag once + INSERT OR IGNORE links), `folders:assignMany(ids,folderId)` (INSERT OR IGNORE). NO schema change (reuses tables). Renderer: the 07-04 item menu is now SELECTION-AWARE — right-click an item that's in a multi-selection acts on the WHOLE selection (labels show count), else it selects + acts on the single item; added Delete-key (with window.confirm) and a token-styled `BatchTagDialog` (mirrors SettingsModal, self-owns Escape). Folder batch op is ADD/assign-many (true move/unassign deferred — multi-folder membership). items.ts now imports services/library (imagesDir/getActiveLibrary) — no import cycle (library → ../db only). | Phase 7 (07-05) | Atomic batch-IPC pattern reused by 07-06 rename; full find/replace+pattern rename split into its OWN 07-06, multi-item inspector → 07-07.
- 2026-06-24: Context menus (07-04) — ONE reusable presentational `ContextMenu` (components/ContextMenu.tsx) rendered via `createPortal(document.body)` (escapes the three-pane/scroller overflow), `position:fixed` at clientX/clientY with a `useLayoutEffect` viewport-flip, dismiss on Escape (capture + stopPropagation so the global grid key handler never sees it) / outside mousedown / scroll / resize / blur. Node model `MenuNode = action | submenu(ONE level flyout) | separator`. Each surface holds its own `{x,y,items}|null` state and an `onContextMenu` handler; the menu is otherwise logic-free. Wired to: grid/masonry/list ITEMS (Grid gained `onItemContextMenu(id,x,y)` on every cell button → LibraryGate builds Quick preview · Rating ▸ · Add to folder ▸ acting on the SINGLE right-clicked item via existing items.update/folders.assign), sidebar FOLDERS (FolderTree row → New subfolder/Rename/Delete reusing its handlers; All items → New folder), inspector TAG chips (Remove from item via tags.remove). Renderer-only; no new IPC/deps. Scope: multi-item batch + items:delete deferred to 07-05; tags menu = remove-from-item only (no tag rename/delete IPC). | Phase 7 (07-04) | Menu infra + per-surface pattern that 07-05 extends with batch actions (incl. Delete).
- 2026-06-24: Rubber-band marquee (07-03) — Grid owns ALL background pointer interaction: a left-button mousedown on empty space (guarded by `closest('[data-item-id]')` so cells never start a marquee) attaches document-level mousemove/mouseup; a 4px threshold splits a click (→ onBackgroundClick → clear) from a drag (→ token `.marquee` overlay + live client-rect hit-test of mounted `[data-item-id]` cells → onMarqueeSelect). useSelection.applyMarquee unions (Shift/Ctrl/Cmd) or replaces. The 07-01 empty-click clear was REMOVED from LibraryGate's wrapper onClick and absorbed here to kill the click/drag race. Renderer-only; no IPC/main/SQL. Scope limit: only on-screen (mounted) cells hit-test, no auto-scroll during drag (deferred). | Phase 7 (07-03) | Completes the selection surface (click+keyboard+marquee); reusable threshold-gated drag-gesture pattern for 07-04 context menus / future drag-to-move.
- 2026-06-24: Content-area view bar (06-01) — `useGridView` hook holds persisted {thumbSize, sortField, sortDir, viewMode} (localStorage); sort is renderer-side via one `compareItems` over the already-loaded scope list (covers all-items/folder/search, NO IPC/SQL change); thumbnail size drives VirtuosoGrid columns via a `--imgman-thumb` custom property (no scroller remount). View controls live in a NEW content-area sub-toolbar (ContentToolbar), not the 05-03 shell toolbar. | Phase 6 (06-01) | 06-02/03/04 extend useGridView + ContentToolbar.
- 2026-06-24: List view (06-03) = react-virtuoso `Virtuoso` (already a dep, no new package); details row = thumb + name + type·ext + W×H + formatBytes(size) + ★rating; row styles in Grid.css (hover/selected/ellipsis). Hover preview (06-04) lives in the shared grid/masonry Cell: hover-intent ~180ms timer → GIF animates (imgman://original <img>) / video plays (`<video muted loop autoPlay playsInline>`); timer cleared on leave/unmount (scroll/sweep-safe); reuses existing CSP (img-src + media-src imgman:). List rows + a disable-toggle deferred. | Phase 6 (06-03/04) | Phase 7 selection/context-menus build on these view modes.
- 2026-06-24: Masonry engine (06-02) = `@virtuoso.dev/masonry` (VirtuosoMasonry), one new runtime dep. Chosen over custom windowed masonry (more code/risk) and CSS-columns (not virtualized → fails 60fps@50k). Pure JS (no native rebuild), bundled by Vite (no CSP change). Masonry tile aspect ratio from Item.width/height (square fallback when null, i.e. non-images); columnCount = floor((containerW+gap)/(thumbSize+gap)) via a ResizeObserver hook. viewMode added to useGridView; Grid/Masonry segmented control fills ContentToolbar's reserved right slot. | Phase 6 (06-02) | Grid-mode VirtuosoGrid + --imgman-thumb (06-01) untouched; 06-03 list view is a 3rd mode on the same switch.
- 2026-06-24: Settings (05-04) = conditionally-rendered modal (no router). Theme state sourced ONLY from useTheme() (no localStorage/theme.ts re-read); entry points in sidebar footer + welcome (NOT TitleBar, keeps 05-02 untouched). Modal owns its Escape + stopPropagation()s past the global key handler; LibraryGate guards Space/Esc on `settingsOpen`. Temp ThemeToggle deleted. | Phase 5 (05-04) | Reusable dialog keyboard-ownership pattern for Phase 7 context menus / batch dialogs.
- 2026-06-24: Three-pane shell (05-03) replaces the vertical-stack layout — left sidebar · center toolbar+content · right collapsible inspector; resizable/collapsible panes + modern search toolbar; pane toggles relocated. | Phase 5 (05-03) | The app shell all later phases (6–8) build inside.
- 2026-06-24: Design tokens = semantic CSS custom properties; light on `:root`, dark on `:root[data-theme="dark"]`. Theme preference (dark/light/system) persisted in localStorage (renderer source-of-truth, NOT main settings); applied pre-render in main.tsx as a 'self' module since the renderer CSP has no script-src (inline <head> script blocked) → no FOUC. Dark is default. Components reference var(--color-*), never raw hex. | Phase 5 (05-01) | 05-02/03/04 + Phase 6–8 build on these tokens; Settings (05-04) relocates the temp toggle and reuses useTheme().
- 2026-06-24: Chrome-less window (05-02) — per-platform frame: `frame:false` on win/linux, `titleBarStyle:'hidden'`+inset traffic lights on darwin. Custom `<TitleBar>` draws controls on win/linux only (macOS uses native traffic lights; renderer reserves 72px, branches on `window.api.platform`). New `window:*` IPC (minimize/toggleMaximize/close/isMaximized) resolves the window per-call via `BrowserWindow.fromWebContents(event.sender)`; main emits `window:maximizeChanged` on maximize/unmaximize and preload exposes `onMaximizeChange` (unsubscribe fn, mirrors import.onProgress). `-webkit-app-region` rules live in TitleBar.css (React can't type it). | Phase 5 (05-02) | 05-03 shell sits inside this frame; reusable window-IPC + event-unsubscribe patterns.
- Electron locked for MVP (revisit Tauri only if bundle size/memory becomes a real problem).
- 2026-06-23: Per-library SQLite — `openDatabase(dbPath)` opens metadata.db inside the active `.library` folder; exactly one connection open, close-before-open on switch. | Phase 2 | Supersedes Phase-1 fixed-userData DB (not migrated).
- 2026-06-23: `.library` validity = folder exists AND (metadata.db OR settings.json) present. | Phase 2 | Import/Phase 3 rely on this contract.
- 2026-06-23: Structured IPC results for `library:*` ({ok,library}|{ok:false,error}|{ok:false,cancelled}) instead of throwing across IPC; shared types in src/preload/types.ts. | Phase 2 | Reusable pattern for import IPC.
- 2026-06-23: sharp for image/GIF thumbnails (no ffmpeg); IDs via crypto.randomUUID(); originals COPIED; no worker pool (sharp async runs off-thread). | Phase 2 | Import non-blocking for MVP; media thumbs + worker pool deferred. (Full table in PROJECT.md)
- 2026-06-23: Renderer→main dropped-file paths via webUtils.getPathForFile (Electron 32+ removed File.path). | Phase 2 | Required for drag-and-drop import.
- 2026-06-23: Custom privileged `imgman://<thumb|original>/<id>` protocol serves library files to the sandboxed renderer (UUID-validated, path-confined to active library's images/); CSP img-src must include `imgman:`. | Phase 3 | Reusable for originals/media; vs base64-over-IPC.
- 2026-06-23: react-virtuoso VirtuosoGrid for the grid; items:list returns all rows (paging deferred). | Phase 3 | Render-side windowing handles scale.
- 2026-06-23: items:list lean projection vs items:get full row (FullItem) for the inspector. | Phase 3 | Grid payload stays small; detail views fetch on demand.
- 2026-06-23: Read-only inspector for MVP; container (LibraryGate) owns Space/Escape, QuickPreview is presentational; CSP media-src += imgman: for video/audio originals. | Phase 3 | Rating/note/tag editing → Phase 4; keyboard avoids focus/scroll bugs.
- 2026-06-23: Item mutation pattern — items:update(id, patch) with an allow-listed ItemPatch (only recognized keys build the SET clause; values validated main-side); renderer does optimistic update → persist → reconcile to returned row → revert on failure. | Phase 4 | Tags/folders/notes extend ItemPatch; rating clamped 0..5.
- 2026-06-23: Many-to-many relations get their own IPC namespace (NOT ItemPatch) — tags:* over tags/item_tags. Tags de-duped by trimmed exact name; add is a transactional lookup-or-insert + INSERT OR IGNORE link; unlink deletes only item_tags (tags row kept for reuse). Mutations return the canonical post-write list; renderer reconciles to it. Autocomplete via native <datalist>. | Phase 4 (04-02) | 04-04 search reuses tags:* to filter; folders (04-03) follow the same many-to-many pattern.
- 2026-06-23: Search (04-04) is LIKE-based, NOT FTS5 — items:search(criteria) runs one parameterized query: name/note LIKE + a tag-name subquery (over item_tags/tags), AND'd with type IN / ext / rating>= / imported_at range filters. LIKE specials (\ % _) escaped with ESCAPE '\'; all values bound. items_fts left UNWIRED (it indexes only name/note, isn't populated/triggered, and tags need a separate match anyway) — proper FTS triggers+backfill deferred to a V1 perf pass. Search is a 3rd grid scope in LibraryGate, mutually exclusive with the folder filter; date filter uses imported_at. | Phase 4 (04-04) | Revisit FTS only if LIKE misses the <0.5s @ 50k target.
- 2026-06-23: Folders (04-03) — folders:* IPC over folders/item_folders (8 channels). Tree is a FLAT parent_id list from main, nested + indented in the renderer (no recursive SQL CTE). Cascade delete computes the descendant set in JS then deletes item_folders links + folders rows in one transaction; items are NEVER deleted. Grid filter = DIRECT members only (folders:itemsIn), no descendant rollup. Grid scope lives in LibraryGate (selectedFolderId in reloadItems deps: null → items:list, else folders:itemsIn). Assign via inspector <select>, no drag-drop. | Phase 4 (04-03) | 04-04 search generalizes the selected-scope→items-query path; rollup/colors/drag-drop/sort_order deferred.
- 2026-06-23: Pinned vite ^7 + @vitejs/plugin-react ^5 (electron-vite 5 caps vite at 7; plugin-react 6 needs vite 8). | Phase 1 | Constrains future vite/plugin upgrades.
- 2026-06-23: SQL schema imported via Vite `?raw` (inlined into bundle) instead of copying schema.sql as an asset. | Phase 1 | Schema travels with build; edits need rebuild.
- 2026-06-23: postinstall runs `node node_modules/electron/install.js` + `electron-builder install-app-deps` because npm 11 silently skips dependency install scripts (Electron binary download was missed). | Phase 1 | Required for `npm run dev` to find Electron on fresh installs.

### Deferred Issues
None logged.

### Blockers/Concerns
- Production packaging not yet verified: sharp + better-sqlite3 are native and will need `asarUnpack` in electron-builder.yml before a real packaged build. | Deferred to a packaging pass.
- No real thumbnails for video/audio/pdf/font — grid uses type-based placeholder icons until V1 media thumbnails.
- Import runs sequentially on the main process; revisit the deferred worker pool if 10k+ imports stutter.
- Renderer bundle ~752 kB (react + react-virtuoso + @virtuoso.dev/masonry + shell/theming) — fine for desktop; revisit if cold start regresses.
- items_fts (FTS5) declared in schema but UNWIRED — search is LIKE-based; wire triggers+backfill in a V1 perf pass if LIKE misses <0.5s @ 50k.
- Performance targets (<0.5s search @ 50k, 60fps scroll) not yet measured against a real 50k-item library.

### Git State
- Repository initialized 2026-06-23 (branch: main).
- Last commit: 8f39198 — feat(06-grid-content-area): view toolbar, view modes, and hover preview (Phase 6 — v1.0 Eagle Parity 2/5).
- Prior: 2190713 — feat(05-design-system-shell): theming, chrome-less shell, and settings (Phase 5).
- Prior: 40770ca — feat(04-organize-search): ratings, tags, folders, and keyword search (Phase 4 — v0.1 MVP complete).
- Prior: 6dd5bf1 — feat(03-browse): virtualized grid, inspector, and spacebar quick preview (Phase 3).
- Prior: e1fa1b7 — feat(02-library-import): portable library + import pipeline (Phase 1 + Phase 2).
- Feature branches merged: none (per-phase commits directly on main).

### Resolved (Phase 2 planning, 2026-06-23)
- Library model: ONE active library at a time, with create/open/switch + recents list.
- Import scope (MVP): import ALL file types; real thumbnails for images/GIFs (sharp), generic icons for video/audio/fonts/PDF. No ffmpeg yet.
- Originals: COPY into the library by default (reference mode deferred to later).
- ffmpeg: deferred (not needed until video/audio thumbnails — V1/later).

### Open Questions (still deferred)
- Reference-in-place mode (vs copy) — later.
- ffmpeg bundle vs download-on-first-run — revisit when video thumbnails are added.

## Session Continuity

Last session: 2026-06-24
Stopped at: Phase 7 (Selection & interaction) COMPLETE — loop closed, transitioned to Phase 8
Next action: /paul:plan for Phase 8 (Organize power features)
Resume file: .paul/ROADMAP.md

Phase 7 COMPLETE (7/7): 07-01 multi-select ✓ → 07-02 keyboard nav ✓ → 07-03 marquee ✓ → 07-04
context menus ✓ → 07-05 batch delete/add-tag/add-to-folder ✓ → 07-06 batch rename ✓ → 07-07 editable
multi-item inspector ✓. Bundled into one `feat(07-selection-interaction)` commit.

Phase 8 (Organize power features) — provisional scope from ROADMAP: smart folders / saved searches
(persisted, re-runnable SearchCriteria — reuses Phase-4 search), color extraction (worker) + color
search, find duplicates (content hashing). Scans run in workers, non-blocking. Research likely
(color quantization/search, perceptual vs exact hashing). 60fps @ 50k still unmeasured — consider a
perf pass before milestone close.

---
*STATE.md — Updated after every significant action*
