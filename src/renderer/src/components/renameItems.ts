// Pure batch-rename helpers (no React). The renderer computes new names from a RenameSpec for an
// instant preview; only the final {id, name}[] is sent to items:renameMany. Names are metadata only.

export interface RenameInput {
  id: string
  name: string
  ext: string
}

export type RenameSpec =
  | { mode: 'pattern'; template: string; start: number; pad: number }
  | { mode: 'replace'; find: string; replace: string; caseSensitive: boolean; regex: boolean }

export interface RenamePreviewRow {
  id: string
  oldName: string
  name: string
}

// Escape a literal string for safe use inside a RegExp.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Validate a spec before applying. For regex find/replace, returns an error string when the pattern
 * is invalid so the dialog can show it and disable Apply. Other modes never error.
 */
export function specError(spec: RenameSpec): string | null {
  if (spec.mode === 'replace' && spec.regex && spec.find) {
    try {
      new RegExp(spec.find, spec.caseSensitive ? 'g' : 'gi')
    } catch (err) {
      return err instanceof Error ? err.message : 'Invalid regular expression'
    }
  }
  return null
}

/** Compute the new name for one item at `index` under `spec`. Returns the original name on error. */
export function computeName(item: RenameInput, index: number, spec: RenameSpec): string {
  if (spec.mode === 'pattern') {
    const seq = String(spec.start + index).padStart(Math.max(0, spec.pad), '0')
    return spec.template
      .replace(/\{name\}/g, item.name)
      .replace(/\{ext\}/g, item.ext)
      .replace(/\{n\}/g, seq)
  }

  // Find & replace
  if (!spec.find) return item.name
  if (spec.regex) {
    try {
      return item.name.replace(new RegExp(spec.find, spec.caseSensitive ? 'g' : 'gi'), spec.replace)
    } catch {
      return item.name // invalid regex — dialog blocks Apply via specError
    }
  }
  if (spec.caseSensitive) {
    return item.name.split(spec.find).join(spec.replace)
  }
  return item.name.replace(new RegExp(escapeRegExp(spec.find), 'gi'), spec.replace)
}

/** Old→new rows for every item (index-based for {n}). */
export function computeRenames(items: RenameInput[], spec: RenameSpec): RenamePreviewRow[] {
  return items.map((item, i) => ({ id: item.id, oldName: item.name, name: computeName(item, i, spec) }))
}
