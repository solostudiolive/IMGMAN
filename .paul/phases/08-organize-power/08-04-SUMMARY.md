---
phase: 08-organize-power
plan: 04
subsystem: database
tags: [duplicates, content-hash, sha256, migration, react]

# Dependency graph
requires:
  - phase: 08-02
    provides: the "piggyback import + Settings-triggered backfill over NULL rows" pattern this mirrors
  - phase: 07-05
    provides: items:delete (atomic batch delete reused to remove redundant copies)
provides:
  - items.content_hash column (+ idempotent migration) and SHA-256 hashing at import
  - backfillHashes() + findDuplicateGroups() services
  - DuplicatesModal (review + keep-newest delete) launched from Settings
affects: [future "find similar / perceptual" dedup, any feature needing a per-item content fingerprint]

# Tech tracking
tech-stack:
  added: []   # Node built-in crypto + fs streams; no dependency
  patterns: [idempotent-table_info-guarded-migration, streamed-sha256, reuse-items-delete]

key-files:
  created:
    - src/main/services/hash.ts
    - src/renderer/src/components/DuplicatesModal.tsx
    - src/renderer/src/components/DuplicatesModal.css
  modified:
    - src/main/db/schema.sql
    - src/main/db/index.ts
    - src/main/services/import.ts
    - src/main/services/items.ts
    - src/main/ipc/items.ts
    - src/preload/index.ts
    - src/preload/types.ts
    - src/renderer/src/components/SettingsModal.tsx
    - src/renderer/src/LibraryGate.tsx

key-decisions:
  - "Exact content hashing (SHA-256 of original bytes) — no perceptual / near-duplicate matching"
  - "Idempotent ALTER guarded on PRAGMA table_info (not user_version) so it self-heals; SCHEMA_VERSION=2"
  - "No worker — streamed async hashing is IO-bound/non-blocking (08-02 stance); worker is the escalation path"
  - "Reuse items:delete; modal only selects ids — no new delete path. Default keep-newest per group."

patterns-established:
  - "First real schema migration: schema.sql for fresh DBs + a table_info-guarded ALTER for existing ones"
  - "Streamed file hashing helper (services/hash.ts) reusable for any future content-fingerprint need"

# Metrics
duration: ~35min
started: 2026-06-26
completed: 2026-06-26
---

# Phase 8 Plan 04: Find Duplicates Summary

**Byte-identical duplicate detection via a SHA-256 content_hash (added by the project's first schema migration, computed at import + backfilled), grouped by shared hash, and resolved in a DuplicatesModal that keeps the newest and deletes the rest through the existing items:delete — no dependency, no worker.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~35 min |
| Started | 2026-06-26 |
| Completed | 2026-06-26 |
| Tasks | 3 auto + 1 human-verify checkpoint (approved) |
| Files modified | 9 modified + 3 created |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Hash stored at import + backfilled | Pass | importFile (streamed `hashFile`) + importImageBuffer (`hashBuffer`) populate content_hash + metadata.json; `backfillHashes()` fills NULL rows for ALL types, idempotent, skips missing files |
| AC-2: Duplicate grouping | Pass | `findDuplicateGroups()` returns only 2+ shared-hash groups, items oldest-first (imported_at ASC); unique/NULL excluded |
| AC-3: Modal — review + delete | Pass | Settings → "Find duplicates…" scans (backfill then group), lists groups w/ thumbnails, pre-checks all-but-newest, shows reclaimable bytes, deletes via items:delete, re-scans |
| AC-4: No regressions | Pass | `npm run typecheck` (node + web) + `npm run build` clean; migration idempotent (table_info guard); no dep, no new IPC namespace, CSP unchanged |

## Accomplishments

- The project's **first real schema migration**: `content_hash` in `schema.sql` for fresh DBs + a `PRAGMA table_info`-guarded `ALTER TABLE` in `runMigrations` (SCHEMA_VERSION→2) for existing libraries — self-healing and idempotent across relaunches.
- `services/hash.ts`: streamed `hashFile` (large files never fully buffered) + `hashBuffer`; wired into both import paths (failure → NULL, import still succeeds).
- `backfillHashes()` (mirrors `backfillPalettes`, all types) + `findDuplicateGroups()` (single GROUP BY/HAVING query folded into groups in JS), exposed over `items:*`.
- `DuplicatesModal`: scan-on-open, thumbnails, keep-newest default selection, reclaimable summary, delete-and-rescan — reusing the Phase-7 `items:delete`. Launched from Settings; grid keyboard shortcuts suppressed while open.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/main/db/schema.sql` | Modified | `content_hash TEXT` column on items |
| `src/main/db/index.ts` | Modified | SCHEMA_VERSION→2; idempotent table_info-guarded ALTER |
| `src/main/services/hash.ts` | Created | `hashFile` (streamed SHA-256) + `hashBuffer` |
| `src/main/services/import.ts` | Modified | Compute + bind content_hash (path + clipboard) |
| `src/main/services/items.ts` | Modified | `backfillHashes`, `findDuplicateGroups`, `DuplicateGroup`, `originalPath` |
| `src/main/ipc/items.ts` | Modified | `items:backfillHashes` + `items:findDuplicates` |
| `src/preload/index.ts`, `types.ts` | Modified | Bridge + types (incl. `DuplicateGroup`) |
| `src/renderer/src/components/DuplicatesModal.tsx/.css` | Created | The dedup review/delete dialog |
| `src/renderer/src/components/SettingsModal.tsx` | Modified | `onFindDuplicates` prop + "Find duplicates…" button |
| `src/renderer/src/LibraryGate.tsx` | Modified | `duplicatesOpen` state, modal mount, keyboard guard |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Exact SHA-256 only | "Content hashing" per roadmap; simple + precise | Catches byte-identical re-imports; near-duplicate/perceptual is a later feature |
| table_info-guarded ALTER | CREATE IF NOT EXISTS can't add a column; guard self-heals regardless of user_version | First migration pattern future schema changes follow |
| No worker | Streamed hashing is IO-bound/non-blocking | Matches 08-02; worker is the noted escalation path for very large libraries |
| Reuse items:delete, keep-newest default | No bespoke delete; sensible default the user can override | Smaller surface; Phase-7 delete already handles links + files |

## Deviations from Plan

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 1 | App theme default flipped dark→light (out-of-plan user request, landed same APPLY) |
| Deferred | 0 | — |

**Scope addition:** Per a user request during this APPLY, `theme.ts` `DEFAULT_PREFERENCE` changed `'dark'` → `'light'` (fresh-install default only; stored prefs unaffected). Unrelated to find-duplicates but committed together.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Phase 8 (Organize power features) COMPLETE — saved searches, color palette, color search, sidebar tags, find duplicates all shipped.
- A migration mechanism + a content-fingerprint per item now exist for future features.

**Concerns:**
- Hash backfill performance unmeasured at 50k items (streamed/async, runs once; worker is the escalation path).
- Renderer bundle ~851 kB (acceptable for desktop; long-noted).

**Blockers:** None. Next milestone phase is **Phase 9 — Browser-extension collecting**.

---
*Phase: 08-organize-power, Plan: 04*
*Completed: 2026-06-26*
