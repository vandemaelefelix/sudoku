import { computeCandidates } from './candidates'
import { bitOf } from './masks'
import { nextSteps } from './nextSteps'
import type { Candidates, Step } from './types'

export type Position = { readonly board: readonly number[]; readonly candidates: Candidates }

export type PlayThrough = {
  /** The position before each step. */
  readonly positions: readonly Position[]
  /** The first of the next steps at each position. */
  readonly steps: readonly Step[]
  readonly solved: boolean
}

/**
 * Solves with tier 1 techniques only. At each position it applies the first of the next steps.
 * Struck candidates stay struck after a placement.
 */
export function playThrough(givens: readonly number[]): PlayThrough {
  const board = [...givens]
  const struck = new Uint16Array(board.length)
  const positions: Position[] = []
  const steps: Step[] = []
  for (;;) {
    const candidates = computeCandidates(board)
    for (let cell = 0; cell < candidates.length; cell++) candidates[cell]! &= ~struck[cell]!
    const step = nextSteps(candidates, board)[0]
    if (!step) break
    positions.push({ board: [...board], candidates: new Uint16Array(candidates) })
    steps.push(step)
    for (const { cell, digit } of step.placements) board[cell] = digit
    for (const { cell, digit } of step.eliminations) struck[cell]! |= bitOf(digit)
  }
  return { positions, steps, solved: board.every((digit) => digit !== 0) }
}
