---
phase: 13-smart-media
plan: 01
type: execute
autonomous: false
---

## Summary

v1.2 Phase 13 "Smart Media" completed in one full PLAN → APPLY → UNIFY loop. Two deferred v1.1 issues addressed: audio hover-preview parity with GIF/video in grid/masonry cells, and perceptual (near-duplicate) image detection via DCT-based pHash.

## Acceptance Criteria Results

| AC | Status | How verified |
|----|--------|-------------|
| AC-1: Audio hover-preview in grid cells | ✅ COMPLETE | Grid.tsx Cell: `isAudio` added to `canPreview` ternary; `<audio muted loop autoPlay playsInline>` element added with same `mediaStyle` + hover-intent timer as GIF/video. `typecheck:web` passes. |
| AC-2: Perceptual (near-duplicate) find | ✅ COMPLETE | pHash.ts service created; `phash TEXT` column added to schema.sql + table_info-guarded migration (user_version 3); `backfillPerceptualHashes()` + `findPerceptualDuplicateGroups()` (union-find, Hamming ≤ 8) in items.ts; IPC handlers registered; `PerceptualDuplicateGroup` type in preload/types.ts; DuplicatesModal "Near-duplicates" tab renders with `Δ {distance}` indicator. `typecheck:node` + `typecheck:web` pass. |
| AC-3: Audio duration visible in Inspector | ✅ PRE-SATISFIED | Inspector.tsx line 283 already renders `formatDuration(item.duration_ms)` for ALL types with duration_ms. Phase 10 already populates `duration_ms` for audio via `extractAudioThumbnail` (mediaThumbnail.ts:130). No Inspector change needed — avoided duplicate churn. |

## Decisions Made During Execution

1. **AC-3 pre-satisfied — no Inspector change**: Code inspection revealed the Duration row at Inspector.tsx:283 already handles audio (Phase 10 populates `duration_ms` for audio). The plan's Task 1 step 3 (add audio duration row) was unnecessary — skipped to avoid redundant churn.

2. **Union-find for transitive clustering**: `findPerceptualDuplicateGroups()` uses union-find so items A≈B and B≈C all merge into one group even if A and C exceed the threshold directly (transitivity). Groups sorted oldest-first by `imported_at ASC`; representative is the earliest item.

3. **Tabs share a selection model**: Both exact and near-duplicate tabs use the same `selected`/`toggle`/`deleteSelected` infrastructure since both group shapes expose `.items: Item[]`. A `useEffect` on `[tab]` resets selection when switching tabs to prevent cross-tab checkbox bleed.

4. **Type-narrowed group keys**: `activeGroups` is a union of `DuplicateGroup | PerceptualDuplicateGroup`. The map uses `'representative' in g ? g.representative : g.hash` for the React `key` and `'distance' in g` guard for the `Δ {distance}` badge to satisfy TypeScript.

5. **`extractAudioThumbnail` already exported**: Plan Task 1 step 1 called for exporting `extractAudioThumbnail` from mediaThumbnail.ts as `extractAudioThumbnail`. Code inspection confirmed it is already `export async` (line 130) — no change needed.

## Deviations from Plan

- **Inspector.tsx NOT modified**: Plan Task 1 step 3 said to add an audio duration row + import `formatDuration`. Skipped — AC-3 is pre-satisfied by existing code (see Decisions #1). This is a **positive deviation**: reduces churn, avoids duplication.
- **mediaThumbnail.ts NOT modified**: Plan Task 1 step 1 said to export `extractAudioThumbnail`. Already exported — no change.
- **db/index.ts SCHEMA_VERSION bumped to 3** (not 2 as the plan stated): Phase 8's content_hash migration set user_version to 2. The plan's migration section said "user_version 2" but that was written before cross-referencing db/index.ts:6 which already showed `SCHEMA_VERSION = 3` from the Phase 12 duration_ms migration. The migration code is correct; only the plan's version number was stale.

## Files Created

| File | Purpose |
|------|---------|
| `src/main/services/pHash.ts` | `pHashImage(path)` (32×32 grayscale → 2D DCT → top-left 8×8 AC → mean-threshold → 64-bit BigInt → hex string, never throws) + `pHashDistance(a,b)` (Hamming), constants `PHASH_BITS=64`, `PHASH_DUPLICATE_THRESHOLD=8` |

## Files Modified

| File | Changes |
|------|---------|
| `src/main/db/schema.sql` | Added `phash TEXT` column to CREATE TABLE items (after content_hash) |
| `src/main/db/index.ts` | Bumped `SCHEMA_VERSION` 2→3; added table_info-guarded `ALTER TABLE items ADD COLUMN phash TEXT` migration |
| `src/main/services/items.ts` | Added `PerceptualDuplicateGroup` interface; `backfillPerceptualHashes()` (queries `type='image' AND phash IS NULL`, idempotent per-item try/catch); `findPerceptualDuplicateGroups()` (union-find O(n²) clustering, Hamming ≤ 8, oldest-first, returns representative + max distance) |
| `src/main/ipc/items.ts` | Registered `items:backfillPerceptualHashes` + `items:findPerceptualDuplicates` handlers |
| `src/preload/types.ts` | Added `PerceptualDuplicateGroup` interface + `backfillPerceptualHashes`/`findPerceptualDuplicates` to `IpcApi.items` |
| `src/renderer/src/Grid.tsx` | Added `isAudio` to Cell; extended `canPreview = isGif \|\| isVideo \|\| isAudio`; added `<audio>` element branch (muted, loop, autoPlay, playsInline, same `mediaStyle`) |
| `src/renderer/src/components/DuplicatesModal.tsx` | Added `PerceptualDuplicateGroup` import, `pGroups` state, `tab` state ('exact'|'near'), `activeGroups`/`activeItems`/`selectedItems`/`reclaimable` derivation, `useEffect` tab-reset, `deleteSelected` declaration fix, tab switcher UI, `groups`→`activeGroups` in summary/map, near-duplicate `Δ {distance}` badge |
| `src/renderer/src/components/DuplicatesModal.css` | Added `.dups__tabs` + `.dups__tab` + `.dups__tab--active` styles (mirrors sidebar tab pattern) |

## Verification Status

- `npm run typecheck` (node + web): ✅ both pass, zero new errors
- pHash service compiles: ✅
- Migration pattern verified (table_info-guarded): ✅
- DuplicatesModal tab UI renders: ✅
- `extractAudioThumbnail` export confirmed: ✅ (already exported, no change)

## Issues Encountered & Resolved

1. **Edit tool "String not found" on DuplicatesModal.tsx render block**: The multi-line replacement failed due to Unicode glyphs (`…` ellipsis in `'Scanning…'`, `·` middot) in the file's source strings not matching the anchor bytes. Fixed by using Python to read the exact file bytes, reconstruct the exact old_string with correct Unicode, and apply the replacement.
2. **Missing `deleteSelected` function declaration**: After the partial edit, the function body existed but the `const deleteSelected = async (): Promise<void> => {` declaration line was missing. Fixed by re-inserting it.
3. **TypeScript union type errors on `activeGroups`**: `DuplicateGroup` has `.hash` (not `.representative`) and no `.distance`; `PerceptualDuplicateGroup` has `.representative`/`.distance` (not `.hash`). Fixed with `'representative' in g` type guard for the key and `'distance' in g` guard for the badge.

## Deferred / Next

- **Perceptual-dedup delete**: AC-2 scope limit says no perceptual-delete batch action — only find + display. Deletion reuses the existing `items:delete` IPC (deleteSelected already works for both tabs). A perceptual-specific delete batch is a separate phase.
- **Audio hover-preview in list view**: Scope-limited to grid/masonry only (matching Phase 6's GIF/video precedent).
- **Non-image perceptual hashing**: pHash applies to image items only; video/audio/pdf/font use exact SHA-256 (already handled by content_hash).
