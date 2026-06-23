# Project: IMGMAN

## Description

A local-first cross-platform desktop app (Electron + React + TypeScript) for collecting, organizing, searching, and browsing visual assets (images, GIFs, videos, audio, fonts, PDFs), inspired by Eagle. Everything is stored in a portable local library so the user owns their data.

## Core Value

A fast, offline-first local "second brain" — collect, organize, search, and browse tens of thousands of visual assets in under a second, with full ownership of your data.

## Requirements

### Validated (Shipped)
- ✓ Cross-platform Electron + React + TS skeleton with HMR — Phase 1
- ✓ Typed IPC boundary (contextBridge, no nodeIntegration) — Phase 1
- ✓ Embedded SQLite metadata DB with idempotent schema — Phase 1
- ✓ electron-builder Windows packaging (native module ABI-correct) — Phase 1
- ✓ Create / open / switch a portable `.library` (per-library SQLite, recents, last-opened) — Phase 2
- ✓ Drag & drop + clipboard + bulk folder import (copy original, sharp thumbnail, metadata.json, items row) — Phase 2
- ✓ Virtualized grid view (react-virtuoso) + inspector/metadata panel — Phase 3
- ✓ Spacebar quick preview (image/GIF full-size, video/audio native playback) — Phase 3

### Must Have (MVP)
- Folders (nested), tags (many-to-many), star ratings (1–5)
- Keyword search (name/tag/note) + filter by format/type/rating/date
- Cross-platform (Windows + macOS)

### Should Have (V1)
- Smart folders + saved searches
- Color extraction + color search
- Hover preview for GIF/video/audio
- Batch rename / batch tag, notes/annotations
- Multiple layouts, settings screen
- Signed builds + auto-update

### Nice to Have (Later)
- Browser extension, find duplicates, plugin API
- AI tagging / semantic + visual search
- Password lock, cloud-sync-friendly layout

## Constraints

### Technical
- Electron locked for MVP (revisit Tauri only if bundle size/memory becomes a real problem)
- Renderer talks to main only via typed IPC; heavy jobs (thumbnails, color, media probe) run in workers
- Originals are never modified; library is a self-contained portable folder
- Metadata in SQLite (`better-sqlite3`); stable unique IDs (UUID/ULID)

### Performance
- Search renders in < 0.5s at 50k items
- Grid scroll holds 60fps (virtualization + cached thumbnails)
- Import is non-blocking; app cold start < 2s

## Success Criteria
- Core value is achieved: collect → organize → search → browse stays smooth at tens of thousands of items
- MVP milestone shippable (library + import + grid + organize + search)
- Performance targets met at 50k items

## Key Decisions

| Decision | Phase | Rationale |
|----------|-------|-----------|
| Electron locked for MVP | Pre-1 | Speed of development; revisit Tauri only on bundle/memory pain |
| One active `.library` at a time; per-library SQLite | 2 | Portable, user-owned library; clean open/close on switch |
| Originals copied (not referenced) into the library | 2 | Safe by default; reference-in-place deferred |
| sharp for image thumbnails; no ffmpeg yet | 2 | Non-image types get correct classification + generic handling; media thumbs are V1 |
| No worker pool for import (sharp async is off-thread) | 2 | Non-blocking enough for MVP; revisit at scale |
| IDs via crypto.randomUUID() | 2 | Built-in, stable, unique; no extra dependency |
| Custom privileged `imgman://` protocol to serve library files | 3 | Sandboxed renderer can't read FS; beats base64-over-IPC; path-confined to active library |
| react-virtuoso VirtuosoGrid; items:list returns all rows | 3 | Render-side windowing scales to 50k; paging deferred |
| items:list lean projection vs items:get full row | 3 | Grid payload stays small; inspector fetches the full record on demand |
| Read-only inspector for MVP | 3 | Rating/tag/note editing deferred to Phase 4 (Organize) |

## Reference

Full design doc (architecture, data model, library format, risks): see root `PROJECT.md`.

---
*Created: 2026-06-23*
*Last updated: 2026-06-23 after Phase 3*
