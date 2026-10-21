import { PEERS, UNITS } from '../units'
import type { Digit } from '../game/types'
import { bitOf } from './masks'
import type { Candidates, CellDigit } from './types'

const SEEN: readonly Uint8Array[] = PEERS.map((peers) => {
  const row = new Uint8Array(PEERS.length)
  for (const peer of peers) row[peer] = 1
  return row
})

/** True when two different cells share a row, a column or a box. A cell does not see itself. */
export function sees(a: number, b: number): boolean {
  return SEEN[a]![b] === 1
}

/** The unit with the lowest index that holds both cells, or undefined when the cells do not see each other. */
export function sharedUnit(a: number, b: number): number | undefined {
  const unit = UNITS.findIndex((cells) => cells.includes(a) && cells.includes(b))
  return unit < 0 ? undefined : unit
}

/** The cells of the unit that have the digit as a candidate. Empty when the board has the digit in the unit. */
export function placesOf(candidates: Candidates, board: readonly number[], unit: number, digit: number): number[] {
  const cells = UNITS[unit]!
  if (cells.some((cell) => board[cell] === digit)) return []
  return cells.filter((cell) => candidates[cell]! & bitOf(digit))
}

/** The candidates of `digit` in every cell that sees all the `seen` cells. */
export function candidatesSeeing(candidates: Candidates, digit: number, seen: readonly number[]): CellDigit[] {
  const bit = bitOf(digit)
  const found: CellDigit[] = []
  for (let cell = 0; cell < candidates.length; cell++) {
    if (candidates[cell]! & bit && seen.every((other) => SEEN[cell]![other] === 1)) {
      found.push({ cell, digit: digit as Digit })
    }
  }
  return found
}
