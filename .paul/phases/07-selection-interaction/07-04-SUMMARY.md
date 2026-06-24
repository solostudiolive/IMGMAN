---
phase: 07-selection-interaction
plan: 04
subsystem: ui
tags: [react, context-menu, portal, right-click, selection, folders, tags]

# Dependency graph
requires:
  - phase: 07-01
    provides: useSelection.handleSelect (right-click selects the clicked item before the menu opens)
  - phase: 07-03
    provides: Grid cell [data-item-id] + background pointer handler (left-button only, so right-click never starts a marquee)
provides:
  - ContextMenu primitive (portal, cursor-positioned, viewport-flip, dismiss on Escape/outside/scroll; action/submenu/separator nodes)
  - Item context menu (grid/masonry/list) — Quick preview · Rating ▸ · Add to folder ▸ on the single right-clicked item
  - Folder context menu (New subfolder/Rename/Delete + New folder on All items)
  - Tag-chip context menu (Remove from item)
  - Grid onItemContextMenu(id, x, y) prop on every cell renderer
affects: [07-05-batch-ops, 07-06-multi-item-inspector]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single reusable ContextMenu via createPortal(document.body); position:fixed at clientX/clientY with useLayoutEffect viewport-flip; one-level submenu flyout reuses the same MenuPanel"
    - "Each surface (LibraryGate/FolderTree/TagEditor) owns its own {x,y,items}|null menu state; ContextMenu is presentational (MenuNode tree + onClose)"
    - "ContextMenu swallows Escape (capture + stopPropagation) so it dismisses without reaching the global grid key handler (05-04 keyboard-ownership pattern)"

key-files:
  created:
    - src/renderer/src/components/ContextMenu.tsx
    - src/renderer/src/components/ContextMenu.css
  modified:
    - src/renderer/src/Grid.tsx
    - src/renderer/src/LibraryGate.tsx
    - src/renderer/src/FolderTree.tsx
    - src/renderer/src/TagEditor.tsx

key-decisions:
  - "Item-menu actions act on the SINGLE right-clicked item via existing single-item IPC (items.update, folders.assign); multi-item batch + items:delete deferred to 07-05"
  - "Tags menu = Remove from item only (no tag rename/delete IPC exists)"
  - "Menu rendered through a portal to escape the three-pane/scroller overflow clipping"

patterns-established:
  - "MenuNode = action | submenu(one level) | separator; reuse ContextMenu on any surface by holding {x,y,items}|null state and an onContextMenu handler"

# Metrics
duration: ~1 session
started: 2026-06-24
completed: 2026-06-24
---

# Phase 7 Plan 04: Context menus — Summary

**Right-click context menus across three surfaces — grid/masonry/list items (Quick preview · Rating ▸ · Add to folder ▸), sidebar folders (New subfolder/Rename/Delete), and inspector tag chips (Remove from item) — all powered by one reusable, token-styled, portal-rendered `ContextMenu` primitive that positions at the cursor, flips to stay on screen, and dismisses on Escape / outside-click / scroll. Renderer-only, reusing existing single-item IPC.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~1 session |
| Started | 2026-06-24 |
| Completed | 2026-06-24 |
| Tasks | 4 of 4 (3 auto + 1 human-verify) |
| Files | 2 created, 4 modified (renderer only) |
| Renderer bundle | ~785 kB (59 modules, +2 vs 07-03) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Item context menu (grid/masonry/list) | Pass | Right-click selects the item + opens menu at cursor; Rating ▸ updates the grid star (items.update → reloadItems); Add to folder ▸ assigns (folders.assign); Quick preview opens. Native menu suppressed. Human-verified in all three modes. |
| AC-2: Folder + tag-chip menus | Pass | Folder row → New subfolder/Rename/Delete via existing FolderTree handlers (items never deleted); "All items" → New folder; tag chip → Remove from item (tags.remove). Human-verified. |
| AC-3: Positioning / dismissal / no interference | Pass | Portal + viewport-flip keeps it on screen; closes on Escape (selection preserved) / outside-click / scroll; left-click select, marquee (07-03), keyboard nav (07-02) all unaffected. Human-verified. |
| AC-4: No regressions | Pass | `npm run typecheck` (node + web) + `npm run build` clean; no main/preload/IPC/SQL files modified; no new dependency. |

## Accomplishments

- Delivered a single reusable ContextMenu primitive (action/submenu/separator nodes) now powering three independent surfaces — the menu infrastructure for the rest of Phase 7.
- Wired item / folder / tag-chip right-click menus to operations that already exist, with zero backend change.
- Preserved all prior selection gestures (click, marquee, keyboard) — right-click is purely additive.

## Task Commits

Committed together with all of Phase 7 at the phase transition (per the per-phase commit convention — Phase 7 not yet complete; 07-05/06 remain).

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Task 1: ContextMenu primitive + CSS | (deferred to phase commit) | feat | Portal menu, viewport-flip, dismissal, submenu flyout |
| Task 2: Grid reporting + LibraryGate item menu | (deferred to phase commit) | feat | onItemContextMenu on all cells; Quick preview/Rating ▸/Add to folder ▸ |
| Task 3: Folder menu + tag-chip menu | (deferred to phase commit) | feat | FolderTree + TagEditor right-click menus |
| Task 4: Human-verify | (deferred to phase commit) | — | Approved |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `components/ContextMenu.tsx` | Created | Reusable menu: MenuNode tree, portal, position:fixed + flip, Escape/outside/scroll dismissal, one-level submenu flyout |
| `components/ContextMenu.css` | Created | Token-driven menu styling (bg-elevated, border, shadow-2, surface-hover, danger, separators) |
| `Grid.tsx` | Modified | `onItemContextMenu?(id,x,y)` prop threaded to grid `Cell`, masonry context, and `ListRow`; `onContextMenu` (preventDefault + report) on each cell button |
| `LibraryGate.tsx` | Modified | `itemMenu` state + async `openItemMenu` (selects item, fetches folders, builds nodes); passes `onItemContextMenu`; renders `<ContextMenu>` |
| `FolderTree.tsx` | Modified | Right-click folder row → New subfolder/Rename/Delete; "All items" → New folder; renders `<ContextMenu>` (existing icon buttons kept) |
| `TagEditor.tsx` | Modified | Right-click tag chip → Remove from item; renders `<ContextMenu>` (legacy chip styling untouched) |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Single-item actions only | Keeps 07-04 renderer-only; multi-item batch + items:delete are 07-05's job | Clean 07-04/07-05 boundary; no half-built batch |
| Portal to document.body | Three-pane panes/scroller would clip an in-flow menu | Menu always renders above and on-screen |
| Tags menu = remove-from-item only | No tag rename/delete IPC exists | Honors "tags" menu intent without new IPC |
| Keep FolderTree icon buttons | Right-click menu is additive, lower risk than replacing them | No regression to existing folder UX |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 1 | Trivial — a plan-sanctioned option |
| Deferred | 0 | — |

**Total impact:** Executed as written. The one addition (a "New folder" entry on the "All items" root row) was explicitly offered as optional in the plan ("Optionally also a 'New folder' menu on the All items root row").

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- ContextMenu + the per-surface `{x,y,items}|null` pattern are in place. 07-05 extends the item menu with multi-item batch actions (and a Delete entry) once `items:delete` + batch IPC exist; 07-06 multi-item inspector reads the same selection.

**Concerns:**
- Submenu flyout is one level and opens on hover (no arrow-key navigation in menus) — sufficient for now; keyboard menu nav deferred.
- 60fps @ 50k still unmeasured.

**Blockers:**
- None.

---
*Phase: 07-selection-interaction, Plan: 04*
*Completed: 2026-06-24*
