---
phase: 07-selection-interaction
plan: 05
subsystem: api
tags: [electron, ipc, sqlite, better-sqlite3, batch, delete, tags, folders, transaction]

# Dependency graph
requires:
  - phase: 07-01
    provides: useSelection (selected Set + clear/prune) — the source of batch targets
  - phase: 07-04
    provides: ContextMenu + item menu (openItemMenu) extended here with batch entries
provides:
  - items:delete(ids) — atomic delete of rows (item_tags + item_folders + items) + on-disk images/<id> dirs
  - tags:addToMany(ids, name) — atomic lookup-or-insert tag + INSERT OR IGNORE links
  - folders:assignMany(ids, folderId) — atomic INSERT OR IGNORE links
  - Selection-aware item context menu (whole selection vs single) + Delete key + BatchTagDialog
affects: [07-06-batch-rename, 07-07-multi-item-inspector]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batch op = one db.transaction(...) returning a count (mirrors deleteFolder); delete removes links BEFORE the items row (FKs are not ON DELETE CASCADE)"
    - "File removal (rmSync images/<id>) is best-effort AFTER the DB commit — DB is source of truth, leftover dir is harmless"
    - "New IPC mirrors the existing triad: service fn → ipcMain.handle → preload method → IpcApi type; batch channels return number"
    - "Right-click is selection-aware: acts on the whole selection when the clicked item ∈ selection, else selects + acts on the single item"

key-files:
  created:
    - src/renderer/src/components/BatchTagDialog.tsx
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
  - "Delete removes DB rows + on-disk images/<id> folder; permanent (confirm only, no trash/undo)"
  - "Folder batch op is ADD (assign-many, INSERT OR IGNORE); true move/unassign deferred (multi-folder membership)"
  - "Full find/replace + pattern rename split into its OWN plan 07-06; multi-item inspector → 07-07"

patterns-established:
  - "Atomic main-side batch IPC returning a count — reused by 07-06 rename and future bulk ops"

# Metrics
duration: ~1 session
started: 2026-06-24
completed: 2026-06-24
---

# Phase 7 Plan 05: Batch operations — Summary

**Atomic batch operations over the multi-selection — delete (DB rows + on-disk originals/thumbnails), add-tag-to-many, and add-many-to-a-folder — each a single main-side SQLite transaction behind new IPC (items:delete / tags:addToMany / folders:assignMany), surfaced through a selection-aware item context menu, a Delete-key shortcut (with confirm), and a token-styled BatchTagDialog. First Phase-7 plan to cross into main/preload/IPC; no schema change, no new deps.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~1 session |
| Started | 2026-06-24 |
| Completed | 2026-06-24 |
| Tasks | 4 of 4 (3 auto + 1 human-verify) |
| Files | 1 created, 9 modified |
| Bundles | main 27.8→30.0 kB, preload 3.30→3.57 kB; renderer 60 modules (~791 kB) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Delete selection (rows + files) | Pass | Menu "Delete N items" + Delete key → confirm → one txn removes item_tags/item_folders/items, then rmSync each images/<id>; grid refreshes, selection clears, inspector empties. On-disk removal confirmed. Human-verified. |
| AC-2: Add a tag to many | Pass | BatchTagDialog → tags:addToMany in one txn (creates tag if new, INSERT OR IGNORE); shows in inspector; re-adding same tag is a no-op. Human-verified. |
| AC-3: Add many to a folder | Pass | "Add to folder ▸ <name>" → folders:assignMany (one txn); all selected appear under that folder. Human-verified. |
| AC-4: Selection semantics + atomicity | Pass | Right-click within a multi-selection acts on the whole set (labels show count); right-click outside selects + acts on the single item; each op is one transaction. Human-verified. |
| AC-5: No regressions | Pass | typecheck (node + web) + build clean; single-item Quick preview/Rating, marquee, keyboard nav intact; schema.sql unchanged. |

## Accomplishments

- Closed the selection → bulk-action loop: the Phase-7 selection surface now drives real batch delete/tag/move.
- Added three atomic, count-returning batch IPC channels following the existing service/ipc/preload/type pattern — no schema change.
- Established the atomic main-side batch pattern (one transaction per op) that 07-06 rename will reuse.

## Task Commits

Committed together with all of Phase 7 at the phase transition (per the per-phase commit convention — Phase 7 not yet complete; 07-06/07 remain).

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Task 1: Backend batch services + IPC + preload + types | (deferred to phase commit) | feat | deleteItems / addTagToMany / assignManyToFolder + channels + IpcApi |
| Task 2: Selection-aware item menu + Delete key | (deferred to phase commit) | feat | openItemMenu rework, deleteTargets, Delete-key branch |
| Task 3: BatchTagDialog + wire "Add tag…" | (deferred to phase commit) | feat | token modal + tags:addToMany wiring |
| Task 4: Human-verify | (deferred to phase commit) | — | Approved (incl. on-disk delete) |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `services/items.ts` | Modified | `deleteItems(ids)` — txn (item_tags + item_folders + items) + rmSync images/<id>; imports fs/path/library |
| `services/tags.ts` | Modified | `addTagToMany(ids, name)` — lookup-or-insert + INSERT OR IGNORE links in one txn |
| `services/folders.ts` | Modified | `assignManyToFolder(ids, folderId)` — INSERT OR IGNORE links in one txn |
| `ipc/items.ts` · `ipc/tags.ts` · `ipc/folders.ts` | Modified | `items:delete` · `tags:addToMany` · `folders:assignMany` handlers |
| `preload/types.ts` · `preload/index.ts` | Modified | IpcApi + bridge methods for the three channels |
| `LibraryGate.tsx` | Modified | Selection-aware openItemMenu (Delete/Add tag…/Add to folder), deleteTargets+confirm, Delete-key branch, tagDialog state + render |
| `components/BatchTagDialog.tsx` | Created | Token modal (input + datalist of existing tags) for batch add-tag; self-owned Escape |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Delete removes rows + files, permanent | Library is the source of truth; no trash table in MVP | Confirm dialog guards it; undo/trash deferred |
| Folder batch = assign-many (add) | Folders are multi-membership; "move"/unassign is ambiguous | Consistent with 07-04 "Add to folder"; true move deferred |
| Split full rename into 07-06 | Find/replace + pattern dialog + name IPC is a distinct concern | Keeps 07-05 cohesive; multi-item inspector → 07-07 |
| Links deleted explicitly in the txn | FKs are not ON DELETE CASCADE (schema unchanged) | Delete works without a schema migration |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Trivial token fix |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** Executed as written.

### Auto-fixed Issues

**1. [Tokens] Non-existent `--color-bg` in BatchTagDialog**
- **Found during:** Task 3 (dialog styling)
- **Issue:** Used `var(--color-bg)` for the input/secondary-button background; the token set has `--color-bg-app/panel/content/elevated`, not `--color-bg` → would render transparent.
- **Fix:** Switched to `var(--color-bg-app)`.
- **Verification:** Grep of tokens.css; typecheck + build clean; dialog renders correctly in human-verify.

## Issues Encountered

None. (Verified no main-process import cycle from items.ts → library.ts, since library.ts imports only ../db.)

## Next Phase Readiness

**Ready:**
- The atomic batch-IPC pattern + selection plumbing are in place. 07-06 (batch rename) adds a name-mutation channel + pattern/find-replace dialog; 07-07 (multi-item inspector) reads the same selection. Phase 7 then commits.

**Concerns:**
- Delete is permanent (no trash/undo) — acceptable for MVP, but a trash table could be a later nicety.
- 60fps @ 50k still unmeasured; batch ops over very large selections not stress-tested (one txn, should scale).

**Blockers:**
- None.

---
*Phase: 07-selection-interaction, Plan: 05*
*Completed: 2026-06-24*
