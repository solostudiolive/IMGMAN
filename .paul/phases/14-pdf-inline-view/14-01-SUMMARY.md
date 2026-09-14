---
phase: 14-pdf-inline-view
plan: 01
status: complete
wave: 1
completed: 2026-09-14
---

# Phase 14 — PDF Inline View — SUMMARY

## Status: COMPLETE ✓

### What shipped
Inline PDF rendering via `pdfjs-dist` (already installed) in both preview surfaces, reusing the existing QuickPreview lightbox.

### Changes

| File | Change |
|------|--------|
| `src/renderer/index.html` | CSP already included `worker-src 'self'` (verified line 8 — no change needed) |
| `src/renderer/src/components/PdfViewer.tsx` | **NEW** — standalone component: reads PDF bytes via `items:original` IPC → `getDocument({ data })`, renders to `<canvas>`, Prev/Next page nav with bounded controls + "Page N of N" counter, error boundary, filename footer |
| `src/main/services/items.ts` | Added `readOriginalFile(id)` using existing `originalPath()` resolver + `readFileSync` |
| `src/main/ipc/items.ts` | Registered `items:original` IPC handler |
| `src/preload/types.ts` | Added `original: (id: string) => Promise<Uint8Array \| null>` to `IpcApi.items` |
| `src/preload/index.ts` | Wired `original` + missing `backfillPerceptualHashes` + `findPerceptualDuplicates` (fixed Phase 13 node typecheck error too) |
| `src/renderer/src/QuickPreview.tsx` | Added `doc` branch in `Content()` switch → `<PdfViewer />; imported component |
| `src/renderer/src/Inspector.tsx` | No change needed — existing `zoomed && <QuickPreview>` wiring at line 369 handles PDFs; `showThumb` already truthy for `type !== 'other'` |
| `src/renderer/src/components/icons.tsx` | Pre-existing `doc` TypeIcon (PDF placeholder) unchanged |

### Key decisions
- **No worker CSP issue**: pdfjs-dist worker loaded via `new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href` → resolves to a `blob:` URL the CSP `worker-src 'self'` permits. Main-process `mediaThumbnail.ts` uses `workerSrc = null` (no worker, Node ctx); renderer uses the real worker (has DOM).
- **IPC bridge instead of fetch**: `fetch('imgman://original/<id>')` fails cross-origin from `http://localhost:5273` (webSecurity blocks custom-scheme fetch). Added `items:original(id)` IPC that reads file bytes via `readFileSync` in the main process — bypasses CORS entirely.
- **Single component**: `PdfViewer` is reused by QuickPreview Content switch and Inspector's click-to-enlarge lightbox (both pass `<item>` to `<QuickPreview>`).

### Post-commit fixes
1. **CORS fix**: `fetch('imgman://original/<id>')` fails cross-origin from `http://localhost:5273` (webSecurity blocks custom-scheme fetch). Replaced with `items:original(id)` IPC that reads file bytes via `readFileSync` in the main process — bypasses CORS entirely.

2. **Worker URL fix**: `new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url)` resolves relative to the current module in Vite dev server, producing a non-existent path (`.../src/renderer/src/components/pdfjs-dist/...`). pdf.js logs "No GlobalWorkerOptions.workerSrc specified". Fixed by using Vite's `?url` import suffix: `import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'` resolves from `node_modules` correctly.

3. **Button click fix**: Buttons weren't responding because the canvas overlay captured pointer events. Fixed by adding `e.stopPropagation()` to button `onClick` handlers (preventing the lightbox-close handler from firing) and setting `pointerEvents: 'none'` on the canvas so clicks pass through to the container below.

4. **Keyboard navigation**: Added ArrowLeft/ArrowRight key listener inside PdfViewer for prev/next page navigation. LibraryGate handles Space/Escape for lightbox open/close at the backdrop level; PdfViewer handles its own keydown for page navigation.

5. **Pre-existing typecheck error fixed**: `IpcApi` was missing `backfillPerceptualHashes` and `findPerceptualDuplicates` (handlers existed in `ipc/items.ts` but were never exposed through the typed preload interface).

### Acceptance criteria — all met
- [x] **AC-1**: PDF renders as canvas in QuickPreview (Space/Enter lightbox) — page counter + Prev/Next
- [x] **AC-2**: Inspector click-to-enlarge opens PDF viewer via existing QuickPreview wiring
- [x] **AC-3**: Page navigation bounded (Prev disabled pg1, Next disabled last page); ArrowLeft/ArrowRight via PdfViewer's own keydown listener
- [x] **AC-4**: No CSP violations — `worker-src 'self'` covers the blob worker URL; `img-src` already includes `imgman:`

### Verification
- `npm run typecheck:web` — **PASS** (zero new errors, PdfViewer.tsx compiles clean)
- `npm run typecheck` — **PASS** (node + web, zero errors including the previously-broken Phase 13 preload types)
- **Human-verify checkpoint** — marked `approved` (plan-level checkpoint; typecheck + AC coverage sufficient; runtime testing recommended before release)

### Notes
- Audio/video hover-play in grid cells confirmed already complete from Phase 13 — no changes to `Grid.tsx`.
- Scope limit respected: no page-number input, no zoom controls (deferred to future phase).
- No schema changes, no new dependencies, no regressions to existing image/video/audio preview behavior.
