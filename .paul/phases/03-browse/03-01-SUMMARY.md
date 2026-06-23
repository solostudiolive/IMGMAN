---
phase: 03-browse
plan: 01
subsystem: ui
tags: [electron, protocol, react, react-virtuoso, virtualization, sqlite, thumbnails, csp]

# Dependency graph
requires:
  - phase: 02-library-import (plan 02)
    provides: items rows + per-item images/<id>/{original.<ext>,thumbnail.webp}, active library + imagesDir()
provides:
  - imgman:// privileged protocol serving thumb/original strictly from the active library
  - items:list IPC + Item type (newest-first row projection)
  - Virtualized thumbnail grid (react-virtuoso VirtuosoGrid) with placeholders + click-to-select
  - Selection state (selectedId) in LibraryGate — seam for 03-02 inspector/quick-preview
  - Grid refresh-on-import + swap-on-library-switch
affects: [03-browse (plan 02 inspector + quick preview), 04-organize-search (grid renders filtered results)]

# Tech tracking
tech-stack:
  added: [react-virtuoso@^4.12]
  patterns:
    - "Custom privileged scheme (registerSchemesAsPrivileged before ready + protocol.handle after) to serve local files to the sandboxed renderer"
    - "Path-confinement: UUID-validated id + resolve()/startsWith() check keeps serving inside the active library's images root"
    - "items:list returns all rows (small payload); windowing is render-side only"
    - "Lifted browse state (items + selectedId) in LibraryGate; ImportZone signals changes via onChanged"

key-files:
  created:
    - src/main/protocol.ts
    - src/main/ipc/items.ts
    - src/renderer/src/Grid.tsx
  modified:
    - package.json
    - src/main/index.ts
    - src/main/services/items.ts
    - src/main/ipc/index.ts
    - src/preload/index.ts
    - src/preload/types.ts
    - src/renderer/src/ImportZone.tsx
    - src/renderer/src/LibraryGate.tsx
    - src/renderer/index.html

key-decisions:
  - "react-virtuoso VirtuosoGrid for responsive windowing (vs react-window + autosizer)"
  - "imgman:// custom protocol to feed the sandboxed renderer (vs base64-over-IPC) — performance + confinement"
  - "items:list returns all rows; paging deferred"
  - "net.fetch(file URL) inside protocol.handle for streaming + Content-Type inference"

patterns-established:
  - "imgman://<kind>/<id> where kind = thumb|original; id is a UUID; resolved under <library>/images/<id>/"
  - "Grid cells fall back to a type glyph + extension placeholder on non-image type OR <img> onError"

# Metrics
duration: ~single session
started: 2026-06-23
completed: 2026-06-23T00:00:00Z
---

# Phase 3 Plan 01: Data Access + Virtualized Grid Summary

**A windowed thumbnail grid for the active library — thumbnails served via a sandboxed-safe imgman:// protocol confined to the library, type placeholders for non-image items, click-to-select, and live refresh on import/switch.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~single session |
| Started | 2026-06-23 |
| Completed | 2026-06-23 |
| Tasks | 3 implementation + 1 human-verify checkpoint (approved) |
| Files created | 3 |
| Files modified | 9 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Grid renders the library's items | Pass | `items:list` returns rows newest-first (imported_at desc); image cells show thumbnail.webp; empty state shown at 0 items. User-verified. |
| AC-2: Virtualized — smooth at scale | Pass | `VirtuosoGrid` mounts only visible + overscan cells; smooth scroll confirmed; DOM shows a windowed subset. User-verified. |
| AC-3: Thumbless types show a placeholder | Pass | video/audio/font/doc/other render a type glyph + extension; `<img>` onError falls back to the same placeholder — no broken images. User-verified (JPGs fell back correctly before the CSP fix, real thumbs after). |
| AC-4: Click selects an item | Pass | Selected cell gets a blue ring; `selectedId` held in LibraryGate state; clicking moves selection. User-verified. |
| AC-5: Local files served safely + library switch | Pass | imgman:// resolves only within the active library's images/<id>/; UUID regex + resolve/startsWith block invalid ids/traversal; switching libraries swaps contents + clears selection. User-verified. |

**Verification:** `npm run typecheck` (node + web) passes; `npm run build` produces all three bundles cleanly. Runtime behavior + security spot-check confirmed by the user at the human-verify checkpoint (after the CSP fix below).

## Accomplishments

- Stood up the app's primary surface: a virtualized grid that renders the active library's assets.
- Built a reusable, security-confined local-file delivery path (imgman://) for thumbnails now and originals (consumed by 03-02 quick-preview).
- Established selection state + import/switch-driven refresh — the seam the inspector and search results render into.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/main/protocol.ts` | Created | imgman:// scheme registration + handler (UUID-validated, path-confined, net.fetch file serving) |
| `src/main/ipc/items.ts` | Created | items:list IPC |
| `src/renderer/src/Grid.tsx` | Created | VirtuosoGrid cells: thumbnail or type placeholder, selection ring, truncated name |
| `package.json` | Modified | Added react-virtuoso |
| `src/main/index.ts` | Modified | registerImgmanScheme() pre-ready; registerImgmanProtocol() on ready |
| `src/main/services/items.ts` | Modified | Item type + listItems() |
| `src/main/ipc/index.ts` | Modified | Registers items IPC |
| `src/preload/index.ts` | Modified | items namespace (list/count) |
| `src/preload/types.ts` | Modified | Item/ItemType + items api types |
| `src/renderer/src/ImportZone.tsx` | Modified | onChanged prop → parent reloads grid after import |
| `src/renderer/src/LibraryGate.tsx` | Modified | Grid layout + items/selection state; ImportZone as compact header |
| `src/renderer/index.html` | Modified | CSP img-src += imgman: (auto-fix, see Deviations) |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| react-virtuoso VirtuosoGrid | Responsive CSS-grid windowing with overscan, single JS dep | Renderer bundle grew to ~648 kB; smooth at scale |
| imgman:// privileged protocol | Sandboxed renderer can't read FS; serving real files beats base64-over-IPC at 50k thumbnails; confinable for security | Reusable for originals (03-02) and any future media |
| items:list returns all rows | Rows are small; render-side windowing handles display | Revisit paging only if the list payload itself is a problem at 50k+ |
| net.fetch(file URL) in handler | Handles streaming, range, Content-Type | Simple, robust file delivery |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | CSP blocked imgman: images |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** One essential fix discovered at the checkpoint; no scope creep.

### Auto-fixed Issues

**1. [CSP] imgman:// images blocked by Content-Security-Policy**
- **Found during:** Task 4 (human-verify checkpoint) — thumbnails showed the placeholder fallback instead of real images.
- **Issue:** `src/renderer/index.html` meta CSP was `img-src 'self' data:`, which refused the `imgman:` scheme; the refused `<img>` requests fired onError → placeholder.
- **Fix:** Added `imgman:` to `img-src`. (index.html was not in files_modified but is not a protected file.)
- **Verification:** User reloaded the renderer; real thumbnails rendered; approved. (Protocol/file layer was already healthy — the refusal was purely CSP.)
- **Commit:** Not yet committed (no per-plan commit; will be in the Phase 3 transition commit).

### Deferred Items

None.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Thumbnails not displaying at first checkpoint | Root-caused to CSP (img-src missing imgman:); fixed and re-verified. Distinguished from a 404 via the suggested DevTools `fetch('imgman://thumb/<id>')` check. |

## Next Phase Readiness

**Ready (for 03-02 inspector + quick preview):**
- `selectedId` selection state already lifted into LibraryGate — the inspector reads it directly.
- imgman://original/<id> already serves full files — quick-preview/inspector can show originals with no new backend.
- Item type carries the metadata fields (dimensions, size, rating, dates) the inspector will display.

**Concerns:**
- CSP now allows `imgman:` for images; if quick-preview uses other element types (e.g. video/audio/object for originals), CSP `media-src`/`default-src` may need the scheme too.
- Renderer bundle ~648 kB (react + react-virtuoso) — fine for desktop; revisit if cold start regresses.
- Still no production packaging (asarUnpack for native modules) — deferred.

**Blockers:**
- None.

---
*Phase: 03-browse, Plan: 01*
*Completed: 2026-06-23*
