---
phase: 12-import-polish
plan: 01
subsystem: ui
tags: [typescript, electron, sqlite, react]

# Dependency graph
requires:
  - phase: 10-media-thumbnails
    provides: [real media thumbnails (video/audio/pdf/font), backfillMediaThumbnails service + IPC]
  - phase: 11-url-import
    provides: [urlImport service, import:url IPC, UrlImportDialog + ImportZone wiring, source_url population]
  - phase: 8-organize-power
    provides: [backfill pattern (palettes/hashes), SettingsModal Library-maintenance structure, formatDuration helper in Inspector]
  - phase: 6-eagle-grid
    provides: [ListRow grid list row, Item interface projection]
provides:
  - [media-thumbnail backfill UI button in SettingsModal]
  - [duration_ms surfaced in the grid ListRow for media items]
affects: [next phase: v1.0 Eagle Parity / v1.1 release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Backfill pattern: SettingsModal button -> window.api.items.backfill* -> service backfill* -> per-item try/catch (skip failures, idempotent via WHERE field IS NULL)"
    - "Shared pure helper duplication across renderer files (formatBytes in Grid.tsx + Inspector.tsx; formatDuration now in Grid.tsx + Inspector.tsx)"

key-files:
  created: []
  modified:
    - src/main/services/items.ts
    - src/preload/types.ts
    - src/renderer/src/Grid.tsx
    - src/renderer/src/components/SettingsModal.tsx

key-decisions:
  - "Media backfill button placed in SettingsModal Library maintenance, mirroring the 'Extract colors' pattern, rather than inventing a new surface"
  - "duration_ms duplicated on both the main-process Item (items.ts) and renderer Item (preload/types.ts) per the existing dual-definition convention — both must stay in sync"
  - "formatDuration helper duplicated in Grid.tsx (not shared) to match the formatBytes precedent"
  - "ImportZone error handling inspected and left unchanged — already correct"

patterns-established:
  - "SettingsModal Library-maintenance backfill row: busy state + 'Done - N updated' caption"
  - "ListRow meta-column fallback: {duration ?? dims} prefers duration for media, falls back to dimensions or em-dash"
---

# Phase 12 Plan 01: Import pipeline polish — Summary

**Settings UI for media-thumbnail backfill + duration shown in list rows, completing the v1.1 Rich Media Import surface.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15 min (edit + typecheck loop) |
| Started | 2026-09-14 |
| Completed | 2026-09-14 |
| Tasks | 2 executed + 1 checkpoint (human-verify, approved) |
| Files modified | 4 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Media-thumbnail backfill exposed in Settings | Pass | Button calls `window.api.items.backfillMediaThumbnails()`; toggles to "Extracting..." then "Done — N updated" |
| AC-2: List row shows duration for media items | Pass | `{duration ?? dims}` in ListRow renders mm:ss for video/audio when dims unavailable |
| AC-3: Backfill is idempotent and safe | Pass | Service filters `width IS NULL`; re-run returns 0; per-item failures skipped |

## Accomplishments

- **Media-thumbnail backfill is now user-accessible** via Settings → Library maintenance. Previously the `backfillMediaThumbnails` IPC (Phase 10) existed with no UI trigger — now it mirrors the "Extract colors" backfill UX exactly.
- **List rows now show media duration.** The `dims` column in `Grid.tsx` `ListRow` now renders `{duration ?? dims}`, so a video with no extracted dimensions still shows its `0:35` duration instead of `—`, matching what the Inspector already displayed.
- **Typecheck clean.** Both `typecheck:node` and `typecheck:web` pass with zero new errors after all edits.

## Task Commits

Each task was applied in-process (no git commit issued — v1.1 Phase 10/11 source remains uncommitted in the working tree per the 2026-09-14 discrepancy; Phase 12 edits ride those same uncommitted changes).

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Task 1: Add media-thumbnail backfill button | (uncommitted, working tree) | feat | SettingsModal Library maintenance "Media" row + state |
| Task 2: Show duration in list-row meta | (uncommitted, working tree) | feat | duration_ms on Item + ITEM_COLS + ListRow {duration ?? dims} |
| Checkpoint | approved | n/a | Human-verify approved after typecheck pass |

Plan metadata: 12-01 (docs: complete plan)

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/renderer/src/components/SettingsModal.tsx` | Modified | "Extract media thumbnails for existing items" button + mediaBusy/mediaResult state |
| `src/main/services/items.ts` | Modified | Added `duration_ms` to `Item` interface + `ITEM_COLS` |
| `src/preload/types.ts` | Modified | Added `duration_ms` to renderer `Item`; removed redundant declaration from `FullItem extends Item` |
| `src/renderer/src/Grid.tsx` | Modified | Added `formatDuration` helper; ListRow renders `{duration ?? dims}` |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Mirror "Extract colors" pattern for media backfill | Consistency with the existing SettingsModal Library-maintenance UX (palettes + duplicates already use this shape) | No new UI patterns; reusable for future backfills (e.g. hashes) |
| Add `duration_ms` to BOTH `Item` interfaces (main + preload) | The renderer imports `Item` from `preload/types.ts`, not from `src/main/services/items.ts`, so both must carry the field for the grid projection to typecheck | Establishes the dual-interface sync convention clearly; future fields added to Item must touch both |
| Duplicate `formatDuration` rather than extract to shared module | Matches the existing `formatBytes` precedent (Grid.tsx:385 vs Inspector.tsx:18); avoids a new import graph change for a 6-line pure function | Minor duplication; flagged as a candidates for future shared-module refactor |
| Inspect ImportZone error handling, make NO change | Verified `run()` try/catch + `statusLine` error render is already correct; Phase 11 boundary's "missing catch block" note was resolved in shipped code | No churn on a working surface; boundary respected |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Essential typecheck fix — preload `Item` interface needed `duration_ms` in addition to main-process `Item` |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** One auto-fix during typecheck (preload types). No scope creep. No deferrals.

### Auto-fixed Issues

**1. [typecheck] preload `Item` interface lacked `duration_ms`**
- **Found during:** Task 2 (Show duration in list-row meta) — `npm run typecheck:web`
- **Issue:** `Grid.tsx:353` referenced `item.duration_ms`, but the renderer's `Item` type (from `src/preload/types.ts`) did not include the field — the main-process `Item` in `items.ts` had been updated but the preload copy had not.
- **Fix:** Added `duration_ms: number | null` to `preload/types.ts` `Item`, and removed the now-redundant `duration_ms` declaration from `FullItem extends Item`.
- **Files:** `src/preload/types.ts`
- **Verification:** `npm run typecheck:web` passes with zero errors; `npm run typecheck` (node + web) passes.
- **Commit:** (uncommitted, working tree)

## Issues Encountered

None beyond the single typecheck auto-fix above.

## Next Phase Readiness

**Ready:**
- v1.1 "Rich Media Import" feature set surface is complete: media thumbnails (Phase 10) + URL import (Phase 11) + backfill UI + duration display (Phase 12). All typechecks pass.
- The reusable backfill-UI pattern (SettingsModal button → `window.api.items.backfill*`) is established and could host a future "Extract hashes" button in SettingsModal.
- `formatDuration` is now available in Grid.tsx; `formatBytes` precedent shows the codebase tolerates this duplication.

**Concerns:**
- Phase 10/11/12 source is all uncommitted in the working tree (no git commits for v1.1 yet). The `feat/eagle-ui-polish` branch's latest commits (d6627d7/e7469ae/6cf82fc) are an unrelated off-loop UI polish + release bump and do NOT contain Phases 10–12. A phase-transition commit is needed.
- STATE.md's v1.1 progress bar shows 70% (Phase 10 + 11 complete) — should be updated to reflect Phase 12 completion.

**Blockers:**
- None for code work. Git commit + milestone close-out is the next systemic step (handled by `/paul:transition`).

---
*Phase: 12-import-polish, Plan: 01*
*Completed: 2026-09-14*
