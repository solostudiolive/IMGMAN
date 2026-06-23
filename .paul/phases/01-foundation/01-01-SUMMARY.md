---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [electron, electron-vite, react, typescript, vite, better-sqlite3, sqlite, ipc, electron-builder]

requires: []
provides:
  - Runnable Electron + React + TS skeleton with HMR
  - Typed IPC bridge (window.api) renderer↔main
  - SQLite metadata DB with idempotent schema (items/folders/tags/smart_folders/items_fts)
  - electron-builder Windows packaging with native module rebuilt for Electron ABI
affects: [02-library-import, 03-browse, 04-organize-search]

tech-stack:
  added: [electron@42, electron-vite@5, vite@7, "@vitejs/plugin-react@5", react@19, better-sqlite3@12, electron-builder@26, "@electron/rebuild@4"]
  patterns:
    - "Typed IPC via contextBridge invoke/handle (no nodeIntegration/remote)"
    - "SQL schema imported as ?raw and inlined into the main bundle"
    - "DB singleton (initDatabase/getDb/closeDatabase) opened on app ready"

key-files:
  created:
    - src/main/index.ts
    - src/main/db/index.ts
    - src/main/db/schema.sql
    - src/main/ipc/index.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
    - src/renderer/src/App.tsx
    - electron.vite.config.ts
    - electron-builder.yml
  modified:
    - package.json

key-decisions:
  - "Pin vite ^7 + @vitejs/plugin-react ^5 (electron-vite 5 caps vite at 7; plugin-react 6 needs vite 8)"
  - "Inline schema.sql via Vite ?raw so it ships in the bundle (no asset copy)"
  - "postinstall downloads Electron binary + install-app-deps (npm 11 skips dep install scripts)"

patterns-established:
  - "main / preload / renderer separation per electron-vite"
  - "All IPC channels registered centrally in src/main/ipc/index.ts with matching typed wrappers in preload"

duration: ~30min
started: 2026-06-23T14:50:00+06:00
completed: 2026-06-23T15:22:33+06:00
---

# Phase 1 Plan 01: Foundation & skeleton — Summary

**A runnable IMGMAN desktop skeleton: Electron + React + TS with HMR, a typed IPC bridge, an embedded SQLite DB that self-initializes its schema, and an electron-builder Windows installer with better-sqlite3 rebuilt for the Electron ABI.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~30 min |
| Started | 2026-06-23T14:50+06:00 |
| Completed | 2026-06-23T15:22+06:00 |
| Tasks | 3 auto + 1 checkpoint (approved) |
| Files modified | 16 created/modified |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: App launches with hot reload | Pass | `npm run dev` opens window; HMR confirmed by editing App.tsx |
| AC-2: Typed IPC round-trips | Pass | UI shows version `0.0.1` + `pong` via window.api; contextIsolation on, nodeIntegration off |
| AC-3: SQLite initializes schema on first run | Pass | metadata.db created in userData; schema applied via CREATE IF NOT EXISTS (idempotent) |
| AC-4: Production build produced | Pass | `dist/IMGMAN Setup 0.0.1.exe` (99.8 MB) + win-unpacked; better_sqlite3.node unpacked & rebuilt for Electron 42.4.1 |

## Accomplishments

- Stood up the full main/preload/renderer architecture (PROJECT.md §10) with working HMR.
- Established the typed IPC contract that every later feature (import, search, library) will extend.
- Wired better-sqlite3 with WAL + foreign_keys and the complete §7 schema, applied idempotently on launch.
- Produced a signed-by-default NSIS installer with the native module correctly unpacked from asar.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `package.json` | Created | Deps, scripts (dev/build/typecheck/rebuild), postinstall |
| `electron.vite.config.ts` | Created | electron-vite build config (externalize native deps, React renderer) |
| `electron-builder.yml` | Created | Windows packaging, asarUnpack better-sqlite3 |
| `tsconfig.json` / `tsconfig.node.json` / `tsconfig.web.json` | Created | Split node/web type-check configs |
| `src/main/index.ts` | Created | App lifecycle, secure BrowserWindow, dev/prod load |
| `src/main/ipc/index.ts` | Created | Central IPC handler registry (getVersion, ping) |
| `src/main/db/index.ts` | Created | DB singleton + idempotent migration runner |
| `src/main/db/schema.sql` | Created | §7 schema (items/folders/tags/smart_folders/items_fts) |
| `src/main/env.d.ts` | Created | `*.sql?raw` module declaration |
| `src/preload/index.ts` + `index.d.ts` | Created | contextBridge `window.api` + its types |
| `src/renderer/index.html` + `src/renderer/src/*` | Created | React entry, App, env.d.ts, CSP |
| `.gitignore` | Created | Ignore node_modules/out/dist/*.db |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Pin vite ^7 + plugin-react ^5 | electron-vite 5 peer-caps vite at 7; plugin-react 6 needs vite 8 | Constrains future vite/plugin major upgrades |
| Inline schema via `?raw` | Avoids copying schema.sql into the packaged app | Schema edits require a rebuild |
| postinstall fetches Electron binary | npm 11 silently skipped dependency install scripts | Fresh `npm install` now yields a working `npm run dev` |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 2 | Build/install reliability; no scope change |
| Scope additions | 0 | — |
| Deferred | 0 | — |

### Auto-fixed Issues

**1. [Build] Peer-dependency conflict on first install**
- **Found during:** Task 1 (npm install)
- **Issue:** `@vitejs/plugin-react@6` requires Vite 8, incompatible with electron-vite 5 (Vite ≤7).
- **Fix:** Pinned `@vitejs/plugin-react@^5.2.0` (supports Vite 7).
- **Verification:** `npm install` succeeded; typecheck + build pass.

**2. [Infra] Electron binary not downloaded (npm 11 skipped install scripts)**
- **Found during:** Checkpoint verification (`npm run dev` → "Error: Electron uninstall")
- **Issue:** npm 11 gated dependency install scripts, so `node_modules/electron/dist` + `path.txt` were never created.
- **Fix:** Ran `node node_modules/electron/install.js`; added it to `postinstall` so fresh installs self-heal.
- **Verification:** `path.txt` + `electron.exe` present; user confirmed `npm run dev` opens the window.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| "Electron uninstall" on dev start | Downloaded Electron binary + hardened postinstall |
| ERESOLVE peer conflict | Re-pinned plugin-react to v5 |

## Next Phase Readiness

**Ready:**
- Typed IPC boundary + DB singleton are the seams Phase 2 (Library & import) plugs into.
- Schema already includes items/folders/tags — import can write rows immediately.
- Packaging path proven (native module handling solved up front).

**Concerns:**
- DB currently lives in `userData`; Phase 2 must introduce the portable `.library` format and likely relocate/open DBs per-library.
- Open questions still unresolved: single vs multiple libraries, MVP file types, ffmpeg bundling, copy-vs-reference (carried in STATE.md).
- Renderer bundle warning (>500 kB) is benign now; revisit when real UI lands.

**Blockers:** None.

---
*Phase: 01-foundation, Plan: 01*
*Completed: 2026-06-23*
