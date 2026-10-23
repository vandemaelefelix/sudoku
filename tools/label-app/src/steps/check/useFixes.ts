import { useState } from 'react'

import type { CheckCell } from '../../api/types'
import type { CheckMode } from './modes'

export interface Fixes {
  /** The fix of each cell by id. A cell without a fix keeps its current label. */
  fixes: Record<string, string>
  valueOf: (cell: CheckCell) => string | null
  /** How many cells of the page have a fix. */
  count: number
  /** Give the cells the label. A label equal to the current one removes the fix. */
  set: (picked: CheckCell[], value: string) => void
  /** Drop the fixes of the cells: the server has them now. */
  forget: (done: CheckCell[]) => void
}

/** The labels that the person changed on the page. They stay when the page changes: they belong to a cell. */
export function useFixes(mode: CheckMode, cells: CheckCell[]): Fixes {
  const [fixes, setFixes] = useState<Record<string, string>>({})
  return {
    fixes,
    valueOf: (cell) => fixes[cell.id] ?? mode.current(cell),
    count: cells.filter((c) => fixes[c.id] !== undefined).length,
    set: (picked, value) =>
      setFixes((all) => {
        const next = { ...all }
        for (const c of picked) {
          if (value === mode.current(c)) delete next[c.id]
          else next[c.id] = value
        }
        return next
      }),
    forget: (done) => {
      const ids = new Set(done.map((c) => c.id))
      setFixes((all) => Object.fromEntries(Object.entries(all).filter(([id]) => !ids.has(id))))
    },
  }
}
