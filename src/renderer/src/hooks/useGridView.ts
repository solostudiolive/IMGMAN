import { useCallback, useState } from 'react'
import type { Item } from '../../../preload/types'

// View-state for the content-area grid: thumbnail size + sort. Persisted to
// localStorage so the grid reopens the way the user left it. Sort is applied
// renderer-side (the scoped item list is already fully loaded), so this hook
// owns both the persisted preferences and the comparator the grid sorts with.

export type SortField = 'imported' | 'created' | 'name' | 'rating' | 'size'
export type SortDir = 'asc' | 'desc'
export type ViewMode = 'grid' | 'masonry' | 'list'

export const THUMB_MIN = 96
export const THUMB_MAX = 280
const THUMB_DEFAULT = 140

const SORT_FIELDS: readonly SortField[] = ['imported', 'created', 'name', 'rating', 'size']
const VIEW_MODES: readonly ViewMode[] = ['grid', 'masonry', 'list']

const KEYS = {
  thumbSize: 'imgman.gridview.thumbSize',
  sortField: 'imgman.gridview.sortField',
  sortDir: 'imgman.gridview.sortDir',
  viewMode: 'imgman.gridview.viewMode'
} as const

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* best effort */
  }
}

function readThumb(): number {
  const raw = read(KEYS.thumbSize)
  const n = raw == null ? NaN : Number(raw)
  return Number.isFinite(n) ? clamp(n, THUMB_MIN, THUMB_MAX) : THUMB_DEFAULT
}

function readSortField(): SortField {
  const raw = read(KEYS.sortField)
  return SORT_FIELDS.includes(raw as SortField) ? (raw as SortField) : 'imported'
}

function readSortDir(): SortDir {
  return read(KEYS.sortDir) === 'asc' ? 'asc' : 'desc'
}

function readViewMode(): ViewMode {
  const raw = read(KEYS.viewMode)
  // Default to masonry (Eagle's waterfall look) for first-time users; honor a saved choice.
  return VIEW_MODES.includes(raw as ViewMode) ? (raw as ViewMode) : 'masonry'
}

export interface GridView {
  thumbSize: number
  sortField: SortField
  sortDir: SortDir
  viewMode: ViewMode
  setThumbSize: (n: number) => void
  setSortField: (f: SortField) => void
  setSortDir: (d: SortDir) => void
  setViewMode: (m: ViewMode) => void
}

export function useGridView(): GridView {
  const [thumbSize, setThumbSizeState] = useState(readThumb)
  const [sortField, setSortFieldState] = useState<SortField>(readSortField)
  const [sortDir, setSortDirState] = useState<SortDir>(readSortDir)
  const [viewMode, setViewModeState] = useState<ViewMode>(readViewMode)

  const setThumbSize = useCallback((n: number): void => {
    const v = clamp(Math.round(n), THUMB_MIN, THUMB_MAX)
    setThumbSizeState(v)
    write(KEYS.thumbSize, String(v))
  }, [])

  const setSortField = useCallback((f: SortField): void => {
    setSortFieldState(f)
    write(KEYS.sortField, f)
  }, [])

  const setSortDir = useCallback((d: SortDir): void => {
    setSortDirState(d)
    write(KEYS.sortDir, d)
  }, [])

  const setViewMode = useCallback((m: ViewMode): void => {
    setViewModeState(m)
    write(KEYS.viewMode, m)
  }, [])

  return {
    thumbSize,
    sortField,
    sortDir,
    viewMode,
    setThumbSize,
    setSortField,
    setSortDir,
    setViewMode
  }
}

// Pure comparator over the loaded list. name → locale-aware (case/accent-insensitive,
// numeric); the rest are numeric on the matching column. Stable tiebreak on id so equal
// keys keep a deterministic order. `desc` negates the ascending result.
export function compareItems(a: Item, b: Item, field: SortField, dir: SortDir): number {
  let cmp: number
  switch (field) {
    case 'name':
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
      break
    case 'rating':
      cmp = a.rating - b.rating
      break
    case 'size':
      cmp = a.size_bytes - b.size_bytes
      break
    case 'created':
      cmp = a.created_at - b.created_at
      break
    case 'imported':
    default:
      cmp = a.imported_at - b.imported_at
      break
  }
  if (cmp === 0) cmp = a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  return dir === 'desc' ? -cmp : cmp
}
