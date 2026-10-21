import { describe, expect, it } from 'vitest'
import { BOX_OF, BOXES, COL_OF, COLUMNS, PEERS, peersOf, ROW_OF, ROWS, UNITS, UNITS_OF, unitKindOf } from './units'

describe('units', () => {
  it('has nine rows, columns and boxes of nine cells', () => {
    for (const units of [ROWS, COLUMNS, BOXES]) {
      expect(units).toHaveLength(9)
      for (const unit of units) expect(unit).toHaveLength(9)
    }
  })

  it('numbers the cells row by row', () => {
    expect(ROWS[1]).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17])
    expect(COLUMNS[2]).toEqual([2, 11, 20, 29, 38, 47, 56, 65, 74])
  })

  it('numbers the boxes left to right, then top to bottom', () => {
    expect(BOXES[0]).toEqual([0, 1, 2, 9, 10, 11, 18, 19, 20])
    expect(BOXES[4]).toEqual([30, 31, 32, 39, 40, 41, 48, 49, 50])
    expect(BOXES[8]).toEqual([60, 61, 62, 69, 70, 71, 78, 79, 80])
  })

  it('gives every cell 20 peers, without the cell itself', () => {
    for (let cell = 0; cell < 81; cell++) {
      const peers = peersOf(cell)
      expect(peers).toHaveLength(20)
      expect(peers).not.toContain(cell)
    }
  })

  it('numbers the units rows, columns, boxes', () => {
    expect(UNITS).toHaveLength(27)
    expect(UNITS.slice(0, 9)).toEqual(ROWS)
    expect(UNITS.slice(9, 18)).toEqual(COLUMNS)
    expect(UNITS.slice(18)).toEqual(BOXES)
    expect([0, 8, 9, 17, 18, 26].map(unitKindOf)).toEqual(['row', 'row', 'column', 'column', 'box', 'box'])
  })

  it('finds the row, the column and the box of each cell', () => {
    for (let cell = 0; cell < 81; cell++) {
      expect(ROWS[ROW_OF[cell]!]).toContain(cell)
      expect(COLUMNS[COL_OF[cell]!]).toContain(cell)
      expect(BOXES[BOX_OF[cell]!]).toContain(cell)
      expect(UNITS_OF[cell]!.map((unit) => UNITS[unit]!.includes(cell))).toEqual([true, true, true])
      expect(PEERS[cell]).toEqual(peersOf(cell))
    }
    expect(UNITS_OF[40]).toEqual([4, 13, 22])
  })

  it('takes the peers from the row, the column and the box', () => {
    expect(peersOf(0)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20, 27, 36, 45, 54, 63, 72])
  })
})
