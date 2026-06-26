-- IMGMAN metadata schema (root PROJECT.md §7).
-- Applied idempotently on every launch: CREATE ... IF NOT EXISTS makes
-- re-running a no-op. Bump user_version for future structural migrations.

CREATE TABLE IF NOT EXISTS items (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  ext          TEXT,           -- jpg, png, mp4, gif, mp3, ttf, pdf...
  type         TEXT,           -- image | video | audio | font | doc
  size_bytes   INTEGER,
  width        INTEGER,
  height       INTEGER,
  duration_ms  INTEGER,        -- for video/audio
  palette      TEXT,           -- JSON array of dominant colors
  content_hash TEXT,           -- SHA-256 hex of original bytes (duplicate detection)
  rating       INTEGER DEFAULT 0,
  source_url   TEXT,           -- where it was collected from
  note         TEXT,
  created_at   INTEGER,
  imported_at  INTEGER
);

CREATE TABLE IF NOT EXISTS folders (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  parent_id  TEXT REFERENCES folders(id),
  sort_order INTEGER
);

CREATE TABLE IF NOT EXISTS item_folders (
  item_id   TEXT REFERENCES items(id),
  folder_id TEXT REFERENCES folders(id),
  PRIMARY KEY (item_id, folder_id)
);

CREATE TABLE IF NOT EXISTS tags (
  id    TEXT PRIMARY KEY,
  name  TEXT UNIQUE NOT NULL,
  color TEXT
);

CREATE TABLE IF NOT EXISTS item_tags (
  item_id TEXT REFERENCES items(id),
  tag_id  TEXT REFERENCES tags(id),
  PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE IF NOT EXISTS smart_folders (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  rules TEXT   -- JSON: conditions on type/tag/color/rating/date
);

-- Full-text search over name + note (external-content table backed by items).
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(name, note, content='items', content_rowid='rowid');
