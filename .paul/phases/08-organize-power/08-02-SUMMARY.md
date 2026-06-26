---
phase: 08-organize-power
plan: 02
subsystem: ui
tags: [electron, sqlite, sharp, color, palette, quantization, import, inspector]

# Dependency graph
requires:
  - phase: 02-library-import
    provides: the import pipeline + sharp decode that palette extraction piggybacks on
  - phase: 03-browse
    provides: items:get / FullItem.palette already returned to the inspector
provides:
  - services/palette.ts extractPalette (no-dep quantizer → #rrggbb JSON) + paletteToJson
  - palette stored on import (items.palette + metadata.json) for new images
  - items:backfillPalettes IPC (async, idempotent) + "Extract colors" Settings control
  - inspector Colors swatch row (reads FullItem.palette)
affects: [08-03-color-search]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "No-dep color quantizer: sharp resize 64 → raw pixels → 4-bit RGB bucket → top-N averaged → #rrggbb"
    - "Extraction piggybacks the existing import sharp decode; failures swallowed (never abort import); no worker"
    - "Reused the pre-declared items.palette column → feature with no schema change"

key-files:
  created:
    - src/main/services/palette.ts
  modified:
    - src/main/services/import.ts
    - src/main/services/items.ts
    - src/main/ipc/items.ts
    - src/preload/types.ts
    - src/preload/index.ts
    - src/renderer/src/components/SettingsModal.tsx
    - src/renderer/src/Inspector.tsx

key-decisions:
  - "No-dependency custom quantizer over downsampled sharp pixels; NO worker (decode off-thread)"
  - "Scope = extraction + backfill + inspector swatches ONLY; color SEARCH split to 08-03"
  - "Palette format = JSON array of #rrggbb (lowercase), most-dominant first — the contract 08-03 queries"
  - "Reuse the existing items.palette column → no schema change; palette stays NULL for non-images / failures"

patterns-established:
  - "Extract-on-import + on-demand idempotent backfill IPC — reusable shape for other derived metadata"

# Metrics
duration: ~1 session
started: 2026-06-24
completed: 2026-06-24
---

# Phase 8 Plan 02: Color Extraction + Backfill + Swatches Summary

**Dominant-color palettes for images via a no-dependency quantizer over the existing sharp decode: extracted on import, backfilled on demand from Settings, stored as a #rrggbb JSON array in the pre-existing items.palette column, and shown as swatches in the inspector. No schema change, no new dep, no worker.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~1 session |
| Started | 2026-06-24 |
| Completed | 2026-06-24 |
| Tasks | 3 auto + 1 human-verify checkpoint (approved) |
| Files modified | 8 (1 created, 7 modified) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Palette extracted on import | Pass | importFile + importImageBuffer compute palette in the existing sharp try; stored to items.palette + metadata.json; non-image/failure → null (no abort) |
| AC-2: Backfill existing items | Pass | items:backfillPalettes fills image items where palette IS NULL (reads original→thumbnail fallback), returns count, idempotent on re-run |
| AC-3: Palette shown in inspector | Pass | Colors swatch row from defensively-parsed FullItem.palette; omitted when empty/non-image |
| AC-4: No regressions | Pass | typecheck (node+web) + build clean; schema.sql unchanged; no new dep; no worker; 08-01/search/folders/Phase 7 intact |

## Accomplishments

- A self-contained no-dependency color quantizer (`services/palette.ts`) that reuses the decode the importer already performs — extraction adds no second image read on import.
- On-demand idempotent backfill (`items:backfillPalettes`) + a Settings "Extract colors" control for libraries imported before this feature.
- Inspector color swatches with zero new IPC (palette already travels on `FullItem`).

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/main/services/palette.ts` | Created | extractPalette quantizer + paletteToJson |
| `src/main/services/import.ts` | Modified | Compute+store palette on both import paths; insertItem binds palette |
| `src/main/services/items.ts` | Modified | backfillPalettes() (async, idempotent) |
| `src/main/ipc/items.ts` | Modified | items:backfillPalettes handler |
| `src/preload/types.ts` · `index.ts` | Modified | items.backfillPalettes bridge |
| `src/renderer/src/components/SettingsModal.tsx` | Modified | "Library maintenance → Extract colors" control |
| `src/renderer/src/Inspector.tsx` | Modified | Colors swatch row (reads FullItem.palette) |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| No-dep quantizer, no worker | sharp decode is off-thread (Phase-2 precedent); avoids a dep + worker infra | Lower risk; extraction reuses the import decode |
| Reuse items.palette column | Pre-declared and unused | No schema change |
| Split color SEARCH to 08-03 | Keep this slice to ~3 tasks | This plan = data foundation only |
| Palette = #rrggbb JSON, most-dominant first | Stable, simple, queryable | Defines the contract 08-03 color search consumes |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** None — plan executed exactly as written.

### Deferred Items

As planned (scope limits): no color SEARCH/filter (→ 08-03), no grid/list swatches (kept items:list lean — inspector only), no backfill progress events (count + busy state only), palette is images-only.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Every image can now carry a stored palette; the #rrggbb format is the query contract for 08-03 color search.
- Extract-on-import + idempotent-backfill pattern is reusable for other derived metadata.

**Concerns:**
- Backfill over a very large library runs sequentially with no progress events (button shows busy + final count) — acceptable for now; revisit if libraries are huge.
- 60fps @ 50k still unmeasured — consider a perf pass before milestone close.

**Blockers:**
- None.

---
*Phase: 08-organize-power, Plan: 02*
*Completed: 2026-06-24*
