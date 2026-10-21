import { BOXES, COLUMNS, ROWS, UNITS, UNITS_OF, type UnitKind } from '../units'
import { bitCount } from '../bits'
import { ALL_DIGITS, bitOf, blockerOf, digitsOf, sortedUnique } from './masks'
import type { Candidates, Step } from './types'

const UNITS_OF_KIND: Readonly<Record<UnitKind, readonly number[]>> = {
  box: BOXES.map((_, box) => 18 + box),
  row: ROWS.map((_, row) => row),
  column: COLUMNS.map((_, column) => 9 + column),
}

function placementStep(
  technique: 'fullHouse' | 'hiddenSingle' | 'nakedSingle',
  cell: number,
  digit: number,
  units: readonly number[],
  support: Iterable<number | undefined>,
): Step {
  const digits = digitsOf(bitOf(digit))
  return {
    technique,
    placements: [{ cell, digit: digits[0]! }],
    eliminations: [],
    units,
    pattern: [cell],
    support: sortedUnique([...support].filter((blocker): blocker is number => blocker !== undefined)),
    digits,
  }
}

/** A box, then a row, then a column. A cell that is the last of two units gives one step. */
export function findFullHouses(candidates: Candidates, board: readonly number[]): Step[] {
  const steps: Step[] = []
  const done = new Set<number>()
  for (const unit of [...UNITS_OF_KIND.box, ...UNITS_OF_KIND.row, ...UNITS_OF_KIND.column]) {
    const cells = UNITS[unit]!
    const empty = cells.filter((cell) => board[cell] === 0)
    if (empty.length !== 1) continue
    const cell = empty[0]!
    const used = cells.reduce((mask, other) => (board[other] ? mask | bitOf(board[other]) : mask), 0)
    const missing = ALL_DIGITS & ~used
    if (bitCount(missing) !== 1 || !(candidates[cell]! & missing) || done.has(cell)) continue
    done.add(cell)
    steps.push(placementStep('fullHouse', cell, digitsOf(missing)[0]!, [unit], []))
  }
  return steps
}

/**
 * Searches the units of the given kinds in the order of `kinds`. A cell and digit that are hidden in
 * two units give one step, from the first unit.
 */
export function findHiddenSingles(
  candidates: Candidates,
  board: readonly number[],
  kinds: readonly UnitKind[],
): Step[] {
  const steps: Step[] = []
  const done = new Set<number>()
  for (const kind of kinds) {
    for (const unit of UNITS_OF_KIND[kind]) {
      const cells = UNITS[unit]!
      for (let digit = 1; digit <= 9; digit++) {
        const bit = bitOf(digit)
        if (cells.some((cell) => board[cell] === digit)) continue
        const places = cells.filter((cell) => candidates[cell]! & bit)
        if (places.length !== 1) continue
        const cell = places[0]!
        const key = cell * 10 + digit
        if (done.has(key)) continue
        done.add(key)
        const blockers = cells
          .filter((other) => other !== cell && board[other] === 0)
          .map((other) => blockerOf(board, other, digit))
        steps.push(placementStep('hiddenSingle', cell, digit, [unit], blockers))
      }
    }
  }
  return steps
}

export function findNakedSingles(candidates: Candidates, board: readonly number[]): Step[] {
  const steps: Step[] = []
  for (let cell = 0; cell < candidates.length; cell++) {
    const mask = candidates[cell]!
    if (board[cell] !== 0 || bitCount(mask) !== 1) continue
    const digit = digitsOf(mask)[0]!
    const blockers = [1, 2, 3, 4, 5, 6, 7, 8, 9]
      .filter((other) => other !== digit)
      .map((other) => blockerOf(board, cell, other))
    steps.push(placementStep('nakedSingle', cell, digit, UNITS_OF[cell]!, blockers))
  }
  return steps
}
