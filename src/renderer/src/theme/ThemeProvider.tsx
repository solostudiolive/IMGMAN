import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import {
  applyTheme,
  readPreference,
  resolveTheme,
  watchSystemTheme,
  writePreference,
  type ResolvedTheme,
  type ThemePreference
} from './theme'

interface ThemeContextValue {
  /** The user's stored choice: 'dark' | 'light' | 'system'. */
  preference: ThemePreference
  /** The concrete theme currently applied (system resolved). */
  resolved: ResolvedTheme
  /** Change the preference (persists + applies). */
  setPreference: (pref: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readPreference())
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(readPreference()))

  // Apply + persist whenever the preference changes.
  useEffect(() => {
    const next = resolveTheme(preference)
    setResolved(next)
    applyTheme(next)
    writePreference(preference)
  }, [preference])

  // When following the OS, react to live color-scheme changes without a reload.
  useEffect(() => {
    if (preference !== 'system') return
    return watchSystemTheme((theme) => {
      setResolved(theme)
      applyTheme(theme)
    })
  }, [preference])

  const setPreference = useCallback((pref: ThemePreference) => setPreferenceState(pref), [])

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
