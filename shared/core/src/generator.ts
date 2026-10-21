import { DIGITS } from './game/completion'
import { grade, gradesAs } from './grading/grade'
import { GRID_CELLS } from './grid'
import { LEVELS, type Level } from './level'
import { createRandom, shuffled } from './random'
import type { Grid } from './types'
import { BOX_OF, COL_OF, ROW_OF } from './units'

export { LEVELS, type Level }

/**
 * One removal pass reaches 25 givens for about 4 grids in 5, so 50 attempts never run out in
 * practice. Only `generateWithTarget` uses it. The measurement and the tests call that function.
 */
const TARGET_ATTEMPTS = 50

/**
 * The removal stops at this count of givens. The floor keeps an easy puzzle open, and it is the
 * count with the lowest expected time per puzzle of the level (ADR-011, amendment "generation by
 * technique"). The floor does not decide the level: the grade does.
 */
export const GIVENS_FLOOR: Readonly<Record<Level, number>> = {
  easy: 40,
  medium: 34,
  hard: 29,
  expert: 25,
}

/** The chance that all attempts miss is negligible for expert (ADR-011, amendment "generation by technique"). */
export const MAX_ATTEMPTS = 250

export type Puzzle = {
  level: Level
  seed: number
  givens: Grid
  solution: Grid
}

const CELLS = GRID_CELLS
const CELL_ORDER = Array.from({ length: CELLS }, (_, cell) => cell)

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
    const row = ROW_OF[cell]!
    const col = COL_OF[cell]!
    const box = BOX_OF[cell]!
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

const ALL_DIGITS = 0b11_1111_1110

function bitCount(mask: number): number {
  let count = 0
  for (let rest = mask; rest !== 0; rest &= rest - 1) count++
  return count
}

/**
 * Answers "does another solution exist when this cell is empty and holds another digit?" for a
 * grid that has the solution as its only fill. A removal keeps the puzzle unique exactly when the
 * answer is no. This gives the same result as `solve(givens).count === 1`, faster, because the
 * search starts from the known digit and allocates nothing per call.
 */
function createOtherSolutionSearch(): (givens: Grid, cell: number, digit: number) => boolean {
  const cells = new Uint8Array(CELLS)
  const rows = new Uint16Array(9)
  const cols = new Uint16Array(9)
  const boxes = new Uint16Array(9)
  let bannedCell = -1
  let bannedBit = 0

  function search(): boolean {
    let best = -1
    let bestMask = 0
    let bestCount = 10
    for (let cell = 0; cell < CELLS; cell++) {
      if (cells[cell] !== 0) continue
      let mask = ALL_DIGITS & ~(rows[ROW_OF[cell]!]! | cols[COL_OF[cell]!]! | boxes[BOX_OF[cell]!]!)
      if (cell === bannedCell) mask &= ~bannedBit
      const candidates = bitCount(mask)
      if (candidates < bestCount) {
        best = cell
        bestMask = mask
        bestCount = candidates
        if (candidates <= 1) break
      }
    }
    if (best === -1) return true
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
      const found = search()
      cells[best] = 0
      rows[row]! &= ~bit
      cols[col]! &= ~bit
      boxes[box]! &= ~bit
      if (found) return true
    }
    return false
  }

  return (givens, cell, digit) => {
    rows.fill(0)
    cols.fill(0)
    boxes.fill(0)
    for (let at = 0; at < CELLS; at++) {
      const value = givens[at]!
      cells[at] = value
      if (value === 0) continue
      const bit = 1 << value
      rows[ROW_OF[at]!]! |= bit
      cols[COL_OF[at]!]! |= bit
      boxes[BOX_OF[at]!]! |= bit
    }
    bannedCell = cell
    bannedBit = 1 << digit
    return search()
  }
}

/**
 * Removes givens in random order while the puzzle keeps exactly one solution. Stops at `target`
 * givens, or when no given can go. The puzzle is unique, so `grade` accepts it.
 */
export function removeGivens(solution: Grid, target: number, random: () => number): Grid {
  const hasOtherSolution = createOtherSolutionSearch()
  const givens = [...solution]
  let count = CELLS
  for (const cell of shuffled(CELL_ORDER, random)) {
    if (count === target) break
    const digit = givens[cell]!
    givens[cell] = 0
    if (hasOtherSolution(givens, cell, digit)) givens[cell] = digit
    else count--
  }
  return givens
}

/**
 * Tries up to TARGET_ATTEMPTS full grids from one random stream. When no attempt reaches the
 * target, returns the attempt with the fewest givens. Every result has exactly one solution.
 * Only the measurement and the tests use it. `generate` does not, because it grades by technique.
 */
export function generateWithTarget(target: number, seed: number): { givens: Grid; solution: Grid } {
  const random = createRandom(seed)
  let best: { givens: Grid; solution: Grid } | undefined
  for (let attempt = 0; attempt < TARGET_ATTEMPTS; attempt++) {
    const solution = fullGrid(random)
    const givens = removeGivens(solution, target, random)
    if (givensCount(givens) === target) return { givens, solution }
    if (!best || givensCount(givens) < givensCount(best.givens)) best = { givens, solution }
  }
  return best!
}

/**
 * Lower is better. The rank is the distance in levels. At the same distance, a level below the
 * wanted one beats a level above it, because a puzzle that is too easy is safer than one that is too hard.
 */
export function fallbackRank(graded: Level, wanted: Level): number {
  const gap = LEVELS.indexOf(graded) - LEVELS.indexOf(wanted)
  return Math.abs(gap) + (gap > 0 ? 0.5 : 0)
}

type Attempt = { givens: Grid; solution: Grid }

/** Reveals givens of the solution, in random order, until the solver finishes. A full grid is easy. */
function reveal({ givens, solution }: Attempt, random: () => number): Attempt {
  const revealed = [...givens]
  for (const cell of shuffled(CELL_ORDER, random)) {
    if (grade(revealed).level !== 'beyond') break
    revealed[cell] = solution[cell]!
  }
  return { givens: revealed, solution }
}

/**
 * Tries `maxAttempts` full grids from one random stream and keeps the first puzzle that grades as
 * `level`. When none does, it grades the attempts and returns the one that `fallbackRank` ranks
 * first. When every attempt is `beyond`, it reveals givens until the solver finishes. The result
 * is never `beyond`, and has exactly one solution. `matches` exists so that a test can force the fallback.
 */
export function generateAtLevel(
  level: Level,
  seed: number,
  maxAttempts: number = MAX_ATTEMPTS,
  matches: (givens: Grid, level: Level) => boolean = gradesAs,
): Puzzle {
  const random = createRandom(seed)
  const misses: Attempt[] = []
  for (let attempt = 0; attempt < Math.max(1, maxAttempts); attempt++) {
    const solution = fullGrid(random)
    const givens = removeGivens(solution, GIVENS_FLOOR[level], random)
    if (matches(givens, level)) return { level, seed, givens, solution }
    misses.push({ givens, solution })
  }
  let best: Attempt | undefined
  let bestRank = Number.POSITIVE_INFINITY
  for (const miss of misses) {
    const graded = grade(miss.givens).level
    if (graded === 'beyond') continue
    const rank = fallbackRank(graded, level)
    if (rank < bestRank) {
      bestRank = rank
      best = miss
    }
  }
  const { givens, solution } = best ?? reveal(misses[0]!, random)
  return { level, seed, givens, solution }
}

/**
 * The puzzle has `level` as its grade. The same level and seed give the same puzzle on every device.
 * Throws a RangeError for an unknown level, or a seed that is not an integer from 0 to 0xffffffff.
 */
export function generate(level: Level, seed: number): Puzzle {
  if (!LEVELS.includes(level)) throw new RangeError(`Unknown level ${String(level)}`)
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError(`A seed is an integer from 0 to ${0xffffffff}, not ${seed}`)
  }
  return generateAtLevel(level, seed)
}
