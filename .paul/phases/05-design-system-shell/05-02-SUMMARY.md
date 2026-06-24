---
phase: 05-design-system-shell
plan: 02
subsystem: ui
tags: [electron, frameless-window, title-bar, ipc, preload, window-controls, react]

requires:
  - phase: 05-design-system-shell (plan 01)
    provides: design tokens (--titlebar-h, --color-*) the title bar styles against
provides:
  - chrome-less window (frame:false on win/linux; titleBarStyle:hidden on macOS)
  - window:* IPC (minimize, toggleMaximize, close, isMaximized) + window:maximizeChanged event
  - preload window bridge + platform string
  - token-based TitleBar React component (drag, double-click-max, live restore icon)
affects: [05-03-shell, 05-04-settings]

tech-stack:
  added: []          # no new runtime dependencies
  patterns:
    - "Window-control IPC resolves the owning window per-call via BrowserWindow.fromWebContents(event.sender)"
    - "main→renderer maximize-state via webContents.send('window:maximizeChanged') + onMaximizeChange unsubscribe (mirrors import.onProgress)"
    - "Component CSS file for non-typeable rules (-webkit-app-region); token-based"
    - "Per-platform window chrome spread into BrowserWindow opts (darwin keeps native traffic lights)"

key-files:
  created:
    - src/main/ipc/window.ts
    - src/renderer/src/components/TitleBar.tsx
    - src/renderer/src/components/TitleBar.css
  modified:
    - src/main/index.ts
    - src/main/ipc/index.ts
    - src/preload/types.ts
    - src/preload/index.ts
    - src/renderer/src/App.tsx

key-decisions:
  - "Custom controls on Windows/Linux; native traffic lights on macOS (no custom mac buttons)"
  - "Dedicated TitleBar.css for -webkit-app-region (React CSSProperties doesn't type it)"
  - "Close-hover uses --color-danger token (not a hard-coded Windows red)"

patterns-established:
  - "Event-style IPC returns an unsubscribe function from the preload wrapper"
  - "First component-scoped CSS file; broader inline-vs-CSS-modules decision deferred to 05-03"

duration: ~30min
started: 2026-06-24
completed: 2026-06-24
---

# Phase 5 Plan 02: Chrome-less custom title bar + window controls — Summary

**The OS window frame is gone: a token-themed custom title bar with working minimize / maximize-restore / close, drag-to-move, double-click-maximize, and a live restore icon — driven by a new typed `window:*` IPC namespace; macOS keeps its native traffic lights.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~30 min |
| Started | 2026-06-24 |
| Completed | 2026-06-24 |
| Tasks | 4 completed (3 auto + 1 human-verify) |
| Files created | 3 |
| Files modified | 5 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Frameless window with themed custom title bar | Pass | No native bar; `--titlebar-h` bar at top, recolors with theme |
| AC-2: Window controls operate the window | Pass | Verified — min/max/close, drag-move, double-click-maximize; controls are `no-drag` |
| AC-3: Maximize/restore state reflected live | Pass | Verified — icon flips on button, double-click, and OS-driven (Win+Up) via `window:maximizeChanged`; initial state from `window:isMaximized` |
| AC-4: macOS path correct (code-verified) | Pass (code) | `titleBarStyle:'hidden'` + inset traffic lights; renderer reserves 72px and renders no custom buttons. Runtime unverified (no macOS env — consistent with project). |
| AC-5: No regressions | Pass | `npm run typecheck` (node+web) + `npm run build` clean; window resizes from edges; existing features intact |

## Accomplishments

- Removed the native frame and gave the renderer full ownership of the window chrome — the borderless frame the three-pane shell (05-03) will sit inside.
- Added a typed `window:*` IPC namespace consistent with existing conventions (invoke/handle for actions, send/on for the maximize event), with the owning window resolved safely per-call from the sender.
- Built a token-themed `<TitleBar>` that adapts to macOS (native traffic lights) vs Windows/Linux (custom controls), with a maximize icon that tracks OS-driven state.

## Task Commits

Not committed individually — per v0.1's **per-phase commit** convention. Plan 05-02's
changes join 05-01 in the working tree, to be included in the single Phase 5 transition
commit (`feat(05-design-system-shell): …`) once 05-03/05-04 land. No commit hashes yet.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/main/ipc/window.ts` | Created | `window:*` handlers; window resolved via `fromWebContents(event.sender)` |
| `src/renderer/src/components/TitleBar.tsx` | Created | Custom title bar: drag region, double-click-maximize, min/max-restore/close, live icon |
| `src/renderer/src/components/TitleBar.css` | Created | `-webkit-app-region` + token styles for the bar/controls |
| `src/main/index.ts` | Modified | Per-platform frame opts (frame:false / titleBarStyle hidden) + maximize/unmaximize → event |
| `src/main/ipc/index.ts` | Modified | Register `registerWindowIpc()` |
| `src/preload/types.ts` | Modified | `IpcApi` gains `platform: string` and the `window` namespace |
| `src/preload/index.ts` | Modified | Implement `platform` + `window.*` (incl. `onMaximizeChange` unsubscribe) |
| `src/renderer/src/App.tsx` | Modified | Render `<TitleBar>` atop a full-height column; content scrolls below |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Native traffic lights on macOS; custom controls only on Win/Linux | Matches Eagle + OS conventions; avoids reimplementing mac buttons | Renderer branches on `window.api.platform`; reserves 72px on mac |
| Dedicated `TitleBar.css` for `-webkit-app-region` | React's `CSSProperties` doesn't type `WebkitAppRegion`; class-based is clean | First component-scoped CSS file; broader CSS-architecture decision deferred to 05-03 |
| Resolve window per-call via `fromWebContents(event.sender)` | No stale/global window reference; multi-window-safe | Reusable pattern for any future window IPC |
| Close-hover = `--color-danger` token | Stay token-driven instead of a hard-coded Windows red | Themable; works in both themes |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** None — plan executed exactly as written.

### Deferred Items

None.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| React doesn't type `-webkit-app-region` for inline styles | Moved drag/no-drag rules into `TitleBar.css` classes |
| macOS cannot be runtime-verified in this environment | Implemented the documented `titleBarStyle:'hidden'` path; flagged as code-verified only (matches existing "macOS build unverified" project note) |

## Next Phase Readiness

**Ready:**
- Borderless window chrome owned by the renderer; `--titlebar-h` reserved and consumed.
- `window.api.platform` available for any future platform branching.
- App is now a full-height flex column (TitleBar + scrollable content) — a natural seam for
  the 05-03 three-pane shell (sidebar · content · inspector) to replace the padded stack.

**Concerns:**
- macOS title bar/controls remain runtime-unverified (no macOS environment).
- The current content region still hosts the v0.1 vertical stack (heading, temp toggle,
  LibraryGate, footer); `LibraryGate`'s `calc(100vh - 120px)` height hack is now slightly
  off under the bar — harmless, and superseded by the 05-03 shell rebuild.

**Blockers:**
- None.

---
*Phase: 05-design-system-shell, Plan: 02*
*Completed: 2026-06-24*
