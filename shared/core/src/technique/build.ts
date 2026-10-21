import type { Digit } from '../game/types'
import { sortedUnique } from './masks'
import type { CellDigit, Step } from './types'

type Structure = Pick<Step, 'links' | 'groups'>

export function placementStep(
  technique: 'fullHouse' | 'hiddenSingle' | 'nakedSingle',
  cell: number,
  digit: Digit,
  units: readonly number[],
  support: Iterable<number | undefined>,
): Step {
  return {
    technique,
    placements: [{ cell, digit }],
    eliminations: [],
    units,
    pattern: [cell],
    support: sortedUnique([...support].filter((blocker): blocker is number => blocker !== undefined)),
    digits: [digit],
  }
}

/** Sorts the eliminations by cell, then by digit. */
export function eliminationStep(
  technique: Exclude<Step['technique'], 'fullHouse' | 'hiddenSingle' | 'nakedSingle'>,
  units: readonly number[],
  pattern: readonly number[],
  digits: readonly Digit[],
  eliminations: readonly CellDigit[],
  structure: Structure = {},
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
    ...structure,
  }
}
