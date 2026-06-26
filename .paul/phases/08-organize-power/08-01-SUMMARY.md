---
phase: 08-organize-power
plan: 01
subsystem: ui
tags: [electron, ipc, sqlite, search, saved-search, smart-folder, sidebar]

# Dependency graph
requires:
  - phase: 04-organize-search
    provides: items:search(criteria) + the SearchCriteria shape — a smart folder is a persisted criteria re-applied through the existing search scope
provides:
  - smartFolders:* IPC (list/create/rename/delete) over the existing smart_folders table (rules = SearchCriteria JSON)
  - SmartFolders sidebar section (click-to-apply, active highlight, inline rename, ContextMenu rename/delete)
  - "Save search" control in SearchBar (onSave) + LibraryGate ownership (list, saveCurrentSearch, reloadSmartFolders)
affects: [08-02-color-search, 08-03-find-duplicates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Saved search = persisted SearchCriteria (JSON in smart_folders.rules) re-applied via the EXISTING search scope — no new query path"
    - "A smart folder rides applySearch(criteria), so search/folder scopes stay mutually exclusive with zero new scope logic"
    - "Reused a pre-declared-but-unused schema table (smart_folders) → feature with no schema change"

key-files:
  created:
    - src/main/services/smartFolders.ts
    - src/main/ipc/smartFolders.ts
    - src/renderer/src/SmartFolders.tsx
  modified:
    - src/main/ipc/index.ts
    - src/preload/types.ts
    - src/preload/index.ts
    - src/renderer/src/SearchBar.tsx
    - src/renderer/src/LibraryGate.tsx

key-decisions:
  - "Reuse the existing smart_folders(id,name,rules) table; rules stores JSON.stringify(SearchCriteria) — NO schema change"
  - "smartFolders:* mirrors folders:* (each mutation returns the canonical SmartFolder[]); defensive JSON.parse on read"
  - "LibraryGate OWNS the list (not the SmartFolders component) so the toolbar Save control can refresh it; SmartFolders is presentational"
  - "Active-highlight is a best-effort JSON-stringify match of criteria (not a normalized deep-equal)"

patterns-established:
  - "Persisted-criteria + sidebar-section + reuse-existing-scope shape (reusable for future saved-view features)"

# Metrics
duration: ~1 session
started: 2026-06-24
completed: 2026-06-24
---

# Phase 8 Plan 01: Saved Searches / Smart Folders Summary

**Saved searches: persist the current SearchCriteria under a name in the existing smart_folders table, list them in a "Smart Folders" sidebar section, and re-run one with a click through the existing search scope — plus inline rename and delete. No schema change, no new deps, no worker.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~1 session |
| Started | 2026-06-24 |
| Completed | 2026-06-24 |
| Tasks | 2 auto + 1 human-verify checkpoint (approved) |
| Files modified | 8 (3 created, 5 modified) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Save the current search | Pass | "Save search" control (shown only when a search is active) + inline name → smartFolders:create; row appears in sidebar |
| AC-2: Apply a saved search | Pass | Click → applySearch(criteria) re-runs through the existing scope; folder selection clears; active row highlighted |
| AC-3: Rename and delete | Pass | Inline rename + right-click Rename/Delete (confirm); reconcile to returned list; items untouched |
| AC-4: Per-library persistence | Pass | reloadSmartFolders on active?.path change; stored in the active library's smart_folders table |
| AC-5: No regressions | Pass | typecheck (node+web) + build clean; schema.sql unchanged; live search / folder filter / Phase 7 features intact |

## Accomplishments

- New `smartFolders:*` IPC stack (service → ipc → preload → IpcApi) reusing the pre-existing `smart_folders` table — a full feature with zero schema change.
- A presentational `SmartFolders` sidebar section mirroring FolderTree (click-to-apply, active highlight, inline rename, ContextMenu), with LibraryGate owning the list so the toolbar can refresh it.
- "Save search" affordance added to SearchBar without disturbing existing filter behavior.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/main/services/smartFolders.ts` | Created | CRUD over smart_folders; rules ↔ SearchCriteria JSON (defensive parse) |
| `src/main/ipc/smartFolders.ts` | Created | smartFolders:list/create/rename/delete handlers |
| `src/renderer/src/SmartFolders.tsx` | Created | Sidebar section (presentational) |
| `src/main/ipc/index.ts` | Modified | Register smartFolders IPC |
| `src/preload/types.ts` | Modified | SmartFolder type + IpcApi.smartFolders namespace |
| `src/preload/index.ts` | Modified | smartFolders bridge wiring |
| `src/renderer/src/SearchBar.tsx` | Modified | onSave prop + "Save search" inline-name control |
| `src/renderer/src/LibraryGate.tsx` | Modified | Owns list, saveCurrentSearch, reloadSmartFolders, renders section + passes onSave |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Reuse smart_folders table (rules = criteria JSON) | Table was pre-declared and unused; avoids a migration | No schema change; consistent with the "extend, don't rebuild" ethos |
| LibraryGate owns the list; SmartFolders presentational | The Save control lives in the toolbar, outside the sidebar component | Both surfaces stay in sync from one source |
| Saved search rides applySearch (existing scope) | applySearch already clears the folder scope | Mutual exclusivity for free; no new scope logic |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** None — plan executed exactly as written.

### Deferred Items

None for this plan. Scope-limited (as planned): no "update saved search from current criteria", no drag-reorder (table has no sort_order), no worker/new-dep work — those belong to later Phase-8 slices or are explicit non-goals.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Phase 8 in progress (1 of ~3 slices done). The persisted-criteria + sidebar-section pattern is established.
- Next slices: 08-02 (color extraction + color search) and 08-03 (find duplicates) — the "heavier backend" work needing a worker, schema/columns, and likely a new dependency (research likely).

**Concerns:**
- Active-highlight is a best-effort JSON match (not normalized deep-equal) — could miss a highlight if criteria key order/shape ever diverges.
- 60fps @ 50k still unmeasured — consider a perf pass before milestone close.

**Blockers:**
- None.

---
*Phase: 08-organize-power, Plan: 01*
*Completed: 2026-06-24*
