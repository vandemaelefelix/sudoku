import type { Digit } from '../game/types'
import { bitOf, digitsOf, sortedUnique } from './masks'
import type { CellDigit, Step } from './types'

export function placementStep(
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

/** Sorts the eliminations by cell, then by digit. */
export function eliminationStep(
  technique: Exclude<Step['technique'], 'fullHouse' | 'hiddenSingle' | 'nakedSingle'>,
  units: readonly number[],
  pattern: readonly number[],
  digits: readonly Digit[],
  eliminations: readonly CellDigit[],
): Step {
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh copy, and the es2022 lib has no toSorted
  const sorted = [...eliminations].sort((a, b) => a.cell - b.cell || a.digit - b.digit)
  return {
    technique,
    placements: [],
    eliminations: sorted,
    units,
    pattern,
    support: [],
    digits,
  }
}
