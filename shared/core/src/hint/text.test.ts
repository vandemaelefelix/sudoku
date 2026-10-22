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
import { cellName, cellsName, listOf, unitName } from './names'
import { planHint } from './plan'
import { HINT_TECHNIQUES } from './techniques'
import { hintText } from './text'
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

const rungs = (step: Step, index = 0): string[] => RUNGS.map((rung) => hintText(planWith(step, index), index, rung))

describe('names', () => {
  it('names a cell in plain words', () => {
    expect(cellName(0)).toBe('row 1, column 1')
    expect(cellName(35)).toBe('row 4, column 9')
  })

  it('names a row, a column and each box by its place', () => {
    expect(unitName(1)).toBe('row 2')
    expect(unitName(13)).toBe('column 5')
    expect([18, 19, 20, 21, 22, 23, 24, 25, 26].map(unitName)).toEqual([
      'the top-left box',
      'the top-middle box',
      'the top-right box',
      'the middle-left box',
      'the centre box',
      'the middle-right box',
      'the bottom-left box',
      'the bottom-middle box',
      'the bottom-right box',
    ])
  })

  it('lists items and cells', () => {
    expect(listOf([3])).toBe('3')
    expect(listOf([3, 7])).toBe('3 and 7')
    expect(listOf([2, 5, 8])).toBe('2, 5 and 8')
    expect(cellsName([9, 13])).toBe('row 2, columns 1 and 5')
    expect(cellsName([2, 29])).toBe('column 3, rows 1 and 4')
    expect(cellsName([0, 10, 20])).toBe('row 1, column 1; row 2, column 2 and row 3, column 3')
  })
})

describe('hintText', () => {
  it('teaches a full house', () => {
    expect(rungs(placement('fullHouse', 2, 4, [0]))).toEqual([
      'Look at row 1. It has one empty cell.',
      'Full house: a row, column or box with one empty cell. That cell gets the missing digit.',
      'Row 1 holds every digit but 4. So 4 goes in its empty cell.',
      'Put 4 in row 1, column 3.',
    ])
  })

  it('teaches a hidden single', () => {
    expect(rungs(placement('hiddenSingle', 20, 1, [18]))).toEqual([
      'Look at the top-left box.',
      'Hidden single: a digit that fits in only one cell of a row, column or box.',
      'In the top-left box, a 1 fits only in row 3, column 3. Every other empty cell has a 1 in its row, column or box.',
      'Put 1 in row 3, column 3.',
    ])
  })

  it('names the steps before in the why of a later hidden single', () => {
    expect(rungs(placement('hiddenSingle', 20, 1, [18]), 1)[2]).toBe(
      'In the top-left box, a 1 fits only in row 3, column 3. ' +
        'Every other empty cell has a 1 in its row, column or box, or an earlier step removed it.',
    )
  })

  it('teaches a naked single, and names the cell at rung 1', () => {
    expect(rungs(placement('nakedSingle', 80, 9, [8, 17, 26]))).toEqual([
      'Look at row 9, column 9.',
      'Naked single: a cell where only one digit fits.',
      'Its row, column and box hold every digit but 9. So only 9 fits.',
      'Put 9 in row 9, column 9.',
    ])
    expect(rungs(placement('nakedSingle', 80, 9, [8, 17, 26]), 1)[2]).toBe(
      'Its row, column and box hold the other digits, or earlier steps removed them. So only 9 fits.',
    )
  })

  it('teaches pointing', () => {
    const step = elimination('pointing', [18, 0], [0, 1], [5], [{ cell: 3, digit: 5 }])
    expect(rungs(step)).toEqual([
      'Look where a 5 fits in the top-left box.',
      'Pointing: a digit that fits in only one row or column of a box. That row or column loses the digit outside the box.',
      'In the top-left box, a 5 fits only in row 1. So the 5 of row 1 must be in this box.',
      'Remove 5 from row 1, outside the top-left box.',
    ])
  })

  it('teaches a box-line reduction', () => {
    const step = elimination('boxLine', [9, 18], [0, 9], [7], [{ cell: 1, digit: 7 }])
    expect(rungs(step)).toEqual([
      'Look where a 7 fits in column 1.',
      'Box-line reduction: a digit that fits in only one box of a row or column. That box loses the digit outside the row or column.',
      'In column 1, a 7 fits only in the top-left box. So the 7 of the top-left box must be in column 1.',
      'Remove 7 from the top-left box, outside column 1.',
    ])
  })

  it('teaches a naked pair', () => {
    const removals: CellDigit[] = [
      { cell: 2, digit: 3 },
      { cell: 5, digit: 7 },
      { cell: 10, digit: 3 },
    ]
    expect(rungs(elimination('nakedPair', [0, 18], [0, 1], [3, 7], removals))).toEqual([
      'Look at row 1.',
      'Naked pair: two cells of a row, column or box that hold only the same two digits. The other cells there cannot hold them.',
      'In row 1, columns 1 and 2 can hold only 3 and 7. So these two digits must go in these two cells.',
      'Remove 3 and 7 from the other cells of row 1 and the top-left box.',
    ])
  })

  it('teaches a naked triple', () => {
    const step = elimination('nakedTriple', [9], [0, 9, 18], [2, 5, 8], [{ cell: 27, digit: 5 }])
    expect(rungs(step)).toEqual([
      'Look at column 1.',
      'Naked triple: three cells of a row, column or box that hold only three digits between them. The other cells there cannot hold them.',
      'In column 1, rows 1, 2 and 3 can hold only 2, 5 and 8 between them. So these three digits must go in these three cells.',
      'Remove 5 from the other cells of column 1.',
    ])
  })

  it('teaches a hidden pair', () => {
    const removals: CellDigit[] = [
      { cell: 0, digit: 2 },
      { cell: 10, digit: 9 },
    ]
    expect(rungs(elimination('hiddenPair', [18], [0, 10], [3, 7], removals))).toEqual([
      'Look at the top-left box.',
      'Hidden pair: two digits that fit in only two cells of a row, column or box. Those cells can hold no other digit.',
      'In the top-left box, 3 and 7 fit only in row 1, column 1 and row 2, column 2. So these two cells can hold no other digit.',
      'Remove 2 and 9 from row 1, column 1 and row 2, column 2.',
    ])
  })

  it('teaches a hidden triple', () => {
    const step = elimination('hiddenTriple', [4], [36, 40, 44], [1, 4, 6], [{ cell: 40, digit: 9 }])
    expect(rungs(step)).toEqual([
      'Look at row 5.',
      'Hidden triple: three digits that fit in only three cells of a row, column or box. Those cells can hold no other digit.',
      'In row 5, 1, 4 and 6 fit only in columns 1, 5 and 9. So these three cells can hold no other digit.',
      'Remove 9 from row 5, columns 1, 5 and 9.',
    ])
  })

  it('tells the player to erase a wrong entry first', () => {
    const plan: HintPlan = { kind: 'mistake', cell: 35 }
    expect(RUNGS.map((rung) => hintText(plan, 0, rung))).toEqual(
      RUNGS.map(() => 'Row 4, column 9 holds a wrong digit. Erase it first.'),
    )
  })

  it('says so when no technique fits', () => {
    const plan: HintPlan = { kind: 'fallback', answer: { cell: 2, digit: 4 } }
    expect(hintText(plan, 0, 1)).toBe(
      'No hint technique fits this board. Put 4 in row 1, column 3, the cell with the fewest possible digits.',
    )
  })

  it('refuses a step that the plan does not have', () => {
    expect(() => hintText(planWith(placement('fullHouse', 2, 4, [0])), 1, 1)).toThrow(RangeError)
  })

  it('has text for every tier 1 and tier 2 technique, and for no tier 3 technique', () => {
    const tier3 = new Set<TechniqueId>(['simpleColouring', 'uniqueRectangle', 'xChain', 'xyChain'])
    const taught = new Set(TECHNIQUE_ORDER.map((rank) => rank.technique).filter((id) => !tier3.has(id)))
    expect(new Set(Object.keys(HINT_TECHNIQUES))).toEqual(taught)
  })

  it('writes an 8 with "an"', () => {
    expect(rungs(placement('hiddenSingle', 20, 8, [18]))[2]).toMatch(/^In the top-left box, an 8 fits only/)
    const step = elimination('pointing', [18, 0], [0, 1], [8], [{ cell: 3, digit: 8 }])
    expect(rungs(step)[0]).toBe('Look where an 8 fits in the top-left box.')
  })

  it('keeps every rung of real plans short, plain and in words', () => {
    let checked = 0
    for (let seed = 0; seed < 40; seed++) {
      const { givens, solution } = ungradedPuzzle(seed % 2 === 0 ? 'hard' : 'expert', seed)
      for (const position of playThrough(givens, undefined, { unique: true }).positions.slice(0, 30)) {
        const entries = position.board.map((digit, cell) => (givens[cell] === 0 ? digit : 0))
        const plan = planHint(createGame({ givens, solution, entries }))
        if (plan === null) continue
        const steps = plan.kind === 'steps' ? plan.steps.length : 1
        for (let index = 0; index < steps; index++) {
          for (const rung of RUNGS) {
            const text = hintText(plan, index, rung)
            checked++
            expect(text).not.toMatch(/r\dc\d/)
            expect(text.split(/\.(?: |$)/).filter(Boolean).length).toBeLessThanOrEqual(2)
            expect(text.split(/[.:]/).every((sentence) => sentence.trim().split(/\s+/).length <= 25)).toBe(true)
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

describe('hintText, tier 2', () => {
  // Real steps from the finders, on the positions of their own tests.
  const board = createEmptyGrid()
  const empty = computeCandidates(board)

  it('teaches a naked quad', () => {
    const candidates = withDigits(empty, { 54: [1, 2], 57: [2, 3], 60: [3, 4], 62: [1, 4] })
    expect(rungs(only(findNakedSubsets(candidates, board, 4)))).toEqual([
      'Look at row 7.',
      'Naked quad: four cells of a row, column or box that hold only four digits between them. The other cells there cannot hold them.',
      'In row 7, columns 1, 4, 7 and 9 can hold only 1, 2, 3 and 4 between them. So these four digits must go in these four cells.',
      'Remove 1, 2, 3 and 4 from the other cells of row 7.',
    ])
  })

  it('teaches a hidden quad', () => {
    const candidates = struck(empty, [8, 26, 44, 62, 80], [6, 7, 8, 9])
    expect(rungs(only(findHiddenSubsets(candidates, board, 4)))).toEqual([
      'Look at column 9.',
      'Hidden quad: four digits that fit in only four cells of a row, column or box. Those cells can hold no other digit.',
      'In column 9, 6, 7, 8 and 9 fit only in rows 2, 4, 6 and 8. So these four cells can hold no other digit.',
      'Remove 1, 2, 3, 4 and 5 from column 9, rows 2, 4, 6 and 8.',
    ])
  })

  it('teaches an X-wing on rows', () => {
    const candidates = onlyIn(empty, 5, [2, 6, 38, 42, 11, 69])
    expect(rungs(only(findFish(candidates, board, 2)))).toEqual([
      'Look where a 5 fits in rows 1 and 5.',
      'X-wing: two rows where a digit fits only in the same two columns. Those columns then lose the digit in the other rows (or the same with rows and columns swapped).',
      'In rows 1 and 5, a 5 fits only in columns 3 and 7. So columns 3 and 7 must hold their 5s in rows 1 and 5.',
      'Remove 5 from columns 3 and 7, outside rows 1 and 5.',
    ])
  })

  it('teaches an X-wing on columns', () => {
    const candidates = onlyIn(empty, 8, [19, 23, 64, 68, 26, 66])
    const [look, , why, answer] = rungs(only(findFish(candidates, board, 2)))
    expect([look, why, answer]).toEqual([
      'Look where an 8 fits in columns 2 and 6.',
      'In columns 2 and 6, an 8 fits only in rows 3 and 8. So rows 3 and 8 must hold their 8s in columns 2 and 6.',
      'Remove 8 from rows 3 and 8, outside columns 2 and 6.',
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
      'Look where a 5 fits in rows 1, 5 and 9.',
      'Swordfish: three rows where a digit fits only in the same three columns. Those columns then lose the digit in the other rows (or the same with rows and columns swapped).',
      'In rows 1, 5 and 9, a 5 fits only in columns 3, 5 and 7. So columns 3, 5 and 7 must hold their 5s in rows 1, 5 and 9.',
      'Remove 5 from columns 3, 5 and 7, outside rows 1, 5 and 9.',
    ])
    const jellyfish = elimination(
      'jellyfish',
      [9, 11, 13, 17, 0, 2, 4, 8],
      [0, 2, 4, 8, 18, 22, 36, 44, 72, 80],
      [7],
      [{ cell: 45, digit: 7 }],
    )
    expect(rungs(jellyfish)).toEqual([
      'Look where a 7 fits in columns 1, 3, 5 and 9.',
      'Jellyfish: four rows where a digit fits only in the same four columns. Those columns then lose the digit in the other rows (or the same with rows and columns swapped).',
      'In columns 1, 3, 5 and 9, a 7 fits only in rows 1, 3, 5 and 9. So rows 1, 3, 5 and 9 must hold their 7s in columns 1, 3, 5 and 9.',
      'Remove 7 from rows 1, 3, 5 and 9, outside columns 1, 3, 5 and 9.',
    ])
  })

  it('teaches a skyscraper on rows and on columns', () => {
    const candidates = onlyIn(empty, 1, [at(1, 2), at(1, 6), at(6, 2), at(6, 7), at(7, 6), at(2, 7)])
    const [rows, columns] = findSkyscrapers(candidates, board)
    expect(rungs(rows!)).toEqual([
      'Look where a 1 fits in rows 2 and 7.',
      'Skyscraper: two rows or two columns where a digit fits in only two cells each, with one cell of each in the same line. One of the other two cells holds the digit.',
      'Rows 2 and 7 each have only two cells for a 1, and both have one in column 3. ' +
        'At most one of those holds the 1, so row 2, column 7 or row 7, column 8 holds it.',
      'Remove 1 from the cells that share a row, column or box with both row 2, column 7 and row 7, column 8.',
    ])
    expect(rungs(columns!)[2]).toBe(
      'Columns 3 and 7 each have only two cells for a 1, and both have one in row 2. ' +
        'At most one of those holds the 1, so row 7, column 3 or row 8, column 7 holds it.',
    )
  })

  it('teaches a two-string kite', () => {
    const candidates = onlyIn(empty, 1, [at(1, 0), at(1, 5), at(2, 2), at(7, 2), at(7, 5)])
    expect(rungs(only(findTwoStringKites(candidates, board)))).toEqual([
      'Look where a 1 fits in row 2 and column 3.',
      'Two-string kite: a row and a column where a digit fits in only two cells each, with one cell of each in the same box. One of the other two cells holds the digit.',
      'Row 2 and column 3 each have only two cells for a 1, and both have one in the top-left box. ' +
        'At most one of those holds the 1, so row 2, column 6 or row 8, column 3 holds it.',
      'Remove 1 from the cells that share a row, column or box with both row 2, column 6 and row 8, column 3.',
    ])
  })

  it('names the far ends of a mirrored kite', () => {
    const candidates = onlyIn(empty, 1, [at(1, 8), at(1, 3), at(2, 6), at(7, 6), at(7, 3)])
    expect(rungs(only(findTwoStringKites(candidates, board)))[2]).toBe(
      'Row 2 and column 7 each have only two cells for a 1, and both have one in the top-right box. ' +
        'At most one of those holds the 1, so row 2, column 4 or row 8, column 7 holds it.',
    )
  })

  // Both ends of the row link lie in the box of the kite. The far ends follow from the eliminations.
  it('names the far ends of a kite whose row link lies in its box', () => {
    const candidates = onlyIn(empty, 1, [at(0, 0), at(0, 1), at(1, 2), at(6, 2), at(7, 1)])
    const steps = findTwoStringKites(candidates, board)
    expect(steps.length).toBeGreaterThan(0)
    for (const step of steps) {
      const named = [...rungs(step)[3]!.matchAll(/row (\d), column (\d)/g)].map(([, row, column]) =>
        at(Number(row) - 1, Number(column) - 1),
      )
      expect(named).toHaveLength(2)
      for (const { cell } of step.eliminations) expect(named.every((far) => sees(far, cell))).toBe(true)
    }
  })

  it('teaches a W-wing linked by a box', () => {
    const candidates = struck(withDigits(empty, { 0: [1, 2], 40: [1, 2] }), [4, 5, 12, 13, 14, 21, 23], [1])
    const step = findWWings(candidates, board).find((wing) => wing.units[0] === 19)!
    expect(rungs(step)[2]).toBe(
      'In the top-middle box, a 1 fits only in row 1, column 4 and row 3, column 5, so one of them holds it. ' +
        'That cell rules out 1 in row 1, column 1 or in row 5, column 5, so one of these holds 2.',
    )
  })

  it('keeps every definition to two short sentences', () => {
    for (const technique of Object.values(HINT_TECHNIQUES)) {
      const text = `${technique!.name}: ${technique!.definition}`
      expect(text.split(/\.(?: |$)/).filter(Boolean).length).toBeLessThanOrEqual(2)
      expect(text.split(/[.:]/).every((sentence) => sentence.trim().split(/\s+/).length <= 25)).toBe(true)
    }
  })

  it('teaches an XY-wing', () => {
    const candidates = withDigits(empty, { 0: [1, 2], 3: [1, 3], 18: [2, 3] })
    expect(rungs(only(findXyWings(candidates, board)))).toEqual([
      'Look at row 1, column 1. It has only two digits.',
      'XY-wing: a cell with two digits, and two cells in its row, column or box that each pair one of them with a third digit. One of the two cells must hold the third digit.',
      'Row 1, column 1 holds 1 or 2. Each choice puts a 3 in row 1, column 4 or row 3, column 1.',
      'Remove 3 from the cells that share a row, column or box with both row 1, column 4 and row 3, column 1.',
    ])
  })

  it('teaches an XYZ-wing', () => {
    const candidates = withDigits(empty, { 0: [1, 2, 3], 1: [1, 3], 9: [2, 3] })
    expect(rungs(only(findXyzWings(candidates, board)))).toEqual([
      'Look at row 1, column 1. It has only three digits.',
      'XYZ-wing: a cell with three digits, and two cells in its row, column or box that each hold two of them, one shared. One of the three cells must hold the shared digit.',
      'Row 1, column 1 holds 1, 2 or 3. Each choice puts a 3 in this cell, in row 1, column 2 or in row 2, column 1.',
      'Remove 3 from the cells that share a row, column or box with all three of these cells.',
    ])
  })

  it('teaches a W-wing', () => {
    const candidates = struck(withDigits(empty, { 0: [1, 2], 13: [1, 2] }), [46, 47, 48, 50, 51, 52, 53], [1])
    expect(rungs(findWWings(candidates, board)[0]!)).toEqual([
      'Look at row 1, column 1 and row 2, column 5. They hold the same two digits.',
      'W-wing: two cells with the same two digits, linked by a row, column or box where one of the two digits fits in only two cells. One of the two cells must hold the other digit.',
      'In row 6, a 1 fits only in columns 1 and 5, so one of them holds it. ' +
        'That cell rules out 1 in row 1, column 1 or in row 2, column 5, so one of these holds 2.',
      'Remove 2 from the cells that share a row, column or box with both row 1, column 1 and row 2, column 5.',
    ])
  })
})
