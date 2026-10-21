import { describe, expect, it } from 'vitest'
import { createEmptyGrid } from '../grid'
import { computeCandidates } from './candidates'
import { findSkyscrapers, findTwoStringKites } from './singleDigit'
import { onlyIn } from './testKit'
import type { CellDigit } from './types'

const board = createEmptyGrid()
const empty = computeCandidates(board)

const at = (row: number, column: number): number => row * 9 + column
const removed = (cells: readonly number[], digit: number): CellDigit[] =>
  cells.map((cell) => ({ cell, digit }) as CellDigit)

const step = (
  technique: 'skyscraper' | 'twoStringKite',
  units: number[],
  pattern: number[],
  digit: number,
  cells: number[],
) => ({
  technique,
  placements: [],
  eliminations: removed(cells, digit),
  units,
  pattern,
  support: [],
  digits: [digit],
})

describe('findSkyscrapers', () => {
  // Row 1 holds the digit at (1,2) and (1,6). Row 6 holds it at (6,2) and (6,7). Column 2 is the
  // shared end line. The far ends are (1,6) and (6,7). The cells (2,7) and (7,6) see both of them.
  // The columns 2, 6 and 7 are strong links too, so two more skyscrapers use them.
  it('clears a digit from the cells that see both far ends of two strong links in rows', () => {
    const candidates = onlyIn(empty, 1, [at(1, 2), at(1, 6), at(6, 2), at(6, 7), at(7, 6), at(2, 7)])
    expect(findSkyscrapers(candidates, board)).toEqual([
      step('skyscraper', [1, 6], [11, 15, 56, 61], 1, [25, 69]),
      step('skyscraper', [11, 15], [11, 15, 56, 69], 1, [61]),
      step('skyscraper', [11, 16], [11, 25, 56, 61], 1, [15]),
    ])
  })

  // The same position, turned over its diagonal. The strong links in rows come first in the output.
  it('clears a digit from the cells that see both far ends of two strong links in columns', () => {
    const candidates = onlyIn(empty, 1, [at(2, 1), at(6, 1), at(2, 6), at(7, 6), at(6, 7), at(7, 2)])
    expect(findSkyscrapers(candidates, board)).toEqual([
      step('skyscraper', [2, 6], [19, 24, 55, 61], 1, [69]),
      step('skyscraper', [2, 7], [19, 24, 65, 69], 1, [55]),
      step('skyscraper', [10, 15], [19, 24, 55, 69], 1, [61, 65]),
    ])
  })

  it('finds nothing when the two links share no end line', () => {
    const candidates = onlyIn(empty, 1, [at(1, 2), at(1, 6), at(6, 3), at(6, 7), at(7, 6)])
    expect(findSkyscrapers(candidates, board)).toEqual([])
  })

  it('finds nothing when the two links share both end lines', () => {
    const candidates = onlyIn(empty, 1, [at(1, 2), at(1, 6), at(6, 2), at(6, 6), at(3, 2), at(3, 6)])
    expect(findSkyscrapers(candidates, board)).toEqual([])
  })

  it('finds nothing when no cell sees both far ends', () => {
    const candidates = onlyIn(empty, 1, [at(1, 2), at(1, 6), at(6, 2), at(6, 7)])
    expect(findSkyscrapers(candidates, board)).toEqual([])
  })

  it('does not use a row with three cells as a link', () => {
    const candidates = onlyIn(empty, 1, [at(1, 2), at(1, 6), at(1, 8), at(6, 2), at(6, 7), at(7, 6), at(2, 7)])
    expect(findSkyscrapers(candidates, board).filter((found) => found.units.includes(1))).toEqual([])
  })
})

describe('findTwoStringKites', () => {
  // The row link is (1,0) and (1,5). The column link is (2,2) and (7,2). The ends (1,0) and (2,2)
  // share box 0. The far ends are (1,5) and (7,2). The cell (7,5) sees both.
  it('clears a digit from the cell that sees both far ends of a row link and a column link', () => {
    const candidates = onlyIn(empty, 1, [at(1, 0), at(1, 5), at(2, 2), at(7, 2), at(7, 5)])
    expect(findTwoStringKites(candidates, board)).toEqual([
      step('twoStringKite', [1, 11, 18], [9, 14, 20, 65], 1, [68]),
    ])
  })

  // The same position, mirrored left to right. The box end is now the second end of the row link.
  it('finds the kite when the second end of the row link shares the box', () => {
    const candidates = onlyIn(empty, 1, [at(1, 8), at(1, 3), at(2, 6), at(7, 6), at(7, 3)])
    expect(findTwoStringKites(candidates, board)).toEqual([
      step('twoStringKite', [1, 15, 20], [12, 17, 24, 69], 1, [66]),
    ])
  })

  it('finds nothing when no end of the row link shares a box with an end of the column link', () => {
    const candidates = onlyIn(empty, 1, [at(0, 1), at(0, 6), at(3, 0), at(7, 0), at(7, 6)])
    expect(findTwoStringKites(candidates, board)).toEqual([])
  })

  it('finds nothing when the row link and the column link share a cell', () => {
    const candidates = onlyIn(empty, 1, [at(0, 1), at(0, 6), at(3, 1), at(3, 6)])
    expect(findTwoStringKites(candidates, board)).toEqual([])
  })

  it('finds nothing when no cell sees both far ends', () => {
    const candidates = onlyIn(empty, 1, [at(1, 0), at(1, 5), at(2, 2), at(7, 2)])
    expect(findTwoStringKites(candidates, board)).toEqual([])
  })
})
