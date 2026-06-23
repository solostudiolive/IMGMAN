# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-06-23)

**Core value:** A fast, offline-first local "second brain" — collect, organize, search, and browse tens of thousands of visual assets in under a second, with full data ownership.
**Current focus:** v0.1 MVP — Phase 4 (Organize & search)

## Current Position

Milestone: v0.1 MVP
Phase: 4 of 4 (Organize & search) — Not started
Plan: Not started
Status: Phase 3 complete and committed. Ready to plan Phase 4.
Last activity: 2026-06-23 — Phase 3 complete (03-01 + 03-02 unified); transitioned to Phase 4

Progress:
- Milestone: [███████░░░] 75% (3 of 4 phases complete)
- Phase 4: [░░░░░░░░░░] 0% (not started)

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Phase 3 loop complete — ready to PLAN Phase 4]
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
- No arrow-key navigation in grid/quick-preview yet — likely expected UX; consider in Phase 4 or a polish pass.

### Git State
- Repository initialized 2026-06-23 (branch: main).
- Last commit: e1fa1b7 — feat(02-library-import): portable library + import pipeline (covers Phase 1 + Phase 2).
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
Stopped at: Phase 3 complete (browse: grid + inspector + quick preview), unified and committed
Next action: Run /paul:plan to create the first plan of Phase 4 (Organize & search)
Resume file: .paul/ROADMAP.md

---
*STATE.md — Updated after every significant action*
