# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-06-23)

**Core value:** A fast, offline-first local "second brain" — collect, organize, search, and browse tens of thousands of visual assets in under a second, with full data ownership.
**Current focus:** v1.0 — Eagle Parity (Phases 5–9): full Eagle-app look, feel, and feature parity, reusing the v0.1 backend.

## Current Position

Milestone: v1.0 — Eagle Parity 🚧 In Progress (2 of 5 phases complete)
Phase: 7 of 9 (Selection & interaction) — Not started
Plan: Not started
Status: Phase 6 complete + committed; ready to plan Phase 7
Last activity: 2026-06-24 — Closed Plan 06-04 loop and ran Phase 6 transition: created 06-04-SUMMARY; evolved PROJECT.md (3 Phase-6 requirements validated + 3 key decisions); marked ROADMAP Phase 6 ✅; committed feat(06-grid-content-area). Phase 6 (Eagle grid & content area) is feature-complete.

Progress:
- v1.0 Eagle Parity: [████░░░░░░] 40% (2 of 5 phases complete; Phase 7 next)
- Phase 6: [██████████] 100% (4 of 4 plans complete — UNIFY closed)

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Phase 6 complete + committed; ready to PLAN Phase 7]
```

## Accumulated Context

### Decisions
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
- No arrow-key navigation in grid/quick-preview yet — likely expected UX; consider in a V1 polish pass.
- items_fts (FTS5) declared in schema but UNWIRED — search is LIKE-based; wire triggers+backfill in a V1 perf pass if LIKE misses <0.5s @ 50k.
- Performance targets (<0.5s search @ 50k, 60fps scroll) not yet measured against a real 50k-item library.

### Git State
- Repository initialized 2026-06-23 (branch: main).
- Last commit: 2190713 — feat(05-design-system-shell): theming, chrome-less shell, and settings (Phase 5 — v1.0 Eagle Parity 1/5).
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
Stopped at: Phase 6 complete (all 4 plans unified) + committed; transition done
Next action: /paul:plan for Phase 7 (Selection & interaction)
Resume file: .paul/ROADMAP.md

Phase 7 status: Not started. Goal — multi-select (shift-range/ctrl-toggle/rubber-band),
right-click context menus (items/folders/tags), keyboard navigation, batch ops
(rename/tag/move/delete), and a polished editable collapsible inspector. Builds on the
Phase 6 grid/masonry/list surface. The 05-04 modal keyboard-ownership pattern applies to
context menus / batch dialogs.
60fps @ 50k still unmeasured — consider a perf pass before milestone close.

---
*STATE.md — Updated after every significant action*
