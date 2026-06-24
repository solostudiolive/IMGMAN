/*
 * Theme primitives shared by the ThemeProvider and the FOUC-safe pre-render apply in
 * main.tsx. Source of truth for this plan is localStorage (renderer-owned, synchronous →
 * no flash). The Settings screen (Plan 05-04) reads/writes the same preference via useTheme().
 */

export type ThemePreference = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

const STORAGE_KEY = 'imgman.theme'
const DEFAULT_PREFERENCE: ThemePreference = 'dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function isPreference(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system'
}

/** Read the persisted preference, validating and falling back to the default. */
export function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isPreference(stored)) return stored
  } catch {
    // localStorage may be unavailable (e.g. disabled) — fall back to default.
  }
  return DEFAULT_PREFERENCE
}

/** Persist the preference. */
export function writePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    // Best-effort; theme still applies in-session even if persistence fails.
  }
}

/** Current OS color scheme. */
export function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

/** Resolve a preference (with 'system') to a concrete theme. */
export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  return pref === 'system' ? systemTheme() : pref
}

/** Apply a resolved theme to the document (drives the [data-theme] CSS overrides). */
export function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved
}

/**
 * Apply the stored theme immediately. Called at the top of main.tsx (module load, before
 * React renders) so the correct theme is in place on first paint — the CSP forbids an inline
 * <head> script, but this module runs as 'self', so it is allowed.
 */
export function applyStoredTheme(): void {
  applyTheme(resolveTheme(readPreference()))
}

/** Subscribe to OS color-scheme changes. Returns an unsubscribe function. */
export function watchSystemTheme(onChange: (theme: ResolvedTheme) => void): () => void {
  const mql = window.matchMedia(DARK_QUERY)
  const handler = (e: MediaQueryListEvent): void => onChange(e.matches ? 'dark' : 'light')
  mql.addEventListener('change', handler)
  return () => mql.removeEventListener('change', handler)
}
