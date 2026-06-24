---
phase: 05-design-system-shell
plan: 03
subsystem: ui
tags: [react, electron, css-tokens, layout, shell, search, theming]

# Dependency graph
requires:
  - phase: 05-01
    provides: design tokens (--color-*, --space-*, --radius-*, --toolbar-h) + ThemeProvider/useTheme
  - phase: 05-02
    provides: chrome-less TitleBar frame the shell sits under
provides:
  - AppShell three-pane primitive (resizable/collapsible, localStorage-persisted)
  - Recomposed LibraryGate rendering into the shell + full-bleed App
  - Modern search/filter toolbar (Type dropdown + Filters popover)
  - Token-skinned FolderTree / Inspector / SearchBar / ImportZone / Grid
affects: [06-grid-content-area, 07-selection-interaction, 08-organize-power, 05-04-settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentational shell primitive owns pane width/scroll/collapse; pages inject content via props"
    - "UI prefs persisted to localStorage under imgman.shell.* (mirrors the theme pref pattern)"
    - "Dropdown/popover menus: single-open state + outside-click/Escape close"

key-files:
  created:
    - src/renderer/src/components/AppShell.tsx
    - src/renderer/src/components/AppShell.css
    - src/renderer/src/components/ThemeToggle.tsx
    - src/renderer/src/SearchBar.css
  modified:
    - src/renderer/src/LibraryGate.tsx
    - src/renderer/src/App.tsx
    - src/renderer/src/FolderTree.tsx
    - src/renderer/src/Inspector.tsx
    - src/renderer/src/SearchBar.tsx
    - src/renderer/src/ImportZone.tsx
    - src/renderer/src/Grid.tsx

key-decisions:
  - "Pane collapse toggles live in per-pane headers; toolbar shows an expand button only when that pane is collapsed"
  - "Advanced filters (format/rating/date) moved into a Filters popover; type filters into a Type dropdown — keeps the toolbar single-row + overflow-proof"
  - "ThemeToggle parked in a pinned sidebar footer (temporary home until Settings, 05-04)"

patterns-established:
  - "Shell pane = flex column (slim header + scrollable body)"
  - "Toolbar grows (min-height) and its filter row wraps instead of horizontal-scrolling"

# Metrics
duration: ~1 session
started: 2026-06-24
completed: 2026-06-24
---

# Phase 5 Plan 03: Three-pane app shell layout — Summary

**Replaced the v0.1 padded vertical stack with a resizable/collapsible Eagle three-pane shell (sidebar · center toolbar+grid · inspector), token-skinned the in-pane components, and — at the human-verify checkpoint — modernized the search/filter toolbar and relocated the pane toggles and theme control.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~1 session |
| Started | 2026-06-24 |
| Completed | 2026-06-24 |
| Tasks | 4 of 4 (3 auto + 1 human-verify) |
| Files modified | 11 (4 created, 7 modified) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Three-pane shell replaces the stack | Pass | AppShell renders sidebar/center/inspector under the title bar; old "IMGMAN" heading / version footer / calc(100vh-…) hack removed; token colors throughout. |
| AC-2: Panes resize + collapse, state persists | Pass | Splitters clamp (sidebar 180–420, inspector 240–560); collapse toggles work; widths + collapsed flags persist to localStorage `imgman.shell.*`. Toggles were relocated into pane headers (deviation) — behavior unchanged. |
| AC-3: All existing functionality works | Pass | Folder filter, search, import, selection→inspector, rating/tags/folders edits, Space/Esc preview — verified at checkpoint by user. |
| AC-4: In-pane components theme-coherent | Pass | FolderTree/Inspector/SearchBar/ImportZone/Grid token-skinned; selection uses the accent token; star-yellow (#f5b301) + status-green (#16a34a) kept as intentional affordance colors. |
| AC-5: No-library welcome still works | Pass | Themed centered welcome with Create/Open/recents, outside the shell. |
| AC-6: No regressions | Pass | `npm run typecheck` (node+web) and `npm run build` both clean. |

## Accomplishments

- Shipped the `AppShell` three-pane primitive: resizable splitters, collapsible sidebar/inspector, localStorage-persisted widths + collapsed state, presentational (no app state inside).
- Recomposed `LibraryGate` into the shell and made `App` full-bleed under the TitleBar — all v0.1 state/handlers/IPC preserved (render-only change).
- Modernized the toolbar into a compact, overflow-proof bar: rounded search field (icon + inline clear), a **Type** dropdown and a **Filters** popover (both with active-count badges, single-open, outside-click/Esc close), and a Clear-all.

## Task Commits

Not committed per-task. Per the project's established convention (STATE → Git State: "per-phase commits directly on main"), all Phase 5 work (05-01, 05-02, 05-03) remains staged in the working tree and will be committed as one `feat(05-design-system-shell): …` commit at the phase transition (after 05-04).

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Task 1: AppShell primitive | (deferred to phase commit) | feat | Resizable/collapsible three-pane shell + AppShell.css |
| Task 2: Recompose LibraryGate / App / ThemeToggle | (deferred) | feat | Shell composition, full-bleed App, extracted ThemeToggle |
| Task 3: Token re-skin pass | (deferred) | feat | FolderTree/Inspector/SearchBar/ImportZone/Grid → tokens |
| Task 4: Human-verify + refinements | (deferred) | feat | Modern toolbar, relocated toggles, sidebar theme toggle |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `components/AppShell.tsx` | Created | Three-pane shell: splitters, collapse, persistence, pane-header toggles |
| `components/AppShell.css` | Created | Structural/cursor/hover rules; pane header/body; wrap-friendly toolbar |
| `components/ThemeToggle.tsx` | Created | Temporary theme cycler (dark→light→system); now full-width in sidebar footer |
| `SearchBar.css` | Created | Search field, Type dropdown menu, Filters popover, chips/badges styling |
| `LibraryGate.tsx` | Modified | Renders into AppShell; theme toggle → sidebar footer; toolbar = SearchBar only |
| `App.tsx` | Modified | Full-height column = TitleBar + full-bleed LibraryGate; removed heading/footer |
| `SearchBar.tsx` | Modified | Rewritten as modern bar (Type dropdown + Filters popover) |
| `FolderTree.tsx` | Modified | Token re-skin; fills shell sidebar width |
| `Inspector.tsx` | Modified | Token re-skin; fills shell inspector pane |
| `ImportZone.tsx` | Modified | Token re-skin; slimmed to a strip above the grid |
| `Grid.tsx` | Modified | Token re-skin of tile/selection/placeholder chrome |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Collapse toggles in per-pane headers; toolbar shows expand button only when collapsed | User request; keeps the collapse control with the pane while staying reachable when collapsed | New `.shell__pane-header`/`.shell__pane-body`; sidebar/inspector became flex columns |
| Type filters → dropdown; advanced filters → popover | User request "make more modern"; also makes the toolbar single-row and overflow-proof | New SearchBar.css; single-open-menu pattern reusable for future toolbars |
| ThemeToggle in sidebar footer (not toolbar) | User request; toolbar reserved for search | Temporary — Settings (05-04) is its final home |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Toolbar overflow (essential) |
| Scope additions | 3 | User-directed UX polish at checkpoint |
| Deferred | 0 | — |

**Total impact:** Plan's "layout + theming only" scope was intentionally exceeded by user direction during the human-verify checkpoint (toolbar modernization, toggle relocation, theme-toggle move). All within `SearchBar`/`AppShell`/`LibraryGate`; no IPC/main/schema touched; all reverified (typecheck+build clean).

### Auto-fixed Issues

**1. [Layout] Search/filter toolbar showed a horizontal scrollbar when narrow**
- **Found during:** Task 4 (human-verify checkpoint)
- **Issue:** The filter row used `overflowX: auto` + `nowrap`; base.css's themed 12px scrollbar rendered an ugly bar inside the 44px toolbar.
- **Fix:** Toolbar now `min-height` (grows) and the filter row wraps; superseded shortly after by moving advanced filters into a popover and types into a dropdown, so the bar stays single-row at normal widths.
- **Files:** `SearchBar.tsx`, `SearchBar.css`, `components/AppShell.css`
- **Verification:** typecheck + build clean; user approved at checkpoint.

### Scope Additions (user-directed at checkpoint)

1. **Modern search bar** — rounded search field (icon + inline clear), **Type** dropdown (checkable menu, count badge), **Filters** popover (format/rating/date, count badge), Clear-all. New `SearchBar.css`.
2. **Relocated pane toggles** — collapse buttons moved from the center toolbar into per-pane headers; toolbar shows an expand button only when a pane is collapsed.
3. **ThemeToggle moved** to a pinned, full-width sidebar footer; center toolbar is now just the SearchBar.

### Deferred Items

None.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Tasks 1–3 were already present in the working tree (applied in a prior session, but STATE.md still showed "ready for APPLY") | Verified the existing code against the plan instead of re-applying; ran typecheck+build (clean); advanced the loop. |

## Next Phase Readiness

**Ready:**
- Three-pane shell + tokens are the stable surface for Phase 6 (masonry grid, size slider, view modes) and Phase 7 (selection/context menus).
- Reusable patterns: presentational shell, `imgman.shell.*` localStorage prefs, single-open dropdown/popover menus.

**Concerns:**
- ThemeToggle is still a temporary control living in the sidebar footer — **Plan 05-04 (Settings screen)** is its intended final home.
- Renderer bundle now ~699 kB (up slightly with the new SearchBar/icons) — still fine for desktop.

**Blockers:**
- None. Phase 5 has one plan remaining (05-04); phase is not yet complete, so no phase transition/commit yet.

---
*Phase: 05-design-system-shell, Plan: 03*
*Completed: 2026-06-24*
