import { describe, expect, it } from 'vitest'

import type { CheckCell } from '../../api/types'
import { MODES, KIND_TABS, kindName, nextWithCells, routeOf, tabName } from './modes'

const CELL = { digit: '7', kind: 'printed' } as CheckCell

describe('modes', () => {
  it('lists the tabs of each mode', () => {
    expect(MODES.digits.tabs).toEqual(['empty', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'unknown'])
    expect(MODES.kinds.tabs).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
  })

  it('reads the label that each mode changes', () => {
    expect(MODES.digits.current(CELL)).toBe('7')
    expect(MODES.kinds.current(CELL)).toBe('printed')
  })

  it('maps the keys of the Digits step', () => {
    const { pick } = MODES.digits
    expect([pick('0'), pick('5'), pick('x')]).toEqual(['empty', '5', 'discarded'])
    expect([pick('p'), pick('h'), pick('u')]).toEqual([undefined, undefined, undefined])
  })

  it('maps the keys of the Kind step', () => {
    const { pick } = MODES.kinds
    expect([pick('p'), pick('h'), pick('u')]).toEqual(['printed', 'handwritten', 'unsure'])
    expect([pick('5'), pick('x')]).toEqual([undefined, undefined])
  })

  it('shows a label on a tile', () => {
    expect([MODES.digits.show(null), MODES.digits.show('empty'), MODES.digits.show('discarded')]).toEqual([
      '?',
      'Empty',
      '✕',
    ])
    expect([MODES.kinds.show(null), MODES.kinds.show('printed'), MODES.kinds.show('unsure')]).toEqual(['?', 'P', '?'])
  })

  it('writes the warning for cells without a label', () => {
    expect(MODES.digits.missing(1)).toBe('1 cell has no digit yet. Select each one and type its digit.')
    expect(MODES.kinds.missing(2)).toBe('2 cells have no kind yet. Select each one and press P or H.')
  })

  it('names the tabs', () => {
    expect([tabName('empty'), tabName('unknown'), tabName('4')]).toEqual(['Empty', 'No guess', '4'])
    expect(KIND_TABS.map(kindName)).toEqual(['All', 'Printed', 'Handwritten', 'Unsure'])
  })

  it('finds the next tab with cells, around the end', () => {
    const tabs = ['a', 'b', 'c']
    expect(nextWithCells(tabs, 'a', { b: 0, c: 2 })).toBe('c')
    expect(nextWithCells(tabs, 'c', { a: 1 })).toBe('a')
    expect(nextWithCells(tabs, 'b', { b: 5 })).toBeUndefined()
  })

  it('builds a route with a kind only for a kind other than All', () => {
    expect(routeOf('digits', '7', 'all')).toBe('digits/7')
    expect(routeOf('kinds', '7', 'printed')).toBe('kinds/7/printed')
  })
})
