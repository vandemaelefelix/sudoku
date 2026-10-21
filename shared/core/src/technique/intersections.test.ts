import { describe, expect, it } from 'vitest'
import { createEmptyGrid } from '../grid'
import { computeCandidates } from './candidates'
import { findBoxLineReductions, findPointing } from './intersections'
import { struck } from './testKit'

const board = createEmptyGrid()
const empty = computeCandidates(board)

const fives = (cells: readonly number[]) => cells.map((cell) => ({ cell, digit: 5 }))

describe('findPointing', () => {
  it('removes the digit from the rest of the row of a pointing pair', () => {
    const candidates = struck(empty, [2, 9, 10, 11, 18, 19, 20], [5])
    expect(findPointing(candidates, board)).toEqual([
      {
        technique: 'pointing',
        placements: [],
        eliminations: fives([3, 4, 5, 6, 7, 8]),
        units: [18, 0],
        pattern: [0, 1],
        support: [],
        digits: [5],
      },
    ])
  })

  it('removes the digit from the rest of the column of a pointing triple', () => {
    const candidates = struck(empty, [30, 32, 39, 41, 48, 50], [5])
    expect(findPointing(candidates, board)).toEqual([
      {
        technique: 'pointing',
        placements: [],
        eliminations: fives([4, 13, 22, 58, 67, 76]),
        units: [22, 13],
        pattern: [31, 40, 49],
        support: [],
        digits: [5],
      },
    ])
  })

  it('gives no step when the line has nothing to remove', () => {
    const candidates = struck(empty, [2, 9, 10, 11, 18, 19, 20, 3, 4, 5, 6, 7, 8], [5])
    expect(findPointing(candidates, board)).toEqual([])
  })

  it('gives no step for one cell, which is a hidden single', () => {
    const candidates = struck(empty, [1, 2, 9, 10, 11, 18, 19, 20], [5])
    expect(findPointing(candidates, board)).toEqual([])
  })

  it('gives no step when the cells share no row and no column', () => {
    const candidates = struck(empty, [1, 2, 9, 10, 11, 18, 19], [5])
    expect(findPointing(candidates, board)).toEqual([])
  })
})

describe('findBoxLineReductions', () => {
  it('removes the digit from the rest of the box when a row keeps it in one box', () => {
    const candidates = struck(empty, [2, 3, 4, 5, 6, 7, 8], [5])
    expect(findBoxLineReductions(candidates, board)).toEqual([
      {
        technique: 'boxLine',
        placements: [],
        eliminations: fives([9, 10, 11, 18, 19, 20]),
        units: [0, 18],
        pattern: [0, 1],
        support: [],
        digits: [5],
      },
    ])
  })

  it('removes the digit from the rest of the box when a column keeps it in one box', () => {
    const candidates = struck(empty, [8, 17, 26, 35, 44, 53], [5])
    expect(findBoxLineReductions(candidates, board)).toEqual([
      {
        technique: 'boxLine',
        placements: [],
        eliminations: fives([60, 61, 69, 70, 78, 79]),
        units: [17, 26],
        pattern: [62, 71, 80],
        support: [],
        digits: [5],
      },
    ])
  })

  it('gives no step when the box has nothing to remove', () => {
    const candidates = struck(empty, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20], [5])
    expect(findBoxLineReductions(candidates, board)).toEqual([])
  })
})
