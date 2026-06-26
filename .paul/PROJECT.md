# Project: IMGMAN

## Description

A local-first cross-platform desktop app (Electron + React + TypeScript) for collecting, organizing, searching, and browsing visual assets (images, GIFs, videos, audio, fonts, PDFs), inspired by Eagle. Everything is stored in a portable local library so the user owns their data.

## Core Value

A fast, offline-first local "second brain" — collect, organize, search, and browse tens of thousands of visual assets in under a second, with full ownership of your data.

## Requirements

### Validated (Shipped)
- ✓ Cross-platform Electron + React + TS skeleton with HMR — Phase 1
- ✓ Typed IPC boundary (contextBridge, no nodeIntegration) — Phase 1
- ✓ Embedded SQLite metadata DB with idempotent schema — Phase 1
- ✓ electron-builder Windows packaging (native module ABI-correct) — Phase 1
- ✓ Create / open / switch a portable `.library` (per-library SQLite, recents, last-opened) — Phase 2
- ✓ Drag & drop + clipboard + bulk folder import (copy original, sharp thumbnail, metadata.json, items row) — Phase 2
- ✓ Virtualized grid view (react-virtuoso) + inspector/metadata panel — Phase 3
- ✓ Spacebar quick preview (image/GIF full-size, video/audio native playback) — Phase 3
- ✓ Editable star ratings (1–5) via allow-listed `items:update` mutation — Phase 4
- ✓ Tags (many-to-many): CRUD + assign/remove + inspector editor with autocomplete — Phase 4
- ✓ Folders (nested): tree CRUD, assign items, filter grid by folder — Phase 4
- ✓ Keyword search (name/note/tags) + filter by format/type/rating/date — Phase 4
- ✓ Design-token theming system (dark default + light, FOUC-safe persistence) — Phase 5
- ✓ Chrome-less custom title bar + per-platform window controls — Phase 5
- ✓ Three-pane app shell (sidebar · toolbar+content · collapsible inspector) + modern search toolbar — Phase 5
- ✓ Settings screen (Appearance theme control + About) — Phase 5
- ✓ Content-area view toolbar: thumbnail-size slider + sort (imported/created/name/rating/size × asc/desc) — Phase 6
- ✓ Multiple view modes: grid (uniform), masonry/waterfall (virtualized, aspect-ratio), list (virtualized details) — Phase 6
- ✓ Hover preview for GIF/video (animate / inline play on hover-intent) — Phase 6
- ✓ Multi-select (click / ctrl-toggle / shift-range / rubber-band marquee) + keyboard navigation (arrows/Shift/Ctrl+A/Home/End) — Phase 7
- ✓ Right-click context menus (items / folders / tags) via a reusable portal menu — Phase 7
- ✓ Batch operations over a selection: delete, add-tag, add-to-folder, rename (pattern + find/replace) — atomic main-side IPC — Phase 7
- ✓ Editable inspector — single-item (rating/tags/folders) + multi-item (aggregate header + batch rating/tags/folders over the intersection) — Phase 7
- ✓ Smart folders / saved searches (persisted re-runnable `SearchCriteria` in `smart_folders`) — Phase 8
- ✓ Color extraction (no-dep quantizer → `items.palette`) + inspector swatches + nearest-color color search — Phase 8
- ✓ Find duplicates (SHA-256 `content_hash`; project's first schema migration; keep-newest delete) — Phase 8
- ✓ Sidebar Tags section (exact-tag filter) + inline library rename — Phase 8 (off-loop)
- ✓ Inter typeface bundled + "refined dark, Eagle-like" restyle (palette/density/focus ring) — Phase 8.1

### Must Have (MVP)
- Cross-platform (Windows + macOS) — Windows verified; macOS build unverified (see Constraints/packaging)

### Should Have (V1)
- ✓ Smart folders + saved searches — Phase 8
- ✓ Color extraction + color search — Phase 8
- Hover preview for audio (GIF/video shipped — Phase 6; audio still pending)
- Notes/annotations editing (batch rename / batch tag shipped — Phase 7; freeform note editing still pending)
- Signed builds + auto-update

### Nice to Have (Later)
- ✓ Find duplicates — Phase 8
- Browser extension — scheduled for v1.1 (deferred from v1.0, 2026-06-26)
- Plugin API
- AI tagging / semantic + visual search
- Password lock, cloud-sync-friendly layout

## Constraints

### Technical
- Electron locked for MVP (revisit Tauri only if bundle size/memory becomes a real problem)
- Renderer talks to main only via typed IPC; heavy jobs (thumbnails, color, media probe) run in workers
- Originals are never modified; library is a self-contained portable folder
- Metadata in SQLite (`better-sqlite3`); stable unique IDs (UUID/ULID)

### Performance
- Search renders in < 0.5s at 50k items
- Grid scroll holds 60fps (virtualization + cached thumbnails)
- Import is non-blocking; app cold start < 2s

## Success Criteria
- Core value is achieved: collect → organize → search → browse stays smooth at tens of thousands of items
- MVP milestone shippable (library + import + grid + organize + search)
- Performance targets met at 50k items

## Key Decisions

| Decision | Phase | Rationale |
|----------|-------|-----------|
| Electron locked for MVP | Pre-1 | Speed of development; revisit Tauri only on bundle/memory pain |
| One active `.library` at a time; per-library SQLite | 2 | Portable, user-owned library; clean open/close on switch |
| Originals copied (not referenced) into the library | 2 | Safe by default; reference-in-place deferred |
| sharp for image thumbnails; no ffmpeg yet | 2 | Non-image types get correct classification + generic handling; media thumbs are V1 |
| No worker pool for import (sharp async is off-thread) | 2 | Non-blocking enough for MVP; revisit at scale |
| IDs via crypto.randomUUID() | 2 | Built-in, stable, unique; no extra dependency |
| Custom privileged `imgman://` protocol to serve library files | 3 | Sandboxed renderer can't read FS; beats base64-over-IPC; path-confined to active library |
| react-virtuoso VirtuosoGrid; items:list returns all rows | 3 | Render-side windowing scales to 50k; paging deferred |
| items:list lean projection vs items:get full row | 3 | Grid payload stays small; inspector fetches the full record on demand |
| Read-only inspector for MVP | 3 | Rating/tag/note editing deferred to Phase 4 (Organize) |
| Item edits via allow-listed `items:update(patch)` (optimistic → reconcile → revert) | 4 | Only recognized keys reach SQL; values validated main-side |
| Many-to-many relations (tags, folders) each get their own IPC namespace returning the canonical post-write list | 4 | Reusable pattern; renderer reconciles to the returned list |
| Folder tree = flat parent_id list rendered nested; cascade-delete keeps items | 4 | No recursive SQL; deleting a folder never deletes assets |
| Search is LIKE-based (name/note/tags + filters); items_fts left unwired | 4 | One consistent path covering tags; FTS triggers+backfill deferred to V1 perf pass |
| Semantic CSS-custom-property design tokens; dark default, theme persisted in renderer localStorage, applied pre-render to avoid FOUC | 5 | Components reference `var(--color-*)`, never raw hex; theme engine owned by renderer, not main settings |
| Chrome-less window: per-platform frame (frameless win/linux, hidden-inset traffic lights darwin); custom `<TitleBar>`; new `window:*` IPC | 5 | Eagle-class custom chrome; window resolved per-call via `BrowserWindow.fromWebContents` |
| Three-pane shell replaces the vertical stack; resizable/collapsible panes; settings as a conditionally-rendered modal (no router) | 5 | Establishes the app shell all later phases build inside; modal owns its Escape + guards host shortcuts |
| Grid view-state (size/sort/viewMode) in a persisted useGridView hook; sort applied renderer-side via one comparator over the loaded scope | 6 | No IPC/SQL change; one path covers all-items/folder/search; later sort/view options just extend the hook |
| `@virtuoso.dev/masonry` for the virtualized waterfall; list view via react-virtuoso `Virtuoso`; grid via VirtuosoGrid | 6 | Only masonry needed a new dep; aspect ratios from Item.width/height (square fallback); 60fps@50k still to be measured |
| Hover preview (GIF animate / video inline-play) in the shared grid/masonry Cell, hover-intent ~180ms, reuses imgman://original | 6 | No CSP/IPC/dep change; scroll/sweep-safe; List rows + a disable-toggle deferred |
| Selection model in a renderer `useSelection` hook (click/ctrl/shift + marquee + keyboard), batch ops as atomic main-side IPC (one txn, returns count), context menu via reusable portal `ContextMenu` | 7 | Renderer owns selection; batch mutations bypass single-item channels; menu escapes pane overflow via createPortal |
| Multi-item inspector reads the INTERSECTION (`HAVING COUNT(DISTINCT item_id)=N`); header aggregates computed renderer-side; new channels only (single Inspector untouched) | 7 | "Common" = on all selected; no tri-state UI; edits apply to whole selection atomically |
| Saved searches persist a `SearchCriteria` JSON in the pre-existing `smart_folders` table; sidebar section re-applies it through the existing search scope | 8 | No schema change, no deps; reuses the Phase-4 search path |
| Color extraction = no-dependency quantizer over sharp pixels (no worker), storing `#rrggbb` JSON in the pre-existing `items.palette`; color SEARCH is a JS nearest-color post-filter (`color`/`colorTolerance` on `SearchCriteria`) | 8 | Extraction and search split into separate slices; no new dep/worker/schema |
| Find duplicates = SHA-256 `content_hash` via the project's FIRST schema migration (table_info-guarded ALTER + `user_version`); hash at import + backfill; keep-newest delete reuses `items:delete` | 8 | Establishes the migration pattern for future schema growth |
| Inter typeface bundled via `@fontsource/inter` (self-hosted woff2, CSP/offline-safe); `--font-sans` is one centralized token; "refined dark, Eagle-like" flat near-black palette + focus-visible ring | 8.1 | Font swap = one token + the entry import; rest is token/component refinement |
| Phase 9 (browser-extension collecting) deferred to v1.1 | 8→9 | v1.0 ships at Phase 8; extension is an external capture surface, cleanly separable |

## Reference

Full design doc (architecture, data model, library format, risks): see root `PROJECT.md`.

---
*Created: 2026-06-23*
*Version: 1.0.0*
*Last updated: 2026-06-26 — v1.0 Eagle Parity COMPLETE (Phases 5–8 + inserted 8.1); Phase 9 (browser extension) deferred to v1.1.*
