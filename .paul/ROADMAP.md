# Roadmap: IMGMAN

## Overview

A local-first desktop asset manager built in stages: stand up the Electron/React/SQLite skeleton, ship a working MVP (collect → organize → search → browse), then layer on V1 polish and later differentiators. Phases below are seeded from the existing design doc and will be detailed during `/paul:plan`.

## Current Milestone

**v0.1 MVP** (v0.1.0)
Status: ✅ Complete (2026-06-23)
Phases: 4 of 4 complete

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with [INSERTED])

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 1 | Foundation & skeleton | 1 | ✅ Complete | 2026-06-23 |
| 2 | Library & import | 2 | ✅ Complete | 2026-06-23 |
| 3 | Browse (grid + inspector) | 2 | ✅ Complete | 2026-06-23 |
| 4 | Organize & search | 4 | ✅ Complete | 2026-06-23 |

## Phase Details

Phase scope and plans will be defined during `/paul:plan`. Provisional intent (from root `PROJECT.md` Milestone 0–1):

### Phase 1: Foundation & skeleton ✅
**Goal:** Electron + React + TS + Vite skeleton with hot reload, typed IPC layer, SQLite wired up, `electron-builder` producing a test build.
**Depends on:** Nothing (first phase)
**Research:** Unlikely (established stack)
**Status:** Complete (2026-06-23) — see `phases/01-foundation/01-01-SUMMARY.md`
**Plans:**
- [x] 01-01: Scaffold skeleton, typed IPC, SQLite schema, Windows build

### Phase 2: Library & import ✅
**Goal:** Create/open a portable library; drag & drop + clipboard + bulk folder import (copy original, generate thumbnail, insert row).
**Depends on:** Phase 1
**Status:** Complete (2026-06-23) — see `phases/02-library-import/02-01-SUMMARY.md`, `02-02-SUMMARY.md`
**Decisions:** One active library (create/open/switch); import all types (real thumbs for images/GIFs, generic otherwise); copy originals; no ffmpeg yet; no worker pool (sharp async is off-thread).
**Plans:**
- [x] 02-01: Library format & lifecycle (create/open/switch, per-library DB, recents) — see `phases/02-library-import/02-01-SUMMARY.md`
- [x] 02-02: Import pipeline (drag/drop + clipboard + bulk; copy original, insert row, sharp thumbnails) — see `phases/02-library-import/02-02-SUMMARY.md`

### Phase 3: Browse (grid + inspector)
**Goal:** Virtualized grid view, inspector/metadata panel, spacebar quick preview.
**Depends on:** Phase 2
**Research:** Unlikely (virtualization libraries are well known)
**Status:** Complete (2026-06-23) — see `phases/03-browse/03-01-SUMMARY.md`, `03-02-SUMMARY.md`
**Decisions:** react-virtuoso (VirtuosoGrid) for windowing; custom privileged `imgman://` protocol to serve library files to the sandboxed renderer (confined to active library); items:list returns all rows (paging deferred); items:get full row for the inspector; read-only inspector (editing → Phase 4).
**Plans:**
- [x] 03-01: Data access + virtualized grid (imgman:// protocol, items:list, VirtuosoGrid, selection) — see `phases/03-browse/03-01-SUMMARY.md`
- [x] 03-02: Inspector/metadata panel + spacebar quick preview (items:get, Inspector, QuickPreview, Space/Esc, CSP media-src) — see `phases/03-browse/03-02-SUMMARY.md`

### Phase 4: Organize & search ✅
**Goal:** Folders, tags, ratings; keyword search + format/type/rating/date filters.
**Depends on:** Phase 3
**Status:** Complete (2026-06-23) — see the four `phases/04-organize-search/04-0N-SUMMARY.md`
**Decisions:** item mutation via allow-listed `items:update`; many-to-many relations (tags, folders) each get their own IPC namespace returning the canonical list; folder tree is a flat parent_id list rendered nested; cascade folder-delete keeps items; search is LIKE-based (FTS deferred), a whole-library scope mutually exclusive with the folder filter.
**Plans:**
- [x] 04-01: Editable star ratings (1–5) + reusable `items:update` mutation — see `phases/04-organize-search/04-01-SUMMARY.md`
- [x] 04-02: Tags (many-to-many): tag CRUD + assign/remove on items, inspector tag editor — see `phases/04-organize-search/04-02-SUMMARY.md`
- [x] 04-03: Folders (nested): folder tree + assign items, filter grid by folder — see `phases/04-organize-search/04-03-SUMMARY.md`
- [x] 04-04: Keyword search (name/note/tags) + format/type/rating/date filters — see `phases/04-organize-search/04-04-SUMMARY.md`

---
*Roadmap created: 2026-06-23*
*Last updated: 2026-06-23 — v0.1 MVP complete (Phase 4 done)*
