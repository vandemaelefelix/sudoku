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

// Each position comes from a generated puzzle, played with the steps of the technique solver. Each step
// was checked by hand against the definition of its technique. No easier technique applies in the position.
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
  {
    name: 'X-wing in two rows',
    board: '037214098049078031810309047386421759090830104401900380104780903008093410963142875',
    steps: [
      {
        technique: 'xWing',
        placements: [],
        eliminations: [{ cell: 50, digit: 6 }],
        units: [4, 6, 14, 16],
        pattern: [41, 43, 59, 61],
        support: [],
        digits: [6],
      },
    ],
  },
  {
    name: 'swordfish in three rows',
    board: '010045000003912480204070015002100640009703100100004070320000704860430001000200030',
    struck: { 2: [7], 3: [6], 47: [5], 72: [5, 7], 73: [5, 7], 74: [5], 76: [8, 9], 77: [6, 8, 9], 78: [9], 80: [9] },
    steps: [
      {
        technique: 'swordfish',
        placements: [],
        eliminations: [
          { cell: 0, digit: 6 },
          { cell: 8, digit: 6 },
          { cell: 49, digit: 6 },
          { cell: 58, digit: 6 },
        ],
        units: [1, 4, 8, 9, 13, 17],
        pattern: [9, 17, 36, 40, 76, 80],
        support: [],
        digits: [6],
      },
    ],
  },
  {
    name: 'two skyscrapers that share a strong link',
    board: '971634005286175943534080617710060438860341700493708061347016000609803174108497306',
    steps: [
      {
        technique: 'skyscraper',
        placements: [],
        eliminations: [{ cell: 49, digit: 5 }],
        units: [12, 15],
        pattern: [30, 51, 57, 60],
        support: [],
        digits: [5],
      },
      {
        technique: 'skyscraper',
        placements: [],
        eliminations: [{ cell: 57, digit: 5 }],
        units: [13, 15],
        pattern: [49, 51, 60, 67],
        support: [],
        digits: [5],
      },
    ],
  },
  {
    name: 'two-string kite',
    board: '680000092104090076309060015798326541413975268562004739940600123206000984831249657',
    steps: [
      {
        technique: 'twoStringKite',
        placements: [],
        eliminations: [{ cell: 23, digit: 7 }],
        units: [6, 10, 24],
        pattern: [19, 56, 59, 64],
        support: [],
        digits: [7],
      },
    ],
  },
  {
    name: 'XY-wing',
    board: '580016430014853620060700185248135796190460058056000014875621943431579862629300571',
    steps: [
      {
        technique: 'xyWing',
        placements: [],
        eliminations: [{ cell: 23, digit: 2 }],
        units: [11, 4],
        pattern: [38, 20, 41],
        support: [],
        digits: [2, 3, 7],
      },
    ],
  },
  {
    name: 'XYZ-wing',
    board: '382659004617384005500721836450017003000008001000536400800003007905102048060805000',
    steps: [
      {
        technique: 'xyzWing',
        placements: [],
        eliminations: [{ cell: 45, digit: 2 }],
        units: [21, 5],
        pattern: [46, 36, 53],
        support: [],
        digits: [2, 7, 9],
      },
    ],
  },
  {
    name: 'two W-wings',
    board: '051087003300000702040300150572000316000726495694135827020903504000000271405070030',
    steps: [
      {
        technique: 'wWing',
        placements: [],
        eliminations: [{ cell: 18, digit: 8 }],
        units: [0, 20, 9],
        pattern: [26, 63, 6, 0],
        support: [],
        digits: [8, 9],
      },
      {
        technique: 'wWing',
        placements: [],
        eliminations: [
          { cell: 3, digit: 2 },
          { cell: 18, digit: 2 },
        ],
        units: [20, 0, 2],
        pattern: [0, 23, 6, 26],
        support: [],
        digits: [2, 9],
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
