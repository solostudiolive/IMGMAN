---
phase: 04-organize-search
plan: 02
subsystem: tags
tags: [tags, many-to-many, sqlite, ipc, react, datalist]

# Dependency graph
requires:
  - phase: 04-organize-search (04-01)
    provides: optimistic-edit/reconcile pattern + inspector edit surface
  - phase: 02-library-import
    provides: tags/item_tags schema, per-library SQLite, randomUUID id style
provides:
  - tags service (listAll / listForItem / add-by-name / remove) over tags + item_tags
  - tags:* IPC namespace + shared Tag type (preload/types)
  - TagEditor component (chips + remove + add-with-datalist) in the inspector
affects: [04-04 search (filter/FTS over tags), any future tag management UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Separate IPC namespace for a many-to-many relation (tags:*) rather than extending ItemPatch"
    - "Mutations return the canonical post-write list; renderer reconciles to it"
    - "Name-deduped upsert in a single better-sqlite3 transaction; INSERT OR IGNORE link"

key-files:
  created:
    - src/main/services/tags.ts
    - src/main/ipc/tags.ts
    - src/renderer/src/TagEditor.tsx
  modified:
    - src/main/ipc/index.ts
    - src/preload/index.ts
    - src/preload/types.ts
    - src/renderer/src/Inspector.tsx

key-decisions:
  - "Tags get their own tags:* IPC namespace (not ItemPatch) since they live in separate tables"
  - "De-dupe tags by exact (trimmed) name; unlink keeps the tags row for reuse"
  - "datalist for autocomplete (no new dependency); tag color/rename/merge deferred"

patterns-established:
  - "Many-to-many editor: load forItem + listAll on selection, reconcile to returned list per mutation"

# Metrics
duration: ~25min (incl. recovery of an interrupted prior APPLY)
started: 2026-06-23
completed: 2026-06-23
---

# Phase 4 Plan 02: Tags (many-to-many) Summary

**Many-to-many tags wired end-to-end: a `tags:*` IPC layer over the existing `tags`/`item_tags` tables, plus an inspector `TagEditor` (chips, ×-remove, add-with-datalist) that creates tags on the fly and de-dupes by name.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~25 min (this session was recovery + completion) |
| Started | 2026-06-23 |
| Completed | 2026-06-23 |
| Tasks | 2 + checkpoint completed |
| Files modified | 7 (3 created, 4 modified) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Add a tag to an item | Pass | Enter adds chip; persisted to `tags` (created if new) + `item_tags`; survives reselect (human-verified). |
| AC-2: Tags de-duplicated by name | Pass | Trimmed exact-name lookup reuses the row; `INSERT OR IGNORE` link makes repeat-add a no-op. |
| AC-3: Remove a tag from an item | Pass | `DELETE FROM item_tags` only; `tags` row kept for reuse. |
| AC-4: Existing tags suggested | Pass | `<datalist>` populated from `tags.listAll()`, refreshed after add. |
| AC-5: tags IPC validated/safe | Pass | Blank/whitespace name is a no-op; no library / unknown id returns `[]`/no-op without throwing across IPC. |

Skill audit: no `.paul/SPECIAL-FLOWS.md` configured — step skipped.

## Accomplishments

- Tag data layer (`src/main/services/tags.ts`): name-deduped upsert inside a single transaction, unlink that preserves the tag row, all guarded on `isDatabaseOpen()`.
- `tags:*` IPC + shared `Tag` type exposed through `window.api.tags` (listAll/listForItem/add/remove).
- Reusable inspector `TagEditor` (chips + remove + add-with-datalist) following the 04-01 reconcile-to-returned-state pattern.
- Recovered an interrupted prior APPLY that had left the tree in a broken state (see Deviations).

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/main/services/tags.ts` | Created | Tag CRUD over `tags`/`item_tags` (dedupe, upsert, unlink-keeps-row). |
| `src/main/ipc/tags.ts` | Created | `registerTagsIpc()` for `tags:listAll/listForItem/add/remove`. |
| `src/renderer/src/TagEditor.tsx` | Created | Inspector tag editor: chips, ×-remove, add input + datalist. |
| `src/main/ipc/index.ts` | Modified | Call `registerTagsIpc()` (was imported but uncalled — fixed). |
| `src/preload/index.ts` | Modified | Added `tags` namespace to `window.api`. |
| `src/preload/types.ts` | Modified | Added `Tag` type + `tags` block to `IpcApi`. |
| `src/renderer/src/Inspector.tsx` | Modified | Render `<TagEditor itemId={item.id} />` below metadata. |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Separate `tags:*` IPC namespace (not `ItemPatch`) | Tags live in their own tables (many-to-many), unlike scalar item fields | 04-04 search reuses this layer to filter by tag |
| De-dupe by trimmed exact name; unlink keeps the `tags` row | Tags are a shared library vocabulary, not item-owned | Avoids orphan-tag churn; rename/merge can come later |
| `datalist` for autocomplete | Native, zero new dependency, matches "no new runtime deps" boundary | Simple; richer combobox can replace it if needed |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Recovery of an interrupted earlier APPLY — essential, no scope change |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** No scope change. The plan was implemented exactly as written; the only deviation was repairing a half-applied prior run.

### Auto-fixed Issues

**1. [Recovery] Interrupted prior APPLY left the tree broken**
- **Found during:** UNIFY precondition check (STATE.md said "awaiting approval" but tag files existed).
- **Issue:** `src/main/ipc/index.ts` imported `registerTagsIpc` but never called it (so tags IPC was never registered); `src/preload` had no `tags` namespace or `Tag` type; `TagEditor.tsx` and the Inspector integration were absent; a stray `src/main/ipc/index.ts.tmp.3568.adb57831bd5f` (the interrupted atomic write, which contained the missing call) was left behind. `npm run typecheck` passed despite this, masking the gap.
- **Fix:** Added the `registerTagsIpc()` call, the preload `tags` namespace + `Tag` type, created `TagEditor.tsx`, integrated it into the Inspector, and deleted the temp file.
- **Verification:** `npm run typecheck` (node + web) passes; `npm run build` emits all three bundles; human-verify checkpoint approved.

### Deferred Items

None.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| STATE.md was stale (claimed plan unstarted while partial code existed) | Reconciled against the working tree; corrected STATE.md to actual position. |
| Green typecheck hid a non-functional backend (unused import not flagged) | Caught via grep + manual trace of registration/preload wiring, not by relying on typecheck alone. |

## Next Phase Readiness

**Ready:**
- `tags:*` IPC + `Tag` type are in place for 04-04 search to filter/FTS over tags.
- Many-to-many editor pattern established for any future relation editors.

**Concerns:**
- Phase 4 work (04-01 + 04-02) remains uncommitted in the working tree — consistent with this project's per-phase commit pattern; commit lands at the Phase 4 transition.
- Tag rename/delete/merge and tag color UI are deferred (out of MVP scope).

**Blockers:** None.

---
*Phase: 04-organize-search, Plan: 02*
*Completed: 2026-06-23*
