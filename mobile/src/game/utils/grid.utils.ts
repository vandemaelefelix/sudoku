import { BOXES, COLUMNS, GRID_CELLS, ROWS } from '@sudoku/core'
import type { CellLines } from '@/utils/selectionFrame.utils'

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

/** The widths of the grid lines in points: the outer frame, a box line and a cell line (ADR-015). */
export type GridLineWidths = { outer: number; box: number; cell: number }

/** The width of line 0 to 9 along one axis: the frame at both ends, a box line every third line. */
function lineWidth(line: number, widths: GridLineWidths): number {
  if (line === 0 || line === 9) return widths.outer
  return line % 3 === 0 ? widths.box : widths.cell
}

/**
 * The centre of line 0 to 9 along one axis of a grid of `side` points. The lines are the gaps between the cells, so the
 * nine cells share what the ten lines leave.
 */
export function gridLineCentre(line: number, side: number, widths: GridLineWidths): number {
  let lines = 0
  for (let before = 0; before <= 9; before++) lines += lineWidth(before, widths)
  const cellSize = (side - lines) / 9
  let start = line * cellSize
  for (let before = 0; before < line; before++) start += lineWidth(before, widths)
  return start + lineWidth(line, widths) / 2
}

/** The centres of the four lines around a cell. */
export function cellLines(cell: number, side: number, widths: GridLineWidths): CellLines {
  const row = rowOf(cell)
  const column = columnOf(cell)
  return {
    left: gridLineCentre(column, side, widths),
    right: gridLineCentre(column + 1, side, widths),
    top: gridLineCentre(row, side, widths),
    bottom: gridLineCentre(row + 1, side, widths),
  }
}
