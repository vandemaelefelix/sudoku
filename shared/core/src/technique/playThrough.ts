import { computeCandidates } from './candidates'
import { bitOf } from './masks'
import { nextSteps, type NextStepsOptions } from './nextSteps'
import { TECHNIQUE_ORDER } from './order'
import type { Candidates, Step, TechniqueRank } from './types'

export type Position = { readonly board: readonly number[]; readonly candidates: Candidates }

export type PlayThrough = {
  /** The position before each step. */
  readonly positions: readonly Position[]
  /** The first of the next steps at each position. */
  readonly steps: readonly Step[]
  /** The position after the last step. A puzzle that stays unsolved is stuck here. */
  readonly final: Position
  readonly solved: boolean
}

/**
 * Solves with the techniques of `ranks`: all of them, unless the caller measures a smaller set. At
 * each position it applies the first of the next steps. Struck candidates stay struck after a
 * placement. The `options` go to `nextSteps`.
 */
export function playThrough(
  givens: readonly number[],
  ranks: readonly TechniqueRank[] = TECHNIQUE_ORDER,
  options: NextStepsOptions = {},
): PlayThrough {
  const board = [...givens]
  const struck = new Uint16Array(board.length)
  const positions: Position[] = []
  const steps: Step[] = []
  let final: Position
  for (;;) {
    const candidates = computeCandidates(board)
    for (let cell = 0; cell < candidates.length; cell++) candidates[cell]! &= ~struck[cell]!
    const step = nextSteps(candidates, board, ranks, options)[0]
    if (!step) {
      final = { board: [...board], candidates }
      break
    }
    positions.push({ board: [...board], candidates: new Uint16Array(candidates) })
    steps.push(step)
    for (const { cell, digit } of step.placements) board[cell] = digit
    for (const { cell, digit } of step.eliminations) struck[cell]! |= bitOf(digit)
  }
  return { positions, steps, final, solved: board.every((digit) => digit !== 0) }
}
