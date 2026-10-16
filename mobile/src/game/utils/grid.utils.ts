import { BOXES, COLUMNS, GRID_CELLS, ROWS } from '@sudoku/core'

/** For each cell, the index of the unit that holds it. The units come from the core. */
function unitIndex(units: readonly (readonly number[])[]): readonly number[] {
  const index = Array.from({ length: GRID_CELLS }, () => 0)
  units.forEach((unit, unitNumber) => {
    for (const cell of unit) index[cell] = unitNumber
  })
  return index
}

const ROW_OF = unitIndex(ROWS)
const COLUMN_OF = unitIndex(COLUMNS)
const BOX_OF = unitIndex(BOXES)

/** Row 0 to 8 of a cell. */
export const rowOf = (cell: number): number => ROW_OF[cell] ?? 0

/** Column 0 to 8 of a cell. */
export const columnOf = (cell: number): number => COLUMN_OF[cell] ?? 0

/** Box 0 to 8 of a cell, row by row. */
export const boxOf = (cell: number): number => BOX_OF[cell] ?? 0
