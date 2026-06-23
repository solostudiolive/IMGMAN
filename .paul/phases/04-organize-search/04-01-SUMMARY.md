---
phase: 04-organize-search
plan: 01
subsystem: ui
tags: [electron, ipc, sqlite, react, ratings, mutation]

# Dependency graph
requires:
  - phase: 03-browse (plan 02)
    provides: items:get + FullItem, read-only Inspector showing rating as glyphs
provides:
  - items:update IPC + updateItem service + ItemPatch type (allow-listed, clamped mutation)
  - Interactive StarRating control in the inspector (set 1–5, click top star to clear)
  - Reusable item-mutation pattern (optimistic update → persist → reconcile, revert on failure)
affects: [04-organize-search (tags/folders/notes reuse items:update + ItemPatch), search (filter by rating)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "items:update(id, patch) — only allow-listed keys build the SET clause; column names never interpolated from input"
    - "Mutation UX: optimistic local update, persist, reconcile to returned DB row, revert + log on failure"

key-files:
  created: []
  modified:
    - src/main/services/items.ts
    - src/main/ipc/items.ts
    - src/preload/index.ts
    - src/preload/types.ts
    - src/renderer/src/Inspector.tsx

key-decisions:
  - "ItemPatch is an allow-list (rating only now); future fields (note, etc.) slot into the same SET builder"
  - "updateItem returns getItem(id) so callers get the canonical persisted row (covers clamping); null for unknown id / no library"
  - "Rating clamped+rounded to 0..5 in the main process (not trusted from the renderer)"
  - "Optimistic update reverts on persist failure rather than masking it"

patterns-established:
  - "Item mutation: allow-listed patch IPC + main-side validation + optimistic/reconcile/revert in the renderer"

# Metrics
duration: ~single session (incl. one re-verify cycle)
started: 2026-06-23
completed: 2026-06-23T00:00:00Z
---

# Phase 4 Plan 01: Editable Star Ratings + items:update Summary

**Star ratings (1–5) are now editable from the inspector and persisted via a validated, allow-listed `items:update` mutation — establishing the item-write pattern that tags, folders, notes, and search-by-rating will reuse.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~single session (one re-verify cycle) |
| Started | 2026-06-23 |
| Completed | 2026-06-23 |
| Tasks | 2 implementation + 1 human-verify checkpoint (approved) |
| Files created | 0 |
| Files modified | 5 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Setting a rating | Pass | Clicking the Nth star sets rating N; stars fill immediately; persisted to items table. User-verified. |
| AC-2: Clearing a rating | Pass | Clicking the current top star resets to 0; persisted. User-verified. |
| AC-3: Ratings persist | Pass | Reselect re-reads via items:get from DB and shows the set rating; persists across relaunch. User-verified after a clean dev restart. |
| AC-4: items:update validated & safe | Pass | rating clamped+rounded to 0..5 in the main process; unknown id / no library → null, no throw across IPC. typecheck + runtime verified. |

**Verification:** `npm run typecheck` (node + web) passes; `npm run build` produces all three bundles cleanly (renderer ~657 kB). Runtime persistence confirmed by the user at the human-verify checkpoint.

## Accomplishments

- Shipped the first organizing primitive of Phase 4: editable ratings, completing the MVP "star ratings (1–5)" requirement.
- Stood up the reusable, validated item-mutation IPC (`items:update` + `ItemPatch`) — the write-path foundation for the rest of Phase 4.
- Established the optimistic-update-with-revert UX pattern for item edits.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/main/services/items.ts` | Modified | ItemPatch type + updateItem(id, patch): allow-listed SET builder, rating clamp 0..5, returns persisted row |
| `src/main/ipc/items.ts` | Modified | items:update handler |
| `src/preload/index.ts` | Modified | items.update bridge (+ ItemPatch import) |
| `src/preload/types.ts` | Modified | ItemPatch type + items.update signature |
| `src/renderer/src/Inspector.tsx` | Modified | Interactive StarRating control; setRating with optimistic update, persist, reconcile, and revert-on-failure |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| ItemPatch allow-list (rating only) | Prevent arbitrary columns reaching SQL; extensible | Tags/folders/notes add keys to the same builder |
| updateItem returns getItem(id) | Callers reconcile to the canonical row (covers clamping) | Renderer trusts the DB, not its optimistic guess |
| Clamp/round in the main process | Renderer input is untrusted | Rating always valid 0..5 |
| Revert optimistic update on failure | Don't mask persist errors | Surfaced the stale-dev-server symptom; better UX |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Hardened error handling; no scope change |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** One essential robustness fix found at the checkpoint; no scope creep.

### Auto-fixed Issues

**1. [UX/Robustness] Silent persist failure masked by optimistic update**
- **Found during:** Task 3 (human-verify) — "rating not saved" on reselect.
- **Issue:** The original `setRating` applied the optimistic update and awaited the persist without catching failure; when the renderer's `window.api.items.update` was unavailable (a dev server started before the new preload/main), the call threw and was swallowed — stars filled, then vanished on reselect.
- **Fix:** `setRating` now wraps the persist in try/catch, reverts the optimistic rating on failure or null, and logs to console.
- **Root cause of the report:** stale dev process predating the new preload bridge; resolved by a full `npm run dev` restart (code path itself was correct).
- **Verification:** User restarted dev; rating set/clear/persist all confirmed.

### Deferred Items

None. (Scope limits stand: no grid rating badge, no batch/multi-select rating, no other editable fields yet.)

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| "Image rating not saved" at first verify | Root-caused to a stale dev server (preload predated items.update); hardened setRating to reveal such failures; full `npm run dev` restart fixed it; re-verified. |

## Next Phase Readiness

**Ready (for the rest of Phase 4):**
- `items:update` + `ItemPatch` are in place — tags/folders/notes editing extend the allow-list and SET builder rather than adding new mutation plumbing.
- The optimistic/reconcile/revert UX pattern is reusable for any inspector edit.
- Rating is now a real, queryable value for the eventual filter-by-rating in the search plan.

**Concerns:**
- Rating not shown on grid cells yet (inspector-only) — a polish item if grid-level rating visibility is wanted.
- FTS (`items_fts`) still has no sync triggers — the search plan (04-04) must populate/maintain it.

**Blockers:**
- None.

---
*Phase: 04-organize-search, Plan: 01*
*Completed: 2026-06-23*
