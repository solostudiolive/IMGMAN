# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-06-23)

**Core value:** A fast, offline-first local "second brain" — collect, organize, search, and browse tens of thousands of visual assets in under a second, with full data ownership.
**Current focus:** v0.1 MVP — Phase 3 (Browse: grid + inspector)

## Current Position

Milestone: v0.1 MVP
Phase: 3 of 4 (Browse: grid + inspector) — Not started
Plan: Not started
Status: Ready to plan Phase 3
Last activity: 2026-06-23 — Phase 2 complete, transitioned to Phase 3

Progress:
- Milestone: [█████░░░░░] 50% (2 of 4 phases complete)
- Phase 3: [░░░░░░░░░░] 0% (not started)

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Phase 2 complete — ready to PLAN Phase 3]
```

## Accumulated Context

### Decisions
- Electron locked for MVP (revisit Tauri only if bundle size/memory becomes a real problem).
- 2026-06-23: Per-library SQLite — `openDatabase(dbPath)` opens metadata.db inside the active `.library` folder; exactly one connection open, close-before-open on switch. | Phase 2 | Supersedes Phase-1 fixed-userData DB (not migrated).
- 2026-06-23: `.library` validity = folder exists AND (metadata.db OR settings.json) present. | Phase 2 | Import/Phase 3 rely on this contract.
- 2026-06-23: Structured IPC results for `library:*` ({ok,library}|{ok:false,error}|{ok:false,cancelled}) instead of throwing across IPC; shared types in src/preload/types.ts. | Phase 2 | Reusable pattern for import IPC.
- 2026-06-23: sharp for image/GIF thumbnails (no ffmpeg); IDs via crypto.randomUUID(); originals COPIED; no worker pool (sharp async runs off-thread). | Phase 2 | Import non-blocking for MVP; media thumbs + worker pool deferred. (Full table in PROJECT.md)
- 2026-06-23: Renderer→main dropped-file paths via webUtils.getPathForFile (Electron 32+ removed File.path). | Phase 2 | Required for drag-and-drop import.
- 2026-06-23: Pinned vite ^7 + @vitejs/plugin-react ^5 (electron-vite 5 caps vite at 7; plugin-react 6 needs vite 8). | Phase 1 | Constrains future vite/plugin upgrades.
- 2026-06-23: SQL schema imported via Vite `?raw` (inlined into bundle) instead of copying schema.sql as an asset. | Phase 1 | Schema travels with build; edits need rebuild.
- 2026-06-23: postinstall runs `node node_modules/electron/install.js` + `electron-builder install-app-deps` because npm 11 silently skips dependency install scripts (Electron binary download was missed). | Phase 1 | Required for `npm run dev` to find Electron on fresh installs.

### Deferred Issues
None logged.

### Blockers/Concerns
- Production packaging not yet verified: sharp + better-sqlite3 are native and will need `asarUnpack` in electron-builder.yml before a real packaged build. | Deferred to a packaging pass.
- No real thumbnails for video/audio/pdf/font — Phase 3 grid must use type-based placeholder icons until V1 media thumbnails.
- Import runs sequentially on the main process; revisit the deferred worker pool if 10k+ imports stutter.

### Git State
- No git repository initialized yet (project is not under version control). Phase commit for Phase 1 was skipped — offer `git init` + initial commit before Phase 2 work.

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
Stopped at: Phase 2 complete, ready to plan Phase 3 (Browse: grid + inspector)
Next action: /paul:plan for Phase 3
Resume file: .paul/ROADMAP.md

---
*STATE.md — Updated after every significant action*
