import { describe, expect, it } from 'vitest'
import { createEmptyGrid } from '../grid'
import { computeCandidates } from './candidates'
import { findFullHouses, findHiddenSingles, findNakedSingles } from './singles'
import { boardWith, struck } from './testKit'

describe('findFullHouses', () => {
  it('places the missing digit of a row with one empty cell', () => {
    const board = boardWith({ 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8 })
    expect(findFullHouses(computeCandidates(board), board)).toEqual([
      {
        technique: 'fullHouse',
        placements: [{ cell: 8, digit: 9 }],
        eliminations: [],
        units: [0],
        pattern: [8],
        support: [],
        digits: [9],
      },
    ])
  })

  it('names the box when a cell is the last of a box and of a row', () => {
    const board = boardWith({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 3, 10: 4, 11: 5, 18: 6, 19: 7, 20: 8 })
    const steps = findFullHouses(computeCandidates(board), board)
    expect(steps).toHaveLength(1)
    expect(steps[0]).toMatchObject({ placements: [{ cell: 0, digit: 9 }], units: [18] })
  })

  it('finds nothing when no unit has one empty cell', () => {
    const board = createEmptyGrid()
    expect(findFullHouses(computeCandidates(board), board)).toEqual([])
  })
})

describe('findHiddenSingles', () => {
  // Four 1s leave the cell 20 as the only place for a 1 in the top-left box.
  const boxBoard = boardWith({ 5: 1, 17: 1, 27: 1, 64: 1 })

  it('finds a hidden single in a box, with the cells that block the digit', () => {
    expect(findHiddenSingles(computeCandidates(boxBoard), boxBoard, ['box'])).toEqual([
      {
        technique: 'hiddenSingle',
        placements: [{ cell: 20, digit: 1 }],
        eliminations: [],
        units: [18],
        pattern: [20],
        support: [5, 17, 27, 64],
        digits: [1],
      },
    ])
  })

  // The 1 fits only the cell 43 in row 4, in column 7 and in the middle-right box.
  const lineBoard = boardWith({ 31: 1, 46: 1, 6: 1, 71: 1 })

  it('names the box when it looks at boxes only', () => {
    expect(findHiddenSingles(computeCandidates(lineBoard), lineBoard, ['box'])).toEqual([
      {
        technique: 'hiddenSingle',
        placements: [{ cell: 43, digit: 1 }],
        eliminations: [],
        units: [23],
        pattern: [43],
        support: [6, 31, 46, 71],
        digits: [1],
      },
    ])
  })

  it('finds a hidden single in a row and gives one step when the column agrees', () => {
    expect(findHiddenSingles(computeCandidates(lineBoard), lineBoard, ['row', 'column'])).toEqual([
      {
        technique: 'hiddenSingle',
        placements: [{ cell: 43, digit: 1 }],
        eliminations: [],
        units: [4],
        pattern: [43],
        support: [6, 31, 46, 71],
        digits: [1],
      },
    ])
  })

  it('has no support cell for a cell that an earlier elimination struck', () => {
    const board = createEmptyGrid()
    const candidates = struck(computeCandidates(board), [1, 2, 9, 10, 11, 18, 19, 20], [5])
    expect(findHiddenSingles(candidates, board, ['box'])).toEqual([
      {
        technique: 'hiddenSingle',
        placements: [{ cell: 0, digit: 5 }],
        eliminations: [],
        units: [18],
        pattern: [0],
        support: [],
        digits: [5],
      },
    ])
  })

  it('skips a digit that the board already places in the unit', () => {
    const board = boardWith({ 0: 1 })
    expect(findHiddenSingles(computeCandidates(board), board, ['box'])).toEqual([])
  })
})

describe('findNakedSingles', () => {
  const board = boardWith({ 1: 1, 2: 2, 9: 3, 18: 4, 27: 5, 3: 6, 10: 7, 19: 8 })

  it('places the only candidate of a cell, with one blocking cell for each other digit', () => {
    expect(findNakedSingles(computeCandidates(board), board)).toEqual([
      {
        technique: 'nakedSingle',
        placements: [{ cell: 0, digit: 9 }],
        eliminations: [],
        units: [0, 9, 18],
        pattern: [0],
        support: [1, 2, 3, 9, 10, 18, 19, 27],
        digits: [9],
      },
    ])
  })

  it('skips a cell with two candidates and a cell without candidates', () => {
    const empty = createEmptyGrid()
    expect(findNakedSingles(computeCandidates(empty), empty)).toEqual([])
    const noCandidates = new Uint16Array(81)
    expect(findNakedSingles(noCandidates, empty)).toEqual([])
  })
})
