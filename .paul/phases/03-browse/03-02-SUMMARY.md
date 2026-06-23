---
phase: 03-browse
plan: 02
subsystem: ui
tags: [electron, react, ipc, inspector, quick-preview, keyboard, csp, sqlite]

# Dependency graph
requires:
  - phase: 03-browse (plan 01)
    provides: lifted selectedId in LibraryGate, imgman://thumb|original protocol, items:list IPC, Item type, in-memory items array
provides:
  - items:get IPC + FullItem type (full row incl. duration_ms, palette, source_url, note)
  - Inspector metadata panel rendered beside the grid (read-only)
  - Spacebar quick-preview overlay (image full-size, video/audio native controls, placeholder for other types)
  - Global Space/Escape keyboard handling in LibraryGate; CSP media-src opened to imgman:
affects: [04-organize-search (inspector is the natural home for rating/tag/note editing; filtered results render through the same grid+inspector)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "items:get returns the FULL row for detail views; items:list stays a lean grid projection"
    - "Keyboard owned by the container (LibraryGate); presentational overlay (QuickPreview) is keyboard-free"
    - "Space handler guards against inputs/textarea/contentEditable and preventDefaults to suppress focused-button activation + page scroll"

key-files:
  created:
    - src/renderer/src/Inspector.tsx
    - src/renderer/src/QuickPreview.tsx
  modified:
    - src/main/services/items.ts
    - src/main/ipc/items.ts
    - src/preload/index.ts
    - src/preload/types.ts
    - src/renderer/src/LibraryGate.tsx
    - src/renderer/index.html

key-decisions:
  - "Read-only inspector for MVP; rating/note/tag editing deferred to Phase 4 (Organize)"
  - "items:get full record (vs widening items:list) keeps the grid payload small"
  - "QuickPreview reuses the in-memory items row (no extra fetch); plays media via native <video>/<audio> over imgman://original"
  - "CSP media-src 'self' imgman: added so video/audio originals load in the sandboxed renderer"

patterns-established:
  - "Detail/list split: list = lean projection, get = full row"
  - "Container-owned keyboard + dumb presentational overlay"

# Metrics
duration: ~single session
started: 2026-06-23
completed: 2026-06-23T00:00:00Z
---

# Phase 3 Plan 02: Inspector + Spacebar Quick Preview Summary

**A read-only inspector panel beside the grid (preview + formatted metadata) and a Space-triggered full-screen quick preview that renders the original — images/GIFs full-size, video/audio with native controls, placeholders for other types — completing the browse surface.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~single session |
| Started | 2026-06-23 |
| Completed | 2026-06-23 |
| Tasks | 3 implementation + 1 human-verify checkpoint (approved) |
| Files created | 2 |
| Files modified | 6 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Inspector shows selected item's metadata | Pass | Panel shows preview + name, type/ext, dimensions (when present), human-readable size, rating stars, created/imported dates; source/note shown only when present; empty state before selection. User-verified. |
| AC-2: Inspector tracks selection & library changes | Pass | Re-fetches via items.get on selectedId change; selection + preview cleared on library switch. User-verified. |
| AC-3: Spacebar toggles quick preview | Pass | Space opens/closes for the selected item (preventDefault stops page scroll + focused-button click); Escape closes; no-op when nothing selected. User-verified. |
| AC-4: Quick preview renders by type, no broken media | Pass | Image/GIF full-size (contain), video/audio via native controls over imgman://original, font/doc/other show a large placeholder. User-verified. |
| AC-5: items:get returns full record safely | Pass | Returns FullItem for a valid id, null for unknown id / no library open; no throw across IPC. typecheck-verified + runtime. |

**Verification:** `npm run typecheck` (node + web) passes; `npm run build` produces all three bundles cleanly (renderer ~655 kB). Runtime behavior confirmed by the user at the human-verify checkpoint.

## Accomplishments

- Completed the browse half of the MVP loop: an asset can now be selected, inspected, and previewed full-screen.
- Established the detail-vs-list data split (items:get full row / items:list lean projection) — the seam Phase 4 editing will build on.
- Reused the imgman://original path from 03-01 for media playback with only a one-line CSP addition.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/renderer/src/Inspector.tsx` | Created | Read-only metadata panel: preview + name/type/ext/dimensions/size/rating/dates/source/note, empty-row omission, empty state |
| `src/renderer/src/QuickPreview.tsx` | Created | Full-viewport overlay; renders original by type (img/video/audio/placeholder); backdrop-click closes |
| `src/main/services/items.ts` | Modified | FullItem type + getItem(id) full-row query |
| `src/main/ipc/items.ts` | Modified | items:get handler |
| `src/preload/index.ts` | Modified | items.get bridge |
| `src/preload/types.ts` | Modified | FullItem type + items.get signature |
| `src/renderer/src/LibraryGate.tsx` | Modified | Grid+Inspector two-column layout; previewOpen state; Space/Escape keydown effect; QuickPreview render |
| `src/renderer/index.html` | Modified | CSP media-src 'self' imgman: |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Read-only inspector | Rating/tag/note editing is Phase 4 "Organize" scope | Clean phase boundary; inspector is the obvious home for editing later |
| items:get full record (not widen items:list) | Keep the grid payload lean at 50k items | Detail views fetch on demand |
| Container-owned keyboard, dumb overlay | Single source of Space/Escape truth; avoids focus/scroll bugs | QuickPreview stays presentational/reusable |
| CSP media-src += imgman: | Sandboxed renderer blocks media from custom scheme otherwise | Video/audio originals play; anticipated in 03-01's concerns |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** Plan executed exactly as written.

### Deferred Items

None new. (Pre-noted scope limits stand: arrow-key navigation between items, "open externally"/reveal action, and rating/note/tag editing — all intentionally out of scope for Phase 3.)

## Issues Encountered

None.

## Next Phase Readiness

**Ready (for Phase 4 — Organize & search):**
- Inspector is the natural surface for rating/tag/note editing — read path (items.get) is already in place; Phase 4 adds the write path.
- Grid + selection + inspector + preview all render off the active library via existing IPC; filtered/search results can flow through the same `items` array.
- FullItem already carries palette/source_url for future color search and provenance display.

**Concerns:**
- Renderer bundle ~655 kB (react + react-virtuoso) — fine for desktop; revisit if cold start regresses.
- No arrow-key navigation in grid/preview yet — likely expected UX; consider in Phase 4 or a polish pass.
- Production packaging (asarUnpack for native modules) still unverified — deferred to a packaging pass.

**Blockers:**
- None.

---
*Phase: 03-browse, Plan: 02*
*Completed: 2026-06-23*
