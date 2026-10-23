import { GRID_CELLS } from '@sudoku/core'
import { columnOf, rowOf } from '@/utils/grid.utils'

/** The middle cell of the grid. The solved pulse starts here (the design canvas, "Check: solved"). */
export const CENTRE_CELL = 40

/** One delay in ms for each cell: stepMs for each row and column step away from the centre cell. */
export function solvedDelays(stepMs: number): number[] {
  const row = rowOf(CENTRE_CELL)
  const column = columnOf(CENTRE_CELL)
  return Array.from(
    { length: GRID_CELLS },
    (_, cell) => (Math.abs(rowOf(cell) - row) + Math.abs(columnOf(cell) - column)) * stepMs,
  )
}
