import { validateScanRecord } from '@sudoku/scan-contract'
import type { CellResult } from '@/scanner'
import type { CellLook } from '@/scan/utils/correction.utils'
import { buildRecord } from './buildRecord'

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
const GIVEN: CellLook = { digit: '5', style: 'given', uncertain: false }

function input(
  overrides: { cells?: readonly CellResult[]; looks?: readonly CellLook[]; corners?: [number, number][] } = {},
) {
  return {
    scanId: UUID_A,
    contributorId: UUID_B,
    appVersion: '1.0.0',
    modelVersion: '2.0.0',
    corners: CORNERS,
    cells: Array.from({ length: 81 }, () => CELL),
    looks: Array.from({ length: 81 }, () => GIVEN),
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
  const looks = Array.from({ length: 81 }, (_, n) =>
    n === 3
      ? ({ digit: '7', style: 'entry', uncertain: false } as CellLook)
      : n === 4
        ? ({ digit: '', style: 'empty', uncertain: false } as CellLook)
        : GIVEN,
  )
  const record = buildRecord(input({ looks }))
  expect(record?.cells[3]).toMatchObject({ edited: true, finalDigit: 7, finalKind: 2 })
  expect(record?.cells[4]).toMatchObject({ edited: true, finalDigit: 0, finalKind: 0 })
  expect(record?.cells.filter((cell) => cell.edited)).toHaveLength(2)
})

it('does not count an invalid model pair as an edit when the player leaves the cell alone', () => {
  // Digit 0 with kind printed shows as an empty cell. Leaving it empty is no correction.
  const odd: CellResult = { ...CELL, digit: 0, kind: 'printed', validPair: false, digitProbs: probs(10, 0) }
  const empty: CellLook = { digit: '', style: 'empty', uncertain: true }
  const cells = Array.from({ length: 81 }, (_, n) => (n === 0 ? odd : CELL))
  const looks = Array.from({ length: 81 }, (_, n) => (n === 0 ? empty : GIVEN))
  expect(buildRecord(input({ cells, looks }))?.cells[0]?.edited).toBe(false)
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
