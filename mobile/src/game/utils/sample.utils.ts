import { solve, type NewGame } from '@sudoku/core'
import { SAMPLE_GIVENS, SAMPLE_POINTING, SAMPLE_STUCK } from '@/game/constants/game.constants'

/** The canvas puzzle. Throws when the puzzle does not have exactly one solution. */
export function sampleStart(): NewGame {
  const givens = [...SAMPLE_GIVENS].map(Number)
  const result = solve(givens)
  if (result.count !== 1) throw new Error(`The sample puzzle has ${result.count} solutions`)
  return { givens, solution: result.solution }
}

/** A game in progress: the puzzle `givens`, with the digits of `board` that are not givens as entries. */
function positionStart([givens, board]: readonly [string, string]): NewGame {
  const start = [...givens].map(Number)
  const result = solve(start)
  if (result.count !== 1) throw new Error(`The sample position has ${result.count} solutions`)
  const entries = [...board].map((digit, cell) => (start[cell] === 0 ? Number(digit) : 0))
  return { givens: start, solution: result.solution, entries }
}

/** A position whose hint plan has two steps: a pointing pair, then a single. */
export const pointingStart = (): NewGame => positionStart(SAMPLE_POINTING)

/** A position where a hint takes the fallback. */
export const stuckStart = (): NewGame => positionStart(SAMPLE_STUCK)
