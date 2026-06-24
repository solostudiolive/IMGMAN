---
phase: 05-design-system-shell
plan: 01
subsystem: ui
tags: [theming, css-tokens, design-system, react-context, electron-renderer, dark-mode]

requires:
  - phase: 04-organize-search
    provides: existing renderer components (App, LibraryGate, Grid, Inspector, FolderTree) to re-skin
provides:
  - CSS custom-property design tokens (semantic, dark default + light)
  - ThemeProvider + useTheme() hook (dark/light/system, persisted, FOUC-safe)
  - global base stylesheet (reset, typography, themed scrollbars)
affects: [05-02-titlebar, 05-03-shell, 05-04-settings, 06-eagle-grid, 07-selection-interaction, 08-organize-power]

tech-stack:
  added: []          # no new runtime dependencies
  patterns:
    - "Semantic CSS custom-property tokens on :root (light) + :root[data-theme='dark'] override"
    - "Theme applied pre-render in main.tsx (CSP forbids inline <head> script) → no FOUC"
    - "Theme preference persisted in localStorage (renderer-owned), source of truth via useTheme()"

key-files:
  created:
    - src/renderer/src/styles/tokens.css
    - src/renderer/src/styles/base.css
    - src/renderer/src/theme/theme.ts
    - src/renderer/src/theme/ThemeProvider.tsx
  modified:
    - src/renderer/src/main.tsx
    - src/renderer/src/App.tsx

key-decisions:
  - "Theme source-of-truth = localStorage (renderer-only), not a main-process settings store"
  - "Dark is the default preference (Eagle's signature look)"
  - "FOUC avoided via a 'self' ES-module call in main.tsx, not an inline script (CSP-safe)"

patterns-established:
  - "Components reference semantic tokens (var(--color-*)), never raw hex"
  - "New theme-aware colors are added as token pairs (light on :root, dark under [data-theme=dark])"

duration: ~30min
started: 2026-06-24
completed: 2026-06-24
---

# Phase 5 Plan 01: Design tokens & theming foundation — Summary

**Renderer-side design-token system with Eagle-matched dark (default) + light palettes, a persistent FOUC-safe ThemeProvider (dark/light/system), and a token-only base stylesheet — the foundation every later Phase 5–9 plan builds against.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~30 min |
| Started | 2026-06-24 |
| Completed | 2026-06-24 |
| Tasks | 4 completed (3 auto + 1 human-verify) |
| Files created | 4 |
| Files modified | 2 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Token system with dark default + light | Pass | `tokens.css` defines every color token on `:root` (light) and `:root[data-theme="dark"]`; default preference resolves to dark |
| AC-2: Theme applied, persisted, FOUC-free | Pass | Verified at checkpoint — light persists across Ctrl+R reload, no dark flash; `localStorage["imgman.theme"]` set |
| AC-3: System preference + live reactivity | Pass | Verified at checkpoint — `system` follows OS color-scheme and updates live via `matchMedia` change listener |
| AC-4: Existing UI re-skinned via tokens (smoke test) | Pass | App heading/footer/toggle use tokens; window bg + scrollbars themed; `npm run typecheck` + `npm run build` clean |

## Accomplishments

- Established the **single source of color/spacing/typography** for the v1.0 redesign as semantic CSS custom properties — Eagle-matched dark default plus a full light override.
- Built a **persistent, system-aware, FOUC-free** theming layer (`ThemeProvider` + `useTheme()`) with no new dependencies and no main-process/IPC changes.
- Proved it end-to-end by re-skinning the App chrome and adding a temporary dark/light/system toggle.

## Task Commits

Not committed individually — this milestone follows v0.1's **per-phase commit** convention
(e.g. `feat(04-organize-search): …`). Plan 05-01's changes remain in the working tree and
will be included in the **Phase 5 transition commit** once the phase's remaining plans
(05-02..05-04) land. No commit hashes to record yet.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/renderer/src/styles/tokens.css` | Created | Semantic design tokens; dark (`[data-theme="dark"]`) + light (`:root`) palettes, spacing/radius/type/layout/motion |
| `src/renderer/src/styles/base.css` | Created | Reset, html/body, typography, themed scrollbars/selection (token-only) |
| `src/renderer/src/theme/theme.ts` | Created | Preference read/write, system detection, resolve/apply, FOUC-safe `applyStoredTheme()`, `watchSystemTheme()` |
| `src/renderer/src/theme/ThemeProvider.tsx` | Created | React context + `useTheme()`; applies/persists, subscribes to OS changes in `system` mode |
| `src/renderer/src/main.tsx` | Modified | Import global styles, call `applyStoredTheme()` before render, wrap `<App/>` in `<ThemeProvider>` |
| `src/renderer/src/App.tsx` | Modified | Top-level chrome converted to tokens + temporary theme toggle (relocates to Settings in 05-04) |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Theme source-of-truth = `localStorage` (renderer only) | Synchronous read → no FOUC; theme is inherently a renderer concern; avoids IPC round-trip on startup | Settings screen (05-04) reads/writes via `useTheme()`; revisit only if app-level settings need main-process persistence |
| Dark is the default preference | Eagle's signature default look | New installs open dark |
| Apply theme from a `'self'` ES module in `main.tsx`, not an inline `<head>` script | Renderer CSP has no `script-src`, so inline scripts are blocked; CSP must not be weakened | No-FOUC achieved without touching CSP |
| Tokens are semantic (role-based), not palette names | One token resolves correctly per theme; components stay theme-agnostic | All later components reference `var(--color-*)`; both themes from one set |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Cosmetic (main.tsx import ordering) |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** None of substance — plan executed as written.

### Auto-fixed Issues

**1. [Cleanup] main.tsx import ordering**
- **Found during:** Task 2 (ThemeProvider wiring)
- **Issue:** Initial draft interleaved `applyStoredTheme()` between import statements.
- **Fix:** Grouped all imports first, then called `applyStoredTheme()` (identical behavior since imports hoist; avoids lint noise).
- **Files:** `src/renderer/src/main.tsx`
- **Verification:** `npm run typecheck` + `npm run build` clean.
- **Commit:** uncommitted (folded into pending Phase 5 commit).

### Deferred Items

None — plan executed exactly as written.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| CSP blocks inline `<head>` script (the usual no-FOUC trick) | Applied theme from `main.tsx` (a `'self'` module) before render instead; CSP untouched |

## Next Phase Readiness

**Ready:**
- Token system + `useTheme()` available for all subsequent plans.
- Layout tokens (`--titlebar-h`, `--sidebar-w`, `--inspector-w`, `--toolbar-h`) pre-reserved for the title bar (05-02) and three-pane shell (05-03).

**Concerns:**
- Child components (Grid, Inspector, FolderTree, SearchBar, etc.) still carry v0.1 inline hex colors — a few greys look out of place on dark until rebuilt in 05-03 / 06 / 07. Expected, in-scope-later (noted at checkpoint), not a bug.
- Renderer bundle ~680 kB (was ~655 kB) — negligible growth from theme code; still fine for desktop.

**Blockers:**
- None.

---
*Phase: 05-design-system-shell, Plan: 01*
*Completed: 2026-06-24*
