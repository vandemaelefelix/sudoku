import { createGame } from '../game/createGame'
import { solve } from '../solver'
import { computeCandidates } from '../technique/candidates'
import { nextSteps } from '../technique/nextSteps'
import type { Step, TechniqueId } from '../technique/types'
import { byChoice, planHint } from './plan'
import { HINT_ORDER } from './techniques'

/**
 * The page of one technique on the techniques screen. Its explanation is in the catalogues of the app, under
 * `technique.<id>.explanation`: at most 4 short sentences (ADR-033).
 * example: a position of a generated puzzle, as 81 digits each: the givens, then the board. 0 marks an empty cell.
 */
export type TechniquePage = {
  readonly example: readonly [givens: string, board: string]
}

/**
 * One page for each technique with hint text. The hint plan of each example position starts with its technique, except
 * for the quads and the jellyfish: an easier step comes first there, but their finder fires on the board.
 */
export const TECHNIQUE_PAGES: Readonly<Partial<Record<TechniqueId, TechniquePage>>> = {
  fullHouse: {
    example: [
      '876000004000000700091200580034010809217069050000305070050008600040076908008000040',
      '876000004025680700091207586534010809217069050080305070050008600040076908008000040',
    ],
  },
  hiddenSingle: {
    example: [
      '876000004000000700091200580034010809217069050000305070050008600040076908008000040',
      '876000004000000700091200580034010809217069050000305070050008600040076908008000040',
    ],
  },
  nakedSingle: {
    example: [
      '008090105090008327200030000000010006019065238000000970806021090002983000900070002',
      '008090105090058327200030009000019006419765238000040971806021093002983004900070002',
    ],
  },
  pointing: {
    example: [
      '609312700307450010080007300904000005000705000508630200000209000002140003006003409',
      '609312700327458916080967302904821605260795000508634290000209060092146003006503429',
    ],
  },
  boxLine: {
    example: [
      '908040210154602730006130000897000300000079040405300890000000000301000670000714000',
      '938547216154692738006138050897451362003879040415326897000063000301085670000714003',
    ],
  },
  nakedPair: {
    example: [
      '000019624240006000600040508000000006020000093004090810007930060500000100190080000',
      '000019624240006901619040508900000056020000093004090812487931265500000189190080347',
    ],
  },
  nakedTriple: {
    example: [
      '000009300050607090008400010045700030900086000100500000000000020000304950200900000',
      '000809300050607090098402010045791030973286040100543009509108020000324950204905000',
    ],
  },
  nakedQuad: {
    example: [
      '000002000000107400100080500700001060060004302240900001000008600000090003309020080',
      '000002000000107400100080500700001060060004302240900001000008600000090003309020080',
    ],
  },
  hiddenPair: {
    example: [
      '000672800006080730705000200000100623010700000098320001060230100400000000009000060',
      '000672800006080730785003206574198623010700000698320071867230100400000000009000060',
    ],
  },
  hiddenTriple: {
    example: [
      '600000000009000041408520060050900106004000200000037058000098000006070300143000807',
      '600000082009000041408520063050900106004000209000037458000398614006070325143000897',
    ],
  },
  hiddenQuad: {
    example: [
      '000002000000107400100080500700001060060004302240900001000008600000090003309020080',
      '000542000000137400104689507700251064061874302240963001000318600000795203309426085',
    ],
  },
  xWing: {
    example: [
      '000903120000020000000050900800002001906004350010390004001005600009180030500200400',
      '050903120090020000002050900800562791906014350015390064001005609009186030560209410',
    ],
  },
  swordfish: {
    example: [
      '007000600000070018002806074000030080900720106000500490001002800009001060063000040',
      '897140620600270918002896074000639080908724106006518490001062809089051060063987041',
    ],
  },
  jellyfish: {
    example: [
      '000002000000107400100080500700001060060004302240900001000008600000090003309020080',
      '000002000000107400100080500700001060060004302240900001000008600000090003309020080',
    ],
  },
  skyscraper: {
    example: [
      '058062400000150800040870201503001078700000040004000900000507002070608009000000000',
      '158062407207154806040870251503401678700000140014700920001507302072608519005210704',
    ],
  },
  twoStringKite: {
    example: [
      '080079100000004602000100050390050700060300500005000009009003010006010090510900806',
      '682579143951834672000100958390050700060390500005700009009683015806015097510907806',
    ],
  },
  xyWing: {
    example: [
      '001260070520080000070000002002500030009000725005700009300000400058006000207001560',
      '981265374523487916674100852702500038009600725005720049316952487458376291297841563',
    ],
  },
  xyzWing: {
    example: [
      '000017300200040080000000000408935070700000506150400000901050003820000050005302700',
      '500017300200043080300009000468935070739128546152476030971054003823701050645302700',
    ],
  },
  wWing: {
    example: [
      '000006835005200006800100040904802700082010900057090002000000000028030400009020000',
      '201006835005200106800100240904802700082010904157094082000000020028030400009020000',
    ],
  },
}

export type TechniqueExample = {
  readonly givens: readonly number[]
  readonly solution: readonly number[]
  readonly board: readonly number[]
  /** The step that the technique finds on the board, with the candidates from the givens and the entries. */
  readonly step: Step
}

const digitsOf = (text: string): number[] => [...text].map(Number)

/**
 * The example of a technique page. The step is the first step of the hint plan of the position when the plan starts with
 * the technique, so the page shows what a hint shows. Else it is the first step that the technique finds. Null for a
 * technique without a page.
 */
export function techniqueExample(technique: TechniqueId): TechniqueExample | null {
  const page = TECHNIQUE_PAGES[technique]
  if (page === undefined) return null
  const givens = digitsOf(page.example[0])
  const board = digitsOf(page.example[1])
  const result = solve(givens)
  // The tests check that each example has exactly one solution.
  if (result.count !== 1) return null
  const { solution } = result
  const entries = board.map((digit, cell) => (givens[cell] === 0 ? digit : 0))
  const plan = planHint(createGame({ givens, solution, entries }))
  const first = plan?.kind === 'steps' ? plan.steps[0] : undefined
  if (first?.technique === technique) return { givens, solution, board, step: first }
  const ranks = HINT_ORDER.filter((rank) => rank.technique === technique)
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts the fresh array of nextSteps
  const step = nextSteps(computeCandidates(board), board, ranks, { unique: true }).sort(byChoice(null))[0]
  return step === undefined ? null : { givens, solution, board, step }
}
