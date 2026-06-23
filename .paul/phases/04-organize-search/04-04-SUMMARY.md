---
phase: 04-organize-search
plan: 04
subsystem: search
tags: [search, filter, sqlite, like, ipc, react]

# Dependency graph
requires:
  - phase: 04-organize-search (04-02)
    provides: tags/item_tags for the tag-name match
  - phase: 04-organize-search (04-03)
    provides: selected-scope → items-query path in LibraryGate that search extends
  - phase: 03-browse
    provides: Grid (items prop), items.listItems projection
provides:
  - search service (parameterized name/note/tag LIKE + type/ext/rating/date filters)
  - items:search(criteria) IPC + shared SearchCriteria type
  - SearchBar + a 3rd grid scope (search) in LibraryGate
affects: [V1 saved searches/smart folders, V1 FTS perf pass]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LIKE-based search: bound params + ESCAPE '\\' so wildcards are literal"
    - "Dynamic positional-param WHERE assembled from present criteria fields"
    - "Three mutually-exclusive grid scopes in LibraryGate (search > folder > all)"

key-files:
  created:
    - src/main/services/search.ts
    - src/renderer/src/SearchBar.tsx
  modified:
    - src/main/ipc/items.ts
    - src/preload/index.ts
    - src/preload/types.ts
    - src/renderer/src/LibraryGate.tsx

key-decisions:
  - "LIKE-based search, not FTS5; items_fts left unwired (deferred to V1 perf pass)"
  - "Search scope is whole-library, mutually exclusive with the folder filter"
  - "Date filter uses imported_at (created_at-based date deferred)"

patterns-established:
  - "Escape LIKE specials (\\ % _) + ESCAPE clause for literal, injection-safe substring search"

# Metrics
duration: ~20min
started: 2026-06-23
completed: 2026-06-23
---

# Phase 4 Plan 04: Keyword Search + Filters Summary

**LIKE-based search shipped: `items:search(criteria)` runs one parameterized query (name/note LIKE + tag-name subquery, AND'd with type/ext/rating/date filters), driven by a header SearchBar that acts as a third, folder-overriding grid scope.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~20 min |
| Started | 2026-06-23 |
| Completed | 2026-06-23 |
| Tasks | 2 auto + 1 checkpoint completed |
| Files modified | 6 (2 created, 4 modified) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Keyword search by name | Pass | Substring name match; clearing restores prior view. |
| AC-2: Match note + tag names | Pass | `name/note LIKE` OR `id IN (tag-name match)`. |
| AC-3: Type + format filters w/ query | Pass | `type IN (…)` (OR'd) AND `ext = ?`, AND'd with query. |
| AC-4: Min rating + import-date range | Pass | `rating >= ?` and `imported_at BETWEEN`, combined. |
| AC-5: Search ↔ folder mutual exclusivity | Pass | Search clears folder; selecting a folder clears search; empty criteria falls back. |
| AC-6: Validated/safe IPC | Pass | LIKE specials escaped (`ESCAPE '\'`), all values bound; no library → []. |

Skill audit: no `.paul/SPECIAL-FLOWS.md` configured — step skipped.

## Accomplishments

- `search` service: dynamic parameterized WHERE assembled only from present criteria; tag match via `item_tags`/`tags` subquery; reuses the items grid projection + `ORDER BY imported_at DESC`.
- `items:search` registered on the existing items IPC; `SearchCriteria` + `items.search` exposed via preload.
- `SearchBar`: debounced text query + per-type checkboxes + format input + min-rating select + from/to date range + Clear.
- LibraryGate now resolves three mutually-exclusive grid scopes (search > folder > all-items).

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/main/services/search.ts` | Created | Parameterized search/filter query over items (+ tag subquery). |
| `src/renderer/src/SearchBar.tsx` | Created | Header search + filter controls. |
| `src/main/ipc/items.ts` | Modified | Register `items:search`. |
| `src/preload/index.ts` | Modified | `items.search` wrapper + `SearchCriteria` import. |
| `src/preload/types.ts` | Modified | `SearchCriteria` type + `items.search` on `IpcApi`. |
| `src/renderer/src/LibraryGate.tsx` | Modified | Search scope state, 3-way `reloadItems`, mutual exclusivity, SearchBar in header. |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| LIKE not FTS5 | items_fts unwired + tags need a separate match anyway; LIKE is one consistent path, fast enough at MVP scale | items_fts triggers+backfill deferred to V1 perf pass |
| Search overrides folder (mutually exclusive) | Simple, predictable mental model | No folder∩search intersection (deferrable) |
| Date filter on imported_at | The user-meaningful "when added" date | created_at-based date deferred |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Trivial — missing type import caught by typecheck |
| Scope additions | 0 | — |
| Deferred | 0 | Logged as scope limits |

**Total impact:** Negligible. Plan executed as written.

### Auto-fixed Issues

**1. [Build] `SearchCriteria` not imported in preload**
- **Found during:** Task 1 (typecheck).
- **Issue:** `preload/index.ts` referenced `SearchCriteria` without importing it.
- **Fix:** Added it to the `./types` type import.
- **Verification:** `npm run typecheck` passes.

### Deferred Items

None beyond stated scope limits (FTS wiring, folder∩search, created-date filter, saved searches, highlighting/ranking).

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Phase 4 feature-complete: ratings (04-01), tags (04-02), folders (04-03), search (04-04). The MVP collect → organize → search → browse loop is closed.
- v0.1 MVP milestone phases are all complete.

**Concerns:**
- items_fts remains unwired — fine at current scale; revisit if LIKE misses <0.5s @ 50k.
- macOS packaging still unverified (Windows-only build tested); native modules need `asarUnpack`.

**Blockers:** None.

---
*Phase: 04-organize-search, Plan: 04*
*Completed: 2026-06-23*
