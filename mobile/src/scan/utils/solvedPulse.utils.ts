import { GRID_CELLS } from '@sudoku/core'

/** The middle cell of the grid. The solved pulse starts here (the design canvas, "Check: solved"). */
export const CENTRE_CELL = 40

/** One delay in ms for each cell: stepMs for each row and column step away from the centre cell. */
export function solvedDelays(stepMs: number): number[] {
  const row = Math.floor(CENTRE_CELL / 9)
  const column = CENTRE_CELL % 9
  return Array.from(
    { length: GRID_CELLS },
    (_, cell) => (Math.abs(Math.floor(cell / 9) - row) + Math.abs((cell % 9) - column)) * stepMs,
  )
}
