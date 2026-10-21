import { describe, expect, it } from 'vitest'
import { createEmptyGrid } from '../grid'
import { computeCandidates } from './candidates'
import { nextSteps } from './nextSteps'
import { TECHNIQUE_ORDER } from './order'
import { findUniqueRectangles } from './rectangles'
import { withDigits } from './testKit'

const board = createEmptyGrid()
const empty = computeCandidates(board)
const pair = { 0: [1, 2], 3: [1, 2], 9: [1, 2] }
const RANK = TECHNIQUE_ORDER.filter((rank) => rank.technique === 'uniqueRectangle')

describe('findUniqueRectangles', () => {
  // The cells 0, 3, 9 and 12 lie in rows 0 and 1, columns 0 and 3, and boxes 0 and 1.
  it('clears both digits of the pair from the fourth cell', () => {
    const candidates = withDigits(empty, { ...pair, 12: [1, 2, 3, 4] })
    expect(findUniqueRectangles(candidates, board)).toEqual([
      {
        technique: 'uniqueRectangle',
        placements: [],
        eliminations: [
          { cell: 12, digit: 1 },
          { cell: 12, digit: 2 },
        ],
        units: [19, 18],
        pattern: [0, 3, 9, 12],
        support: [],
        digits: [1, 2],
      },
    ])
  })

  it('finds nothing when the fourth cell lacks one digit of the pair', () => {
    expect(findUniqueRectangles(withDigits(empty, { ...pair, 12: [1, 3, 4] }), board)).toEqual([])
  })

  it('finds nothing when the fourth cell holds only the pair', () => {
    expect(findUniqueRectangles(withDigits(empty, { ...pair, 12: [1, 2] }), board)).toEqual([])
  })

  it('finds nothing when a corner holds a different pair', () => {
    expect(findUniqueRectangles(withDigits(empty, { ...pair, 9: [1, 3], 12: [1, 2, 3] }), board)).toEqual([])
  })

  it('finds nothing when the four cells lie in four boxes', () => {
    const candidates = withDigits(empty, { 0: [1, 2], 3: [1, 2], 27: [1, 2], 30: [1, 2, 3] })
    expect(findUniqueRectangles(candidates, board)).toEqual([])
  })

  it('finds nothing in a position where every cell has all nine candidates', () => {
    expect(findUniqueRectangles(empty, board)).toEqual([])
  })
})

describe('the unique option of nextSteps', () => {
  const candidates = withDigits(empty, { ...pair, 12: [1, 2, 3, 4] })

  it('skips the unique rectangle unless the caller says that the puzzle has one solution', () => {
    expect(RANK).toHaveLength(1)
    expect(nextSteps(candidates, board, RANK)).toEqual([])
    expect(nextSteps(candidates, board, RANK, { unique: false })).toEqual([])
    expect(nextSteps(candidates, board, RANK, { unique: true }).map((step) => step.technique)).toEqual([
      'uniqueRectangle',
    ])
  })
})
