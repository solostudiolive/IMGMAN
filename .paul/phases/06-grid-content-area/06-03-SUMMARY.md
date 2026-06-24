---
phase: 06-grid-content-area
plan: 03
subsystem: ui
tags: [react, virtuoso, list-view, view-mode, details-list]

# Dependency graph
requires:
  - phase: 06-02
    provides: useGridView.viewMode + Grid/Masonry segmented control + per-mode Grid rendering
  - phase: 06-01
    provides: ContentToolbar + thumbSize/sort controls
provides:
  - List view mode (virtualized details list) as the 3rd ViewMode
  - Grid.css (list-row layout + hover/selected/ellipsis)
affects: [06-04-hover-preview, 07-selection-interaction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "react-virtuoso `Virtuoso` (list component, already a dependency) for the virtualized details list — no new package"
    - "List rows use a component-scoped CSS file (Grid.css) for hover/selected/ellipsis; grid/masonry cells stay inline-styled"
    - "Size slider maps to list row thumbnail size via clamp(thumbSize*0.4, 32, 80)"

key-files:
  created:
    - src/renderer/src/Grid.css
  modified:
    - src/renderer/src/hooks/useGridView.ts
    - src/renderer/src/components/ContentToolbar.tsx
    - src/renderer/src/Grid.tsx

key-decisions:
  - "List uses react-virtuoso Virtuoso (no new dependency) vs the masonry package"
  - "List is read-only display (selection + inspector) — no inline edit / sortable headers / resizable columns (Phase 7)"
  - "Row thumbnail size derived from the existing thumbSize slider (clamped to a list range)"

patterns-established:
  - "ViewMode is now 3-way (grid/masonry/list); the switch + per-mode Grid rendering is the extension point for future modes"

# Metrics
duration: ~1 session
started: 2026-06-24
completed: 2026-06-24
---

# Phase 6 Plan 03: List view mode — Summary

**A third view mode (List) completing Grid/Masonry/List: a virtualized react-virtuoso details list where each row shows a small thumbnail + name + type·format + dimensions + human-readable size + rating, driven by the same sort + size controls — using the already-installed `Virtuoso` (no new dependency), with Grid and Masonry paths untouched.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~1 session |
| Started | 2026-06-24 |
| Completed | 2026-06-24 |
| Tasks | 3 of 3 (2 auto + 1 human-verify) |
| Files modified | 4 (1 created, 3 modified) |
| Renderer bundle | 767 kB (+~15 kB, no new dep) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Three-way switch incl. List (persisted) | Pass | Grid/Masonry/List in ContentToolbar; List highlights when active; viewMode persists 'list' across reload. |
| AC-2: List rows show details, virtualized | Pass | `Virtuoso` list; each row = thumb + name + type·ext + W×H (— when unknown) + formatBytes size + ★rating; only visible rows mounted; name ellipsis. |
| AC-3: Sort + size + selection in List | Pass | compareItems reorders rows; slider scales row thumb (clamp 32–80); click selects + inspector updates; Space preview works. |
| AC-4: Grid + Masonry unchanged | Pass | Both render paths untouched; verified visually. |
| AC-5: Toolchain | Pass | typecheck (node+web) + build clean; no new dependency; no main/preload/IPC/SQL files modified. |

## Accomplishments

- Completed Phase 6's "multiple view modes" deliverable — Grid, Masonry, and List all selectable from one control.
- Reused react-virtuoso's `Virtuoso` for the list, keeping the dependency count flat (only masonry was new, in 06-02).
- Added `formatBytes` + a compact details-row layout (Grid.css) reusable by future list-like surfaces.

## Task Commits

Not committed per-task. Per the project convention, all Phase 6 work commits together at the Phase 6 transition (after the final plan, 06-04).

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Task 1: 'list' ViewMode + List button | (phase commit) | feat | useGridView 'list'; ContentToolbar List button/glyph |
| Task 2: Virtuoso list + Grid.css | (phase commit) | feat | ListRow (thumb/name/type/dims/size/rating), formatBytes, row styles |
| Task 3: Human-verify | (phase commit) | — | Approved |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `Grid.css` | Created | List-row flex layout + hover/selected + name ellipsis + column classes |
| `hooks/useGridView.ts` | Modified | `ViewMode` += 'list'; VIEW_MODES += 'list' |
| `components/ContentToolbar.tsx` | Modified | Third (List) button + ListGlyph in the view-mode control |
| `Grid.tsx` | Modified | `viewMode==='list'` → Virtuoso list; ListRow component; formatBytes helper |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| react-virtuoso Virtuoso for the list | Already a dependency; purpose-built virtualized list | No new package; consistent windowing |
| Read-only list (no inline edit / sortable headers / resizable cols) | Keep plan focused; editing/selection power is Phase 7 | Smaller surface; clear scope boundary |
| Row thumb size from thumbSize slider (clamped) | One size control drives all three modes | Slider stays meaningful in List mode |

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
- 06-04 (hover preview for GIF/video) is the LAST Phase 6 plan; it layers onto the shared grid/masonry Cell (and optionally list rows). Its UNIFY triggers the Phase 6 transition + the `feat(06-…)` commit.

**Concerns:**
- 60fps @ 50k still unmeasured against a real large library (smooth in human-verify on a smaller set across all three modes). Worth a perf pass before milestone close.
- Renderer bundle 767 kB. Still fine for desktop.

**Blockers:**
- None.

---
*Phase: 06-grid-content-area, Plan: 03*
*Completed: 2026-06-24*
