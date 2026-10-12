import { GIVENS_TARGET, LEVELS, solve, type Level, type NewGame } from '@sudoku/core'
import type { CorrectedGrid } from '@/scan/utils/correctionEdit.utils'

/** Why "Play this puzzle" stays off. none and several: the number of solutions of the givens. */
export type PlayBlock = 'conflict' | 'none' | 'several' | 'solved'

/** The plain grid that a scan hands to the game (SUD-03), with the level of its givens. */
export type ScannedStart = { level: Level; puzzle: Required<NewGame> }

export type PlayCheck = { ok: true; start: ScannedStart } | { ok: false; block: PlayBlock }

/** The level whose givens target is nearest (ADR-011, amendment "a level for scanned puzzles"). A tie goes to the easier level. */
export function levelOf(givens: readonly number[]): Level {
  const count = givens.filter((digit) => digit !== 0).length
  const distance = (level: Level) => Math.abs(GIVENS_TARGET[level] - count)
  // LEVELS runs from easy to expert, and only a nearer level replaces the best one.
  return LEVELS.reduce((best, level) => (distance(level) < distance(best) ? level : best))
}

/**
 * The play gate of the correction screen (QR-04). Uncertain cells never block: the ring is a hint.
 * Only the givens go to the solver. A wrong entry loads as a wrong entry and is not a mistake.
 */
export function checkPlay(grid: CorrectedGrid, conflicts: readonly boolean[]): PlayCheck {
  if (conflicts.some(Boolean)) return { ok: false, block: 'conflict' }
  const solved = solve(grid.givens)
  if (solved.count === 0) return { ok: false, block: 'none' }
  if (solved.count === 2) return { ok: false, block: 'several' }
  const { solution } = solved
  // createGame makes a full, correct grid a won game, and PuzzleRepository.start refuses a won game.
  const full = solution.every((digit, cell) => grid.givens[cell] === digit || grid.entries[cell] === digit)
  if (full) return { ok: false, block: 'solved' }
  return {
    ok: true,
    start: { level: levelOf(grid.givens), puzzle: { givens: grid.givens, solution, entries: grid.entries } },
  }
}
