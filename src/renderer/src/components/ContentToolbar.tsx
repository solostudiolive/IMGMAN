import {
  THUMB_MAX,
  THUMB_MIN,
  type SortDir,
  type SortField,
  type ViewMode
} from '../hooks/useGridView'
import './ContentToolbar.css'

// Content-area view bar (Phase 6). Presentational/controlled: LibraryGate owns the
// view-state via useGridView and passes it down. Holds the sort control (field + asc/desc)
// and the thumbnail-size slider. View-mode switching (grid/masonry/list) is added by 06-02
// in the gap on the right — this row intentionally leaves room for it.

// Labels carry the "Sort:" prefix so the dropdown is self-describing — the standalone "Sort"
// label is dropped to save toolbar width (the word now lives inside the control).
const SORT_OPTIONS: ReadonlyArray<{ value: SortField; label: string }> = [
  { value: 'imported', label: 'Sort: Imported' },
  { value: 'created', label: 'Sort: Date created' },
  { value: 'name', label: 'Sort: Name' },
  { value: 'rating', label: 'Sort: Rating' },
  { value: 'size', label: 'Sort: Size' }
]

export default function ContentToolbar({
  thumbSize,
  sortField,
  sortDir,
  viewMode,
  selectedCount = 0,
  onThumbSize,
  onSortField,
  onSortDir,
  onViewMode
}: {
  thumbSize: number
  sortField: SortField
  sortDir: SortDir
  viewMode: ViewMode
  selectedCount?: number
  onThumbSize: (n: number) => void
  onSortField: (f: SortField) => void
  onSortDir: (d: SortDir) => void
  onViewMode: (m: ViewMode) => void
}): React.JSX.Element {
  return (
    <div className="content-toolbar">
      <div className="content-toolbar__group">
        <select
          id="grid-sort"
          className="content-toolbar__select"
          aria-label="Sort"
          value={sortField}
          onChange={(e) => onSortField(e.target.value as SortField)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="content-toolbar__dir"
          aria-label="Sort direction"
          title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          onClick={() => onSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {selectedCount > 1 && (
        <span className="content-toolbar__count">{selectedCount} selected</span>
      )}

      <div className="content-toolbar__group content-toolbar__group--end">
        <div className="content-toolbar__viewmode" role="group" aria-label="View mode">
          <button
            type="button"
            className={`content-toolbar__viewbtn${viewMode === 'grid' ? ' content-toolbar__viewbtn--on' : ''}`}
            aria-pressed={viewMode === 'grid'}
            title="Grid"
            onClick={() => onViewMode('grid')}
          >
            <GridGlyph />
          </button>
          <button
            type="button"
            className={`content-toolbar__viewbtn${viewMode === 'masonry' ? ' content-toolbar__viewbtn--on' : ''}`}
            aria-pressed={viewMode === 'masonry'}
            title="Masonry"
            onClick={() => onViewMode('masonry')}
          >
            <MasonryGlyph />
          </button>
          <button
            type="button"
            className={`content-toolbar__viewbtn${viewMode === 'list' ? ' content-toolbar__viewbtn--on' : ''}`}
            aria-pressed={viewMode === 'list'}
            title="List"
            onClick={() => onViewMode('list')}
          >
            <ListGlyph />
          </button>
        </div>
        <SizeGlyph />
        <input
          className="content-toolbar__slider"
          type="range"
          min={THUMB_MIN}
          max={THUMB_MAX}
          value={thumbSize}
          aria-label="Thumbnail size"
          title="Thumbnail size"
          onChange={(e) => onThumbSize(Number(e.target.value))}
        />
      </div>
    </div>
  )
}

function SizeGlyph(): React.JSX.Element {
  return (
    <svg
      className="content-toolbar__glyph"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function GridGlyph(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

// Two columns of unequal-height tiles → the waterfall idea.
function MasonryGlyph(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="10" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="11" width="7" height="10" rx="1.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

// A small thumb + lines per row → the details-list idea.
function ListGlyph(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="15" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="2" />
      <line x1="11" y1="6.5" x2="21" y2="6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="11" y1="17.5" x2="21" y2="17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
