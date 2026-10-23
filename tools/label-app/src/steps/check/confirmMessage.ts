import type { KindTab } from '../../api/types'
import { plural } from '../../format'
import { KIND_TABS, nextWithCells, type CheckMode } from './modes'

export interface Confirmed {
  mode: CheckMode
  tab: string
  kind: KindTab
  /** The cells that the confirm call took, and how many of them had a fix. */
  cells: number
  fixed: number
  /** The open cells per tab and per kind tab, as the server counted them before the call. */
  counts: Record<string, number>
  kindCounts: Record<KindTab, number> | undefined
}

function whatNext({ mode, tab, kind, cells, counts, kindCounts }: Confirmed): string {
  const shown = kind === 'all' ? (counts[tab] ?? 0) : (kindCounts?.[kind] ?? 0)
  const left = shown - cells
  if (left > 0) return `${plural(left, 'cell')} of this tab ${left === 1 ? 'is' : 'are'} left.`
  if (kind !== 'all' && kindCounts && nextWithCells(KIND_TABS, kind, { ...kindCounts, [kind]: 0 })) {
    return `The ${kind} tab is done. The next kind tab with cells opens.`
  }
  if (nextWithCells(mode.tabs, tab, { ...counts, [tab]: 0 })) return 'This tab is done. The next tab with cells opens.'
  return `Every tab is done. Next: ${mode.next.name}.`
}

/** What the confirm call did and what comes next. */
export function confirmMessage(facts: Confirmed): string {
  const { cells, fixed } = facts
  return `Confirmed ${plural(cells, 'cell')}${fixed ? `, ${fixed} with a fix` : ''}. ${whatNext(facts)}`
}
