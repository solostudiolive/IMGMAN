// Eagle shows filenames WITHOUT their extension (the format lives in a badge / the Format row).
// Our `name` column keeps the original basename incl. extension; these helpers derive the clean
// display form and rebuild the stored name after an inline rename.

/** The name shown in the UI: `name` with a trailing `.<ext>` removed (case-insensitive). */
export function baseName(name: string, ext?: string | null): string {
  if (ext) {
    const suffix = `.${ext}`.toLowerCase()
    if (name.toLowerCase().endsWith(suffix) && name.length > suffix.length) {
      return name.slice(0, -suffix.length)
    }
  }
  return name
}

/** Reattach the extension to a user-edited base name so the stored `name` keeps its `.<ext>`. */
export function withExt(base: string, ext?: string | null): string {
  const trimmed = base.trim()
  return ext ? `${trimmed}.${ext}` : trimmed
}
