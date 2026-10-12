import type { Grid } from './types'

/** count 2 means two or more: the search stops at the second solution. */
export type SolveResult = { count: 0 } | { count: 1; solution: Grid } | { count: 2 }

const CELLS = 81
const ALL_DIGITS = 0b11_1111_1110

const ROW_OF: readonly number[] = Array.from({ length: CELLS }, (_, cell) => Math.floor(cell / 9))
const COL_OF: readonly number[] = Array.from({ length: CELLS }, (_, cell) => cell % 9)
const BOX_OF: readonly number[] = Array.from(
  { length: CELLS },
  (_, cell) => Math.floor(cell / 27) * 3 + Math.floor((cell % 9) / 3),
)

function bitCount(mask: number): number {
  let count = 0
  for (let rest = mask; rest !== 0; rest &= rest - 1) count++
  return count
}

/**
 * Backtracking solver of ADR-011. Bit d of a mask stands for digit d.
 * Throws a RangeError for a puzzle that is not 81 integers from 0 to 9.
 */
export function solve(puzzle: readonly number[]): SolveResult {
  if (puzzle.length !== CELLS) {
    throw new RangeError(`A puzzle has ${CELLS} cells, not ${puzzle.length}`)
  }
  const cells: Grid = Array.from({ length: CELLS }, () => 0)
  const rows = Array.from({ length: 9 }, () => 0)
  const cols = Array.from({ length: 9 }, () => 0)
  const boxes = Array.from({ length: 9 }, () => 0)

  for (let cell = 0; cell < CELLS; cell++) {
    const digit = puzzle[cell]!
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
      throw new RangeError(`Cell ${cell} holds ${digit}, not an integer from 0 to 9`)
    }
  }

  for (let cell = 0; cell < CELLS; cell++) {
    const digit = puzzle[cell]!
    if (digit === 0) continue
    const bit = 1 << digit
    const row = ROW_OF[cell]!
    const col = COL_OF[cell]!
    const box = BOX_OF[cell]!
    if ((rows[row]! | cols[col]! | boxes[box]!) & bit) return { count: 0 }
    rows[row]! |= bit
    cols[col]! |= bit
    boxes[box]! |= bit
    cells[cell] = digit
  }

  let count = 0
  let solution: Grid | undefined

  // Returns true when the search can stop: it found the second solution.
  function search(): boolean {
    let best = -1
    let bestMask = 0
    let bestCount = 10
    for (let cell = 0; cell < CELLS; cell++) {
      if (cells[cell] !== 0) continue
      const mask = ALL_DIGITS & ~(rows[ROW_OF[cell]!]! | cols[COL_OF[cell]!]! | boxes[BOX_OF[cell]!]!)
      const candidates = bitCount(mask)
      if (candidates < bestCount) {
        best = cell
        bestMask = mask
        bestCount = candidates
        if (candidates <= 1) break
      }
    }
    if (best === -1) {
      count++
      if (count === 1) solution = [...cells]
      return count >= 2
    }
    if (bestCount === 0) return false

    const row = ROW_OF[best]!
    const col = COL_OF[best]!
    const box = BOX_OF[best]!
    for (let rest = bestMask; rest !== 0;) {
      const bit = rest & -rest
      rest ^= bit
      cells[best] = 31 - Math.clz32(bit)
      rows[row]! |= bit
      cols[col]! |= bit
      boxes[box]! |= bit
      const stop = search()
      cells[best] = 0
      rows[row]! &= ~bit
      cols[col]! &= ~bit
      boxes[box]! &= ~bit
      if (stop) return true
    }
    return false
  }

  search()
  if (count === 0) return { count: 0 }
  if (count === 1 && solution) return { count: 1, solution }
  return { count: 2 }
}
