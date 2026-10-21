import { LEVELS, type Level } from '../generator'
import { computeCandidates } from '../technique/candidates'
import { bitOf } from '../technique/masks'
import { nextSteps } from '../technique/nextSteps'
import { stepWeight } from '../technique/order'
import { playThrough } from '../technique/playThrough'
import { findFullHouses, findHiddenSingles, findNakedSingles } from '../technique/singles'
import type { Candidates, Step, TechniqueId } from '../technique/types'
import { GRADE_ORDER, TECHNIQUE_LEVEL } from './levels'

/** The choice counts this many moves (ADR-011, amendment 2026-10-21). */
export const CHOICE_MOVES = 25

/**
 * A puzzle that needs only singles, with a choice below this value, is medium. The data is in
 * docs/research/2026-10-21-technique-grading.md.
 */
export const EASY_MIN_CHOICE = 19

export type Grade = {
  /** `beyond` when the solver does not finish the puzzle. It is not a level of the game. */
  level: Level | 'beyond'
  /** The technique of the highest level, and among those the one with the highest weight. Null when there are no steps. */
  hardest: TechniqueId | null
  /** The sum of `stepWeight` over the steps, in Sudoku Explainer points. */
  score: number
  /** The mean value of the first CHOICE_MOVES moves. See `choiceOf`. */
  choice: number
  steps: number
}

/** The cells that a full house, a hidden single or a naked single fills now. A cell counts once. */
function singlePlacements(candidates: Candidates, board: readonly number[]): { cell: number; digit: number }[] {
  const found = new Map<number, number>()
  const steps = [
    ...findFullHouses(candidates, board),
    ...findHiddenSingles(candidates, board, ['box', 'row', 'column']),
    ...findNakedSingles(candidates, board),
  ]
  for (const { placements } of steps) {
    for (const { cell, digit } of placements) if (!found.has(cell)) found.set(cell, digit)
  }
  return [...found].map(([cell, digit]) => ({ cell, digit }))
}

/**
 * The mean value of the first CHOICE_MOVES moves of a solve in rounds, or 0 for no moves. A round
 * fills every cell that a single can fill, all at once. It counts one move per cell, and the value
 * of each move is the number of cells of the round. When no single applies, the round applies the
 * first step of `GRADE_ORDER` and counts one move with the value 0.
 * The rounds do not depend on the scan order, so a symmetry transform keeps the choice of a puzzle
 * that needs only singles. The givens must have exactly one solution, so that no two cells of a round conflict.
 */
export function choiceOf(givens: readonly number[]): number {
  const board = [...givens]
  const struck = new Uint16Array(board.length)
  let total = 0
  let moves = 0
  while (moves < CHOICE_MOVES && board.includes(0)) {
    const candidates = computeCandidates(board)
    for (let cell = 0; cell < candidates.length; cell++) candidates[cell]! &= ~struck[cell]!
    const singles = singlePlacements(candidates, board)
    if (singles.length > 0) {
      const counted = Math.min(singles.length, CHOICE_MOVES - moves)
      total += counted * singles.length
      moves += counted
      for (const { cell, digit } of singles) board[cell] = digit
      continue
    }
    const step = nextSteps(candidates, board, GRADE_ORDER, { unique: true })[0]
    if (!step) break
    moves++
    for (const { cell, digit } of step.placements) board[cell] = digit
    for (const { cell, digit } of step.eliminations) struck[cell]! |= bitOf(digit)
  }
  return moves === 0 ? 0 : total / moves
}

function hardestOf(steps: readonly Step[]): TechniqueId | null {
  let best: Step | null = null
  for (const step of steps) {
    if (best === null) best = step
    else {
      const levels = LEVELS.indexOf(TECHNIQUE_LEVEL[step.technique]) - LEVELS.indexOf(TECHNIQUE_LEVEL[best.technique])
      if (levels > 0 || (levels === 0 && stepWeight(step) > stepWeight(best))) best = step
    }
  }
  return best?.technique ?? null
}

/**
 * Grades a puzzle by the techniques that solve it and by how many cells a single can fill at each
 * step. The givens must have exactly one solution: the solver then also uses the techniques that
 * need it, and `grade` does not check it. Throws a RangeError for a grid that is not 81 integers from 0 to 9.
 */
export function grade(givens: readonly number[]): Grade {
  // GRADE_ORDER, not TECHNIQUE_ORDER: a hard technique then runs only when no easier level helps.
  const { steps, solved } = playThrough(givens, GRADE_ORDER, { unique: true })
  const hardest = hardestOf(steps)
  // The weights have one decimal. The rounding removes the float noise of the sum.
  const score = Math.round(steps.reduce((sum, step) => sum + stepWeight(step), 0) * 10) / 10
  const choice = choiceOf(givens)
  let level: Level | 'beyond'
  if (!solved) level = 'beyond'
  else if (hardest === null) level = 'easy'
  else {
    level = TECHNIQUE_LEVEL[hardest]
    if (level === 'easy' && choice < EASY_MIN_CHOICE) level = 'medium'
  }
  return { level, hardest, score, choice, steps: steps.length }
}
