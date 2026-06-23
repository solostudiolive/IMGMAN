# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-06-23)

**Core value:** A fast, offline-first local "second brain" — collect, organize, search, and browse tens of thousands of visual assets in under a second, with full data ownership.
**Current focus:** v0.1 MVP COMPLETE — awaiting next milestone (V1 polish) decision.

## Current Position

Milestone: v0.1 MVP — ✅ COMPLETE (4 of 4 phases)
Phase: 4 of 4 (Organize & search) — ✅ Complete
Plan: 04-04 complete (loop closed); Phase 4 transition done
Status: Milestone complete — ready to start next milestone or pause
Last activity: 2026-06-23 — Closed 04-04 loop + Phase 4 transition: PROJECT.md/ROADMAP evolved, phase committed. v0.1 MVP feature-complete.

Progress:
- Milestone: [██████████] 100% (4 of 4 phases complete)
- Phase 4: [██████████] 100% (4 of 4 plans complete)

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Loop complete — Phase 4 transition done — v0.1 MVP COMPLETE 🎉]
```

## Accumulated Context

### Decisions
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
- Renderer bundle ~655 kB (react + react-virtuoso) — fine for desktop; revisit if cold start regresses.
- No arrow-key navigation in grid/quick-preview yet — likely expected UX; consider in a V1 polish pass.
- items_fts (FTS5) declared in schema but UNWIRED — search is LIKE-based; wire triggers+backfill in a V1 perf pass if LIKE misses <0.5s @ 50k.
- Performance targets (<0.5s search @ 50k, 60fps scroll) not yet measured against a real 50k-item library.

### Git State
- Repository initialized 2026-06-23 (branch: main).
- Last commit: 6dd5bf1 — feat(03-browse): virtualized grid, inspector, and spacebar quick preview (Phase 3).
- Prior: e1fa1b7 — feat(02-library-import): portable library + import pipeline (Phase 1 + Phase 2).
- Feature branches merged: none.

### Resolved (Phase 2 planning, 2026-06-23)
- Library model: ONE active library at a time, with create/open/switch + recents list.
- Import scope (MVP): import ALL file types; real thumbnails for images/GIFs (sharp), generic icons for video/audio/fonts/PDF. No ffmpeg yet.
- Originals: COPY into the library by default (reference mode deferred to later).
- ffmpeg: deferred (not needed until video/audio thumbnails — V1/later).

### Open Questions (still deferred)
- Reference-in-place mode (vs copy) — later.
- ffmpeg bundle vs download-on-first-run — revisit when video thumbnails are added.

## Session Continuity

Last session: 2026-06-23
Stopped at: v0.1 MVP COMPLETE — Phase 4 closed + transitioned + committed
Next action: /paul:discuss-milestone (or /paul:milestone) to scope V1, or /paul:complete-milestone to formally archive v0.1. Optional first: verify a real packaged Windows build (asarUnpack for sharp + better-sqlite3).
Resume file: .paul/ROADMAP.md

---
*STATE.md — Updated after every significant action*
