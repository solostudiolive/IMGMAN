# Roadmap: IMGMAN

## Overview

A local-first desktop asset manager built in stages: stand up the Electron/React/SQLite skeleton, ship a working MVP (collect → organize → search → browse), then layer on V1 polish and later differentiators. Phases below are seeded from the existing design doc and will be detailed during `/paul:plan`.

## Current Milestone

**v1.0 — Eagle Parity** (v1.0.0)
Status: 🚧 In Progress (started 2026-06-24)
Phases: 3 of 5 complete (Phases 5–9)
Focus: Transform the functional v0.1 MVP into a polished, Eagle-class desktop asset
manager — look, feel, and feature parity — reusing the proven SQLite/IPC backend.

## Completed Milestones

**v0.1 MVP** (v0.1.0) — ✅ Complete (2026-06-23) — Phases 1–4. See MILESTONES.md.

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
| 5 | Design system & shell | 4 | ✅ Complete | 2026-06-24 |
| 6 | Eagle grid & content area | 4 | ✅ Complete | 2026-06-24 |
| 7 | Selection & interaction | 7 | ✅ Complete | 2026-06-24 |
| 8 | Organize power features | 4 | In Progress | - |
| 8.1 | UI polish & Inter [INSERTED] | 2 | ✅ Complete | 2026-06-26 |
| 9 | Browser-extension collecting | TBD | Not started | - |

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

## Milestone v1.0 — Eagle Parity (Phases 5–9)

Front-end transformation of the v0.1 MVP into an Eagle-class desktop app, plus a few new
backend features. The existing IPC namespaces (`library:*`, `items:*`, `tags:*`,
`folders:*`, `items:search`), per-library SQLite, and `imgman://` protocol are **reused**,
not rebuilt — new work extends them. Phase scope and plans are defined during `/paul:plan`.

### Phase 5: Design system & shell
**Goal:** Establish the visual foundation — dark + light theming tokens (Eagle-matched
palette/spacing/typography), a chrome-less custom title bar, and a three-pane app shell
(left sidebar · center toolbar+content · right collapsible inspector) replacing the
current vertical-stack layout. Includes a settings screen with theme toggle.
**Depends on:** Phase 4 (v0.1 backend + components to re-skin)
**Research:** Likely (Electron custom title bar / window controls, theming-token approach)
**Status:** ✅ Complete (2026-06-24) — see the four `phases/05-design-system-shell/05-0N-SUMMARY.md`
**Plans:**
- [x] 05-01: Design tokens & theming foundation (token system, ThemeProvider, dark default + light, FOUC-safe persistence) — see `phases/05-design-system-shell/05-01-SUMMARY.md`
- [x] 05-02: Chrome-less custom title bar + window controls — see `phases/05-design-system-shell/05-02-SUMMARY.md`
- [x] 05-03: Three-pane app shell layout (resizable/collapsible shell, modern search toolbar, relocated pane toggles + sidebar theme toggle) — see `phases/05-design-system-shell/05-03-SUMMARY.md`
- [x] 05-04: Settings screen (Appearance theme control + About) + relocate theme toggle — see `phases/05-design-system-shell/05-04-SUMMARY.md`

### Phase 6: Eagle grid & content area
**Goal:** The centerpiece — masonry/waterfall grid layout, a thumbnail-size slider,
multiple view modes (grid/masonry/list), a sort + view-controls toolbar, and hover preview
for GIF/video. Must hold 60fps scroll at 50k items.
**Depends on:** Phase 5 (shell + tokens)
**Research:** Likely (virtualized masonry at scale)
**Status:** ✅ Complete (2026-06-24) — see the four `phases/06-grid-content-area/06-0N-SUMMARY.md`
**Decisions:** renderer-side view-state (useGridView) + one sort comparator across scopes (no IPC); `@virtuoso.dev/masonry` for the virtualized waterfall (aspect ratios from Item.width/height); list view via react-virtuoso `Virtuoso`; hover preview (GIF animate / video play) in the shared Cell reusing imgman://original (no CSP/dep/IPC change). 60fps @ 50k not yet measured.
**Plans:**
- [x] 06-01: View toolbar — thumbnail-size slider + sort control (renderer-side; no IPC) — see `phases/06-grid-content-area/06-01-SUMMARY.md`
- [x] 06-02: Masonry/waterfall layout + view-mode switch (grid ↔ masonry) — @virtuoso.dev/masonry — see `phases/06-grid-content-area/06-02-SUMMARY.md`
- [x] 06-03: List view mode (virtualized Virtuoso details list) — see `phases/06-grid-content-area/06-03-SUMMARY.md`
- [x] 06-04: Hover preview for GIF/video (hover-intent in shared Cell) — see `phases/06-grid-content-area/06-04-SUMMARY.md`

### Phase 7: Selection & interaction
**Goal:** Make it feel like a real desktop app — multi-select (shift-range, ctrl-toggle,
rubber-band), right-click context menus (items/folders/tags), keyboard navigation, batch
operations (rename/tag/move/delete), and a polished editable collapsible inspector
(single + multi-item).
**Depends on:** Phase 6 (grid is the selection surface); batch ops depend on multi-select
**Research:** Unlikely
**Status:** ✅ Complete (2026-06-24) — see the seven `phases/07-selection-interaction/07-0N-SUMMARY.md`
**Decisions:** selection model in a renderer `useSelection` hook (click/ctrl/shift + marquee + keyboard); batch ops are atomic main-side IPC (one txn, returns count); reusable portal `ContextMenu`; multi-item inspector reads the INTERSECTION (`HAVING COUNT(DISTINCT item_id)=N`) with header aggregates computed renderer-side; new channels only (single Inspector untouched); no schema change, no new deps.
**Plans:**
- [x] 07-01: Multi-select model (mouse: click/ctrl-toggle/shift-range) + primary/anchor — see `phases/07-selection-interaction/07-01-SUMMARY.md`
- [x] 07-02: Keyboard navigation (arrows/shift/Ctrl+A/Home/End/Enter + scroll-into-view) — see `phases/07-selection-interaction/07-02-SUMMARY.md`
- [x] 07-03: Rubber-band marquee selection (drag-rect over mounted cells) — see `phases/07-selection-interaction/07-03-SUMMARY.md`
- [x] 07-04: Context menus (items / folders / tags) — see `phases/07-selection-interaction/07-04-SUMMARY.md`
- [x] 07-05: Batch operations — delete + add-tag + add-to-folder (atomic main-side IPC) — see `phases/07-selection-interaction/07-05-SUMMARY.md`
- [x] 07-06: Batch rename (full find/replace + pattern: {n}/{name}/{ext}) — see `phases/07-selection-interaction/07-06-SUMMARY.md`
- [x] 07-07: Editable multi-item inspector (aggregate header + batch rating/tags/folders, common-value intersection) — see `phases/07-selection-interaction/07-07-SUMMARY.md`

### Phase 8: Organize power features
**Goal:** The heavier backend work — smart folders / saved searches (persisted,
re-runnable `SearchCriteria`), color extraction (worker) + color search, and find
duplicates (content hashing). Scans run in workers, non-blocking.
**Depends on:** Phase 4 search/data layer; Phase 7 (UI surfaces to invoke from)
**Research:** Likely (color quantization/search, perceptual vs exact hashing)
**Status:** In Progress (08-01 ✓, 08-02 ✓; 08-03 color search planned 2026-06-26; 08-04 TBD)
**Decisions:** smart folders reuse the existing smart_folders table (no schema change, no deps);
color extraction uses a NO-dep custom quantizer over sharp pixels with NO worker (sharp decode is
off-thread), reusing the pre-existing items.palette column; color extraction and color SEARCH split
into separate slices.
**Plans:** (independent vertical slices)
- [x] 08-01: Saved searches / smart folders (persist SearchCriteria in the existing smart_folders table; sidebar section + click-to-apply + rename/delete; reuses items:search, no schema change, no deps) — see `phases/08-organize-power/08-01-SUMMARY.md`
- [x] 08-02: Color extraction + backfill + inspector swatches (no-dep quantizer on sharp pixels; stores #rrggbb JSON in items.palette; no worker, no schema change) — see `phases/08-organize-power/08-02-SUMMARY.md`
- [ ] 08-03: Color SEARCH (nearest-color filter over stored palettes + SearchCriteria + color picker) — planned 2026-06-26, see `phases/08-organize-power/08-03-PLAN.md`
- [ ] 08-04: Find duplicates (content hashing) — TBD

### Phase 8.1: UI polish & Inter [INSERTED 2026-06-24]
**Goal:** A design-system refresh — bundle the **Inter** typeface and refine the look across the app:
typography & spacing scale, dark/light color & contrast tokens, and component density/layout (sidebar,
toolbar, grid cards, inspector). Pure front-end polish; no backend/IPC/schema change.
**Why inserted:** User-requested mid-Phase-8 (font swap + UI polish). It's design-system work (Phase-5
lineage), not "organize power features", so it's a decimal insertion with its own commit
(`feat(8.1-ui-polish): …`) rather than folded into the Phase-8 bundle.
**Depends on:** Phase 5 design tokens (extends `--font-*` / `--color-*` / `--space-*`); touches all UI.
**Research:** Unlikely (centralized tokens; @fontsource/inter is well-known).
**Decisions:** bundle Inter via the `@fontsource/inter` npm package (self-hosted woff2, CSP/offline-safe
— no CDN; `default-src 'self'` covers fonts); `--font-sans = 'Inter', system-ui, sans-serif`. Typography
is centralized (one `--font-sans` token in styles/tokens.css applied in styles/base.css), so the swap is
one token + the @fontsource import in the renderer entry; the rest is token/component refinement.
**Status:** ✅ Complete (2026-06-26) — see `phases/08.1-ui-polish/08.1-01-SUMMARY.md`, `08.1-02-SUMMARY.md`; committed `feat(8.1-ui-polish)`
**Outcome note:** 8.1-02 landed an Eagle "flat near-black" dark palette (near-uniform panes, neutral-grey selection with blue accent reserved for grid tiles, restrained radii md=6/lg=10) — a human-verify reinterpretation of the plan's suggested layered-grey/8–12px values. Added `--shadow-3` + `--ring` + accent `:focus-visible` ring.
**Plans:** (each ended at a visual human-verify checkpoint)
- [x] 8.1-01: Inter bundling (@fontsource/inter) + typography & spacing scale (token + entry only) — see `phases/08.1-ui-polish/08.1-01-SUMMARY.md`
- [x] 8.1-02: "Refined dark, Eagle-like" restyle — color/contrast token refresh + component density/layout polish (cards/sidebar/toolbar/menus/modal) + focus ring — see `phases/08.1-ui-polish/08.1-02-SUMMARY.md`

### Phase 9: Browser-extension collecting
**Goal:** External capture surface — a companion browser extension plus a local receiver
endpoint that sends images/URLs into the active library.
**Depends on:** Phase 2 import pipeline; a running app to receive
**Research:** Likely (extension ↔ desktop local-endpoint handshake, security)
**Status:** Not started
**Plans:** TBD (defined during `/paul:plan`)

> Optional descope: V1 could ship at Phases 5–7 and defer 8–9 to a V1.1 if timeline
> pressure appears. Kept as one milestone per the milestone discussion (2026-06-24).

---
*Roadmap created: 2026-06-23*
*Last updated: 2026-06-26 — Inserted Phase 8.1 (UI polish & Inter) ✅ complete + committed (feat(8.1-ui-polish)); resume Phase 8 at 08-03 (color search)*
