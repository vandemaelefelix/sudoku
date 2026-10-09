/** The number of cells in a sudoku grid. */
export const GRID_CELLS = 81

/** A new grid with every cell empty. 0 means empty. */
export function createEmptyGrid(): number[] {
  return new Array<number>(GRID_CELLS).fill(0)
}
