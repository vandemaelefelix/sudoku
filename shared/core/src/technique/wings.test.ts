import { describe, expect, it } from 'vitest'
import { createEmptyGrid } from '../grid'
import { computeCandidates } from './candidates'
import { findWWings, findXyWings, findXyzWings } from './wings'
import { onlyIn, struck, withDigits } from './testKit'
import type { CellDigit } from './types'

const board = createEmptyGrid()
const empty = computeCandidates(board)

const removed = (cells: readonly number[], digit: number): CellDigit[] =>
  cells.map((cell) => ({ cell, digit }) as CellDigit)

describe('findXyWings', () => {
  // Pivot (0,0) holds 1 and 2. The pincers (0,3) with 1 and 3, and (2,0) with 2 and 3, share 3.
  it('clears the shared digit of the pincers from the cells that see both', () => {
    const candidates = withDigits(empty, { 0: [1, 2], 3: [1, 3], 18: [2, 3] })
    expect(findXyWings(candidates, board)).toEqual([
      {
        technique: 'xyWing',
        placements: [],
        eliminations: removed([1, 2, 21, 22, 23], 3),
        units: [0, 9],
        pattern: [0, 3, 18],
        support: [],
        digits: [3, 1, 2],
      },
    ])
  })

  it('puts the pincers in cell order and the unit of the first pincer first', () => {
    const candidates = withDigits(empty, { 40: [1, 2], 36: [1, 3], 4: [2, 3] })
    expect(findXyWings(candidates, board)).toEqual([
      {
        technique: 'xyWing',
        placements: [],
        eliminations: removed([0], 3),
        units: [13, 4],
        pattern: [40, 4, 36],
        support: [],
        digits: [3, 1, 2],
      },
    ])
  })

  it('gives one unit when both pincers are in the unit of the pivot', () => {
    const candidates = withDigits(empty, { 0: [1, 2], 3: [1, 3], 6: [2, 3] })
    const [wing] = findXyWings(candidates, board)
    expect(wing!.units).toEqual([0])
    expect(wing!.pattern).toEqual([0, 3, 6])
  })

  it('finds nothing when a pincer does not see the pivot', () => {
    const candidates = withDigits(empty, { 0: [1, 2], 3: [1, 3], 31: [2, 3] })
    expect(findXyWings(candidates, board)).toEqual([])
  })

  it('finds nothing when the pincers do not share one digit', () => {
    const candidates = withDigits(empty, { 0: [1, 2], 3: [1, 3], 18: [2, 4] })
    expect(findXyWings(candidates, board)).toEqual([])
  })

  it('finds nothing when the pincers hold a digit that the pivot lacks, beyond the shared one', () => {
    const candidates = withDigits(empty, { 0: [1, 2], 3: [1, 3], 18: [1, 4] })
    expect(findXyWings(candidates, board)).toEqual([])
  })

  it('finds nothing when no cell that sees both pincers holds the digit', () => {
    const candidates = struck(withDigits(empty, { 0: [1, 2], 3: [1, 3], 18: [2, 3] }), [1, 2, 21, 22, 23], [3])
    expect(findXyWings(candidates, board)).toEqual([])
  })
})

describe('findXyzWings', () => {
  // Pivot (0,0) holds 1, 2 and 3. The pincers (0,1) with 1 and 3, and (1,0) with 2 and 3, share 3.
  // The pivot may hold 3 itself, so only the cells that also see the pivot lose 3.
  it('clears the shared digit from the cells that see the pivot and both pincers', () => {
    const candidates = withDigits(empty, { 0: [1, 2, 3], 1: [1, 3], 9: [2, 3] })
    expect(findXyzWings(candidates, board)).toEqual([
      {
        technique: 'xyzWing',
        placements: [],
        eliminations: removed([2, 10, 11, 18, 19, 20], 3),
        units: [0, 9],
        pattern: [0, 1, 9],
        support: [],
        digits: [3, 1, 2],
      },
    ])
  })

  it('finds nothing when a pincer lies outside the box and the lines of the pivot', () => {
    const candidates = withDigits(empty, { 0: [1, 2, 3], 1: [1, 3], 30: [2, 3] })
    expect(findXyzWings(candidates, board)).toEqual([])
  })

  it('finds nothing when the pincers do not hold the digits of the pivot', () => {
    const candidates = withDigits(empty, { 0: [1, 2, 3], 1: [1, 3], 9: [3, 4] })
    expect(findXyzWings(candidates, board)).toEqual([])
  })

  it('does not take an XY-wing for an XYZ-wing', () => {
    const candidates = withDigits(empty, { 0: [1, 2], 1: [1, 3], 9: [2, 3] })
    expect(findXyzWings(candidates, board)).toEqual([])
  })
})

describe('findWWings', () => {
  const noOtherOne = [46, 47, 48, 50, 51, 52, 53]

  // The cells (0,0) and (1,4) hold 1 and 2. Row 5 holds 1 only at (5,0) and (5,4). Each end sees
  // one of the cells. One of the cells holds 2, so 2 leaves the cells that see both.
  it('clears one digit from the cells that see both cells of a pair joined by a strong link on the other', () => {
    const candidates = struck(withDigits(empty, { 0: [1, 2], 13: [1, 2] }), noOtherOne, [1])
    expect(findWWings(candidates, board)).toEqual([
      {
        technique: 'wWing',
        placements: [],
        eliminations: removed([3, 4, 5, 9, 10, 11], 2),
        units: [5, 9, 13],
        pattern: [0, 13, 45, 49],
        support: [],
        digits: [2, 1],
      },
    ])
  })

  it('puts each link end after the cell that it sees', () => {
    const candidates = struck(withDigits(empty, { 4: [1, 2], 9: [1, 2] }), noOtherOne, [1])
    expect(findWWings(candidates, board)).toEqual([
      {
        technique: 'wWing',
        placements: [],
        eliminations: removed([0, 1, 2, 12, 13, 14], 2),
        units: [5, 13, 9],
        pattern: [4, 9, 49, 45],
        support: [],
        digits: [2, 1],
      },
    ])
  })

  it('finds nothing when the link digit has a third cell in the unit', () => {
    const candidates = struck(withDigits(empty, { 0: [1, 2], 13: [1, 2] }), [46, 48, 50, 51, 52, 53], [1])
    expect(findWWings(candidates, board)).toEqual([])
  })

  it('finds nothing when the two cells see each other', () => {
    const candidates = struck(withDigits(empty, { 0: [1, 2], 4: [1, 2] }), noOtherOne, [1])
    expect(findWWings(candidates, board)).toEqual([])
  })

  it('finds nothing when an end of the strong link is one of the two cells', () => {
    const candidates = withDigits(onlyIn(empty, 1, [0, 5, 13]), { 0: [1, 2], 13: [1, 2] })
    expect(findWWings(candidates, board)).toEqual([])
  })

  it('finds nothing when the ends see only one of the two cells', () => {
    const candidates = struck(withDigits(empty, { 0: [1, 2], 13: [1, 2] }), [45, 47, 48, 50, 51, 52, 53], [1])
    expect(findWWings(candidates, board)).toEqual([])
  })

  it('finds nothing when the two cells hold different digits', () => {
    const candidates = struck(withDigits(empty, { 0: [1, 2], 13: [1, 3] }), noOtherOne, [1])
    expect(findWWings(candidates, board)).toEqual([])
  })
})
