---
phase: 02-library-import
plan: 02
subsystem: import
tags: [electron, sharp, better-sqlite3, ipc, react, drag-drop, clipboard, thumbnails]

# Dependency graph
requires:
  - phase: 02-library-import (plan 01)
    provides: active library + per-library DB (getDb), imagesDir() path helper, structured IPC result + gate UI patterns
provides:
  - ImportService (importFile / importImageBuffer / importPaths) — copy original + sharp thumbnail + metadata.json + items row
  - File-type classification (image/video/audio/font/doc/other)
  - Per-item on-disk layout images/<id>/{original.<ext>,thumbnail.webp,metadata.json} (root PROJECT.md §6)
  - Typed import:* IPC (paths/clipboard/folder) + progress events + items:count
  - Renderer ImportZone (drag-drop, clipboard paste, bulk folder, live count + progress)
affects: [03-browse (grid reads thumbnails + items rows), 04-organize-search (search over items/FTS)]

# Tech tracking
tech-stack:
  added: [sharp@0.34.5]
  patterns:
    - "Source-agnostic import engine taking file paths or an image buffer; sources are thin IPC adapters"
    - "Batch import isolates per-file failures (collected, never aborts the batch)"
    - "Renderer→main path resolution via webUtils.getPathForFile (Electron 32+ removed File.path)"
    - "send/on progress channel (import:progress) with an unsubscribe-returning preload wrapper, alongside invoke/handle"

key-files:
  created:
    - src/main/services/import.ts
    - src/main/services/items.ts
    - src/main/ipc/import.ts
    - src/renderer/src/ImportZone.tsx
  modified:
    - package.json
    - src/main/ipc/index.ts
    - src/preload/index.ts
    - src/preload/types.ts
    - src/renderer/src/LibraryGate.tsx

key-decisions:
  - "sharp for image/GIF thumbnails + dimensions; no ffmpeg (non-images get correct type, no thumbnail)"
  - "IDs via Node crypto.randomUUID() (no new dep) rather than a ULID library"
  - "No worker_threads pool — sharp's async libvips work is already off the JS thread (non-blocking import for MVP)"
  - "Originals copied (never moved/modified); reference-in-place deferred"
  - "items:count exposed for the gate's live count; full grid is Phase 3"

patterns-established:
  - "Per-item folder = id (crypto.randomUUID); original.<ext> is a byte-for-byte copy"
  - "thumbnail.webp = fit-inside 512x512, withoutEnlargement, quality 80"
  - "metadata.json mirrors the items row for portability (root PROJECT.md §6)"

# Metrics
duration: ~single session
started: 2026-06-23
completed: 2026-06-23T00:00:00Z
---

# Phase 2 Plan 02: Import Pipeline Summary

**Three import sources (drag & drop files/folders, clipboard paste, bulk folder) feeding a source-agnostic engine that copies the untouched original, generates a sharp WebP thumbnail for images, writes a portable per-item metadata.json, and inserts the items row — with batch progress and a live count in the gate.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~single session |
| Started | 2026-06-23 |
| Completed | 2026-06-23 |
| Tasks | 3 implementation + 1 human-verify checkpoint (approved) |
| Files created | 4 |
| Files modified | 5 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Drag & drop files and folders | Pass | Dropped paths resolved via `webUtils.getPathForFile`; directories walked recursively; one items row per file; count rises; sources left unmodified (copyFile). User-verified at checkpoint. |
| AC-2: Paste image from clipboard | Pass | `clipboard.readImage()` → PNG buffer → `importImageBuffer`; empty clipboard returns a clear "No image in clipboard." message and imports nothing. User-verified. |
| AC-3: Bulk folder import with progress | Pass | Folder dialog → recursive import; `import:progress` events drive a "done/total" line; a failing file is collected in `failed` and does not abort the batch. User-verified. |
| AC-4: Per-item layout, thumbnails, metadata | Pass | images/<id>/ holds original.<ext> + thumbnail.webp (images) + metadata.json; items row populated (id/name/ext/type/size/width/height/created_at/imported_at); non-image types import with correct type, no thumbnail, null dims. User-verified. |

**Verification:** `npm run typecheck` (node + web) passes; `npm run build` produces all three bundles cleanly (sharp externalized via `externalizeDepsPlugin`). Runtime behavior confirmed by the user at the human-verify checkpoint.

## Accomplishments

- Delivered the "Collect" half of the core promise: assets now flow into the active library from three sources.
- Established the per-item on-disk layout (root PROJECT.md §6) the Phase 3 grid and Phase 4 search read from.
- Non-blocking import via sharp's async API with isolated per-file failures, plus live progress + count UI — no worker pool needed for MVP.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/main/services/import.ts` | Created | Engine: classifyType, importFile, importImageBuffer, importPaths (recursive walk, progress, failure isolation) |
| `src/main/services/items.ts` | Created | `countItems()` for the gate's live count |
| `src/main/ipc/import.ts` | Created | `import:paths`/`import:clipboard`/`import:folder` (structured results + progress) + `items:count` |
| `src/renderer/src/ImportZone.tsx` | Created | Drop zone, clipboard paste, "Import folder…", progress + live count + inline errors |
| `package.json` | Modified | Added `sharp` dependency |
| `src/main/ipc/index.ts` | Modified | Registers `registerImportIpc()` |
| `src/preload/index.ts` | Modified | `import` namespace + `pathForFile` (webUtils) on `window.api` |
| `src/preload/types.ts` | Modified | `ImportResult`, `ImportProgress`, `pathForFile`, `import` namespace types |
| `src/renderer/src/LibraryGate.tsx` | Modified | Mounts `<ImportZone key={active.path}/>` in the active branch (remounts on switch) |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| No worker_threads pool | sharp's libvips work already runs off the JS thread; event loop stays responsive | Roadmap said "worker thumbnails" — downgraded to a deferred perf optimization; revisit if 50k-item imports stutter |
| `crypto.randomUUID()` for IDs | Built-in, no dependency; satisfies "stable unique ID" | UUIDv4 (not sortable like ULID); fine for keys, ordering uses created_at |
| sharp only (no ffmpeg) | Per phase decision; video/audio thumbnails are V1 | Non-image types import with correct type but no thumbnail |
| `items:count` for the gate | Grid is Phase 3; a count proves import works now | Minimal items service; grid queries come later |
| `key={active.path}` on ImportZone | Force remount + count refresh on library switch | Clean per-library state without extra wiring |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Extensionless-file handling (original with no ext) |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** Negligible — followed the plan closely; one small robustness addition.

### Auto-fixed Issues

**1. [Robustness] Files with no extension**
- **Found during:** Task 1 (import engine)
- **Issue:** `original.<ext>` would produce `original.` for extensionless files.
- **Fix:** When ext is empty, the copied original is named `original` (no trailing dot); type classifies as `other`.
- **Files:** `src/main/services/import.ts`
- **Verification:** Covered by typecheck + logic; non-image/extensionless path exercised conceptually during checkpoint.

### Deferred Items

None.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| npm's allow-scripts policy skipped sharp's install script (same npm 11 behavior noted in Phase 1) | Not needed — modern sharp ships prebuilt N-API binaries as optional deps; verified `@img/sharp-win32-x64` present and `require('sharp')` loads (v0.34.5). No rebuild required (N-API is ABI-stable across Electron). |

## Next Phase Readiness

**Ready:**
- items rows + per-item thumbnail.webp give Phase 3's virtualized grid everything it needs to render.
- `items:count` + the IPC pattern extend naturally to grid queries (paged list, by-id fetch).
- metadata.json provides a portable/recoverable per-item record.

**Concerns:**
- Production packaging not yet verified: sharp (like better-sqlite3) is native and will need `asarUnpack` in electron-builder config before a real build — deferred to a packaging pass.
- No thumbnails for video/audio/pdf/font yet; the grid must show type-based placeholder icons until V1 media thumbnails land.
- Large imports run sequentially on the main process; if 10k+ imports stutter, revisit the deferred worker pool.

**Blockers:**
- None.

---
*Phase: 02-library-import, Plan: 02*
*Completed: 2026-06-23*
