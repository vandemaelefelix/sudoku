import { describe, expect, it } from 'vitest'
import { createGame } from '../game/createGame'
import type { Digit } from '../game/types'
import { TIER_1_ORDER } from '../technique/order'
import { playThrough } from '../technique/playThrough'
import { ungradedPuzzle } from '../technique/testKit'
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
        'Every other empty cell has a 1 in its row, column or box, or lost it in a step before.',
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
      'Its row, column and box hold the other digits, or a step before removed them. So only 9 fits.',
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

  it('has text for every tier 1 technique', () => {
    const tier1 = new Set(TIER_1_ORDER.map((rank) => rank.technique))
    expect(new Set(Object.keys(HINT_TECHNIQUES))).toEqual(tier1)
  })

  it('keeps every rung of real plans short, plain and in words', () => {
    let checked = 0
    for (let seed = 0; seed < 40; seed++) {
      const { givens, solution } = ungradedPuzzle('hard', seed)
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
