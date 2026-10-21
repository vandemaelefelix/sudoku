import type { CellResult } from '@/scanner'
import { cellLook, type CellLook } from './correction.utils'
import { finalGrid } from './finalGrid.utils'

const printed = (digit: number): CellResult => ({
  digit,
  kind: 'printed',
  confidence: 0.99,
  validPair: true,
  second: 1,
})
const empty: CellResult = { digit: 0, kind: 'none', confidence: 0.99, validPair: true, second: 1 }
const scan = (): CellResult[] => Array.from({ length: 81 }, (_, i) => (i % 2 === 0 ? printed((i % 9) + 1) : empty))
const unchanged = (cells: CellResult[]): CellLook[] => cells.map((cell) => cellLook(cell))

describe('finalGrid', () => {
  it('marks no cell as corrected when the player changed nothing', () => {
    const cells = scan()
    const grid = finalGrid(cells, unchanged(cells))
    expect(grid).toHaveLength(81)
    expect(grid.some((cell) => cell.digitCorrected || cell.kindCorrected)).toBe(false)
    expect(grid[4]).toEqual({ digit: 5, kind: 'printed', digitCorrected: false, kindCorrected: false })
    expect(grid[1]).toEqual({ digit: 0, kind: 'none', digitCorrected: false, kindCorrected: false })
  })

  it('flags a corrected digit and keeps the kind', () => {
    const cells = scan()
    const looks = unchanged(cells)
    looks[4] = { ...looks[4]!, digit: '2' }
    expect(finalGrid(cells, looks)[4]).toEqual({
      digit: 2,
      kind: 'printed',
      digitCorrected: true,
      kindCorrected: false,
    })
  })

  it('turns an entry into handwritten and a given into printed', () => {
    const cells = scan()
    const looks = unchanged(cells)
    looks[0] = { ...looks[0]!, style: 'entry' }
    expect(finalGrid(cells, looks)[0]).toEqual({
      digit: 1,
      kind: 'handwritten',
      digitCorrected: false,
      kindCorrected: true,
    })
  })

  it('turns a cleared cell into digit 0 with kind none', () => {
    const cells = scan()
    const looks = unchanged(cells)
    looks[2] = { digit: '', style: 'empty', uncertain: false }
    expect(finalGrid(cells, looks)[2]).toEqual({ digit: 0, kind: 'none', digitCorrected: true, kindCorrected: true })
  })

  it('keeps a pencil-marked cell as notes with digit 0', () => {
    const cells = scan()
    cells[1] = { ...empty, kind: 'notes' }
    const grid = finalGrid(cells, unchanged(cells))
    expect(grid[1]).toEqual({ digit: 0, kind: 'notes', digitCorrected: false, kindCorrected: false })
  })

  it('does not count an invalid model pair as a correction when the player leaves the cell alone', () => {
    // Digit 0 with kind printed shows as an empty cell. Leaving it empty is no correction.
    const cells = scan()
    cells[0] = { digit: 0, kind: 'printed', confidence: 0.4, validPair: false, second: 1 }
    const grid = finalGrid(cells, unchanged(cells))
    expect(grid[0]).toEqual({ digit: 0, kind: 'none', digitCorrected: false, kindCorrected: false })
  })

  it('keeps what the scanner read for a cell without a look', () => {
    const cells = scan()
    expect(finalGrid(cells, [])[0]).toEqual({ digit: 1, kind: 'printed', digitCorrected: false, kindCorrected: false })
  })
})
