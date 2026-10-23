import { type Digit, generate } from '@sudoku/core'
import type { CellResult } from '@/scanner'
import type { CaptureOk } from '@/scan/utils/captureResult.utils'
import { okResult } from '@/scan/scanTestKit'

/** A hard puzzle with a fixed seed. */
export const puzzle = generate('hard', 5)

export const firstOpen = puzzle.givens.findIndex((digit) => digit === 0)

/** A digit that differs from the solution of the first open cell. */
export const wrongDigit = (((puzzle.solution[firstOpen] ?? 0) % 9) + 1) as Digit

/** A recognised result with every given of `givens` printed, and `over` on top. */
export function scanOf(givens: readonly number[], over: { [n: number]: Partial<CellResult> } = {}): CaptureOk {
  const printed: { [n: number]: Partial<CellResult> } = {}
  givens.forEach((digit, n) => {
    if (digit !== 0) printed[n] = { digit, kind: 'printed', confidence: 1 }
  })
  return okResult({ ...printed, ...over })
}

/** A recognised result with the whole solution. wrong: one cell with another digit. */
export function fullScan(wrong?: { cell: number; digit: number }): CaptureOk {
  const over: { [n: number]: Partial<CellResult> } = {}
  puzzle.solution.forEach((digit, n) => {
    over[n] = {
      digit: wrong?.cell === n ? wrong.digit : digit,
      kind: puzzle.givens[n] === 0 ? 'handwritten' : 'printed',
      confidence: 1,
    }
  })
  return okResult(over)
}
