import { GRID_CELLS } from '../grid'
import { ALL_DIGITS } from './scan'
import type { CandidateState } from './types'

const maskOf = (digits: readonly number[]): number => digits.reduce((mask, digit) => mask | (1 << digit), 0)

/**
 * A made-up state for a technique test. Every empty cell starts with all nine candidates.
 * `candidates` replaces the digits of a cell. `values` fills a cell. It does not need to obey the rules.
 */
export function stateOf(
  parts: { values?: Record<number, number>; candidates?: Record<number, readonly number[]> } = {},
): CandidateState {
  const values = Array.from({ length: GRID_CELLS }, (_, cell) => parts.values?.[cell] ?? 0)
  const candidates = values.map((value, cell) => {
    if (value !== 0) return 0
    const own = parts.candidates?.[cell]
    return own ? maskOf(own) : ALL_DIGITS
  })
  return { values, candidates }
}

/** Removes `digits` from the candidates of `cells`, as a test setup. */
export function without(cells: readonly number[], digits: readonly number[]): Record<number, readonly number[]> {
  const left = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((digit) => !digits.includes(digit))
  return Object.fromEntries(cells.map((cell) => [cell, left]))
}

export const pairs = (cells: readonly number[], digits: readonly number[]) =>
  cells.flatMap((cell) => digits.map((digit) => ({ cell, digit })))
