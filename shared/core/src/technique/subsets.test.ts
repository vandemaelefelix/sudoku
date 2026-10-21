import { describe, expect, it } from 'vitest'
import { createEmptyGrid } from '../grid'
import { computeCandidates } from './candidates'
import { findHiddenSubsets, findNakedSubsets } from './subsets'
import { struck, withDigits } from './testKit'
import type { CellDigit } from './types'

const board = createEmptyGrid()
const empty = computeCandidates(board)

const elimination = (cells: readonly number[], digits: readonly number[]): CellDigit[] =>
  cells.flatMap((cell) => digits.map((digit) => ({ cell, digit }) as CellDigit))

describe('findNakedSubsets', () => {
  it('removes the pair digits from the rest of a row', () => {
    const candidates = withDigits(empty, { 0: [1, 2], 4: [1, 2] })
    expect(findNakedSubsets(candidates, board, 2)).toEqual([
      {
        technique: 'nakedPair',
        placements: [],
        eliminations: elimination([1, 2, 3, 5, 6, 7, 8], [1, 2]),
        units: [0],
        pattern: [0, 4],
        support: [],
        digits: [1, 2],
      },
    ])
  })

  it('gives one step with both units when the pair shares a row and a box', () => {
    const candidates = withDigits(empty, { 0: [1, 2], 1: [1, 2] })
    expect(findNakedSubsets(candidates, board, 2)).toEqual([
      {
        technique: 'nakedPair',
        placements: [],
        eliminations: elimination([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20], [1, 2]),
        units: [0, 18],
        pattern: [0, 1],
        support: [],
        digits: [1, 2],
      },
    ])
  })

  it('finds a triple whose cells hold two of its three digits each', () => {
    const candidates = withDigits(empty, { 0: [1, 2], 4: [2, 3], 8: [1, 3] })
    expect(findNakedSubsets(candidates, board, 3)).toEqual([
      {
        technique: 'nakedTriple',
        placements: [],
        eliminations: elimination([1, 2, 3, 5, 6, 7], [1, 2, 3]),
        units: [0],
        pattern: [0, 4, 8],
        support: [],
        digits: [1, 2, 3],
      },
    ])
  })

  it('does not report a triple that holds a pair', () => {
    const candidates = withDigits(empty, { 0: [1, 2], 4: [1, 2], 8: [1, 2, 3] })
    expect(findNakedSubsets(candidates, board, 3)).toEqual([])
    expect(findNakedSubsets(candidates, board, 2)).toHaveLength(1)
  })

  it('gives no step when no other cell holds a digit of the subset', () => {
    const others = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20]
    const candidates = struck(withDigits(empty, { 0: [1, 2], 1: [1, 2] }), others, [1, 2])
    expect(findNakedSubsets(candidates, board, 2)).toEqual([])
  })

  it('ignores a cell that holds a digit on the board', () => {
    const placed = createEmptyGrid()
    placed[0] = 1
    const candidates = withDigits(empty, { 0: [1, 2], 4: [1, 2] })
    expect(findNakedSubsets(candidates, placed, 2)).toEqual([])
  })
})

describe('findHiddenSubsets', () => {
  it('removes the other digits from the cells of a hidden pair', () => {
    const candidates = struck(empty, [2, 3, 4, 5, 6, 7, 8], [1, 2])
    expect(findHiddenSubsets(candidates, board, 2)).toEqual([
      {
        technique: 'hiddenPair',
        placements: [],
        eliminations: elimination([0, 1], [3, 4, 5, 6, 7, 8, 9]),
        units: [0],
        pattern: [0, 1],
        support: [],
        digits: [1, 2],
      },
    ])
  })

  it('gives one step with both units when the pair is hidden in a row and a box', () => {
    const candidates = struck(empty, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20], [1, 2])
    expect(findHiddenSubsets(candidates, board, 2)).toEqual([
      {
        technique: 'hiddenPair',
        placements: [],
        eliminations: elimination([0, 1], [3, 4, 5, 6, 7, 8, 9]),
        units: [0, 18],
        pattern: [0, 1],
        support: [],
        digits: [1, 2],
      },
    ])
  })

  it('removes the other digits from the cells of a hidden triple', () => {
    const candidates = struck(empty, [1, 2, 3, 5, 6, 7], [1, 2, 3])
    expect(findHiddenSubsets(candidates, board, 3)).toEqual([
      {
        technique: 'hiddenTriple',
        placements: [],
        eliminations: elimination([0, 4, 8], [4, 5, 6, 7, 8, 9]),
        units: [0],
        pattern: [0, 4, 8],
        support: [],
        digits: [1, 2, 3],
      },
    ])
  })

  it('does not report a triple that holds a hidden pair', () => {
    const candidates = struck(empty, [2, 3, 4, 5, 6, 7, 8], [1, 2])
    const stripped = struck(candidates, [2, 3, 5, 6, 7, 8], [3])
    expect(findHiddenSubsets(stripped, board, 3)).toEqual([])
  })

  it('gives no step when the cells hold no other digit', () => {
    const candidates = withDigits(struck(empty, [2, 3, 4, 5, 6, 7, 8], [1, 2]), { 0: [1, 2], 1: [1, 2] })
    expect(findHiddenSubsets(candidates, board, 2)).toEqual([])
  })

  it('skips a digit that the board already places in the unit', () => {
    const placed = createEmptyGrid()
    placed[8] = 1
    const candidates = struck(computeCandidates(placed), [2, 3, 4, 5, 6, 7], [2])
    expect(findHiddenSubsets(candidates, placed, 2)).toEqual([])
  })
})
