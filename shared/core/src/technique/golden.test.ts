import { describe, expect, it } from 'vitest'
import { computeCandidates } from './candidates'
import { nextSteps } from './nextSteps'
import { boardFromString, struck as strike } from './testKit'
import type { Step } from './types'

type Golden = {
  name: string
  board: string
  /** Candidates that earlier steps of the same solve removed. Key: cell. Value: digits. */
  struck?: Record<number, number[]>
  steps: Step[]
}

// Each position comes from a generated puzzle, played with the tier 1 steps. Each step was checked
// by hand against the definition of its technique. No easier technique applies in the position.
const GOLDEN: Golden[] = [
  {
    name: 'full house: the last cell of column 1',
    board: '876000024020000700091207580034010809217069050000345070050008600040576908068000040',
    steps: [
      {
        technique: 'fullHouse',
        placements: [{ cell: 46, digit: 8 }],
        eliminations: [],
        units: [10],
        pattern: [46],
        support: [],
        digits: [8],
      },
    ],
  },
  {
    name: 'hidden single in a box',
    board: '008090105090058327200130009000019006019065238000040971806021093072983004900076002',
    steps: [
      {
        technique: 'hiddenSingle',
        placements: [{ cell: 60, digit: 7 }],
        eliminations: [],
        units: [26],
        pattern: [60],
        support: [52, 64, 76],
        digits: [7],
      },
    ],
  },
  {
    name: 'hidden single in a row',
    board: '008090105090058327200130009000019006019065238000040971806021793072983004900076002',
    steps: [
      {
        technique: 'hiddenSingle',
        placements: [{ cell: 36, digit: 4 }],
        eliminations: [],
        units: [4],
        pattern: [36],
        support: [49],
        digits: [4],
      },
    ],
  },
  {
    name: 'naked single',
    board: '008090105090058327200130009000019006419765238000040971806021793072983004900076002',
    steps: [
      {
        technique: 'nakedSingle',
        placements: [{ cell: 50, digit: 2 }],
        eliminations: [],
        units: [5, 14, 22],
        pattern: [50],
        support: [14, 31, 32, 39, 40, 41, 49, 68],
        digits: [2],
      },
    ],
  },
  {
    name: 'pointing pair',
    board: '100072068562819743780063200206754380470386002800291476628945137347128695900637824',
    steps: [
      {
        technique: 'pointing',
        placements: [],
        eliminations: [{ cell: 38, digit: 5 }],
        units: [23, 4],
        pattern: [42, 43],
        support: [],
        digits: [5],
      },
    ],
  },
  {
    name: 'box-line reduction',
    board: '008290100090658327200130009020819006019765208685342971806021093002983000900076002',
    steps: [
      {
        technique: 'boxLine',
        placements: [],
        eliminations: [
          { cell: 0, digit: 4 },
          { cell: 1, digit: 4 },
          { cell: 19, digit: 4 },
          { cell: 20, digit: 4 },
        ],
        units: [1, 18],
        pattern: [9, 11],
        support: [],
        digits: [4],
      },
    ],
  },
  {
    name: 'naked pair',
    board: '705130408000850000863497251000009680008064000506308004147685932389721546652943817',
    steps: [
      {
        technique: 'nakedPair',
        placements: [],
        eliminations: [
          { cell: 46, digit: 1 },
          { cell: 46, digit: 7 },
          { cell: 52, digit: 7 },
        ],
        units: [5],
        pattern: [49, 51],
        support: [],
        digits: [1, 7],
      },
    ],
  },
  {
    name: 'hidden pair',
    board: '046003728037048569850070314395400187624781935781935246070000451410007693560004872',
    steps: [
      {
        technique: 'hiddenPair',
        placements: [],
        eliminations: [
          { cell: 56, digit: 2 },
          { cell: 56, digit: 9 },
          { cell: 57, digit: 2 },
          { cell: 57, digit: 6 },
        ],
        units: [6],
        pattern: [56, 57],
        support: [],
        digits: [3, 8],
      },
    ],
  },
  {
    name: 'naked triple',
    board: '100490502059132074204060109720900403000004205405321700516843927982000341347219050',
    struck: { 32: [8], 34: [8], 43: [8] },
    steps: [
      {
        technique: 'nakedTriple',
        placements: [],
        eliminations: [
          { cell: 37, digit: 6 },
          { cell: 38, digit: 8 },
          { cell: 43, digit: 6 },
        ],
        units: [4],
        pattern: [36, 39, 40],
        support: [],
        digits: [6, 7, 8],
      },
    ],
  },
  {
    name: 'hidden triple',
    board: '300900506000000801007000003190782005400095210020000000841539762239876154000241389',
    struck: { 2: [8], 11: [5, 6], 19: [5, 6], 37: [8], 51: [4], 52: [4, 7] },
    steps: [
      {
        technique: 'hiddenTriple',
        placements: [],
        eliminations: [
          { cell: 45, digit: 6 },
          { cell: 47, digit: 3 },
          { cell: 47, digit: 6 },
        ],
        units: [5],
        pattern: [45, 47, 53],
        support: [],
        digits: [5, 7, 8],
      },
    ],
  },
]

describe('nextSteps on golden positions', () => {
  it.for(GOLDEN)('finds the $name', ({ board, struck, steps }) => {
    const cells = boardFromString(board)
    let candidates = computeCandidates(cells)
    for (const [cell, digits] of Object.entries(struck ?? {})) {
      candidates = strike(candidates, [Number(cell)], digits)
    }
    expect(nextSteps(candidates, cells)).toEqual(steps)
  })
})
