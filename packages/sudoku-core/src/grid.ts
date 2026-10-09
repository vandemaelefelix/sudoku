/** The number of cells in a sudoku grid. */
export const GRID_CELLS = 81

/** A new grid with every cell empty. 0 means empty. */
export function createEmptyGrid(): number[] {
  return Array.from({ length: GRID_CELLS }, () => 0)
}
