---
phase: 07-selection-interaction
plan: 03
subsystem: ui
tags: [react, selection, marquee, rubber-band, virtuoso, pointer-events]

# Dependency graph
requires:
  - phase: 07-01
    provides: useSelection (selected Set + primary/anchor) + the empty-click clear that this plan absorbs into Grid
  - phase: 07-02
    provides: Grid forwardRef + measured wrapper (wrapRef) hosting the marquee overlay/pointer handlers
provides:
  - useSelection.applyMarquee(ids, additive) — batch replace-or-add selection
  - data-item-id on every grid/masonry/list cell for client-rect hit-testing
  - Grid-owned background pointer interaction: drag → marquee rectangle + intersect mounted cells → onMarqueeSelect; plain background press → onBackgroundClick
affects: [07-04-context-menus, 07-05-batch-ops, 07-06-multi-item-inspector]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Background pointer gesture lives on Grid's measured wrapper (wrapRef); document-level mousemove/mouseup listeners track the drag; a 4px threshold distinguishes drag (marquee) from click (clear)"
    - "Hit-test = wrapRef.querySelectorAll('[data-item-id]') × client-coord getBoundingClientRect() intersection; overlay positioned wrapper-relative (subtract wrapper rect)"
    - "Container owns selection semantics (LibraryGate wires onMarqueeSelect→applyMarquee, onBackgroundClick→clear); Grid is gesture-only"

key-files:
  created: []
  modified:
    - src/renderer/src/hooks/useSelection.ts
    - src/renderer/src/Grid.tsx
    - src/renderer/src/Grid.css
    - src/renderer/src/LibraryGate.tsx

key-decisions:
  - "Empty-click clear moved from a LibraryGate wrapper onClick INTO Grid's background handler, so a drag (marquee) and a click (clear) no longer race"
  - "Marquee catches only currently-mounted (on-screen) cells; no auto-scroll during drag (deferred)"
  - "Token-driven overlay via color-mix(in srgb, var(--color-accent) 18%, transparent) + accent border (Chromium/Electron supports color-mix — no fallback needed)"

patterns-established:
  - "Document-listener drag gesture on the Grid wrapper, threshold-gated, reusable for future pointer interactions (e.g. drag-to-move in a later phase)"

# Metrics
duration: ~1 session
started: 2026-06-24
completed: 2026-06-24
---

# Phase 7 Plan 03: Rubber-band marquee — Summary

**Rubber-band (marquee) selection: dragging on empty grid space draws a token-styled rectangle and live-selects every mounted cell it intersects (Shift/Ctrl/Cmd to ADD to the existing selection); a plain empty-space click clears. Works across grid, masonry, and list — completing the selection surface (click + keyboard + marquee) for the upcoming context-menu / batch-op plans.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~1 session |
| Started | 2026-06-24 |
| Completed | 2026-06-24 |
| Tasks | 3 of 3 (2 auto + 1 human-verify) |
| Files modified | 4 (renderer only) |
| Renderer bundle | ~776 kB (≈ unchanged) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Drag selects intersecting items (replace) | Pass | Rectangle follows cursor; on-move hit-test live-selects intersecting cells; replaces prior selection; toolbar count updates. Human-verified. |
| AC-2: Additive marquee (Shift/Ctrl/Cmd) | Pass | `additive` captured at mousedown → `applyMarquee` unions onto current selection. Human-verified. |
| AC-3: Background click clears; cell + keyboard intact | Pass | Sub-4px press = background click → `clear`; cell mousedown skipped via `closest('[data-item-id]')`; click/ctrl/shift + arrow nav unaffected. Human-verified. |
| AC-4: No regressions | Pass | `npm run typecheck` (node + web) + `npm run build` clean; no main/preload/IPC/SQL files modified; scroll/sort/size/view-modes/hover/inspector unchanged. |

## Accomplishments

- Shipped the third selection gesture (marquee) — the grid now feels like a real desktop file browser.
- Resolved the click-vs-drag conflict by making Grid the single owner of background pointer interaction (clear + marquee), retiring LibraryGate's inline empty-click `onClick`.
- Established a reusable, threshold-gated document-listener drag pattern on the Grid wrapper.

## Task Commits

Committed together with all of Phase 7 at the phase transition (per the per-phase commit convention — Phase 7 is not yet complete; 07-04/05/06 remain).

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Task 1: applyMarquee + data-item-id on cells | (deferred to phase commit) | feat | `applyMarquee` in useSelection; `data-item-id` on Cell (grid/masonry) + ListRow |
| Task 2: marquee overlay + background pointer; LibraryGate wiring | (deferred to phase commit) | feat | Grid props/state/handler + `.marquee` overlay; LibraryGate wires marquee/clear |
| Task 3: Human-verify | (deferred to phase commit) | — | Approved |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `hooks/useSelection.ts` | Modified | `applyMarquee(ids, additive)` — union (additive) or replace; primary/anchor follow last id (reset on empty replace) |
| `Grid.tsx` | Modified | `onMarqueeSelect`/`onBackgroundClick` props; `data-item-id` on Cell button; marquee state + wrapper `onMouseDown` → document drag listeners + client-rect hit-test; wrapper `position:relative` + overlay render |
| `Grid.css` | Modified | `.marquee` overlay (absolute, `pointer-events:none`, accent border + `color-mix` fill) |
| `LibraryGate.tsx` | Modified | Removed inline empty-click `onClick` clear; wired `onMarqueeSelect → sel.applyMarquee`, `onBackgroundClick → sel.clear` |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Move empty-click clear into Grid's background handler | A wrapper `onClick` clear and a drag-to-marquee on the same surface race | Single gesture owner; drag and click no longer conflict |
| `closest('[data-item-id]')` guard on mousedown | Marquee must start only on empty space, never on a cell | Cell click / ctrl / shift selection (07-01) untouched |
| 4px drag threshold | Distinguish a click (clear) from a drag (marquee) | Prevents accidental clears/selections on small jitters |
| `color-mix` fill (no fallback) | Electron/Chromium supports `color-mix`; keeps the overlay token-driven | Clean token styling; no extra CSS var |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 0 | — |
| Deferred | 1 | Pre-existing scope limit (no auto-scroll during drag), re-logged below |

**Total impact:** Plan executed essentially as written. One execution note: a prior partial APPLY had already added `applyMarquee` and the `ListRow` `data-item-id`; this session completed the rest (Cell `data-item-id`, all of Task 2) and verified — no rework or divergence from the plan.

### Deferred Items

- No auto-scroll during marquee drag, and only currently-mounted (on-screen) cells are hit-tested — an explicit SCOPE LIMIT of this plan, not new debt. Auto-scroll-while-dragging can be added in a later interaction pass if needed.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Plan found partially applied (applyMarquee + one data-item-id present, Task 2 absent) at UNIFY time | Detected via code scan before unifying; routed back through APPLY to complete Task 1 remainder + all of Task 2, then verified — rather than fabricating a SUMMARY. |

## Next Phase Readiness

**Ready:**
- Selection surface is complete (click 07-01 + keyboard 07-02 + marquee 07-03). 07-04 context menus and 07-05 batch ops act on `useSelection` (`selected`/`primary`); 07-06 multi-item inspector reads `selected`.

**Concerns:**
- Marquee won't catch off-screen cells (no auto-scroll) — acceptable, documented.
- 60fps @ 50k still unmeasured — consider a perf pass before Phase 7 / milestone close (the live per-move `querySelectorAll` + rect intersection is over mounted cells only, so cost is bounded by overscan, but worth confirming at scale).

**Blockers:**
- None.

---
*Phase: 07-selection-interaction, Plan: 03*
*Completed: 2026-06-24*
