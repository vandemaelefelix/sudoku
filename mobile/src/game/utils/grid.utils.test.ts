import { boxOf, cellLines, columnOf, gridLineCentre, rowOf } from './grid.utils'

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

describe('the grid lines', () => {
  // A grid of 2 + 9 * 38 + 2 * 2 + 6 * 1 + 2 = 356 points has cells of exactly 38 points.
  const widths = { outer: 2, box: 2, cell: 1 }
  const side = 356

  it('finds the centre of each line: the frame, the cell lines and the box lines', () => {
    expect(gridLineCentre(0, side, widths)).toBe(1)
    expect(gridLineCentre(1, side, widths)).toBe(2 + 38 + 0.5)
    expect(gridLineCentre(3, side, widths)).toBe(2 + 3 * 38 + 2 * 1 + 1)
    expect(gridLineCentre(9, side, widths)).toBe(side - 1)
  })

  it('gives the four lines around a cell next to a box line', () => {
    // Cell 3 is row 1, column 4: its left side is the box line 3.
    expect(cellLines(3, side, widths)).toEqual({
      left: gridLineCentre(3, side, widths),
      right: gridLineCentre(4, side, widths),
      top: 1,
      bottom: gridLineCentre(1, side, widths),
    })
  })
})
