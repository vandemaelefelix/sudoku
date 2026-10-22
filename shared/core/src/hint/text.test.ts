import { describe, expect, it } from 'vitest'
import { createGame } from '../game/createGame'
import type { Digit } from '../game/types'
import { TECHNIQUE_ORDER } from '../technique/order'
import { playThrough } from '../technique/playThrough'
import { computeCandidates } from '../technique/candidates'
import { findFish } from '../technique/fish'
import { findSkyscrapers, findTwoStringKites } from '../technique/singleDigit'
import { findHiddenSubsets, findNakedSubsets } from '../technique/subsets'
import { onlyIn, struck, ungradedPuzzle, withDigits } from '../technique/testKit'
import { sees } from '../technique/sight'
import { findWWings, findXyWings, findXyzWings } from '../technique/wings'
import { createEmptyGrid } from '../grid'
import type { CellDigit, Step, TechniqueId } from '../technique/types'
import { planHint } from './plan'
import { HINT_TECHNIQUE_IDS, HINT_TECHNIQUES } from './techniques'
import {
  cell,
  cells,
  cellsIn,
  digits,
  HINT_MESSAGE_IDS,
  type HintMessage,
  type HintValue,
  lines,
  message,
  unit,
  units,
} from './message'
import { hintMessage } from './text'
import type { HintPlan, HintRung } from './types'

const RUNGS: readonly HintRung[] = [1, 2, 3, 4]

function placement(technique: TechniqueId, cell: number, digit: Digit, units: number[]): Step {
  return {
    technique,
    placements: [{ cell, digit }],
    eliminations: [],
    units,
    pattern: [cell],
    support: [],
    digits: [digit],
  }
}

function elimination(
  technique: TechniqueId,
  units: number[],
  pattern: number[],
  digits: Digit[],
  eliminations: CellDigit[],
): Step {
  return { technique, placements: [], eliminations, units, pattern, support: [], digits }
}

/** A plan whose step `index` is `step`. The plan ends at a placement, as every steps plan does. */
function planWith(step: Step, index = 0): HintPlan {
  const last = placement('hiddenSingle', 80, 9, [8])
  const steps = [...Array.from({ length: index }, () => step), step, ...(step.placements.length ? [] : [last])]
  return { kind: 'steps', steps, answer: steps.at(-1)!.placements[0]! }
}

const rungs = (step: Step, index = 0): HintMessage[] =>
  RUNGS.map((rung) => hintMessage(planWith(step, index), index, rung))

/** The rung 2 message: the app writes the name and the definition of the technique. */
const technique = (id: TechniqueId): HintMessage => ({ ...message('hint.technique'), technique: id })

/** A value of a real plan: a digit, or a part whose cells and units exist. */
function isValid(value: HintValue): boolean {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 1 && value <= 9
  const isCell = (index: number) => Number.isInteger(index) && index >= 0 && index <= 80
  const isUnit = (index: number) => Number.isInteger(index) && index >= 0 && index <= 26
  switch (value.kind) {
    case 'cell':
      return isCell(value.cell)
    case 'cells':
      return value.cells.length > 0 && value.cells.every(isCell)
    case 'unit':
      return isUnit(value.unit)
    case 'units':
    case 'lines':
      return value.units.length > 0 && value.units.every(isUnit)
    case 'cellsIn':
      return isUnit(value.unit) && value.cells.length > 0 && value.cells.every(isCell)
    case 'digits':
      return value.digits.length > 0 && value.digits.every((digit) => isValid(digit))
  }
}

describe('hintMessage', () => {
  it('teaches a full house', () => {
    expect(rungs(placement('fullHouse', 2, 4, [0]))).toEqual([
      message('hint.fullHouse.look', { unit: unit(0) }),
      technique('fullHouse'),
      message('hint.fullHouse.why', { unit: unit(0), digit: 4 }),
      message('hint.put', { cell: cell(2), digit: 4 }),
    ])
  })

  it('teaches a hidden single', () => {
    expect(rungs(placement('hiddenSingle', 20, 1, [18]))).toEqual([
      message('hint.look.unit', { unit: unit(18) }),
      technique('hiddenSingle'),
      message('hint.hiddenSingle.why', { unit: unit(18), cell: cell(20), digit: 1 }),
      message('hint.put', { cell: cell(20), digit: 1 }),
    ])
  })

  it('names the steps before in the why of a later hidden single', () => {
    expect(rungs(placement('hiddenSingle', 20, 1, [18]), 1)[2]).toEqual(
      message('hint.hiddenSingle.whyLater', { unit: unit(18), cell: cell(20), digit: 1 }),
    )
  })

  it('teaches a naked single, and names the cell at rung 1', () => {
    expect(rungs(placement('nakedSingle', 80, 9, [8, 17, 26]))).toEqual([
      message('hint.look.cell', { cell: cell(80) }),
      technique('nakedSingle'),
      message('hint.nakedSingle.why', { digit: 9 }),
      message('hint.put', { cell: cell(80), digit: 9 }),
    ])
    expect(rungs(placement('nakedSingle', 80, 9, [8, 17, 26]), 1)[2]).toEqual(
      message('hint.nakedSingle.whyLater', { digit: 9 }),
    )
  })

  it('teaches pointing', () => {
    const step = elimination('pointing', [18, 0], [0, 1], [5], [{ cell: 3, digit: 5 }])
    expect(rungs(step)).toEqual([
      message('hint.look.digitIn', { digit: 5, place: unit(18) }),
      technique('pointing'),
      message('hint.pointing.why', { unit: unit(18), digit: 5, second: unit(0) }),
      message('hint.removeOutside', { digit: 5, from: unit(0), outside: unit(18) }),
    ])
  })

  it('teaches a box-line reduction', () => {
    const step = elimination('boxLine', [9, 18], [0, 9], [7], [{ cell: 1, digit: 7 }])
    expect(rungs(step)).toEqual([
      message('hint.look.digitIn', { digit: 7, place: unit(9) }),
      technique('boxLine'),
      message('hint.boxLine.why', { unit: unit(9), digit: 7, second: unit(18) }),
      message('hint.removeOutside', { digit: 7, from: unit(18), outside: unit(9) }),
    ])
  })

  it('teaches a naked pair', () => {
    const removals: CellDigit[] = [
      { cell: 2, digit: 3 },
      { cell: 5, digit: 7 },
      { cell: 10, digit: 3 },
    ]
    expect(rungs(elimination('nakedPair', [0, 18], [0, 1], [3, 7], removals))).toEqual([
      message('hint.look.unit', { unit: unit(0) }),
      technique('nakedPair'),
      message('hint.nakedPair.why', { unit: unit(0), cells: cellsIn(0, [0, 1]), digits: digits([3, 7]) }),
      message('hint.nakedSubset.answer', { digits: digits([3, 7]), units: units([0, 18]) }),
    ])
  })

  it('teaches a naked triple', () => {
    const step = elimination('nakedTriple', [9], [0, 9, 18], [2, 5, 8], [{ cell: 27, digit: 5 }])
    expect(rungs(step)).toEqual([
      message('hint.look.unit', { unit: unit(9) }),
      technique('nakedTriple'),
      message('hint.nakedTriple.why', { unit: unit(9), cells: cellsIn(9, [0, 9, 18]), digits: digits([2, 5, 8]) }),
      message('hint.nakedSubset.answer', { digits: digits([5]), units: units([9]) }),
    ])
  })

  it('teaches a hidden pair', () => {
    const removals: CellDigit[] = [
      { cell: 0, digit: 2 },
      { cell: 10, digit: 9 },
    ]
    expect(rungs(elimination('hiddenPair', [18], [0, 10], [3, 7], removals))).toEqual([
      message('hint.look.unit', { unit: unit(18) }),
      technique('hiddenPair'),
      message('hint.hiddenPair.why', { unit: unit(18), digits: digits([3, 7]), cells: cellsIn(18, [0, 10]) }),
      message('hint.hiddenSubset.answer', { digits: digits([2, 9]), cells: cells([0, 10]) }),
    ])
  })

  it('teaches a hidden triple', () => {
    const step = elimination('hiddenTriple', [4], [36, 40, 44], [1, 4, 6], [{ cell: 40, digit: 9 }])
    expect(rungs(step)).toEqual([
      message('hint.look.unit', { unit: unit(4) }),
      technique('hiddenTriple'),
      message('hint.hiddenTriple.why', { unit: unit(4), digits: digits([1, 4, 6]), cells: cellsIn(4, [36, 40, 44]) }),
      message('hint.hiddenSubset.answer', { digits: digits([9]), cells: cells([36, 40, 44]) }),
    ])
  })

  it('tells the player to erase a wrong entry first', () => {
    const plan: HintPlan = { kind: 'mistake', cell: 35 }
    expect(RUNGS.map((rung) => hintMessage(plan, 0, rung))).toEqual(
      RUNGS.map(() => message('hint.mistake', { cell: cell(35) })),
    )
  })

  it('says so when no technique fits', () => {
    const plan: HintPlan = { kind: 'fallback', answer: { cell: 2, digit: 4 } }
    expect(hintMessage(plan, 0, 1)).toEqual(message('hint.fallback', { digit: 4, cell: cell(2) }))
  })

  it('refuses a step that the plan does not have', () => {
    expect(() => hintMessage(planWith(placement('fullHouse', 2, 4, [0])), 1, 1)).toThrow(RangeError)
  })

  it('has messages for every tier 1 and tier 2 technique, and for no tier 3 technique', () => {
    const tier3 = new Set<TechniqueId>(['simpleColouring', 'uniqueRectangle', 'xChain', 'xyChain'])
    const taught = new Set(TECHNIQUE_ORDER.map((rank) => rank.technique).filter((id) => !tier3.has(id)))
    expect(new Set(Object.keys(HINT_TECHNIQUES))).toEqual(taught)
    expect(new Set(HINT_TECHNIQUE_IDS)).toEqual(taught)
  })

  it('gives every rung of real plans a known id and values that exist', () => {
    let checked = 0
    for (let seed = 0; seed < 40; seed++) {
      const { givens, solution } = ungradedPuzzle(seed % 2 === 0 ? 'hard' : 'expert', seed)
      for (const position of playThrough(givens, undefined, { unique: true }).positions.slice(0, 30)) {
        const entries = position.board.map((digit, at) => (givens[at] === 0 ? digit : 0))
        const plan = planHint(createGame({ givens, solution, entries }))
        if (plan === null) continue
        const steps = plan.kind === 'steps' ? plan.steps.length : 1
        for (let index = 0; index < steps; index++) {
          for (const rung of RUNGS) {
            const text = hintMessage(plan, index, rung)
            checked++
            expect(HINT_MESSAGE_IDS).toContain(text.id)
            expect(Object.values(text.values).every(isValid)).toBe(true)
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100)
  })
})

function only(steps: Step[]): Step {
  expect(steps).toHaveLength(1)
  return steps[0]!
}

const at = (row: number, column: number): number => row * 9 + column

describe('hintMessage, tier 2', () => {
  // Real steps from the finders, on the positions of their own tests.
  const board = createEmptyGrid()
  const empty = computeCandidates(board)

  it('teaches a naked quad', () => {
    const candidates = withDigits(empty, { 54: [1, 2], 57: [2, 3], 60: [3, 4], 62: [1, 4] })
    expect(rungs(only(findNakedSubsets(candidates, board, 4)))).toEqual([
      message('hint.look.unit', { unit: unit(6) }),
      technique('nakedQuad'),
      message('hint.nakedQuad.why', {
        unit: unit(6),
        cells: cellsIn(6, [54, 57, 60, 62]),
        digits: digits([1, 2, 3, 4]),
      }),
      message('hint.nakedSubset.answer', { digits: digits([1, 2, 3, 4]), units: units([6]) }),
    ])
  })

  it('teaches a hidden quad', () => {
    const candidates = struck(empty, [8, 26, 44, 62, 80], [6, 7, 8, 9])
    expect(rungs(only(findHiddenSubsets(candidates, board, 4)))).toEqual([
      message('hint.look.unit', { unit: unit(17) }),
      technique('hiddenQuad'),
      message('hint.hiddenQuad.why', {
        unit: unit(17),
        digits: digits([6, 7, 8, 9]),
        cells: cellsIn(17, [17, 35, 53, 71]),
      }),
      message('hint.hiddenSubset.answer', { digits: digits([1, 2, 3, 4, 5]), cells: cells([17, 35, 53, 71]) }),
    ])
  })

  it('teaches an X-wing on rows', () => {
    const candidates = onlyIn(empty, 5, [2, 6, 38, 42, 11, 69])
    expect(rungs(only(findFish(candidates, board, 2)))).toEqual([
      message('hint.look.digitIn', { digit: 5, place: lines([0, 4]) }),
      technique('xWing'),
      message('hint.fish.why', { digit: 5, bases: lines([0, 4]), covers: lines([11, 15]) }),
      message('hint.removeOutside', { digit: 5, from: lines([11, 15]), outside: lines([0, 4]) }),
    ])
  })

  it('teaches an X-wing on columns', () => {
    const candidates = onlyIn(empty, 8, [19, 23, 64, 68, 26, 66])
    const [look, , why, answer] = rungs(only(findFish(candidates, board, 2)))
    expect([look, why, answer]).toEqual([
      message('hint.look.digitIn', { digit: 8, place: lines([10, 14]) }),
      message('hint.fish.why', { digit: 8, bases: lines([10, 14]), covers: lines([2, 7]) }),
      message('hint.removeOutside', { digit: 8, from: lines([2, 7]), outside: lines([10, 14]) }),
    ])
  })

  it('teaches a swordfish and a jellyfish', () => {
    const swordfish = elimination(
      'swordfish',
      [0, 4, 8, 11, 13, 15],
      [2, 4, 38, 42, 74, 76],
      [5],
      [{ cell: 29, digit: 5 }],
    )
    expect(rungs(swordfish)).toEqual([
      message('hint.look.digitIn', { digit: 5, place: lines([0, 4, 8]) }),
      technique('swordfish'),
      message('hint.fish.why', { digit: 5, bases: lines([0, 4, 8]), covers: lines([11, 13, 15]) }),
      message('hint.removeOutside', { digit: 5, from: lines([11, 13, 15]), outside: lines([0, 4, 8]) }),
    ])
    const jellyfish = elimination(
      'jellyfish',
      [9, 11, 13, 17, 0, 2, 4, 8],
      [0, 2, 4, 8, 18, 22, 36, 44, 72, 80],
      [7],
      [{ cell: 45, digit: 7 }],
    )
    expect(rungs(jellyfish)).toEqual([
      message('hint.look.digitIn', { digit: 7, place: lines([9, 11, 13, 17]) }),
      technique('jellyfish'),
      message('hint.fish.why', { digit: 7, bases: lines([9, 11, 13, 17]), covers: lines([0, 2, 4, 8]) }),
      message('hint.removeOutside', { digit: 7, from: lines([0, 2, 4, 8]), outside: lines([9, 11, 13, 17]) }),
    ])
  })

  it('teaches a skyscraper on rows and on columns', () => {
    const candidates = onlyIn(empty, 1, [at(1, 2), at(1, 6), at(6, 2), at(6, 7), at(7, 6), at(2, 7)])
    const [rows, columns] = findSkyscrapers(candidates, board)
    expect(rungs(rows!)).toEqual([
      message('hint.look.digitIn', { digit: 1, place: lines([1, 6]) }),
      technique('skyscraper'),
      message('hint.linkedPair.why', {
        lines: lines([1, 6]),
        digit: 1,
        joint: unit(11),
        a: cell(at(1, 6)),
        b: cell(at(6, 7)),
      }),
      message('hint.removeSeeingBoth', { digit: 1, a: cell(at(1, 6)), b: cell(at(6, 7)) }),
    ])
    expect(rungs(columns!)[2]).toEqual(
      message('hint.linkedPair.why', {
        lines: lines([11, 15]),
        digit: 1,
        joint: unit(1),
        a: cell(at(6, 2)),
        b: cell(at(7, 6)),
      }),
    )
  })

  it('teaches a two-string kite', () => {
    const candidates = onlyIn(empty, 1, [at(1, 0), at(1, 5), at(2, 2), at(7, 2), at(7, 5)])
    expect(rungs(only(findTwoStringKites(candidates, board)))).toEqual([
      message('hint.look.digitIn', { digit: 1, place: units([1, 11]) }),
      technique('twoStringKite'),
      message('hint.linkedPair.why', {
        lines: units([1, 11]),
        digit: 1,
        joint: unit(18),
        a: cell(at(1, 5)),
        b: cell(at(7, 2)),
      }),
      message('hint.removeSeeingBoth', { digit: 1, a: cell(at(1, 5)), b: cell(at(7, 2)) }),
    ])
  })

  it('names the far ends of a mirrored kite', () => {
    const candidates = onlyIn(empty, 1, [at(1, 8), at(1, 3), at(2, 6), at(7, 6), at(7, 3)])
    expect(rungs(only(findTwoStringKites(candidates, board)))[2]).toEqual(
      message('hint.linkedPair.why', {
        lines: units([1, 15]),
        digit: 1,
        joint: unit(20),
        a: cell(at(1, 3)),
        b: cell(at(7, 6)),
      }),
    )
  })

  // Both ends of the row link lie in the box of the kite. The far ends follow from the eliminations.
  it('names the far ends of a kite whose row link lies in its box', () => {
    const candidates = onlyIn(empty, 1, [at(0, 0), at(0, 1), at(1, 2), at(6, 2), at(7, 1)])
    const steps = findTwoStringKites(candidates, board)
    expect(steps.length).toBeGreaterThan(0)
    for (const step of steps) {
      const { a, b } = rungs(step)[3]!.values
      const named = [a, b].map((value) => (value as { cell: number }).cell)
      expect(named).toHaveLength(2)
      for (const { cell: removed } of step.eliminations) expect(named.every((far) => sees(far, removed))).toBe(true)
    }
  })

  it('teaches a W-wing linked by a box', () => {
    const candidates = struck(withDigits(empty, { 0: [1, 2], 40: [1, 2] }), [4, 5, 12, 13, 14, 21, 23], [1])
    const step = findWWings(candidates, board).find((wing) => wing.units[0] === 19)!
    expect(rungs(step)[2]).toEqual(
      message('hint.wWing.why', {
        link: unit(19),
        linked: 1,
        ends: cellsIn(19, [at(0, 3), at(2, 4)]),
        a: cell(0),
        b: cell(40),
        removed: 2,
      }),
    )
  })

  it('teaches an XY-wing', () => {
    const candidates = withDigits(empty, { 0: [1, 2], 3: [1, 3], 18: [2, 3] })
    expect(rungs(only(findXyWings(candidates, board)))).toEqual([
      message('hint.xyWing.look', { cell: cell(0) }),
      technique('xyWing'),
      message('hint.xyWing.why', { pivot: cell(0), digits: digits([1, 2], 'or'), shared: 3, a: cell(3), b: cell(18) }),
      message('hint.removeSeeingBoth', { digit: 3, a: cell(3), b: cell(18) }),
    ])
  })

  it('teaches an XYZ-wing', () => {
    const candidates = withDigits(empty, { 0: [1, 2, 3], 1: [1, 3], 9: [2, 3] })
    expect(rungs(only(findXyzWings(candidates, board)))).toEqual([
      message('hint.xyzWing.look', { cell: cell(0) }),
      technique('xyzWing'),
      message('hint.xyzWing.why', { pivot: cell(0), digits: digits([1, 2, 3], 'or'), shared: 3, a: cell(1), b: cell(9) }),
      message('hint.removeSeeingAll', { digit: 3 }),
    ])
  })

  it('teaches a W-wing', () => {
    const candidates = struck(withDigits(empty, { 0: [1, 2], 13: [1, 2] }), [46, 47, 48, 50, 51, 52, 53], [1])
    expect(rungs(findWWings(candidates, board)[0]!)).toEqual([
      message('hint.wWing.look', { a: cell(0), b: cell(13) }),
      technique('wWing'),
      message('hint.wWing.why', {
        link: unit(5),
        linked: 1,
        ends: cellsIn(5, [45, 49]),
        a: cell(0),
        b: cell(13),
        removed: 2,
      }),
      message('hint.removeSeeingBoth', { digit: 2, a: cell(0), b: cell(13) }),
    ])
  })
})
