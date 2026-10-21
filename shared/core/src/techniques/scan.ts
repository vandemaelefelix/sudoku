import { BOXES, COLUMNS, ROWS } from '../units'
import type { CandidateState, Step, UnitRef } from './types'

export type Unit = { ref: UnitRef; cells: readonly number[] }

export const ALL_DIGITS = 0b11_1111_1110

const unitsOf = (kind: UnitRef['kind'], all: readonly (readonly number[])[]): Unit[] =>
  all.map((cells, index) => ({ ref: { kind, index }, cells }))

export const BOX_UNITS = unitsOf('box', BOXES)
export const ROW_UNITS = unitsOf('row', ROWS)
export const COLUMN_UNITS = unitsOf('column', COLUMNS)

/** The scan order of every technique: boxes, then rows, then columns. */
export const UNITS: readonly Unit[] = [...BOX_UNITS, ...ROW_UNITS, ...COLUMN_UNITS]

export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export const rowOf = (cell: number): number => Math.floor(cell / 9)
export const columnOf = (cell: number): number => cell % 9
export const boxOf = (cell: number): number => Math.floor(cell / 27) * 3 + Math.floor((cell % 9) / 3)

export function bitCount(mask: number): number {
  let count = 0
  for (let rest = mask; rest !== 0; rest &= rest - 1) count++
  return count
}

export function digitsOf(mask: number): number[] {
  return DIGITS.filter((digit) => mask & (1 << digit))
}

export function cellsWith(state: CandidateState, cells: readonly number[], digit: number): number[] {
  return cells.filter((cell) => state.candidates[cell]! & (1 << digit))
}

export function makeStep(technique: Step['technique'], parts: Partial<Omit<Step, 'technique'>>): Step {
  return { technique, placements: [], eliminations: [], units: [], cells: [], digits: [], ...parts }
}

/** The subsets of `size` items, in lexicographic order. */
export function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]]
  const result: T[][] = []
  for (let i = 0; i + size <= items.length; i++) {
    for (const rest of combinations(items.slice(i + 1), size - 1)) result.push([items[i]!, ...rest])
  }
  return result
}
