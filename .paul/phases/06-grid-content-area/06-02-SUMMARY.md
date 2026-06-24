---
phase: 06-grid-content-area
plan: 02
subsystem: ui
tags: [react, masonry, virtuoso, virtualization, view-mode, resizeobserver]

# Dependency graph
requires:
  - phase: 06-01
    provides: useGridView (thumbSize/sort) + ContentToolbar with a reserved view-mode slot
  - phase: 03-01
    provides: VirtuosoGrid grid + imgman://thumb protocol + Item.width/height
provides:
  - Virtualized masonry/waterfall layout (@virtuoso.dev/masonry)
  - Grid/Masonry view-mode switch (persisted via useGridView.viewMode)
  - useElementWidth (ResizeObserver) hook for container-driven column count
affects: [06-03-list-view, 06-04-hover-preview, 07-selection-interaction]

# Tech tracking
tech-stack:
  added: ["@virtuoso.dev/masonry@1.4.3"]
  patterns:
    - "VirtuosoMasonry for variable-height virtualized layout; columnCount derived from measured container width + thumbSize (not auto-fill)"
    - "Per-cell selection/handlers passed to VirtuosoMasonry via the `context` prop (ItemContent receives {context,data,index})"
    - "Shared Cell with a layout flag ('grid' square | 'masonry' natural aspect-ratio) so both modes reuse one renderer"
    - "key={columnCount} on VirtuosoMasonry to cleanly re-layout when the column count changes"

key-files:
  created:
    - src/renderer/src/hooks/useElementWidth.ts
  modified:
    - src/renderer/src/hooks/useGridView.ts
    - src/renderer/src/components/ContentToolbar.tsx
    - src/renderer/src/components/ContentToolbar.css
    - src/renderer/src/Grid.tsx
    - src/renderer/src/LibraryGate.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "Masonry engine = @virtuoso.dev/masonry (vs custom windowed / non-virtualized CSS columns)"
  - "Aspect ratio from Item.width/height only; square fallback for null dims (non-images)"
  - "columnCount computed renderer-side from container width via ResizeObserver"
  - "viewMode added to useGridView (4th persisted key); Grid-mode VirtuosoGrid untouched"

patterns-established:
  - "View-mode is a useGridView field; 06-03 list view becomes a 3rd value on the same switch"
  - "useElementWidth is the reusable container-measurement hook for layout math"

# Metrics
duration: ~1 session
started: 2026-06-24
completed: 2026-06-24
---

# Phase 6 Plan 02: Masonry/waterfall + view-mode switch — Summary

**A virtualized masonry/waterfall layout (@virtuoso.dev/masonry v1.4.3) and a Grid/Masonry view-mode switch in the content toolbar: masonry tiles take the item's natural aspect ratio (Item.width/height, square fallback for null dims), the column count is derived from the measured container width + the 06-01 size slider, and the 06-01 sort drives both modes — Grid mode (VirtuosoGrid) left unchanged.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~1 session |
| Started | 2026-06-24 |
| Completed | 2026-06-24 |
| Tasks | 3 of 3 (2 auto + 1 human-verify) |
| Files modified | 8 (1 created, 7 modified incl. lockfile) |
| Renderer bundle | 752 kB (+~43 kB for masonry) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: View-mode switch (persisted) | Pass | Grid/Masonry segmented control in ContentToolbar's right group; active = accent; viewMode persisted via useGridView (key `imgman.gridview.viewMode`), survives reload. |
| AC-2: Masonry by aspect ratio, virtualized | Pass | VirtuosoMasonry; tiles use `aspect-ratio: w / h` for images, `1 / 1` fallback for null dims; only visible (+overscan) cells mounted. |
| AC-3: Size + sort drive both modes | Pass | columnCount = floor((width+gap)/(thumbSize+gap)) recomputes on slider drag; sort (compareItems) reorders both modes; switching modes preserves size+sort. |
| AC-4: Grid unchanged; interactions in both | Pass | Grid mode still VirtuosoGrid + `--imgman-thumb`; click→select+inspector, Space preview, folder/search/import all work in both. |
| AC-5: Toolchain | Pass | `npm install` resolved @virtuoso.dev/masonry@1.4.3; typecheck (node+web) + build clean; no main/preload/IPC/SQL files touched. |

## Accomplishments

- Shipped Phase 6's centerpiece: a virtualized Eagle-style waterfall that holds up while scrolling, with images at true aspect ratio.
- Extended (did not restructure) 06-01's `useGridView` + `ContentToolbar` — view-mode is the 4th persisted preference and fills the slot the toolbar reserved.
- Added a reusable `useElementWidth` (ResizeObserver) hook and a shared Cell renderer parameterized by layout, keeping Grid and Masonry on one code path.

## Task Commits

Not committed per-task. Per the project's per-phase commit convention, all Phase 6 work (06-01…final) is committed together at the Phase 6 transition.

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Task 1: dep + viewMode + view-mode control | (phase commit) | feat | Install masonry; useGridView.viewMode; Grid/Masonry toolbar control |
| Task 2: masonry rendering + wiring | (phase commit) | feat | useElementWidth; VirtuosoMasonry path; LibraryGate viewMode wiring |
| Task 3: Human-verify | (phase commit) | — | Approved |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `hooks/useElementWidth.ts` | Created | ResizeObserver hook → container width for columnCount |
| `hooks/useGridView.ts` | Modified | Added persisted `viewMode: 'grid' \| 'masonry'` + setter |
| `components/ContentToolbar.tsx` | Modified | Grid/Masonry segmented control (icons) in the right group |
| `components/ContentToolbar.css` | Modified | `.content-toolbar__viewmode/__viewbtn(--on)` styles |
| `Grid.tsx` | Modified | Masonry path (VirtuosoMasonry, aspect-ratio tiles, columnCount); shared Cell with layout flag; Grid path unchanged |
| `LibraryGate.tsx` | Modified | Pull/pass viewMode + setViewMode to toolbar and grid |
| `package.json` / `package-lock.json` | Modified | Add @virtuoso.dev/masonry@1.4.3 |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| @virtuoso.dev/masonry as the engine | Virtualized + least code vs custom/CSS-columns; pure JS (no native rebuild) | One new runtime dep; 60fps@50k feasible |
| columnCount from measured width (ResizeObserver) | VirtuosoMasonry needs an explicit column count, not auto-fill | Size slider maps to column width → count |
| `key={columnCount}` on VirtuosoMasonry | Force a clean re-layout when columns change | Avoids stale column distribution |
| Selection passed via `context` prop | VirtuosoMasonry ItemContent is a component, not a closure | Highlight updates without remounting cells |

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

| Issue | Resolution |
|-------|------------|
| `@` in `npm install @virtuoso.dev/masonry` parsed as PowerShell splat operator | Quoted the package name: `npm install "@virtuoso.dev/masonry"` |
| `require('@virtuoso.dev/masonry/package.json')` blocked (subpath not in package `exports`) | Read the version from `node_modules/.../package.json` directly (1.4.3) |

## Next Phase Readiness

**Ready:**
- View-mode switch is a 3-way-ready control; 06-03 adds `'list'` to useGridView's ViewMode + a third toolbar button + a list renderer in Grid. 06-04 (hover preview) layers onto the shared Cell.

**Concerns:**
- 60fps @ 50k still not measured against a real 50k-item library (human-verify used a smaller set; scrolling was smooth). Worth a dedicated perf pass before milestone close.
- Renderer bundle 752 kB (+~43 kB). Still fine for desktop.
- Masonry aspect ratios only exist for images (sharp populates width/height); video/pdf/font tiles are square until V1 media-dimension extraction.

**Blockers:**
- None.

---
*Phase: 06-grid-content-area, Plan: 02*
*Completed: 2026-06-24*
