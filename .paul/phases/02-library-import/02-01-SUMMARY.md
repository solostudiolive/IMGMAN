---
phase: 02-library-import
plan: 01
subsystem: infra
tags: [electron, sqlite, better-sqlite3, ipc, react, library-format]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: DB singleton, typed IPC (invoke/handle) pattern, contextBridge preload bridge, schema.sql (?raw)
provides:
  - Portable `.library` on-disk format (metadata.db, settings.json, images/, thumbnails-cache/)
  - LibraryService (create/open/switch, one active library at a time)
  - Per-library DB layer (openDatabase(path) replacing fixed-userData initDatabase)
  - App config in userData (recentLibraries + lastOpened) with auto-reopen
  - Typed `window.api.library` IPC surface + minimal renderer LibraryGate UI
affects: [02-library-import import pipeline, 03-browse, 04-organize-search]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One active SQLite connection scoped to the active library; close-before-open on switch"
    - "Structured IPC results ({ok:true,library} | {ok:false,error} | {ok:false,cancelled}) instead of throwing across IPC"
    - "Shared IPC types in src/preload/types.ts importable by both preload and renderer without the preload runtime"

key-files:
  created:
    - src/main/services/library.ts
    - src/main/config.ts
    - src/main/ipc/library.ts
    - src/renderer/src/LibraryGate.tsx
    - src/preload/types.ts
  modified:
    - src/main/db/index.ts
    - src/main/ipc/index.ts
    - src/main/index.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
    - src/renderer/src/App.tsx

key-decisions:
  - "Per-library DB: initDatabase() -> openDatabase(dbPath) opening metadata.db inside the active library"
  - "Structured IPC result type for library:* instead of raw rejections, so the gate can render errors inline"
  - "Shared types extracted to src/preload/types.ts (not in original files list) to avoid renderer importing preload runtime"
  - "listRecent returns LibraryInfo[] ({path,name}) rather than string[] for direct display"

patterns-established:
  - "Library folder validity = dir exists AND (metadata.db OR settings.json) present"
  - "Recents auto-pruned on read (drop entries whose folder no longer exists); stale recent dropped on failed openPath"

# Metrics
duration: ~single session
started: 2026-06-23
completed: 2026-06-23T00:00:00Z
---

# Phase 2 Plan 01: Library Format & Lifecycle Summary

**Portable `.library` format with create/open/switch lifecycle, a per-library SQLite connection (one active at a time), userData-persisted recents/last-opened, and a minimal renderer gate UI.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~single session |
| Started | 2026-06-23 |
| Completed | 2026-06-23 |
| Tasks | 3 implementation tasks + 1 human-verify checkpoint |
| Files created | 5 |
| Files modified | 6 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Create a new library | Pass | `createLibrary()` makes `<name>.library/` + images/ + thumbnails-cache/, writes settings.json (name/createdAt/formatVersion:1), opens DB (applies schema), sets active; rejects if folder exists. Gate shows name+path and "0 items". |
| AC-2: Open an existing library | Pass | `openLibrary()` validates via `isLibrary()` (dir + metadata.db OR settings.json), opens DB (schema re-run is a no-op via `CREATE ... IF NOT EXISTS`), throws descriptive error for non-library folders; gate surfaces error inline and active is unchanged. |
| AC-3: Recents persist and switch | Pass | `config.json` in userData stores recentLibraries (capped 20) + lastOpened; app `whenReady` auto-reopens lastOpened if valid; `library:openPath` switches; recents pruned on read. |
| AC-4: One active library, DB scoped to it | Pass | `getDb()` returns the active library's connection or throws if none; `openDatabase()` calls `closeDatabase()` first (no leaked handles / WAL on wrong file); `will-quit` closes the active library. |

**Verification:** `npm run typecheck` (typecheck:node + typecheck:web) passes with no errors. AC behavior confirmed by code inspection; runtime GUI walkthrough is the Task 4 human-verify checkpoint (manual, owned by user).

## Accomplishments

- Established the seam every later MVP feature builds on: "the active library" — a self-contained, portable folder the user owns.
- Refactored the Phase-1 fixed-userData DB into a per-library connection with clean close-before-open switching.
- Persisted app-level state (recents + last-opened) with automatic reopen on launch and self-healing pruning of stale entries.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/main/services/library.ts` | Created | `.library` format, path helpers, create/open/validate/close lifecycle, active-library state |
| `src/main/config.ts` | Created | userData config.json: recents + lastOpened, prune-on-read, add/remove helpers |
| `src/main/ipc/library.ts` | Created | `library:*` IPC handlers with structured results; dialogs for create/open |
| `src/renderer/src/LibraryGate.tsx` | Created | Minimal create/open/switch UI; inline name entry (no window.prompt), recents list, error surface |
| `src/preload/types.ts` | Created | Shared IPC types (LibraryInfo, LibraryResult, IpcApi) for preload + renderer |
| `src/main/db/index.ts` | Modified | `openDatabase(path)` replaces fixed-path init; pragmas + idempotent schema; getDb throws if none open |
| `src/main/ipc/index.ts` | Modified | Registers `registerLibraryIpc()` alongside app:getVersion/ping |
| `src/main/index.ts` | Modified | No fixed userData DB; auto-reopen lastOpened on ready; closeActiveLibrary on will-quit |
| `src/preload/index.ts` | Modified | Adds typed `library` namespace to `window.api` |
| `src/preload/index.d.ts` | Modified | Global `Window.api` typed via shared IpcApi |
| `src/renderer/src/App.tsx` | Modified | Renders LibraryGate; version moved to footer (keeps typed-IPC proof) |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Shared types in `src/preload/types.ts` | Renderer needs LibraryInfo/LibraryResult without importing the preload runtime (electron) | New file beyond the plan's files list; cleaner renderer/preload boundary |
| `library:listRecent` returns `LibraryInfo[]` not `string[]` | Gate displays a friendly name per recent without re-deriving it | IPC contract richer than planned; types updated to match |
| `addRecent` also sets `lastOpened` (no separate `setLastOpened`) | Every recent add is the act of opening it | Slightly simpler config API than the plan enumerated |
| `library:openPath` drops the recent on failure | Stale recents self-heal instead of lingering as dead buttons | Better UX; minor auto-fix beyond plan text |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Stale-recent pruning on failed openPath (UX) |
| Scope additions | 2 | New shared types file; richer listRecent return shape |
| Deferred | 0 | — |

**Total impact:** Minor, all in service of a cleaner boundary and better UX. No scope creep beyond the plan's intent.

### Auto-fixed Issues

**1. [UX] Stale recents could linger as dead buttons**
- **Found during:** Task 2 (library IPC)
- **Issue:** A recent whose folder was moved/deleted would fail silently on click.
- **Fix:** `library:openPath` calls `removeRecent(path)` on failure; `getConfig()` prunes non-existent recents on every read.
- **Files:** `src/main/ipc/library.ts`, `src/main/config.ts`
- **Verification:** Covered by `getConfig` prune logic + typecheck.

### Deferred Items

None — plan executed within its intended scope.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| STATE.md not updated after APPLY (showed APPLY pending) | Reconciled during UNIFY against the filesystem; all plan files present and typecheck green — APPLY was in fact complete. STATE.md corrected as part of this loop closure. |

## Next Phase Readiness

**Ready:**
- "Active library" abstraction + per-library DB are the foundation Plan 02-02 (import) builds directly on.
- `getDb()` returns the active library's connection for inserting image rows.
- `imagesDir()` / `thumbsCacheDir()` helpers give the import pipeline its copy/thumbnail destinations.
- Structured IPC result + gate UI patterns are reusable for import IPC and progress UI.

**Concerns:**
- Phase-1 userData `metadata.db` skeleton is intentionally superseded (not migrated) — confirm no lingering references assume it.
- Library IDs not yet introduced; 02-02/Phase 3 may need a stable per-library identifier.
- Still no git repository — Phase 1 commit was skipped; recommend `git init` + commit before/with 02-02.

**Blockers:**
- None.

---
*Phase: 02-library-import, Plan: 01*
*Completed: 2026-06-23*
