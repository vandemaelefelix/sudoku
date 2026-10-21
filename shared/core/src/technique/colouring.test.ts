import { describe, expect, it } from 'vitest'
import { createEmptyGrid } from '../grid'
import { computeCandidates } from './candidates'
import { findSimpleColouring } from './colouring'
import { onlyIn } from './testKit'
import type { CellDigit } from './types'

const board = createEmptyGrid()
const empty = computeCandidates(board)

const removed = (cells: readonly number[], digit: number): CellDigit[] =>
  cells.map((cell) => ({ cell, digit }) as CellDigit)

describe('findSimpleColouring', () => {
  // The links join the cells 0, 8, 20, 38 and 44 in one group. The cells 0, 20 and 44 are one colour.
  // The cells 0 and 20 share a box, so that colour is false.
  it('clears the digit from a colour that sees itself (colour wrap)', () => {
    const candidates = onlyIn(empty, 5, [0, 8, 10, 20, 38, 44])
    expect(findSimpleColouring(candidates, board)).toEqual([
      {
        technique: 'simpleColouring',
        placements: [],
        eliminations: removed([0, 20, 44], 5),
        units: [0, 17, 4, 11],
        pattern: [0, 8, 20, 38, 44],
        support: [],
        digits: [5],
        groups: [
          [0, 20, 44],
          [8, 38],
        ],
      },
    ])
  })

  // The cells 11 and 20 see a cell of each colour: 0 and 8 are in row 0 and column 8 of the group.
  it('clears the digit from a cell that sees both colours (colour trap)', () => {
    const candidates = onlyIn(empty, 5, [0, 8, 11, 20, 47, 53, 65])
    expect(findSimpleColouring(candidates, board)).toEqual([
      {
        technique: 'simpleColouring',
        placements: [],
        eliminations: removed([11, 20], 5),
        units: [0, 17, 5],
        pattern: [0, 8, 47, 53],
        support: [],
        digits: [5],
        groups: [
          [0, 53],
          [8, 47],
        ],
      },
    ])
  })

  it('finds nothing when no colour sees itself and no cell sees both colours', () => {
    expect(findSimpleColouring(onlyIn(empty, 5, [0, 8, 47, 53, 65]), board)).toEqual([])
  })

  it('finds nothing for a group of one link', () => {
    expect(findSimpleColouring(onlyIn(empty, 5, [0, 8, 4, 12]), board)).toEqual([])
  })

  it('finds nothing in a position where every cell has all nine candidates', () => {
    expect(findSimpleColouring(empty, board)).toEqual([])
  })
})
