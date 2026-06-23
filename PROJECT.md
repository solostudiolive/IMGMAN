# Asset Manager — Project Plan

> A local-first desktop application for collecting, organizing, searching, and browsing visual assets (images, GIFs, videos, audio, fonts, PDFs). Inspired by [Eagle](https://en.eagle.cool/).

---

## 1. Vision

Build a fast, offline-first "second brain" for design and reference files. Users drag in anything visual, organize it with folders + tags + smart rules, and find it again in under a second through keyword, color, or filter search. Everything is stored locally in a portable library so the user owns their data.

**Core promise:** *Collect → Organize → Search → Browse*, with everything staying smooth even at tens of thousands of items.

---

## 2. Target users

- Designers, illustrators, photographers, motion artists
- UX/UI researchers collecting screenshots and inspiration
- Anyone managing large personal libraries of reference media

---

## 3. Feature scope

Features are split into **MVP** (ship first), **V1**, and **Later** so the project stays buildable.

### Collect
| Feature | Phase |
|---|---|
| Drag & drop files / folders into the app | MVP |
| Paste from clipboard (image data) | MVP |
| Import existing folder (bulk) | MVP |
| Screenshot capture | V1 |
| Browser extension (drag, batch save, right-click save) | Later |
| Save web bookmarks / video links (YouTube, Vimeo) | Later |

### Organize
| Feature | Phase |
|---|---|
| Folders (hierarchical / nested) | MVP |
| Tags (many-to-many) | MVP |
| Star ratings (1–5) | MVP |
| Notes / annotations per item | V1 |
| Smart folders (auto-filter by name, tag, color, format) | V1 |
| Batch rename / batch tag | V1 |
| Find duplicates | Later |
| Auto-tagging / AI tagging | Later |

### Search
| Feature | Phase |
|---|---|
| Keyword search (name, tag, note) | MVP |
| Filter by format / type / rating / date | MVP |
| Color search (find by dominant color) | V1 |
| Saved searches | V1 |
| Reverse / visual / semantic search | Later (AI) |

### Browse
| Feature | Phase |
|---|---|
| Grid / masonry layout (thumbnails) | MVP |
| Detail / inspector panel (metadata) | MVP |
| Spacebar / quick preview | MVP |
| Hover preview for GIF / video / audio | V1 |
| List + waterfall + adjustable layouts | V1 |
| Focus zoom, open in new window | Later |

### Platform / system
| Feature | Phase |
|---|---|
| Cross-platform (Windows + macOS) | MVP |
| Portable local library format | MVP |
| Password / library lock | Later |
| Plugin system (JS/HTML) | Later |
| Cloud-sync friendly storage layout | V1 |

---

## 4. Tech stack

Two viable paths. Eagle itself is built on **Electron**, which is the lower-risk, faster-to-build choice — and it matches a web/JS skill set.

### Recommended: Electron
- **Shell:** Electron (Chromium + Node.js) — cross-platform, huge ecosystem
- **UI:** React + TypeScript + Vite (or Vue if preferred)
- **Styling:** Tailwind CSS
- **Metadata DB:** SQLite via `better-sqlite3` (fast, synchronous, embeddable)
- **Thumbnails / image processing:** `sharp`
- **Video / audio:** `ffmpeg` (via `fluent-ffmpeg`) for thumbnails + duration
- **Color extraction:** `node-vibrant` or a k-means palette extractor
- **Packaging:** `electron-builder` (produces `.exe` / `.dmg`)

### Alternative: Tauri (lighter, faster, smaller binaries)
- **Shell:** Tauri (Rust core + system webview)
- **UI:** same React/Vue + TypeScript front end
- **DB:** SQLite via `rusqlite` or `sqlx`
- **Image/video:** `image` crate + `ffmpeg` sidecar
- **Trade-off:** smaller + faster, but you write some Rust and the ecosystem is younger.

> **Decision:** Start with **Electron** for speed of development. Revisit Tauri only if bundle size / memory becomes a real problem.

---

## 5. Architecture

```
┌──────────────────────────────────────────────┐
│                  Renderer (UI)                 │
│   React + TS  ·  grid, inspector, search bar   │
└───────────────▲────────────────┬───────────────┘
                │   IPC (typed)   │
┌───────────────┴────────────────▼───────────────┐
│                Main process (Node)              │
│  ┌───────────┐ ┌───────────┐ ┌───────────────┐ │
│  │ Library    │ │ Indexer /  │ │ Thumbnail /   │ │
│  │ service    │ │ importer   │ │ media worker  │ │
│  └─────┬─────┘ └─────┬─────┘ └───────┬───────┘ │
└────────┼─────────────┼───────────────┼──────────┘
         ▼             ▼               ▼
   SQLite (meta)   File system     Thumbnail cache
                 (original files)
```

- **Renderer** = pure UI, talks to main only through typed IPC channels.
- **Main process** = owns the library, the database, and the file system.
- **Workers** = heavy jobs (thumbnail generation, color extraction, video probing) run off the main thread to keep the UI smooth.
- **Virtualized grid** (e.g. `react-window` / `react-virtuoso`) so 50k+ thumbnails scroll without lag.

---

## 6. Library format (data on disk)

A self-contained, portable folder — the user can move it, back it up, or put it in a sync folder.

```
MyLibrary.library/
├── metadata.db            # SQLite: items, tags, folders, smart folders
├── settings.json          # library-level settings
├── images/
│   ├── <itemId>/
│   │   ├── original.jpg    # the real file (untouched)
│   │   ├── thumbnail.webp  # generated preview
│   │   └── metadata.json   # per-item record (redundant w/ db for portability)
│   └── ...
└── thumbnails-cache/       # optional global cache
```

**Principles**
- Original files are never modified.
- DB is the fast index; per-item `metadata.json` keeps the library portable/recoverable.
- IDs are stable and unique (UUID or a sortable ID like ULID).

---

## 7. Data model (SQLite)

```sql
CREATE TABLE items (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  ext          TEXT,           -- jpg, png, mp4, gif, mp3, ttf, pdf...
  type         TEXT,           -- image | video | audio | font | doc
  size_bytes   INTEGER,
  width        INTEGER,
  height       INTEGER,
  duration_ms  INTEGER,        -- for video/audio
  palette      TEXT,           -- JSON array of dominant colors
  rating       INTEGER DEFAULT 0,
  source_url   TEXT,           -- where it was collected from
  note         TEXT,
  created_at   INTEGER,
  imported_at  INTEGER
);

CREATE TABLE folders (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  parent_id  TEXT REFERENCES folders(id),
  sort_order INTEGER
);

CREATE TABLE item_folders (
  item_id   TEXT REFERENCES items(id),
  folder_id TEXT REFERENCES folders(id),
  PRIMARY KEY (item_id, folder_id)
);

CREATE TABLE tags (
  id    TEXT PRIMARY KEY,
  name  TEXT UNIQUE NOT NULL,
  color TEXT
);

CREATE TABLE item_tags (
  item_id TEXT REFERENCES items(id),
  tag_id  TEXT REFERENCES tags(id),
  PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE smart_folders (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  rules TEXT   -- JSON: conditions on type/tag/color/rating/date
);

-- Full-text search over name + note + tags
CREATE VIRTUAL TABLE items_fts USING fts5(name, note, content='items');
```

---

## 8. Roadmap / milestones

### Milestone 0 — Setup (week 1)
- Electron + React + TS + Vite skeleton, hot reload working
- Typed IPC layer, SQLite wired up, `electron-builder` producing a test build

### Milestone 1 — MVP "it works" (weeks 2–4)
- Create / open a library
- Drag & drop + clipboard import → file copied, thumbnail generated, row inserted
- Grid view (virtualized) + inspector panel
- Folders + tags + ratings, basic keyword search + format filter
- Spacebar quick preview

### Milestone 2 — V1 polish (weeks 5–8)
- Smart folders + saved searches
- Color extraction + color search
- Hover preview for GIF/video/audio
- Batch rename / batch tag, notes/annotations
- Multiple layouts, settings screen
- App icon, auto-update, signed builds

### Milestone 3 — Differentiators (later)
- Browser extension
- Find duplicates
- Plugin API (JS/HTML)
- AI tagging / semantic + visual search
- Password lock, cloud-sync layout

---

## 9. Performance targets

- Search results render in **< 0.5s** at 50k items
- Grid scroll stays at **60fps** (virtualization + cached thumbnails)
- Import is non-blocking — thumbnails generate in a worker, UI stays responsive
- App cold start **< 2s**

---

## 10. Project structure

```
asset-manager/
├── package.json
├── electron-builder.yml
├── vite.config.ts
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts
│   │   ├── ipc/              # typed IPC handlers
│   │   ├── services/         # library, importer, search
│   │   ├── workers/          # thumbnail, color, media probe
│   │   └── db/               # schema, migrations, queries
│   ├── preload/              # contextBridge API
│   └── renderer/             # React UI
│       ├── components/       # Grid, Inspector, Sidebar, SearchBar
│       ├── hooks/
│       ├── store/            # state (Zustand/Redux)
│       └── pages/
└── resources/                # icons, ffmpeg binaries
```

---

## 11. Risks & decisions to make

- **Storage of originals:** copy into the library (safe, more disk) vs. reference in place (less disk, breaks if files move). *Recommendation: copy by default, offer "reference" mode later.*
- **ffmpeg bundling** increases binary size — decide bundle vs. download-on-first-run.
- **Code signing** (Apple notarization + Windows cert) is needed before distribution; budget time and cost.
- **Naming / branding** and whether this is personal-use or a product to sell.
- **Electron vs Tauri** — locked to Electron for MVP per section 4.

---

## 12. Open questions

- Single library or multiple libraries support at launch?
- Which file types are must-have for MVP (images only, or video/audio/fonts too)?
- Is a browser extension in scope, or desktop-only for now?
- Free/open-source, or commercial with a trial (Eagle's model)?

---

## 13. References

- Eagle (product this is modeled on): https://en.eagle.cool/
- Electron: https://www.electronjs.org/
- Tauri: https://tauri.app/
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3
- sharp (image processing): https://sharp.pixelplumbing.com/
