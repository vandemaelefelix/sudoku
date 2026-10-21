import type { Digit } from '../game/types'
import { PEERS } from '../units'

export const ALL_DIGITS = 0b1_1111_1111

export function bitOf(digit: number): number {
  return 1 << (digit - 1)
}

/** The digits of a mask, ascending. */
export function digitsOf(mask: number): Digit[] {
  const digits: Digit[] = []
  for (let digit = 1; digit <= 9; digit++) if (mask & bitOf(digit)) digits.push(digit as Digit)
  return digits
}

export function maskOf(digits: readonly number[]): number {
  return digits.reduce((mask, digit) => mask | bitOf(digit), 0)
}

/**
 * The peer with the lowest index that holds `digit` on the board. A fixed choice keeps the output
 * deterministic when several peers hold the digit.
 */
export function blockerOf(board: readonly number[], cell: number, digit: number): number | undefined {
  return PEERS[cell]!.find((peer) => board[peer] === digit)
}

export function sortedUnique(values: Iterable<number>): number[] {
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh copy, and the es2022 lib has no toSorted
  return [...new Set(values)].sort((a, b) => a - b)
}
