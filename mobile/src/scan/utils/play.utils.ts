import { solve, type NewGame } from '@sudoku/core'
import type { CorrectedGrid } from '@/scan/utils/correctionEdit.utils'

/** Why "Play this puzzle" stays off. none and several: the number of solutions of the givens. full: no cell is empty, so there is nothing to play. */
export type PlayBlock = 'conflict' | 'none' | 'several' | 'full'

/** The plain grid that a scan hands to the game (SUD-03). The game finds the level from the givens. */
export type ScannedStart = Required<NewGame>

export type PlayCheck = { ok: true; start: ScannedStart } | { ok: false; block: PlayBlock }

/**
 * The play gate of the correction screen (QR-04). Uncertain cells never block: the ring is a hint.
 * Only the givens go to the solver. A wrong entry loads as a wrong entry and is not a mistake.
 */
export function checkPlay(grid: CorrectedGrid, conflicts: readonly boolean[]): PlayCheck {
  if (conflicts.some(Boolean)) return { ok: false, block: 'conflict' }
  // A full grid has nothing to play. The screen offers verify, and verifyGrid judges it (a wrong entry is a mistake here).
  if (grid.givens.every((digit, cell) => digit !== 0 || grid.entries[cell] !== 0)) return { ok: false, block: 'full' }
  const solved = solve(grid.givens)
  if (solved.count === 0) return { ok: false, block: 'none' }
  if (solved.count === 2) return { ok: false, block: 'several' }
  const { solution } = solved
  return { ok: true, start: { givens: grid.givens, solution, entries: grid.entries } }
}
