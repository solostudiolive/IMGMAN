# Milestones: IMGMAN

Record of milestone scope and outcomes. Newest first.

---

## v1.0 — Eagle Parity ✅ Complete

**Completed:** 2026-06-26 (started 2026-06-24)
**Duration:** ~3 days
**Phases:** 4 integer phases (5–8) + 1 inserted (8.1); Phase 9 deferred to v1.1
**Theme:** Transform the functional v0.1 MVP into a polished, Eagle-class desktop asset
manager — look, feel, and feature parity — reusing the proven SQLite/IPC backend.

### Stats

| Metric | Value |
|--------|-------|
| Phases | 4 (+1 inserted: 8.1) |
| Plans | 21 (4 + 4 + 7 + 4 + 2) |
| Files changed | 114 (+15,638 / −436 since v0.1) |
| Tag | v1.0.0 |

### Accomplishments

- **Phase 5 — Design system & shell:** semantic CSS-custom-property design tokens (dark
  default + light, FOUC-safe persistence), a chrome-less per-platform custom title bar +
  window controls, a three-pane resizable/collapsible app shell, and a settings modal.
- **Phase 6 — Eagle grid & content area:** thumbnail-size slider + sort toolbar
  (renderer-side, no IPC), three virtualized view modes (grid / masonry-waterfall / list),
  and hover-intent preview for GIF/video.
- **Phase 7 — Selection & interaction:** full multi-select (click / ctrl-toggle /
  shift-range / rubber-band marquee / keyboard nav), reusable portal context menus
  (items / folders / tags), atomic main-side batch ops (delete / tag / move / rename with
  pattern + find-replace), and an editable single- + multi-item inspector (intersection
  semantics).
- **Phase 8 — Organize power features:** saved searches / smart folders (persisted
  re-runnable `SearchCriteria`), no-dependency color extraction + inspector swatches,
  nearest-color color search, and find-duplicates (SHA-256 `content_hash` via the project's
  first schema migration). Plus an off-loop sidebar Tags section + inline library rename.
- **Phase 8.1 (inserted) — UI polish & Inter:** bundled the **Inter** typeface
  (`@fontsource/inter`, self-hosted/CSP-safe) and a "refined dark, Eagle-like" restyle —
  flat near-black palette, tightened spacing/density, restrained radii, and an accent
  focus-visible ring.

### Key Decisions

- Theme engine owned by the **renderer** (localStorage source-of-truth, applied pre-render
  to avoid FOUC), not main settings; components reference `var(--color-*)`, never raw hex.
- Chrome-less window uses a **per-platform frame** (frameless win/linux, hidden-inset
  traffic lights darwin) with new `window:*` IPC resolved per-call via
  `BrowserWindow.fromWebContents`.
- View state lives in a renderer `useGridView` hook with one sort comparator across all
  scopes (no IPC/SQL); `@virtuoso.dev/masonry` was the only new view dep.
- Batch operations are **atomic main-side IPC** (one `db.transaction`, returns a count);
  multi-item inspector reads the strict **intersection** (`HAVING COUNT(DISTINCT item_id)=N`).
- Color extraction is a **no-dependency quantizer over sharp pixels** (no worker — sharp
  decode is off-thread) reusing the pre-existing `items.palette` column; color **search** is
  a JS nearest-color post-filter (`color`/`colorTolerance` on `SearchCriteria`).
- Find-duplicates introduced the project's **first schema migration** (`content_hash` via
  table_info-guarded ALTER + `user_version`) and a streamed SHA-256 in `services/hash.ts`.

### Descope

- **Phase 9 — Browser-extension collecting: DEFERRED to v1.1** (confirmed 2026-06-26).
  v1.0 ships at Phase 8. v1.1 starting decisions captured: target Chromium (Chrome/Edge) +
  Firefox (Manifest V3); capture = right-click image + page screenshot + drag-an-image;
  security = loopback-only receiver (127.0.0.1) + pairing token shown in Settings.

### Known carry-forward / deferred

- Performance targets (<0.5s search @ 50k, 60fps scroll) not yet measured against a real
  50k-item library; `items_fts` (FTS5) still unwired (LIKE-based search).
- Production packaging (`asarUnpack` for sharp + better-sqlite3) unverified; macOS build
  unverified; signed builds + auto-update not done.
- No real thumbnails for video/audio/pdf/font; import still sequential on the main process.

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
