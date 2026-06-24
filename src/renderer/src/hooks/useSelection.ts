import { useCallback, useState } from 'react'

// Multi-select model for the content grid. Pure renderer state (ephemeral, per scope):
//  - selected: the set of selected item ids
//  - primary:  the last-clicked item — drives the inspector + quick preview
//  - anchor:   the fixed end for shift-range selection
// The ordered id list (current sort order) is passed per call so range selection always
// reflects what the grid is actually showing.

export type SelectMods = { ctrl: boolean; shift: boolean }

export interface Selection {
  selected: Set<string>
  primary: string | null
  anchor: string | null
  handleSelect: (id: string, orderedIds: string[], mods: SelectMods) => void
  selectAll: (orderedIds: string[]) => void
  applyMarquee: (ids: string[], additive: boolean) => void
  clear: () => void
  prune: (presentIds: string[]) => void
}

export function useSelection(): Selection {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [primary, setPrimary] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<string | null>(null)

  const handleSelect = useCallback(
    (id: string, orderedIds: string[], mods: SelectMods): void => {
      if (mods.shift && anchor) {
        const a = orderedIds.indexOf(anchor)
        const b = orderedIds.indexOf(id)
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a <= b ? [a, b] : [b, a]
          setSelected(new Set(orderedIds.slice(lo, hi + 1)))
          setPrimary(id)
          return // keep anchor for further shift-clicks
        }
        // anchor not in current order → fall through to plain select
      }

      if (mods.ctrl) {
        setSelected((prev) => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
        setPrimary(id)
        setAnchor(id)
        return
      }

      setSelected(new Set([id]))
      setPrimary(id)
      setAnchor(id)
    },
    [anchor]
  )

  const selectAll = useCallback((orderedIds: string[]): void => {
    setSelected(new Set(orderedIds))
    const last = orderedIds.length ? orderedIds[orderedIds.length - 1] : null
    setPrimary(last)
    setAnchor(last)
  }, [])

  // Marquee result: replace the selection with `ids`, or union them onto the current
  // selection when `additive`. Primary/anchor follow the last id (or reset on empty replace).
  const applyMarquee = useCallback((ids: string[], additive: boolean): void => {
    const last = ids.length ? ids[ids.length - 1] : null
    if (additive) {
      setSelected((prev) => new Set([...prev, ...ids]))
      if (last) {
        setPrimary(last)
        setAnchor(last)
      }
    } else {
      setSelected(new Set(ids))
      setPrimary(last)
      setAnchor(last)
    }
  }, [])

  const clear = useCallback((): void => {
    setSelected(new Set())
    setPrimary(null)
    setAnchor(null)
  }, [])

  const prune = useCallback((presentIds: string[]): void => {
    const present = new Set(presentIds)
    setSelected((prev) => {
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (present.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
    setPrimary((p) => (p && present.has(p) ? p : null))
    setAnchor((a) => (a && present.has(a) ? a : null))
  }, [])

  return { selected, primary, anchor, handleSelect, selectAll, applyMarquee, clear, prune }
}
