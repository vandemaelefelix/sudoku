import { GRID_CELLS } from '../grid'
import { peersOf } from '../units'
import { ALL_DIGITS, UNITS } from './scan'
import type { CandidateState, Step } from './types'

/**
 * Builds the state of a grid: every empty cell keeps the digits that none of its peers holds.
 * Pass the givens, or the givens with the entries of a game. Throws a RangeError for a grid
 * that is not 81 integers from 0 to 9. A grid that breaks a rule is not an error here.
 */
export function createCandidateState(grid: readonly number[]): CandidateState {
  if (grid.length !== GRID_CELLS) {
    throw new RangeError(`A grid has ${GRID_CELLS} cells, not ${grid.length}`)
  }
  grid.forEach((digit, cell) => {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
      throw new RangeError(`Cell ${cell} holds ${digit}, not an integer from 0 to 9`)
    }
  })
  const candidates = grid.map((digit, cell) => {
    if (digit !== 0) return 0
    return peersOf(cell).reduce((mask, peer) => mask & ~(1 << grid[peer]!), ALL_DIGITS)
  })
  return { values: [...grid], candidates }
}

/** Returns a new state. A placement also clears its digit from the peers of the cell. */
export function applyStep(state: CandidateState, step: Step): CandidateState {
  const values = [...state.values]
  const candidates = [...state.candidates]
  for (const { cell, digit } of step.placements) {
    values[cell] = digit
    candidates[cell] = 0
    for (const peer of peersOf(cell)) candidates[peer]! &= ~(1 << digit)
  }
  for (const { cell, digit } of step.eliminations) candidates[cell]! &= ~(1 << digit)
  return { values, candidates }
}

/** True when a cell has no candidate, a unit holds a digit twice, or a unit lost a digit. */
export function isContradiction({ values, candidates }: CandidateState): boolean {
  if (values.some((value, cell) => value === 0 && candidates[cell] === 0)) return true
  return UNITS.some(({ cells }) => {
    let placed = 0
    let possible = 0
    for (const cell of cells) {
      const bit = 1 << values[cell]!
      if (values[cell] !== 0 && placed & bit) return true
      if (values[cell] !== 0) placed |= bit
      possible |= candidates[cell]!
    }
    return (placed | possible) !== ALL_DIGITS
  })
}
