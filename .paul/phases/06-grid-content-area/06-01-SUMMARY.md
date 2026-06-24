---
phase: 06-grid-content-area
plan: 01
subsystem: ui
tags: [react, grid, virtuoso, sort, thumbnail-size, localStorage]

# Dependency graph
requires:
  - phase: 05-03
    provides: AppShell three-pane layout + content-body slot the view toolbar sits in
  - phase: 03-01
    provides: VirtuosoGrid + items:list (the grid this plan resizes/sorts)
provides:
  - useGridView hook (persisted thumbSize/sortField/sortDir + compareItems comparator)
  - ContentToolbar (sort field + asc/desc toggle + thumbnail-size slider)
  - Grid thumbnail-size prop via --imgman-thumb CSS custom property
affects: [06-02-masonry-viewmode, 06-03-list-view, 06-04-hover-preview]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Renderer-side sort: one compareItems() comparator over the already-loaded scope list covers all-items/folder/search with zero IPC change"
    - "Thumbnail size driven by a CSS custom property on the VirtuosoGrid wrapper, so resizing reflows columns without recreating the List component (no scroller remount)"
    - "Grid view-state persisted to localStorage in a dedicated hook (useGridView), mirroring AppShell's read/write+clamp pattern"

key-files:
  created:
    - src/renderer/src/hooks/useGridView.ts
    - src/renderer/src/components/ContentToolbar.tsx
    - src/renderer/src/components/ContentToolbar.css
  modified:
    - src/renderer/src/Grid.tsx
    - src/renderer/src/LibraryGate.tsx

key-decisions:
  - "Sort stays renderer-side (no ORDER BY param on items:list/search) — one path for all 3 scopes"
  - "Thumbnail size via --imgman-thumb custom property to avoid remounting the virtualized scroller"
  - "View controls live in a NEW content-area sub-toolbar, not the 05-03 shell toolbar (which keeps SearchBar)"
  - "Default sort imported↓ matches the prior ORDER BY imported_at DESC → no behavior change until the user acts"

patterns-established:
  - "useGridView is the home for grid view-state; 06-02 view-mode + 06-03 list options extend it"
  - "ContentToolbar is the content-area view bar; the right-side gap is reserved for the 06-02 view-mode switch"

# Metrics
duration: ~1 session
started: 2026-06-24
completed: 2026-06-24
---

# Phase 6 Plan 01: View toolbar (size + sort) — Summary

**A content-area view toolbar above the grid — a thumbnail-size slider and a sort control (Imported/Created/Name/Rating/Size × asc/desc) — backed by a persisted useGridView hook; the grid resizes live via a CSS custom property and reorders via a renderer-side comparator that works identically across all-items, folder, and search scopes with no IPC/SQL change.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~1 session |
| Started | 2026-06-24 |
| Completed | 2026-06-24 |
| Tasks | 3 of 3 (2 auto + 1 human-verify) |
| Files modified | 5 (3 created, 2 modified) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: View toolbar renders above the grid | Pass | ContentToolbar between the ImportZone row and the grid; token-styled (sort select + ↑/↓ toggle, item count, size slider). |
| AC-2: Thumbnail size slider resizes cells live | Pass | Slider (96–280) drives `--imgman-thumb` on the VirtuosoGrid wrapper → columns reflow; no scroller remount; persisted across reload. |
| AC-3: Sort control reorders the grid | Pass | compareItems() over the loaded list; field + direction persisted; applies in all-items, folder, and search scopes. |
| AC-4: No regressions | Pass | typecheck (node+web) + build clean; selection/inspector, Space preview, folder, search, import unaffected; no main/preload/IPC/SQL files touched. |

## Accomplishments

- Shipped the Eagle-style content-area view bar and the two highest-value controls (size + sort).
- Established `useGridView` (persisted view-state + `compareItems`) and `ContentToolbar` as the extension points for the rest of Phase 6 (06-02 view-mode switch, 06-03 list options).
- Kept the change renderer-only: no IPC/SQL/main edits, one comparator covering all three grid scopes.

## Task Commits

Not committed per-task. Per the project's per-phase commit convention, Phase 6 work is committed together at the Phase 6 transition (after the final plan in the phase).

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Task 1: useGridView + ContentToolbar (+CSS) | (phase commit) | feat | Persisted view-state hook + comparator; controlled toolbar |
| Task 2: Wire Grid + LibraryGate | (phase commit) | feat | thumbSize via custom property; renderer-side sort via useMemo |
| Task 3: Human-verify | (phase commit) | — | Approved |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `hooks/useGridView.ts` | Created | Persisted `{thumbSize, sortField, sortDir}` + setters + `compareItems` comparator + THUMB_MIN/MAX |
| `components/ContentToolbar.tsx` | Created | Controlled view bar: sort `<select>`, asc/desc toggle, size `<input type=range>`, item count |
| `components/ContentToolbar.css` | Created | Token-based toolbar row (36px, bottom border), select/button/slider styling |
| `Grid.tsx` | Modified | New `thumbSize` prop → `--imgman-thumb` on wrapper; List columns use `minmax(var(--imgman-thumb,140px),1fr)` |
| `LibraryGate.tsx` | Modified | `useGridView()`, `sortedItems` useMemo, render ContentToolbar above grid, pass sorted items + thumbSize |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Sort renderer-side (no SQL ORDER BY param) | The scoped list is already fully loaded; one comparator covers all-items/folder/search | Zero IPC change; later sort options just extend compareItems |
| Thumbnail size via `--imgman-thumb` custom property | Setting it on the wrapper avoids recreating Virtuoso's List component, which would remount the scroller | Smooth live resize; no scroll-position loss |
| New content-area sub-toolbar (not the shell toolbar) | Keeps the 05-03 shell + SearchBar untouched; leaves room for the 06-02 view-mode switch | Lower cross-plan risk; clear extension point |

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
- View-state model (`useGridView`) + view bar (`ContentToolbar`) in place; 06-02 adds a `viewMode` field to the hook and a view-mode control in the toolbar's reserved right-side slot, then introduces the masonry layout alongside the existing uniform grid.

**Concerns:**
- 60fps @ 50k items is still unmeasured (carried Phase-3 concern); masonry (06-02) is the layout most likely to stress it — measure there.
- Renderer bundle ~710 kB (essentially unchanged; +~6 kB).

**Blockers:**
- None.

---
*Phase: 06-grid-content-area, Plan: 01*
*Completed: 2026-06-24*
