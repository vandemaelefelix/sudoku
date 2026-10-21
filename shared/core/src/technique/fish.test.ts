import { describe, expect, it } from 'vitest'
import { createEmptyGrid } from '../grid'
import { computeCandidates } from './candidates'
import { findFish } from './fish'
import { onlyIn } from './testKit'
import type { CellDigit } from './types'

const board = createEmptyGrid()
const empty = computeCandidates(board)

const removed = (cells: readonly number[], digit: number): CellDigit[] =>
  cells.map((cell) => ({ cell, digit }) as CellDigit)

describe('findFish, size 2 (X-wing)', () => {
  it('clears a digit from two columns when two rows hold it in those columns only', () => {
    const candidates = onlyIn(empty, 5, [2, 6, 38, 42, 11, 69])
    expect(findFish(candidates, board, 2)).toEqual([
      {
        technique: 'xWing',
        placements: [],
        eliminations: removed([11, 69], 5),
        units: [0, 4, 11, 15],
        pattern: [2, 6, 38, 42],
        support: [],
        digits: [5],
      },
    ])
  })

  it('clears a digit from two rows when two columns hold it in those rows only', () => {
    const candidates = onlyIn(empty, 8, [19, 23, 64, 68, 26, 66])
    expect(findFish(candidates, board, 2)).toEqual([
      {
        technique: 'xWing',
        placements: [],
        eliminations: removed([26, 66], 8),
        units: [10, 14, 2, 7],
        pattern: [19, 23, 64, 68],
        support: [],
        digits: [8],
      },
    ])
  })

  it('finds nothing when a base row holds the digit in a third column', () => {
    const candidates = onlyIn(empty, 5, [2, 6, 38, 42, 44, 11, 69])
    expect(findFish(candidates, board, 2)).toEqual([])
  })

  it('finds nothing when the two rows use three columns together', () => {
    const candidates = onlyIn(empty, 5, [2, 6, 38, 43, 11, 69])
    expect(findFish(candidates, board, 2)).toEqual([])
  })

  it('finds nothing when the columns hold the digit nowhere else', () => {
    const candidates = onlyIn(empty, 5, [2, 6, 38, 42])
    expect(findFish(candidates, board, 2)).toEqual([])
  })

  it('leaves a line with one cell to the hidden single', () => {
    const candidates = onlyIn(empty, 5, [2, 38, 42, 11, 69])
    expect(findFish(candidates, board, 2)).toEqual([])
  })

  it('does not use a row that already holds the digit on the board', () => {
    const placed = createEmptyGrid()
    placed[0] = 5
    const candidates = onlyIn(computeCandidates(placed), 5, [2, 6, 38, 42, 11, 69])
    expect(findFish(candidates, placed, 2)).toEqual([])
  })
})

describe('findFish, size 3 (swordfish)', () => {
  it('clears a digit from three columns when three rows hold it in those columns only', () => {
    const candidates = onlyIn(empty, 3, [1, 4, 31, 34, 55, 61, 10, 40, 79])
    expect(findFish(candidates, board, 3)).toEqual([
      {
        technique: 'swordfish',
        placements: [],
        eliminations: removed([10, 40, 79], 3),
        units: [0, 3, 6, 10, 13, 16],
        pattern: [1, 4, 31, 34, 55, 61],
        support: [],
        digits: [3],
      },
    ])
  })

  it('clears a digit from three rows when three columns hold it in those rows only', () => {
    const candidates = onlyIn(empty, 3, [9, 36, 39, 66, 15, 69, 13, 44, 65])
    expect(findFish(candidates, board, 3)).toEqual([
      {
        technique: 'swordfish',
        placements: [],
        eliminations: removed([13, 44, 65], 3),
        units: [9, 12, 15, 1, 4, 7],
        pattern: [9, 15, 36, 39, 66, 69],
        support: [],
        digits: [3],
      },
    ])
  })

  it('finds nothing when the rows use four columns', () => {
    const candidates = onlyIn(empty, 3, [1, 4, 31, 34, 55, 62, 10, 40, 79])
    expect(findFish(candidates, board, 3)).toEqual([])
  })
})

describe('findFish, size 4 (jellyfish)', () => {
  it('clears a digit from four columns when four rows hold it in those columns only', () => {
    const candidates = onlyIn(empty, 2, [1, 3, 21, 23, 50, 53, 64, 71, 17, 32, 37, 75])
    expect(findFish(candidates, board, 4)).toEqual([
      {
        technique: 'jellyfish',
        placements: [],
        eliminations: removed([17, 32, 37, 75], 2),
        units: [0, 2, 5, 7, 10, 12, 14, 17],
        pattern: [1, 3, 21, 23, 50, 53, 64, 71],
        support: [],
        digits: [2],
      },
    ])
  })

  it('clears a digit from four rows when four columns hold it in those rows only', () => {
    const candidates = onlyIn(empty, 2, [9, 27, 29, 47, 50, 77, 16, 79, 13, 35, 48, 73])
    expect(findFish(candidates, board, 4)).toEqual([
      {
        technique: 'jellyfish',
        placements: [],
        eliminations: removed([13, 35, 48, 73], 2),
        units: [9, 11, 14, 16, 1, 3, 5, 8],
        pattern: [9, 16, 27, 29, 47, 50, 77, 79],
        support: [],
        digits: [2],
      },
    ])
  })

  it('finds nothing when one row holds the digit in a fifth column', () => {
    const candidates = onlyIn(empty, 2, [1, 3, 21, 23, 50, 53, 64, 71, 69, 17, 32, 37, 75])
    expect(findFish(candidates, board, 4)).toEqual([])
  })
})
