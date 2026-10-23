import { describe, expect, it } from 'vitest'

import type { KindTab } from '../../api/types'
import { confirmMessage, type Confirmed } from './confirmMessage'
import { MODES } from './modes'

const ZERO = { empty: 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, unknown: 0 }
const KINDS = { all: 0, printed: 0, handwritten: 0, unsure: 0 }

function facts(extra: Partial<Confirmed> = {}): Confirmed {
  return {
    mode: MODES.digits,
    tab: '7',
    kind: 'all',
    cells: 3,
    fixed: 0,
    counts: { ...ZERO, '7': 3 },
    kindCounts: undefined,
    ...extra,
  }
}

describe('confirmMessage', () => {
  it('counts the cells and the fixes', () => {
    expect(confirmMessage(facts({ cells: 1 }))).toMatch(/^Confirmed 1 cell\. /)
    expect(confirmMessage(facts({ fixed: 2 }))).toMatch(/^Confirmed 3 cells, 2 with a fix\. /)
  })

  it('says how many cells of the tab are left', () => {
    expect(confirmMessage(facts({ counts: { ...ZERO, '7': 4 } }))).toBe(
      'Confirmed 3 cells. 1 cell of this tab is left.',
    )
    expect(confirmMessage(facts({ counts: { ...ZERO, '7': 9 } }))).toBe(
      'Confirmed 3 cells. 6 cells of this tab are left.',
    )
  })

  it('opens the next tab with cells when the tab is done', () => {
    const counts = { ...ZERO, '7': 3, '9': 1 }
    expect(confirmMessage(facts({ counts }))).toBe(
      'Confirmed 3 cells. This tab is done. The next tab with cells opens.',
    )
  })

  it('names the next step when every tab is done', () => {
    expect(confirmMessage(facts())).toBe('Confirmed 3 cells. Every tab is done. Next: Kind.')
    expect(confirmMessage(facts({ mode: MODES.kinds }))).toBe('Confirmed 3 cells. Every tab is done. Next: Finish.')
  })

  it('counts the cells of a kind tab, not of the whole digit', () => {
    const kindCounts: Record<KindTab, number> = { ...KINDS, all: 5, printed: 4, handwritten: 1 }
    const base = { mode: MODES.kinds, kind: 'printed' as const, kindCounts, counts: { ...ZERO, '7': 5 } }
    expect(confirmMessage(facts({ ...base, cells: 3 }))).toBe('Confirmed 3 cells. 1 cell of this tab is left.')
  })

  it('opens the next kind tab when the kind tab is done', () => {
    const kindCounts: Record<KindTab, number> = { ...KINDS, all: 5, printed: 3, handwritten: 2 }
    const done = facts({ mode: MODES.kinds, kind: 'printed', kindCounts, counts: { ...ZERO, '7': 5 } })
    expect(confirmMessage(done)).toBe('Confirmed 3 cells. The printed tab is done. The next kind tab with cells opens.')
  })

  it('counts the All tab as a kind tab with cells', () => {
    const kindCounts: Record<KindTab, number> = { ...KINDS, all: 3, printed: 3 }
    const done = facts({ mode: MODES.kinds, kind: 'printed', kindCounts, counts: { ...ZERO, '7': 3, '8': 2 } })
    expect(confirmMessage(done)).toBe('Confirmed 3 cells. The printed tab is done. The next kind tab with cells opens.')
  })
})
