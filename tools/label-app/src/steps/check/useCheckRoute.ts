import { useEffect, useRef } from 'react'

import { isKindPage, type CheckPage, type KindTab } from '../../api/types'
import { go } from '../../hooks/useRoute'
import { KIND_TABS, nextWithCells, routeOf, type CheckMode } from './modes'

export interface CheckRoute {
  mode: CheckMode
  tab: string
  kind: KindTab
  /** The route of a tab. The kind stays the same unless the call gives one. */
  to: (tab: string, kind?: KindTab) => string
  /** The route of the tab that is `by` places further, around the end. */
  step: (by: number) => string
}

/** A tab or a kind that the route names wrongly becomes the first tab or All. */
export function useCheckRoute(mode: CheckMode, asked: string | undefined, askedKind: string | undefined): CheckRoute {
  const tab = asked && mode.tabs.includes(asked) ? asked : (mode.tabs[0] ?? '')
  // Only the Kind step has kind tabs. No kind in the route means All.
  const kind = KIND_TABS.find((k) => k === askedKind && mode.id === 'kinds') ?? 'all'
  return {
    mode,
    tab,
    kind,
    to: (t, k = kind) => routeOf(mode.id, t, k),
    step: (by) =>
      routeOf(mode.id, mode.tabs[(mode.tabs.indexOf(tab) + by + mode.tabs.length) % mode.tabs.length] ?? tab, kind),
  }
}

/**
 * Move on to the next tab that has cells. The first move-on follows a route without a tab.
 * `loaded` is the newest page. `data` is the page of the tab in the route.
 * Returns the open cells of the shown kind tab and the next kind tab with cells.
 */
export function useMoveOn(
  { mode, tab, kind }: CheckRoute,
  asked: string | undefined,
  loaded: CheckPage | undefined,
  data: CheckPage | undefined,
): { shownCount: number; nextKind: KindTab | undefined } {
  const onward = data && (data.counts[tab] ?? 0) === 0 ? nextWithCells(mode.tabs, tab, data.counts) : undefined
  const first = loaded ? mode.tabs.find((t) => (loaded.counts[t] ?? 0) > 0) : undefined
  // After a digit move-on, the kind tab of the new digit may be empty too.
  const carried = useRef(false)
  useEffect(() => {
    if (!asked && first && first !== tab) go(routeOf(mode.id, first, kind))
    else if (onward) {
      carried.current = true
      go(routeOf(mode.id, onward, kind))
    }
  }, [mode.id, asked, first, tab, onward, kind])

  const kindCounts = data && isKindPage(data) ? data.kind_counts : undefined
  const shownCount = kindCounts?.[kind] ?? 0
  const nextKind = kindCounts ? nextWithCells(KIND_TABS, kind, kindCounts) : undefined
  const seenCount = useRef({ key: '', n: 0 })
  useEffect(() => {
    if (!kindCounts) return
    if (kind === 'all') {
      // A move-on that lands on All must not make a later click on an empty kind tab jump on.
      carried.current = false
      return
    }
    const key = `${tab}:${kind}`
    const emptied = seenCount.current.key === key && seenCount.current.n > 0 && shownCount === 0
    seenCount.current = { key, n: shownCount }
    const arrived = carried.current
    carried.current = false
    if ((emptied || arrived) && shownCount === 0 && nextKind) go(routeOf(mode.id, tab, nextKind))
  }, [mode.id, kindCounts, tab, kind, shownCount, nextKind])
  return { shownCount, nextKind }
}
