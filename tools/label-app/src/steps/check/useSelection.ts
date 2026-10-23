import { useEffect, useState } from 'react'

import type { CheckCell } from '../../api/types'
import { typingIn } from '../../hooks/useKeys'

export interface Selection {
  selected: Set<string>
  warning: string | null
  setWarning: (warning: string | null) => void
  /** Select the cells. `add` keeps the cells that are selected already. */
  select: (ids: string[], add: boolean) => void
  /** A click on a cell: toggle it, or with `range` select from the cell that the last click chose. */
  click: (id: string, range: boolean) => void
  clear: () => void
}

/** The selected cells of the page. A new page clears the selection: the fixes belong to a cell and stay. */
export function useSelection(cells: CheckCell[], pageId: string | undefined): Selection {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [anchor, setAnchor] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [pageKey, setPageKey] = useState('')
  if (pageId !== undefined && pageKey !== pageId) {
    setPageKey(pageId)
    setSelected(new Set())
    setAnchor(null)
    setWarning(null)
  }

  const select = (ids: string[], add: boolean): void => {
    setSelected((all) => new Set(add ? [...all, ...ids] : ids))
    setWarning(null)
  }

  const click = (id: string, range: boolean): void => {
    const from = anchor === null ? -1 : cells.findIndex((c) => c.id === anchor)
    const to = cells.findIndex((c) => c.id === id)
    if (range && from >= 0) {
      const [a, b] = from < to ? [from, to] : [to, from]
      select(
        cells.slice(a, b + 1).map((c) => c.id),
        true,
      )
    } else {
      setSelected((all) => {
        const toggled = new Set(all)
        if (!toggled.delete(id)) toggled.add(id)
        return toggled
      })
      setAnchor(id)
      setWarning(null)
    }
  }

  // The key is not in useKeys: that hook skips every key with a modifier.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'a' || typingIn(event)) return
      event.preventDefault()
      setSelected(new Set(cells.map((c) => c.id)))
      setWarning(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cells])

  return { selected, warning, setWarning, select, click, clear: () => setSelected(new Set()) }
}
