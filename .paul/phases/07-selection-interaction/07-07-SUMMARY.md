---
phase: 07-selection-interaction
plan: 07
subsystem: ui
tags: [electron, ipc, sqlite, batch, inspector, rating, tags, folders, intersection]

# Dependency graph
requires:
  - phase: 07-05
    provides: atomic batch-IPC pattern (service → ipc → preload → IpcApi, one txn, returns count) + tags:addToMany / folders:assignMany reused for the "add" side
  - phase: 07-01
    provides: useSelection — the `selected` Set drives which items the multi-inspector edits
provides:
  - items:rateMany(ids, rating) — atomic batch rating (clamped 0..5)
  - tags:commonForItems(ids) / tags:removeFromMany(ids, tagId) — intersection read + batch unlink
  - folders:commonForItems(ids) / folders:unassignMany(ids, folderId) — intersection read + batch unassign
  - MultiInspector — editable multi-selection panel (aggregate header + batch rating/tags/folders)
  - LibraryGate single↔multi inspector switch (selectedItems memo, selection-size gated)
affects: [08-organize-power-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Aggregate read = dynamic IN (?,?,…) + HAVING COUNT(DISTINCT item_id) = ids.length → only values shared by ALL selected items (the intersection)"
    - "Header aggregates (count / total size / type breakdown / common-rating) computed RENDERER-side from the grid's Item[] (free); only the intersections are fetched"
    - "Inspector slot is selection-size gated: >1 → MultiInspector, else single Inspector (unchanged)"

key-files:
  created:
    - src/renderer/src/components/MultiInspector.tsx
  modified:
    - src/main/services/items.ts
    - src/main/services/tags.ts
    - src/main/services/folders.ts
    - src/main/ipc/items.ts
    - src/main/ipc/tags.ts
    - src/main/ipc/folders.ts
    - src/preload/types.ts
    - src/preload/index.ts
    - src/renderer/src/LibraryGate.tsx

key-decisions:
  - "Five NEW channels added (rateMany / commonForItems×2 / removeFromMany / unassignMany); existing single-item + 07-05/06 channels untouched; adds reuse addToMany/assignMany"
  - "'Common' = strict INTERSECTION via HAVING COUNT(DISTINCT item_id)=N; no tri-state/partial chips, no per-item drill-down"
  - "MultiInspector is a NEW component; single Inspector / TagEditor / FolderAssigner behavior unchanged — LibraryGate only chooses between them"
  - "No schema change, no new runtime deps; rating clamped 0..5 mirroring updateItem; items_fts untouched"

patterns-established:
  - "Intersection-read + atomic-batch-mutate IPC pair for multi-selection editors — reusable for future bulk surfaces"

# Metrics
duration: ~1 session
started: 2026-06-24
completed: 2026-06-24
---

# Phase 7 Plan 07: Editable Multi-Item Inspector Summary

**A MultiInspector shown for 2+ selected items: aggregate header (count · total size · per-type counts) plus batch rating ("Mixed"-aware), common-tags, and common-folders (the intersection) as removable chips with add controls — every edit applied to the whole selection in one transaction.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~1 session |
| Started | 2026-06-24 |
| Completed | 2026-06-24 |
| Tasks | 3 auto + 1 human-verify checkpoint (approved) |
| Files modified | 9 (1 created, 8 modified) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Multi vs single switch + aggregate header | Pass | `sel.selected.size > 1` → MultiInspector (count/size/type breakdown); 1 → Inspector; 0 → empty state |
| AC-2: Batch rating with mixed state | Pass | commonRating null → "Mixed" label; `items:rateMany(ids, n)` sets all in one txn; re-select shows the new common value |
| AC-3: Common tags (show shared + add/remove all) | Pass | `tags:commonForItems` intersection chips; `removeFromMany` / `addToMany` apply to all + refetch |
| AC-4: Common folders (show shared + add/remove all) | Pass | `folders:commonForItems` chips; `unassignMany` / `assignMany` apply to all (items never deleted) |
| AC-5: No regressions | Pass | `npm run typecheck` (node+web) + `npm run build` clean; single Inspector / 07-05/06 / marquee / keyboard nav unchanged; schema.sql untouched |

## Accomplishments

- Wired five new batch/aggregate IPC channels end-to-end (services were pre-written; this plan registered the tags/folders handlers and the entire preload bridge + IpcApi types).
- Built `MultiInspector` — token-styled aggregate header, Mixed-aware StarRating, intersection-based tag/folder chips with add controls, all operating atomically over the selection.
- Switched the LibraryGate inspector slot by selection size via a `selectedItems` memo, leaving the single Inspector path fully intact.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/renderer/src/components/MultiInspector.tsx` | Created | Editable multi-selection inspector panel |
| `src/main/services/items.ts` | Modified | `rateItems(ids, rating)` (clamp 0..5, one txn) |
| `src/main/services/tags.ts` | Modified | `commonTagsForItems` (HAVING=N) + `removeTagFromMany` |
| `src/main/services/folders.ts` | Modified | `commonFoldersForItems` (HAVING=N) + `unassignManyFromFolder` |
| `src/main/ipc/items.ts` | Modified | `items:rateMany` handler |
| `src/main/ipc/tags.ts` | Modified | `tags:commonForItems` + `tags:removeFromMany` handlers |
| `src/main/ipc/folders.ts` | Modified | `folders:commonForItems` + `folders:unassignMany` handlers |
| `src/preload/types.ts` | Modified | IpcApi: `rateMany` / `commonForItems`×2 / `removeFromMany` / `unassignMany` |
| `src/preload/index.ts` | Modified | Bridge wiring for the five channels |
| `src/renderer/src/LibraryGate.tsx` | Modified | `selectedItems` memo + single↔multi inspector switch |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Strict intersection (`HAVING COUNT(DISTINCT item_id)=N`) for common tags/folders | Only values on ALL selected items; predictable, no tri-state UI | Removing a chip is unambiguous (removes from all) |
| Header aggregates computed renderer-side from `Item[]` | Grid already carries rating/size/type — no extra IPC | Only the intersections hit the DB |
| New channels only; reuse `addToMany`/`assignMany` for adds | Keeps single-item + 07-05/06 channels untouched | Minimal surface, no regressions |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** None — plan executed exactly as written. (Note: the service-layer functions had been written in a prior partial APPLY; this APPLY completed the IPC registration + preload + renderer and verified the full stack.)

### Deferred Items

None — plan executed as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Phase 7 (Selection & interaction) is COMPLETE — multi-select, keyboard nav, marquee, context menus, batch delete/tag/move/rename, and the editable single + multi-item inspector all shipped.
- The intersection-read + atomic-batch-mutate IPC pattern is a reusable foundation for Phase 8 power features (smart folders, color search, duplicates) that act over selections.

**Concerns:**
- 60fps @ 50k items still unmeasured — consider a perf pass before milestone close.
- Renderer bundle ~815 kB — fine for desktop; revisit if cold start regresses.

**Blockers:**
- None.

---
*Phase: 07-selection-interaction, Plan: 07*
*Completed: 2026-06-24*
