import { GRID_CELLS } from './grid'

const NINE = [0, 1, 2, 3, 4, 5, 6, 7, 8]

export const ROWS: readonly (readonly number[])[] = NINE.map((row) => NINE.map((k) => row * 9 + k))

export const COLUMNS: readonly (readonly number[])[] = NINE.map((column) =>
  NINE.map((k) => k * 9 + column),
)

export const BOXES: readonly (readonly number[])[] = NINE.map((box) => {
  const top = Math.floor(box / 3) * 3
  const left = (box % 3) * 3
  return NINE.map((k) => (top + Math.floor(k / 3)) * 9 + left + (k % 3))
})

const PEERS: readonly (readonly number[])[] = Array.from({ length: GRID_CELLS }, (_, cell) => {
  const units = [ROWS, COLUMNS, BOXES].flatMap((all) => all.filter((unit) => unit.includes(cell)))
  return [...new Set(units.flat())].filter((other) => other !== cell).sort((a, b) => a - b)
})

/** The 20 other cells in the row, the column and the box of `cell`, sorted. */
export function peersOf(cell: number): readonly number[] {
  return PEERS[cell] ?? []
}
