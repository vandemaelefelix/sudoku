import type { CellResult } from '@/scanner'
import type { Quad } from '@/utils/geometry.utils'
import { type CellLook, cellLook } from './correction.utils'
import { buildScanRecord } from './correctionLog.utils'

const corners: Quad = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
]
const printed = (digit: number): CellResult => ({
  digit,
  kind: 'printed',
  confidence: 0.99,
  validPair: true,
  second: 1,
})
const empty: CellResult = { digit: 0, kind: 'none', confidence: 0.99, validPair: true, second: 1 }
const scan = (): CellResult[] => Array.from({ length: 81 }, (_, i) => (i % 2 === 0 ? printed((i % 9) + 1) : empty))
const unchanged = (cells: CellResult[]): CellLook[] => cells.map(cellLook)

describe('buildScanRecord', () => {
  it('marks no cell as corrected when the player changed nothing', () => {
    const cells = scan()
    const record = buildScanRecord(cells, unchanged(cells), corners, 'now', 'run')
    expect(record.cells.some((cell) => cell.digitCorrected || cell.kindCorrected)).toBe(false)
  })

  it('records a corrected digit with the model answer and the final answer', () => {
    const cells = scan()
    const looks = unchanged(cells)
    looks[4] = { ...looks[4]!, digit: '2' }
    const record = buildScanRecord(cells, looks, corners, 'now', 'run')
    expect(record.cells).toHaveLength(81)
    expect(record.cells[4]).toEqual({
      row: 0,
      col: 4,
      model: { digit: 5, kind: 'printed', confidence: 0.99 },
      final: { digit: 2, kind: 'printed' },
      digitCorrected: true,
      kindCorrected: false,
    })
    expect(record.cells.filter((cell) => cell.digitCorrected || cell.kindCorrected)).toHaveLength(1)
    expect(record).toMatchObject({ savedAt: 'now', modelRun: 'run', corners })
  })

  it('records a kind switch: an entry is handwritten', () => {
    const cells = scan()
    const looks = unchanged(cells)
    looks[0] = { ...looks[0]!, style: 'entry' }
    const first = buildScanRecord(cells, looks, corners, 'now', 'run').cells[0]!
    expect(first).toMatchObject({
      final: { digit: 1, kind: 'handwritten' },
      kindCorrected: true,
      digitCorrected: false,
    })
  })

  it('records a cleared cell as empty with the kind none', () => {
    const cells = scan()
    const looks = unchanged(cells)
    looks[2] = { digit: '', style: 'empty', uncertain: false }
    expect(buildScanRecord(cells, looks, corners, 'now', 'run').cells[2]).toMatchObject({
      final: { digit: 0, kind: 'none' },
      digitCorrected: true,
    })
  })
})
