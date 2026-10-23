import { post } from '../../api/client'
import { isKindPage, type CheckPage } from '../../api/types'
import { plural } from '../../format'
import type { Action } from '../../hooks/useAction'
import type { Loaded } from '../../hooks/useLoad'
import { confirmMessage } from './confirmMessage'
import type { CheckRoute } from './useCheckRoute'
import type { Fixes } from './useFixes'
import type { Selection } from './useSelection'

interface Parts {
  route: CheckRoute
  page: Loaded<CheckPage>
  /** The page of the tab in the route. */
  data: CheckPage | undefined
  action: Action
  selection: Selection
  fixes: Fixes
  /** The sure threshold as a fraction, 0.5 to 1. */
  threshold: number
}

/** The three things a person does on a page: give the selected cells a label, confirm the page, confirm the sure cells. */
export function useCheckActions({ route, page, data, action, selection, fixes, threshold }: Parts) {
  const { mode, tab, kind } = route
  const cells = data?.cells ?? []

  const apply = (value: string): void => {
    if (!selection.selected.size) {
      selection.setWarning('Select cells first. Click one, shift-click a range, drag a box, or press ⌘A.')
      return
    }
    const picked = cells.filter((c) => selection.selected.has(c.id))
    fixes.set(picked, value)
    selection.clear()
    selection.setWarning(null)
    action.setNote(`Set ${plural(picked.length, 'cell')} to ${value}. Enter confirms the page.`)
  }

  /** A key that gives a label. A key of the other step only warns. */
  const choose = (key: string): void => {
    const value = mode.pick(key.toLowerCase())
    if (value === undefined) selection.setWarning(mode.wrongKey)
    else apply(value)
  }

  const confirm = async (): Promise<void> => {
    if (!data || action.busy || page.loading || !cells.length) return
    const missing = cells.filter((c) => fixes.valueOf(c) === null).length
    if (missing) {
      selection.setWarning(mode.missing(missing))
      return
    }
    // The message needs the counts before the call: the call changes them.
    const message = confirmMessage({
      mode,
      tab,
      kind,
      cells: cells.length,
      fixed: fixes.count,
      counts: data.counts,
      kindCounts: isKindPage(data) ? data.kind_counts : undefined,
    })
    const body = cells.map((c) => ({ id: c.id, [mode.field]: fixes.valueOf(c) }))
    const done = await action.run(
      () => post<number>(`/api/check/${mode.id}/confirm`, { cells: body }),
      () => message,
    )
    if (done !== undefined) {
      fixes.forget(cells)
      selection.clear()
    }
  }

  const confirmSure = async (): Promise<void> => {
    if (!data || action.busy || page.loading || !data.sure) return
    const done = await action.run(
      () =>
        post<{ cells: number }>(`/api/check/${mode.id}/sure`, {
          digit: tab,
          threshold,
          ...(kind === 'all' ? {} : { kind }),
        }),
      (r) =>
        `Confirmed ${plural(r.cells, 'sure cell')} of this tab. The cells that are left need a look. Select the wrong ones and press a key.`,
    )
    if (done !== undefined) selection.clear()
  }

  return { choose, confirm, confirmSure }
}
