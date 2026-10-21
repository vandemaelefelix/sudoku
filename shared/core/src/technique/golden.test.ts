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
  /** True when the puzzle has one solution. Every generated puzzle has one. */
  unique?: boolean
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
  {
    name: 'simple colouring: colour trap',
    board: '241390670700201900390000102172800596639527814854009327420950761900002450517406209',
    struck: { 11: [8], 22: [8], 67: [3, 8] },
    steps: [
      {
        technique: 'simpleColouring',
        placements: [],
        eliminations: [{ cell: 17, digit: 8 }],
        units: [13, 8, 25, 26, 6],
        pattern: [13, 56, 59, 71, 76, 79],
        support: [],
        digits: [8],
        groups: [
          [13, 59, 79],
          [56, 71, 76],
        ],
      },
    ],
  },
  {
    name: 'simple colouring: colour wrap',
    board: '086039124123000690940126380312967548869200731000000269290000806631098402008602913',
    struck: { 12: [5, 7], 13: [4, 5], 48: [4, 5], 49: [4, 5], 50: [4, 5], 57: [5, 7], 58: [5], 59: [4, 5] },
    steps: [
      {
        technique: 'simpleColouring',
        placements: [],
        eliminations: [
          { cell: 3, digit: 5 },
          { cell: 17, digit: 5 },
          { cell: 20, digit: 5 },
          { cell: 41, digit: 5 },
          { cell: 56, digit: 5 },
          { cell: 70, digit: 5 },
          { cell: 76, digit: 5 },
        ],
        units: [0, 18, 12, 19, 2, 7, 25, 1, 14, 17, 20, 16, 26, 13, 4, 22, 6],
        pattern: [0, 3, 14, 17, 20, 26, 40, 41, 56, 61, 66, 70, 76],
        support: [],
        digits: [5],
        groups: [
          [0, 14, 26, 40, 61, 66],
          [3, 17, 20, 41, 56, 70, 76],
        ],
      },
      {
        technique: 'simpleColouring',
        placements: [],
        eliminations: [{ cell: 56, digit: 7 }],
        units: [0, 18, 12, 19, 2, 7, 1, 17, 20, 16, 26],
        pattern: [0, 3, 13, 17, 20, 26, 61, 66, 70],
        support: [],
        digits: [7],
        groups: [
          [0, 13, 26, 61, 66],
          [3, 17, 20, 70],
        ],
      },
    ],
  },
  {
    name: 'X-chain of three links',
    board: '036000702209000500100002800391754268000920004020803900012405089050000420000208000',
    struck: { 71: [6], 76: [6], 80: [6] },
    steps: [
      {
        technique: 'xChain',
        placements: [],
        eliminations: [{ cell: 76, digit: 1 }],
        units: [22, 4, 15],
        pattern: [41, 42, 49, 78],
        support: [],
        digits: [1],
        links: [
          { from: 49, to: 41, digit: 1, strong: true },
          { from: 41, to: 42, digit: 1, strong: false },
          { from: 42, to: 78, digit: 1, strong: true },
        ],
      },
    ],
  },
  {
    name: 'X-chain of five links',
    board: '100090502059132074000060109700900403000004205405321700516843927980000041047019050',
    struck: { 32: [8], 34: [8], 43: [6, 8] },
    steps: [
      {
        technique: 'xChain',
        placements: [],
        eliminations: [{ cell: 34, digit: 6 }],
        units: [0, 18, 9, 4, 22],
        pattern: [1, 7, 9, 32, 36, 39],
        support: [],
        digits: [6],
        links: [
          { from: 7, to: 1, digit: 6, strong: true },
          { from: 1, to: 9, digit: 6, strong: false },
          { from: 9, to: 36, digit: 6, strong: true },
          { from: 36, to: 39, digit: 6, strong: false },
          { from: 39, to: 32, digit: 6, strong: true },
        ],
      },
    ],
  },
  {
    name: 'XY-chain of six cells',
    board: '193002087264000093785930042916327854478659231352000769039200478041003926027090315',
    steps: [
      {
        technique: 'xyChain',
        placements: [],
        eliminations: [{ cell: 77, digit: 6 }],
        units: [2, 15, 0, 12, 8],
        pattern: [3, 6, 23, 24, 72, 75],
        support: [],
        digits: [6, 1, 4, 5, 8],
        links: [
          { from: 23, to: 24, digit: 1, strong: false },
          { from: 24, to: 6, digit: 6, strong: false },
          { from: 6, to: 3, digit: 5, strong: false },
          { from: 3, to: 75, digit: 4, strong: false },
          { from: 75, to: 72, digit: 8, strong: false },
        ],
      },
    ],
  },
  {
    name: 'XY-chain with two eliminations',
    board: '005490320009600540001503967950042106100065209700918435080179654590830712017250893',
    steps: [
      {
        technique: 'xyChain',
        placements: [],
        eliminations: [
          { cell: 29, digit: 3 },
          { cell: 38, digit: 3 },
        ],
        units: [10, 5, 11],
        pattern: [19, 37, 46, 47, 56],
        support: [],
        digits: [3, 2, 4, 6],
        links: [
          { from: 37, to: 19, digit: 4, strong: false },
          { from: 19, to: 46, digit: 2, strong: false },
          { from: 46, to: 47, digit: 6, strong: false },
          { from: 47, to: 56, digit: 2, strong: false },
        ],
      },
    ],
  },
  {
    name: 'unique rectangle',
    board: '050000604760549210400000500070050936005003027020000051516300749200796185987415362',
    unique: true,
    steps: [
      {
        technique: 'uniqueRectangle',
        placements: [],
        eliminations: [
          { cell: 20, digit: 3 },
          { cell: 20, digit: 8 },
        ],
        units: [18, 20],
        pattern: [11, 17, 20, 26],
        support: [],
        digits: [3, 8],
      },
    ],
  },
]

describe('nextSteps on golden positions', () => {
  it.for(GOLDEN)('finds the $name', ({ board, struck, steps, unique }) => {
    const cells = boardFromString(board)
    let candidates = computeCandidates(cells)
    for (const [cell, digits] of Object.entries(struck ?? {})) {
      candidates = strike(candidates, [Number(cell)], digits)
    }
    expect(nextSteps(candidates, cells, undefined, { unique })).toEqual(steps)
  })
})
