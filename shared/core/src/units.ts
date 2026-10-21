import { GRID_CELLS } from './grid'

const NINE = [0, 1, 2, 3, 4, 5, 6, 7, 8]

export const ROWS: readonly (readonly number[])[] = NINE.map((row) => NINE.map((k) => row * 9 + k))

export const COLUMNS: readonly (readonly number[])[] = NINE.map((column) => NINE.map((k) => k * 9 + column))

export const BOXES: readonly (readonly number[])[] = NINE.map((box) => {
  const top = Math.floor(box / 3) * 3
  const left = (box % 3) * 3
  return NINE.map((k) => (top + Math.floor(k / 3)) * 9 + left + (k % 3))
})

/** Unit indices: rows 0 to 8, columns 9 to 17, boxes 18 to 26. */
export const UNITS: readonly (readonly number[])[] = [...ROWS, ...COLUMNS, ...BOXES]

export type UnitKind = 'row' | 'column' | 'box'

export function unitKindOf(unit: number): UnitKind {
  if (unit < 9) return 'row'
  return unit < 18 ? 'column' : 'box'
}

const CELLS = Array.from({ length: GRID_CELLS }, (_, cell) => cell)

export const ROW_OF: readonly number[] = CELLS.map((cell) => Math.floor(cell / 9))
export const COL_OF: readonly number[] = CELLS.map((cell) => cell % 9)
export const BOX_OF: readonly number[] = CELLS.map((cell) => Math.floor(cell / 27) * 3 + Math.floor((cell % 9) / 3))

/** For each cell: the unit indices of its row, its column and its box, in this order. */
export const UNITS_OF: readonly (readonly [number, number, number])[] = CELLS.map((cell) => [
  ROW_OF[cell]!,
  9 + COL_OF[cell]!,
  18 + BOX_OF[cell]!,
])

/** For each cell: the 20 other cells in its row, column and box, sorted. */
export const PEERS: readonly (readonly number[])[] = CELLS.map((cell) => {
  const units = UNITS_OF[cell]!.map((unit) => UNITS[unit]!)
  return CELLS.filter((other) => other !== cell && units.some((unit) => unit.includes(other)))
})

/** The 20 other cells in the row, the column and the box of `cell`, sorted. */
export function peersOf(cell: number): readonly number[] {
  return PEERS[cell] ?? []
}
