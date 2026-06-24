---
phase: 07-selection-interaction
plan: 02
subsystem: ui
tags: [react, keyboard-navigation, virtuoso, selection, accessibility]

# Dependency graph
requires:
  - phase: 07-01
    provides: useSelection (handleSelect/selectAll/clear; primary/anchor)
  - phase: 06-02
    provides: Grid view modes + masonry columnCount formula reused for column reporting
provides:
  - Keyboard navigation over the grid (arrows/shift/Ctrl+A/Home/End/Enter) + scroll-into-view
  - Grid imperative handle (GridHandle.scrollToId) + column-count reporting (onColumns)
affects: [07-03-marquee, 07-04-context-menus, 07-05-batch-ops]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Grid is forwardRef<GridHandle> exposing scrollToId; measured wrapper computes column count for every mode and reports it via onColumns into a LibraryGate ref (no render churn)"
    - "2D arrow nav in grid (±1 / ±columns); 1D in list & masonry (masonry rows irregular)"
    - "Navigation reuses useSelection.handleSelect (plain/shift) + selectAll — no new selection methods"

key-files:
  created: []
  modified:
    - src/renderer/src/Grid.tsx
    - src/renderer/src/LibraryGate.tsx

key-decisions:
  - "2D nav only in grid; list/masonry are 1D (masonry layout irregular)"
  - "Active scrolls into view via Virtuoso/VirtuosoGrid scrollToIndex; masonry has no handle → no-op"
  - "Extended the existing Space/Escape keydown effect rather than adding a second listener"

patterns-established:
  - "GridHandle (imperative ref) is the channel for container→grid scroll control; reusable by 07-03/07-04"

# Metrics
duration: ~1 session
started: 2026-06-24
completed: 2026-06-24
---

# Phase 7 Plan 02: Keyboard navigation — Summary

**Arrow-key navigation over the content grid: arrows move + select the active item (2D in grid — ±1 / ±columns; 1D in list/masonry), Shift+arrows extend the range, Ctrl/Cmd+A selects all, Home/End jump, Enter/Space toggle the quick preview, and the active item scrolls into view — built on `useSelection` (no new selection logic) plus a new `GridHandle.scrollToId` + column-count reporting. Retires the long-standing "no arrow-key navigation" concern.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~1 session |
| Started | 2026-06-24 |
| Completed | 2026-06-24 |
| Tasks | 3 of 3 (2 auto + 1 human-verify) |
| Files modified | 2 |
| Renderer bundle | ~773 kB (≈ unchanged) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Arrows move + select | Pass | grid 2D (L/R ±1, U/D ±columns); list/masonry 1D; first item when none active; clamps at ends. |
| AC-2: Shift-extend / Ctrl+A / Home / End / Enter | Pass | shift+arrow = range from anchor; Ctrl/Cmd+A = selectAll; Home/End first/last; Enter toggles preview. |
| AC-3: Active scrolls into view | Pass | grid + list via scrollToIndex; masonry no-op (no handle), selection still correct. |
| AC-4: Context guards | Pass | input/textarea/contenteditable + Settings-open guards prevent grid nav; caret keys work in fields. |
| AC-5: No regressions | Pass | typecheck (node+web) + build clean; mouse select / sort / size / view modes / hover / inspector unchanged; no main/preload/IPC/SQL change. |

## Accomplishments

- Shipped full keyboard navigation across all three view modes, driven entirely by the 07-01 selection model.
- Added a reusable `GridHandle` (imperative scroll) + column-count reporting the later Phase-7 plans can use.
- Closed the "no arrow-key navigation" carried concern.

## Task Commits

Committed together with all of Phase 7 at the phase transition (per the per-phase commit convention).

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Task 1: GridHandle + column reporting | (phase commit) | feat | forwardRef scrollToId; measured wrapper → onColumns |
| Task 2: nav key handling | (phase commit) | feat | arrows/shift/Ctrl+A/Home/End/Enter; scroll active into view |
| Task 3: Human-verify | (phase commit) | — | Approved |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `Grid.tsx` | Modified | `forwardRef<GridHandle>` w/ `scrollToId`; measured wrapper computes + reports `columns` (onColumns); internal Virtuoso/VirtuosoGrid refs |
| `LibraryGate.tsx` | Modified | gridRef + columnsRef; extended keydown effect (nav keys); Grid `ref`/`onColumns` wiring |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| 2D nav grid-only; 1D list/masonry | Masonry rows are irregular → row math would mis-jump | Predictable nav; masonry still usable |
| scrollToIndex without `align` | `align:'auto'` isn't valid (enum start/center/end) | Uses Virtuoso default into-view scroll |
| Extend existing keydown effect | Avoid competing listeners / double-handling | One handler owns grid keys |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Trivial type fix; no behavior change |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** Essential fix only, no scope creep.

### Auto-fixed Issues

**1. [Types] Invalid `align: 'auto'` on scrollToIndex**
- **Found during:** Task 1 (Grid handle)
- **Issue:** react-virtuoso's `scrollToIndex` `align` accepts only `start | center | end`; `'auto'` failed typecheck.
- **Fix:** Dropped `align`, using the library's default into-view scroll.
- **Files:** `Grid.tsx`
- **Verification:** `npm run typecheck:web` passes; scroll-into-view confirmed in human-verify.

## Issues Encountered

None beyond the auto-fix above.

## Next Phase Readiness

**Ready:**
- 07-03 (rubber-band marquee) can reuse `GridHandle` patterns; 07-04 context menus / 07-05 batch ops act on `useSelection`. Selection + keyboard + (next) marquee complete the selection surface.

**Concerns:**
- Masonry has no scroll-into-view (no handle) — keyboard nav there selects but won't auto-scroll; acceptable, noted.
- 60fps @ 50k still unmeasured.

**Blockers:**
- None.

---
*Phase: 07-selection-interaction, Plan: 02*
*Completed: 2026-06-24*
