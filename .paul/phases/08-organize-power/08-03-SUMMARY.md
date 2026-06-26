---
phase: 08-organize-power
plan: 03
subsystem: search
tags: [color-search, palette, SearchCriteria, react, sqlite]

# Dependency graph
requires:
  - phase: 08-02
    provides: items.palette (#rrggbb JSON, most-dominant first) — the stored palettes this plan queries
  - phase: 08-01
    provides: smart-folder persistence — color rides along in the saved SearchCriteria for free
  - phase: 04-04
    provides: items:search scope + SearchCriteria pipeline this extends
provides:
  - SearchCriteria.color + colorTolerance (nearest-color filter field)
  - searchItems nearest-color post-filter over stored palettes
  - SearchBar color picker + tolerance + Clear in the Filters popover
affects: [08-04 find-duplicates, any future "find similar / palette similarity" feature]

# Tech tracking
tech-stack:
  added: []   # no new dependency
  patterns: [SearchCriteria-field-not-new-channel, JS-post-filter-over-ordered-rows, defensive-palette-parse]

key-files:
  created: []
  modified:
    - src/main/services/search.ts
    - src/preload/types.ts
    - src/renderer/src/SearchBar.tsx
    - src/renderer/src/SearchBar.css
    - src/renderer/src/LibraryGate.tsx

key-decisions:
  - "Color is a SearchCriteria field (rides items:search) — no new IPC channel, no schema change, no worker"
  - "Plain RGB Euclidean distance (squared, no sqrt); tolerance levels Exact 25 / Close 60 / Loose 110, default 60"
  - "Post-filter over the already-ordered SQL rows preserves imported_at DESC and AND's with all other filters"

patterns-established:
  - "Extend SearchCriteria + mirror in preload/types.ts in lockstep; the IPC handler forwards the whole object untouched"
  - "Only SELECT the extra `palette` column when color-filtering; column-unset path is byte-identical to before"

# Metrics
duration: ~20min
started: 2026-06-26
completed: 2026-06-26
---

# Phase 8 Plan 03: Color Search Summary

**Filter the grid by a picked color with adjustable tolerance — a nearest-color post-filter over the 08-02 stored palettes, surfaced as a color picker in the SearchBar Filters popover, riding the existing `items:search` scope (no new channel, schema, dependency, or worker).**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~20 min |
| Started | 2026-06-26 |
| Completed | 2026-06-26 |
| Tasks | 2 auto + 1 human-verify checkpoint (approved) |
| Files modified | 5 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Nearest-color filtering over stored palettes | Pass | `paletteMatchesColor` keeps an item if any palette color is within tolerance; NULL/empty/non-image excluded while active; AND's with other filters; newest-first preserved |
| AC-2: Adjustable tolerance + clearable | Pass | Tolerance select widens/narrows the match set; Clear removes the constraint; color-unset path is byte-identical to pre-plan |
| AC-3: Color picker in toolbar; scope + saved searches | Pass | Native `<input type=color>` + tolerance + Clear in Filters popover; Filters badge counts color; `isSearchActive` switches to search scope; persists into smart folders via the existing criteria plumbing |
| AC-4: No regressions | Pass | `npm run typecheck` (node + web) and `npm run build` both clean; no schema/dep/IPC-channel change; CSP unchanged |

## Accomplishments

- `SearchCriteria` gained `color?: string` + `colorTolerance?: number`, mirrored in `services/search.ts` and `preload/types.ts` (now sitting alongside the off-loop `tagIds` field added earlier this session).
- `searchItems` nearest-color post-pass: `parseHex` (#rgb/#rrggbb) + `paletteMatchesColor` (defensive JSON.parse, squared RGB distance, early-exit) + `DEFAULT_COLOR_TOLERANCE = 60`. The SELECT appends `, palette` only when color-filtering; rows are filtered then `palette` is stripped so the return type stays `Item[]`.
- SearchBar Filters popover: a "Color" group (swatch + Exact/Close/Loose tolerance + conditional Clear); `advCount` counts color so the badge + `anyActive` update for free.
- `LibraryGate.isSearchActive` recognizes `color`, so a color-only filter switches the grid to the search scope (overriding the folder filter) like every other criterion.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/main/services/search.ts` | Modified | `color`/`colorTolerance` fields; `parseHex` + `paletteMatchesColor` + default; conditional palette SELECT + post-filter |
| `src/preload/types.ts` | Modified | Mirror the two new SearchCriteria fields (renderer-facing) |
| `src/renderer/src/SearchBar.tsx` | Modified | Color group (picker + tolerance + Clear) in the popover; `advCount += color` |
| `src/renderer/src/SearchBar.css` | Modified | `.searchbar__color` swatch + `.searchbar__color-clear`, scoped to beat `.searchbar__row > *` flex |
| `src/renderer/src/LibraryGate.tsx` | Modified | `isSearchActive` includes `!!c.color` |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Color as a SearchCriteria field, JS post-filter | Reuses items:search + LibraryGate scope + smart-folder persistence; palettes already extracted, so the post-filter is cheap | No new channel/schema/dep/worker; color persists into saved searches for free |
| Squared RGB Euclidean distance, no sqrt | Comparing against `tol*tol` avoids a sqrt per palette entry | Cheaper; identical ordering of "near" decisions |
| Only SELECT `palette` when color is set | Keeps the no-color query byte-identical (anti-regression) | Zero behavior change when color unset |

## Deviations from Plan

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | CSS specificity fix — no scope creep |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Auto-fixed:** The color swatch/Clear `flex: 0 0 auto` was being overridden by the later `.searchbar__row > *` `flex: 1 1 0` (equal specificity, later in source). Scoped the selectors to `.searchbar__row > .searchbar__color[-clear]` so they win regardless of order. Caught by reasoning about the cascade before the human-verify pass.

**Context note:** This plan landed on a `SearchCriteria` that already carried the off-loop `tagIds` field (added earlier the same session, committed in 3cf919b). The plan's "extend the interface" intent held — `color`/`colorTolerance` were added alongside `tagIds`, not in place of it.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Color search complete — the last remaining Phase 8 slice is **08-04: Find duplicates (content hashing)**.
- `SearchCriteria` is now the established extension point (query/types/ext/rating/date/tagIds/color); future filters follow the same mirror-and-post-filter pattern.

**Concerns:**
- Color post-filter performance unmeasured at 50k items (it runs after the SQL WHERE, so the candidate set is already reduced; revisit only if a real large library shows lag — consistent with the phase's no-worker stance).

**Blockers:** None.

---
*Phase: 08-organize-power, Plan: 03*
*Completed: 2026-06-26*
