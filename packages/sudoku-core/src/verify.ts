import { GRID_CELLS } from './grid'
import { solve } from './solver'
import { BOXES, COLUMNS, ROWS } from './units'

/**
 * wrong: the givens have one solution, and these entries differ from it. hints: cell index to solution digit.
 * clash: the givens cannot judge the grid, so these cells share a digit in a unit.
 */
export type GridVerdict =
  | { status: 'solved' }
  | { status: 'wrong'; hints: Readonly<Record<number, number>> }
  | { status: 'clash'; cells: readonly number[] }

const UNITS = [...ROWS, ...COLUMNS, ...BOXES]

function duplicateCells(grid: readonly number[]): number[] {
  const marked = new Set<number>()
  for (const unit of UNITS) {
    const seen = new Map<number, number>()
    for (const cell of unit) {
      const digit = grid[cell]!
      const first = seen.get(digit)
      if (first === undefined) {
        seen.set(digit, cell)
      } else {
        marked.add(first)
        marked.add(cell)
      }
    }
  }
  return [...marked].sort((a, b) => a - b)
}

/**
 * Judges a full grid. The printed digits (givens) are trusted and the handwritten digits (entries) are judged.
 * A grid that follows every rule is solved, whatever the givens are. Throws a RangeError when a cell holds neither.
 */
export function verifyGrid(givens: readonly number[], entries: readonly number[]): GridVerdict {
  const grid = Array.from({ length: GRID_CELLS }, (_, cell) => givens[cell] || entries[cell] || 0)
  const empty = grid.indexOf(0)
  if (empty !== -1) throw new RangeError(`Cell ${empty} is empty`)

  const cells = duplicateCells(grid)
  if (cells.length === 0) return { status: 'solved' }

  const solved = solve(givens)
  if (solved.count !== 1) return { status: 'clash', cells }
  const hints: Record<number, number> = {}
  solved.solution.forEach((digit, cell) => {
    if (grid[cell] !== digit) hints[cell] = digit
  })
  return { status: 'wrong', hints }
}
