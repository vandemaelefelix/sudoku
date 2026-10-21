import type { Digit } from '../game/types'
import { BOX_OF, COL_OF, ROW_OF, UNITS } from '../units'
import { eliminationStep } from './build'
import { bitOf } from './masks'
import type { Candidates, Step } from './types'

const BOX_UNITS = [18, 19, 20, 21, 22, 23, 24, 25, 26]
const LINE_UNITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]

function placesOf(candidates: Candidates, board: readonly number[], unit: number, digit: number): number[] {
  const cells = UNITS[unit]!
  if (cells.some((cell) => board[cell] === digit)) return []
  return cells.filter((cell) => candidates[cell]! & bitOf(digit))
}

function sameValue(cells: readonly number[], table: readonly number[]): boolean {
  return cells.every((cell) => table[cell] === table[cells[0]!])
}

/** The row or the column that holds all the cells, as a unit index. */
function lineOf(cells: readonly number[]): number | undefined {
  if (sameValue(cells, ROW_OF)) return ROW_OF[cells[0]!]
  if (sameValue(cells, COL_OF)) return 9 + COL_OF[cells[0]!]!
  return undefined
}

function removals(
  candidates: Candidates,
  from: number,
  keep: (cell: number) => boolean,
  digit: number,
): { cell: number; digit: Digit }[] {
  return UNITS[from]!.filter((cell) => !keep(cell) && candidates[cell]! & bitOf(digit)).map((cell) => ({
    cell,
    digit: digit as Digit,
  }))
}

/** A digit in 2 or 3 cells of a box, all in one line, leaves the rest of the line. */
export function findPointing(candidates: Candidates, board: readonly number[]): Step[] {
  const steps: Step[] = []
  for (const box of BOX_UNITS) {
    for (let digit = 1; digit <= 9; digit++) {
      const cells = placesOf(candidates, board, box, digit)
      if (cells.length < 2) continue
      const line = lineOf(cells)
      if (line === undefined) continue
      const eliminations = removals(candidates, line, (cell) => BOX_OF[cell] === box - 18, digit)
      if (eliminations.length === 0) continue
      steps.push(eliminationStep('pointing', [box, line], cells, [digit as Digit], eliminations))
    }
  }
  return steps
}

/** A digit in 2 or 3 cells of a line, all in one box, leaves the rest of the box. */
export function findBoxLineReductions(candidates: Candidates, board: readonly number[]): Step[] {
  const steps: Step[] = []
  for (const line of LINE_UNITS) {
    for (let digit = 1; digit <= 9; digit++) {
      const cells = placesOf(candidates, board, line, digit)
      if (cells.length < 2 || !sameValue(cells, BOX_OF)) continue
      const box = 18 + BOX_OF[cells[0]!]!
      const inLine = new Set(UNITS[line])
      const eliminations = removals(candidates, box, (cell) => inLine.has(cell), digit)
      if (eliminations.length === 0) continue
      steps.push(eliminationStep('boxLine', [line, box], cells, [digit as Digit], eliminations))
    }
  }
  return steps
}
