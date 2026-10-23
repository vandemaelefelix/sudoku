// Arithmetic, not lookup tables: the scanner calls these helpers inside worklets, and a worklet would copy a table when it
// captures it. Each helper carries the 'worklet' directive so the UI thread and the frame processor can call it.

const SIDE = 9
const BOX_SIDE = 3

/** Row 0 to 8 of a cell. */
export function rowOf(cell: number): number {
  'worklet'
  return Math.floor(cell / SIDE)
}

/** Column 0 to 8 of a cell. */
export function columnOf(cell: number): number {
  'worklet'
  return cell % SIDE
}

/** Box 0 to 8 of a cell, row by row. */
export function boxOf(cell: number): number {
  'worklet'
  return Math.floor(rowOf(cell) / BOX_SIDE) * BOX_SIDE + Math.floor(columnOf(cell) / BOX_SIDE)
}

/** The row and the column of a cell, from 1, for labels. cell: the index, row-major. */
export function cellPlace(cell: number): { row: number; column: number } {
  'worklet'
  return { row: rowOf(cell) + 1, column: columnOf(cell) + 1 }
}

/** The top-left corner of a cell in points. grid: the top-left corner of the grid. cellSize: the side of one cell. */
export function cellRect(
  grid: { x: number; y: number },
  cellSize: number,
  cell: number,
): { left: number; top: number } {
  'worklet'
  return { left: grid.x + columnOf(cell) * cellSize, top: grid.y + rowOf(cell) * cellSize }
}
