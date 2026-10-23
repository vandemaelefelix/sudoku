import { boxOf, cellPlace, cellRect, columnOf, rowOf } from './grid.utils'

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

it.each([
  [0, 1, 1],
  [23, 3, 6],
  [80, 9, 9],
])('names cell %d as row %d, column %d from 1', (cell, row, column) => {
  expect(cellPlace(cell)).toEqual({ row, column })
})

it('puts a cell at its corner in points', () => {
  expect(cellRect({ x: 10, y: 20 }, 30, 0)).toEqual({ left: 10, top: 20 })
  expect(cellRect({ x: 10, y: 20 }, 30, 23)).toEqual({ left: 10 + 5 * 30, top: 20 + 2 * 30 })
})
