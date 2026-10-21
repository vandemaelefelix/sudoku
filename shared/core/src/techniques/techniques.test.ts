import { describe, expect, it } from 'vitest'
import { claiming, pointing } from './intersections'
import { fullHouse, hiddenSingle, nakedSingle } from './singles'
import { hiddenPair, hiddenQuad, hiddenTriple, nakedPair, nakedQuad, nakedTriple } from './subsets'
import { pairs, stateOf, without } from './testState'
import { TECHNIQUES } from './techniques'

const NINE = [1, 2, 3, 4, 5, 6, 7, 8, 9]

describe('TECHNIQUES', () => {
  it('lists the techniques in the solver order', () => {
    expect(TECHNIQUES.map((technique) => technique.id)).toEqual([
      'full-house',
      'hidden-single',
      'naked-single',
      'pointing',
      'claiming',
      'naked-pair',
      'hidden-pair',
      'naked-triple',
      'hidden-triple',
      'naked-quad',
      'hidden-quad',
    ])
  })

  it.for(TECHNIQUES)('$id finds nothing in a state where every cell has all nine candidates', (technique) => {
    expect(technique.find(stateOf())).toBeNull()
  })
})

describe('full house', () => {
  it('places the last digit of a row with one empty cell', () => {
    const state = stateOf({ values: { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8 } })
    expect(fullHouse.find(state)).toEqual({
      technique: 'full-house',
      placements: [{ cell: 8, digit: 9 }],
      eliminations: [],
      units: [{ kind: 'row', index: 0 }],
      cells: [8],
      digits: [9],
    })
  })

  it('looks at the boxes first', () => {
    const state = stateOf({ values: { 30: 1, 31: 2, 32: 3, 39: 4, 41: 6, 48: 7, 49: 8, 50: 9 } })
    expect(fullHouse.find(state)).toEqual({
      technique: 'full-house',
      placements: [{ cell: 40, digit: 5 }],
      eliminations: [],
      units: [{ kind: 'box', index: 4 }],
      cells: [40],
      digits: [5],
    })
  })
})

describe('hidden single', () => {
  it('places the one cell of a row that can hold a digit', () => {
    const state = stateOf({ candidates: without([27, 28, 29, 31, 32, 33, 34, 35], [5]) })
    expect(hiddenSingle.find(state)).toEqual({
      technique: 'hidden-single',
      placements: [{ cell: 30, digit: 5 }],
      eliminations: [],
      units: [{ kind: 'row', index: 3 }],
      cells: [30],
      digits: [5],
    })
  })
})

describe('naked single', () => {
  it('places the only candidate of a cell', () => {
    const state = stateOf({ candidates: { 40: [7] } })
    expect(nakedSingle.find(state)).toEqual({
      technique: 'naked-single',
      placements: [{ cell: 40, digit: 7 }],
      eliminations: [],
      units: [],
      cells: [40],
      digits: [7],
    })
  })
})

describe('pointing', () => {
  it('clears a digit from the row when the box holds it in that row only', () => {
    const state = stateOf({ candidates: without([2, 9, 10, 11, 18, 19, 20], [4]) })
    expect(pointing.find(state)).toEqual({
      technique: 'pointing',
      placements: [],
      eliminations: pairs([3, 4, 5, 6, 7, 8], [4]),
      units: [
        { kind: 'box', index: 0 },
        { kind: 'row', index: 0 },
      ],
      cells: [0, 1],
      digits: [4],
    })
  })

  it('clears a digit from the column when the box holds it in that column only', () => {
    const state = stateOf({ candidates: without([1, 2, 10, 11, 18, 19, 20], [4]) })
    expect(pointing.find(state)).toEqual({
      technique: 'pointing',
      placements: [],
      eliminations: pairs([27, 36, 45, 54, 63, 72], [4]),
      units: [
        { kind: 'box', index: 0 },
        { kind: 'column', index: 0 },
      ],
      cells: [0, 9],
      digits: [4],
    })
  })
})

describe('claiming', () => {
  it('clears a digit from the box when the row holds it in that box only', () => {
    const state = stateOf({ candidates: without([0, 1, 2, 5, 6, 7, 8], [6]) })
    expect(claiming.find(state)).toEqual({
      technique: 'claiming',
      placements: [],
      eliminations: pairs([12, 13, 14, 21, 22, 23], [6]),
      units: [
        { kind: 'row', index: 0 },
        { kind: 'box', index: 1 },
      ],
      cells: [3, 4],
      digits: [6],
    })
  })

  it('clears a digit from the box when the column holds it in that box only', () => {
    const state = stateOf({ candidates: without([18, 27, 36, 45, 54, 63, 72], [2]) })
    expect(claiming.find(state)).toEqual({
      technique: 'claiming',
      placements: [],
      eliminations: pairs([1, 2, 10, 11, 19, 20], [2]),
      units: [
        { kind: 'column', index: 0 },
        { kind: 'box', index: 0 },
      ],
      cells: [0, 9],
      digits: [2],
    })
  })
})

describe('naked pair', () => {
  it('clears the pair digits from a row when two cells hold only those two digits', () => {
    const state = stateOf({ candidates: { 0: [1, 2], 4: [1, 2] } })
    expect(nakedPair.find(state)).toEqual({
      technique: 'naked-pair',
      placements: [],
      eliminations: [1, 2, 3, 5, 6, 7, 8].flatMap((cell) => pairs([cell], [1, 2])),
      units: [{ kind: 'row', index: 0 }],
      cells: [0, 4],
      digits: [1, 2],
    })
  })

  it('looks at the boxes first', () => {
    const state = stateOf({ candidates: { 0: [1, 2], 1: [1, 2] } })
    expect(nakedPair.find(state)).toEqual({
      technique: 'naked-pair',
      placements: [],
      eliminations: [2, 9, 10, 11, 18, 19, 20].flatMap((cell) => pairs([cell], [1, 2])),
      units: [{ kind: 'box', index: 0 }],
      cells: [0, 1],
      digits: [1, 2],
    })
  })
})

describe('hidden pair', () => {
  it('clears the other digits from two cells that hold a pair of digits alone in the row', () => {
    const state = stateOf({ candidates: without([37, 38, 39, 41, 42, 43, 44], [3, 8]) })
    expect(hiddenPair.find(state)).toEqual({
      technique: 'hidden-pair',
      placements: [],
      eliminations: pairs([36, 40], [1, 2, 4, 5, 6, 7, 9]),
      units: [{ kind: 'row', index: 4 }],
      cells: [36, 40],
      digits: [3, 8],
    })
  })
})

describe('naked triple', () => {
  it('clears three digits from a row when three cells hold only those digits', () => {
    const state = stateOf({ candidates: { 18: [1, 2], 22: [2, 3], 26: [1, 3] } })
    expect(nakedTriple.find(state)).toEqual({
      technique: 'naked-triple',
      placements: [],
      eliminations: [19, 20, 21, 23, 24, 25].flatMap((cell) => pairs([cell], [1, 2, 3])),
      units: [{ kind: 'row', index: 2 }],
      cells: [18, 22, 26],
      digits: [1, 2, 3],
    })
  })
})

describe('hidden triple', () => {
  it('clears the other digits from three cells that hold three digits alone in the column', () => {
    const state = stateOf({
      candidates: {
        ...without([5, 23, 32, 50, 59, 77], [4, 5, 6]),
        14: NINE.filter((digit) => digit !== 6),
        41: NINE.filter((digit) => digit !== 4),
        68: NINE.filter((digit) => digit !== 5),
      },
    })
    expect(hiddenTriple.find(state)).toEqual({
      technique: 'hidden-triple',
      placements: [],
      eliminations: pairs([14, 41, 68], [1, 2, 3, 7, 8, 9]),
      units: [{ kind: 'column', index: 5 }],
      cells: [14, 41, 68],
      digits: [4, 5, 6],
    })
  })
})

describe('naked quad', () => {
  it('clears four digits from a row when four cells hold only those digits', () => {
    const state = stateOf({ candidates: { 54: [1, 2], 57: [2, 3], 60: [3, 4], 62: [1, 4] } })
    expect(nakedQuad.find(state)).toEqual({
      technique: 'naked-quad',
      placements: [],
      eliminations: [55, 56, 58, 59, 61].flatMap((cell) => pairs([cell], [1, 2, 3, 4])),
      units: [{ kind: 'row', index: 6 }],
      cells: [54, 57, 60, 62],
      digits: [1, 2, 3, 4],
    })
  })
})

describe('hidden quad', () => {
  it('clears the other digits from four cells that hold four digits alone in the column', () => {
    const state = stateOf({
      candidates: {
        ...without([8, 26, 44, 62, 80], [6, 7, 8, 9]),
        17: [1, 2, 3, 4, 5, 6, 7],
        35: [1, 2, 3, 4, 5, 7, 8],
        53: [1, 2, 3, 4, 5, 8, 9],
        71: [1, 2, 3, 4, 5, 9, 6],
      },
    })
    expect(hiddenQuad.find(state)).toEqual({
      technique: 'hidden-quad',
      placements: [],
      eliminations: pairs([17, 35, 53, 71], [1, 2, 3, 4, 5]),
      units: [{ kind: 'column', index: 8 }],
      cells: [17, 35, 53, 71],
      digits: [6, 7, 8, 9],
    })
  })
})
