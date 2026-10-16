import { solve, type NewGame } from '@sudoku/core'
import { SAMPLE_GIVENS } from '@/game/constants/game.constants'

/** The canvas puzzle. Throws when the puzzle does not have exactly one solution. */
export function sampleStart(): NewGame {
  const givens = [...SAMPLE_GIVENS].map(Number)
  const result = solve(givens)
  if (result.count !== 1) throw new Error(`The sample puzzle has ${result.count} solutions`)
  return { givens, solution: result.solution }
}
