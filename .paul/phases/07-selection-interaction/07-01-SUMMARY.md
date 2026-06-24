---
phase: 07-selection-interaction
plan: 01
subsystem: ui
tags: [react, selection, multi-select, grid, hooks]

# Dependency graph
requires:
  - phase: 06-02
    provides: shared Grid Cell (grid/masonry) + masonry context plumbing
  - phase: 06-03
    provides: list rows (ListRow) sharing the selected styling
provides:
  - useSelection hook (Set + primary + anchor; click/ctrl/shift semantics)
  - multi-select wiring across grid/masonry/list; "N selected" toolbar count
affects: [07-02-keyboard-marquee, 07-03-context-menus, 07-04-batch-ops, 07-05-multi-item-inspector]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSelection: {selected:Set, primary, anchor}; handleSelect(id, orderedIds, mods) — plain=replace, ctrl/cmd=toggle, shift=range over current sort order; ordered list passed per call (not stored)"
    - "Primary (last-clicked) id keeps the single-id inspector/preview contract while the grid renders a full selection set"
    - "Selection passed to VirtuosoMasonry cells via the context prop (selectedIds + onSelect)"

key-files:
  created:
    - src/renderer/src/hooks/useSelection.ts
  modified:
    - src/renderer/src/Grid.tsx
    - src/renderer/src/LibraryGate.tsx
    - src/renderer/src/components/ContentToolbar.tsx

key-decisions:
  - "Multi-select is renderer-only ephemeral state (no persistence, no IPC)"
  - "Inspector/QuickPreview keep their single-id contract, fed the primary — multi-item inspector deferred to 07-05"
  - "Range selection walks the current sorted order (orderedIds passed per call)"
  - "Selection clears on scope change / empty-click / Escape (when no preview); prunes ids no longer in the list"

patterns-established:
  - "useSelection is the selection source of truth for 07-02 (keyboard/marquee), 07-03 (context menus), 07-04 (batch ops)"

# Metrics
duration: ~1 session
started: 2026-06-24
completed: 2026-06-24
---

# Phase 7 Plan 01: Multi-select model (mouse) — Summary

**A selection set + primary/anchor model (`useSelection`): plain click replaces, Ctrl/Cmd-click toggles, Shift-click selects a contiguous range over the current sort order; the primary (last-clicked) item still drives the inspector and Space preview, all three view modes highlight every selected item, the toolbar shows "N selected", and selection clears on scope change / empty-click / Escape — renderer-only, no IPC.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~1 session |
| Started | 2026-06-24 |
| Completed | 2026-06-24 |
| Tasks | 3 of 3 (2 auto + 1 human-verify) |
| Files modified | 4 (1 created, 3 modified) |
| Renderer bundle | ~771 kB (≈ unchanged) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Click selects one; Ctrl/Cmd-click toggles | Pass | plain → replace; ctrl/cmd → toggle in set; both set primary; ctrl also sets anchor. |
| AC-2: Shift-click selects a range | Pass | range over orderedIds from anchor→clicked (inclusive); primary = clicked; anchor kept. |
| AC-3: Primary drives inspector + preview; multi styling | Pass | all selected highlighted in grid/masonry/list; inspector + Space use primary; toolbar "N selected" when >1. |
| AC-4: Selection resets sensibly | Pass | clears on library/folder/search change, empty-click, Escape (no preview); prune drops vanished ids. |
| AC-5: No regressions | Pass | typecheck (node+web) + build clean; single-selection + inspector edits + hover + sort/size unchanged; no main/preload/IPC/SQL change. |

## Accomplishments

- Established the selection source of truth (`useSelection`) the rest of Phase 7 builds on.
- Generalized all three view modes from a single `selectedId` to a `Set<string>` + primary/anchor with zero change to the inspector's single-item contract.
- Added visible multi-select feedback ("N selected") and sensible clear/prune behaviour.

## Task Commits

Committed together with all of Phase 7 at the phase transition (per the per-phase commit convention).

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Task 1: useSelection hook | (phase commit) | feat | Selection state machine (set + primary + anchor) |
| Task 2: Wire Grid + LibraryGate + toolbar | (phase commit) | feat | Modifier clicks across modes; primary→inspector; "N selected" |
| Task 3: Human-verify | (phase commit) | — | Approved |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `hooks/useSelection.ts` | Created | `{selected, primary, anchor}` + handleSelect/selectAll/clear/prune; SelectMods type |
| `Grid.tsx` | Modified | `selectedIds: Set` + `onSelect(id, mods)`; `modsFrom(e)`; masonry context carries selectedIds |
| `LibraryGate.tsx` | Modified | Owns useSelection; orderedIds memo; primary→inspector/preview; clear/prune effects; empty-click + Esc clear |
| `components/ContentToolbar.tsx` | Modified | Optional `selectedCount` → "N selected" caption |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Renderer-only ephemeral selection | Selection is pure UI state | No IPC/persistence; resets per scope |
| Inspector keeps single-id contract (primary) | Avoid disrupting Phase 4 inspector edits | Multi-item inspector is a clean later add (07-05) |
| orderedIds passed per call (not stored in hook) | Range must reflect current sort | Hook stays pure; correct ranges after re-sort |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** None — plan executed exactly as written.

### Deferred Items

None.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- 07-02 (keyboard navigation + rubber-band marquee) drives the same `useSelection` (arrows move primary; shift-arrows extend; Ctrl+A → selectAll; marquee builds a set). 07-03 context menus and 07-04 batch ops act on `sel.selected`.

**Concerns:**
- Arrow-key navigation still absent (existing carried concern) — that's exactly 07-02's job.
- 60fps @ 50k still unmeasured.

**Blockers:**
- None.

---
*Phase: 07-selection-interaction, Plan: 01*
*Completed: 2026-06-24*
