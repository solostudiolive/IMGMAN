---
phase: 07-selection-interaction
plan: 06
subsystem: ui
tags: [electron, ipc, sqlite, batch, rename, regex, pattern, dialog]

# Dependency graph
requires:
  - phase: 07-05
    provides: the atomic batch-IPC pattern (service → ipc → preload → IpcApi, one txn, returns count) mirrored by renameItems
  - phase: 07-04
    provides: the selection-aware item context menu the "Rename…" entry joins
provides:
  - items:renameMany({id,name}[]) — atomic metadata rename (UPDATE items SET name)
  - renameItems.ts — pure compute helper (pattern {name}/{ext}/{n} + start/pad; literal/regex find&replace; specError)
  - BatchRenameDialog — token modal with live old→new preview, two modes
  - "Rename…" item-menu entry (single + multi) over the selection in display order
affects: [07-07-multi-item-inspector]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rename names computed RENDERER-side (instant preview) via a pure helper; backend just persists the final {id,name}[]"
    - "Rename is metadata-only (items.name); on-disk images/<id>/original.<ext> never renamed, ext never changed"
    - "Invalid-regex handled gracefully: specError() returns a message, dialog shows it + disables Apply (computeName falls back to the original name)"

key-files:
  created:
    - src/renderer/src/components/renameItems.ts
    - src/renderer/src/components/BatchRenameDialog.tsx
  modified:
    - src/main/services/items.ts
    - src/main/ipc/items.ts
    - src/preload/types.ts
    - src/preload/index.ts
    - src/renderer/src/LibraryGate.tsx

key-decisions:
  - "Metadata-only rename (name column); no file-system rename, no ext change, no undo"
  - "Dedicated items:renameMany channel (not ItemPatch/items:update); one transaction"
  - "Preview computed renderer-side; apply sends only changed, non-blank names"

patterns-established:
  - "Pure compute helper + token modal + atomic persist channel — reusable shape for future bulk edits"

# Metrics
duration: ~1 session
started: 2026-06-24
completed: 2026-06-24
---

# Phase 7 Plan 06: Batch rename — Summary

**Batch rename over the selection with a live-preview dialog in two modes — Pattern ({name}/{ext}/{n} with a start number + zero-padding) and Find & Replace (literal or JS-regex, case-sensitive toggle, graceful invalid-regex handling) — computed renderer-side for an instant old→new preview and persisted in one transaction via the new items:renameMany channel. Metadata-only (items.name); on-disk files are never touched. Reuses the 07-05 atomic batch pattern and the 07-04 item menu.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~1 session |
| Started | 2026-06-24 |
| Completed | 2026-06-24 |
| Tasks | 4 of 4 (3 auto + 1 human-verify) |
| Files | 2 created, 5 modified |
| Bundles | preload 3.57→3.66 kB; renderer 62 modules (~804 kB) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Pattern rename | Pass | {name}/{ext}/{n} + start + zero-pad; live preview in display order; Apply → items:renameMany persists; grid + inspector reflect. Human-verified. |
| AC-2: Find & replace (literal + regex) | Pass | Live literal/regex replace with case-sensitivity; invalid regex shows inline error + disables Apply (no crash); valid regex applies. Human-verified. |
| AC-3: Trigger, selection order, no-op safety | Pass | "Rename…" for single + multi; dialog opens over the selection in sorted order; blank/unchanged names skipped; Cancel/Escape = no change. Human-verified. |
| AC-4: No regressions / safety | Pass | typecheck (node + web) + build clean; only items.name changes (no file rename, no ext/schema change); 07-04/07-05/marquee/keyboard nav intact. |

## Accomplishments

- Completed the Phase-7 batch-action set (delete/tag/move + rename) — the selection now drives every bulk operation.
- Shipped a full-featured rename (pattern tokens + literal/regex find-replace) with a safe, live preview, all metadata-only.
- Kept the backend dumb (persist-only) by computing names renderer-side — instant preview, one atomic write.

## Task Commits

Committed together with all of Phase 7 at the phase transition (07-07 is the final plan).

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Task 1: items:renameMany backend | (deferred to phase commit) | feat | renameItems txn + channel + preload + IpcApi |
| Task 2: rename helper + BatchRenameDialog | (deferred to phase commit) | feat | computeName/computeRenames/specError + token modal |
| Task 3: wire "Rename…" into the item menu | (deferred to phase commit) | feat | menu entry + targets→Item mapping + dialog render + keydown guard |
| Task 4: Human-verify | (deferred to phase commit) | — | Approved |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `services/items.ts` | Modified | `renameItems(renames)` — one txn of `UPDATE items SET name`; trimmed/non-empty only |
| `ipc/items.ts` · `preload/types.ts` · `preload/index.ts` | Modified | `items:renameMany` channel + IpcApi + bridge |
| `components/renameItems.ts` | Created | Pure helpers: RenameSpec, computeName/computeRenames, specError, regex-escape |
| `components/BatchRenameDialog.tsx` | Created | Token modal: mode toggle, pattern/replace inputs, live old→new preview (capped), self-owned Escape |
| `LibraryGate.tsx` | Modified | renameDialog state; "Rename…" menu entry (targets→sorted Item rows); dialog render; keydown guard + deps |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Metadata-only rename | The display name is independent of the stored `original.<ext>` file | Safe + reversible (re-rename); no file I/O |
| Compute names renderer-side | Instant preview; backend stays a dumb persister | One atomic write of the final {id,name}[] |
| Dedicated items:renameMany | ItemPatch is rating-only; batch needs per-row names | Clean channel; mirrors 07-05 batch pattern |
| Graceful invalid regex | Avoid crashes on partial input | specError → inline message + Apply disabled |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** Executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- 07-07 (editable multi-item inspector) is the FINAL Phase-7 plan and will trigger the Phase 7 transition + commit. The selection model, batch IPC, and dialog patterns are all in place for it to build on.

**Concerns:**
- Rename has no undo (re-rename to revert) — acceptable for MVP.
- 60fps @ 50k still unmeasured; consider a perf pass before the milestone closes.

**Blockers:**
- None.

---
*Phase: 07-selection-interaction, Plan: 06*
*Completed: 2026-06-24*
