import { createRandom, shuffled } from './random'
import { solve } from './solver'
import type { Grid } from './types'

export type Level = 'easy' | 'medium' | 'hard' | 'expert'

export const LEVELS: readonly Level[] = ['easy', 'medium', 'hard', 'expert']

/** v1 grades a puzzle by its number of givens only (ADR-011, amendment 2026-10-12). */
export const GIVENS_TARGET: Readonly<Record<Level, number>> = {
  easy: 40,
  medium: 34,
  hard: 29,
  expert: 25,
}

/** One removal pass reaches 25 givens for about 4 grids in 5, so 50 attempts never run out in practice. */
export const MAX_ATTEMPTS = 50

export type Puzzle = {
  level: Level
  seed: number
  givens: Grid
  solution: Grid
}

const CELLS = 81
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const CELL_ORDER = Array.from({ length: CELLS }, (_, cell) => cell)

function boxOf(cell: number): number {
  return Math.floor(cell / 27) * 3 + Math.floor((cell % 9) / 3)
}

function givensCount(grid: readonly number[]): number {
  return grid.filter((digit) => digit !== 0).length
}

/** A complete valid grid. Bit d of a mask stands for digit d. */
export function fullGrid(random: () => number): Grid {
  const cells: Grid = Array.from({ length: CELLS }, () => 0)
  const rows = Array.from({ length: 9 }, () => 0)
  const cols = Array.from({ length: 9 }, () => 0)
  const boxes = Array.from({ length: 9 }, () => 0)

  function fill(cell: number): boolean {
    if (cell === CELLS) return true
    const row = Math.floor(cell / 9)
    const col = cell % 9
    const box = boxOf(cell)
    for (const digit of shuffled(DIGITS, random)) {
      const bit = 1 << digit
      if ((rows[row]! | cols[col]! | boxes[box]!) & bit) continue
      cells[cell] = digit
      rows[row]! |= bit
      cols[col]! |= bit
      boxes[box]! |= bit
      if (fill(cell + 1)) return true
      cells[cell] = 0
      rows[row]! &= ~bit
      cols[col]! &= ~bit
      boxes[box]! &= ~bit
    }
    return false
  }

  fill(0)
  return cells
}

function removeGivens(solution: Grid, target: number, random: () => number): Grid {
  const givens = [...solution]
  let count = CELLS
  for (const cell of shuffled(CELL_ORDER, random)) {
    if (count === target) break
    const digit = givens[cell]!
    givens[cell] = 0
    if (solve(givens).count === 1) count--
    else givens[cell] = digit
  }
  return givens
}

/**
 * Tries up to MAX_ATTEMPTS full grids from one random stream. When no attempt reaches the
 * target, returns the attempt with the fewest givens. Every result has exactly one solution.
 */
export function generateWithTarget(target: number, seed: number): { givens: Grid; solution: Grid } {
  const random = createRandom(seed)
  let best: { givens: Grid; solution: Grid } | undefined
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const solution = fullGrid(random)
    const givens = removeGivens(solution, target, random)
    if (givensCount(givens) === target) return { givens, solution }
    if (!best || givensCount(givens) < givensCount(best.givens)) best = { givens, solution }
  }
  return best!
}

/**
 * The same level and seed give the same puzzle on every device.
 * Throws a RangeError for an unknown level, or a seed that is not an integer from 0 to 0xffffffff.
 */
export function generate(level: Level, seed: number): Puzzle {
  if (!LEVELS.includes(level)) throw new RangeError(`Unknown level ${String(level)}`)
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError(`A seed is an integer from 0 to ${0xffffffff}, not ${seed}`)
  }
  const { givens, solution } = generateWithTarget(GIVENS_TARGET[level], seed)
  return { level, seed, givens, solution }
}
