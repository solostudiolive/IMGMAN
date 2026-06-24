# Milestones: IMGMAN

Record of milestone scope and outcomes. Newest first.

---

## v1.0 — Eagle Parity 🚧 In Progress

**Started:** 2026-06-24
**Phases:** 5 (Phases 5–9)
**Theme:** Transform the functional v0.1 MVP into a polished, Eagle-class desktop asset
manager — look, feel, and feature parity — reusing the proven SQLite/IPC backend.

**Scope:**
- Phase 5 — Design system & shell: dark+light theming tokens (Eagle-matched), chrome-less
  title bar, three-pane layout, settings screen + theme toggle.
- Phase 6 — Eagle grid & content area: masonry/waterfall grid, thumbnail-size slider, view
  modes, sort toolbar, hover preview for GIF/video.
- Phase 7 — Selection & interaction: multi-select, context menus, keyboard nav, batch
  rename/tag/move/delete, polished editable inspector.
- Phase 8 — Organize power features: smart folders / saved searches, color extraction +
  color search, find duplicates.
- Phase 9 — Browser-extension collecting: companion extension + local receiver endpoint.

---

## v0.1 — MVP ✅ Complete

**Completed:** 2026-06-23
**Phases:** 4 (Phases 1–4)
**Theme:** Ship a working local-first asset manager — collect → organize → search → browse.

**Accomplishments:**
- Cross-platform Electron + React + TS skeleton, typed IPC boundary, embedded SQLite with
  idempotent schema, Windows packaging (Phase 1).
- Portable `.library` lifecycle (create/open/switch, per-library SQLite, recents) and an
  import pipeline (drag&drop + clipboard + bulk folder; copy original, sharp thumbnail,
  metadata, items row) (Phase 2).
- Virtualized grid (react-virtuoso) + inspector, spacebar quick preview, custom privileged
  `imgman://` protocol serving library files to the sandboxed renderer (Phase 3).
- Editable star ratings, tags (many-to-many), nested folders, keyword search + format/type/
  rating/date filters (Phase 4).

**Known carry-forward / deferred:** FTS5 (`items_fts`) unwired (LIKE-based search), no real
media thumbnails, arrow-key grid nav, packaging `asarUnpack` for native modules unverified.

---
*Created: 2026-06-24*
