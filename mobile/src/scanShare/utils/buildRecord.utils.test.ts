import { validateScanRecord } from '@sudoku/scan-contract'
import type { CellResult } from '@/scanner'
import type { FinalCell, FinalGrid } from '@/utils/finalGrid.utils'
import { buildRecord } from './buildRecord.utils'

const UUID_A = '7f3a91c2-0000-4000-8000-000000000001'
const UUID_B = '7f3a91c2-0000-4000-8000-000000000002'
const CORNERS: [number, number][] = [
  [0.1, 0.1],
  [0.9, 0.1],
  [0.9, 0.9],
  [0.1, 0.9],
]

function probs(width: number, top: number): number[] {
  return Array.from({ length: width }, (_, i) => (i === top ? 1 : 0))
}

// Printed 5 for every cell: digit class 5, kind class 1 (printed).
const CELL: CellResult = {
  digit: 5,
  kind: 'printed',
  confidence: 1,
  validPair: true,
  second: 0,
  digitProbs: probs(10, 5),
  kindProbs: probs(4, 1),
}
const KEPT: FinalCell = { digit: 5, kind: 'printed', digitCorrected: false, kindCorrected: false }

function input(overrides: { cells?: readonly CellResult[]; finalGrid?: FinalGrid; corners?: [number, number][] } = {}) {
  return {
    scanId: UUID_A,
    contributorId: UUID_B,
    appVersion: '1.0.0',
    modelVersion: '2.0.0',
    corners: CORNERS,
    cells: Array.from({ length: 81 }, () => CELL),
    finalGrid: Array.from({ length: 81 }, () => KEPT),
    ...overrides,
  }
}

it('builds a record that passes the contract, with edited false when the player changed nothing', () => {
  const record = buildRecord(input())
  expect(record).not.toBeNull()
  expect(validateScanRecord(record).ok).toBe(true)
  expect(record?.cells.every((cell) => !cell.edited)).toBe(true)
  expect(record?.cells[0]).toMatchObject({ finalDigit: 5, finalKind: 1 })
})

it('sets edited on the cells the player changed, and the final digit and kind', () => {
  const finalGrid = Array.from({ length: 81 }, (_, n): FinalCell => {
    if (n === 3) return { digit: 7, kind: 'handwritten', digitCorrected: true, kindCorrected: true }
    if (n === 4) return { digit: 0, kind: 'none', digitCorrected: true, kindCorrected: true }
    if (n === 5) return { digit: 5, kind: 'handwritten', digitCorrected: false, kindCorrected: true }
    return KEPT
  })
  const record = buildRecord(input({ finalGrid }))
  expect(record?.cells[3]).toMatchObject({ edited: true, finalDigit: 7, finalKind: 2 })
  expect(record?.cells[4]).toMatchObject({ edited: true, finalDigit: 0, finalKind: 0 })
  expect(record?.cells[5]).toMatchObject({ edited: true, finalDigit: 5, finalKind: 2 })
  expect(record?.cells.filter((cell) => cell.edited)).toHaveLength(3)
})

it('keeps a pencil-marked cell as kind notes, not as an edit', () => {
  const finalGrid = Array.from({ length: 81 }, (_, n): FinalCell =>
    n === 0 ? { digit: 0, kind: 'notes', digitCorrected: false, kindCorrected: false } : KEPT,
  )
  expect(buildRecord(input({ finalGrid }))?.cells[0]).toMatchObject({ edited: false, finalDigit: 0, finalKind: 3 })
})

it('returns null when the final grid is short of a cell', () => {
  expect(buildRecord(input({ finalGrid: [KEPT] }))).toBeNull()
})

it('returns null when a cell has no probabilities', () => {
  const { digitProbs: _drop, ...bare } = CELL
  expect(buildRecord(input({ cells: Array.from({ length: 81 }, () => bare) }))).toBeNull()
})

it('returns null when the record breaks the contract', () => {
  expect(
    buildRecord(
      input({
        corners: [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ],
      }),
    ),
  ).toBeNull()
})
