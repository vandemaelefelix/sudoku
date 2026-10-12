import { boxOf, columnOf, rowOf } from './grid.utils'

it.each([
  [0, 0, 0, 0],
  [40, 4, 4, 4],
  [50, 5, 5, 4],
  [80, 8, 8, 8],
  [14, 1, 5, 1],
])('places cell %d in row %d, column %d and box %d', (cell, row, column, box) => {
  expect(rowOf(cell)).toBe(row)
  expect(columnOf(cell)).toBe(column)
  expect(boxOf(cell)).toBe(box)
})
