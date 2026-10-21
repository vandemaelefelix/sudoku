import { applyStep, createCandidateState, isContradiction } from './candidates'
import { TECHNIQUES } from './techniques'
import type { Step, Technique, TechniqueSolve } from './types'

export type SolveOptions = {
  /** Tried in this order. The default is `TECHNIQUES`. */
  techniques?: readonly Technique[]
}

/**
 * Applies the first technique that makes progress, then starts again from the first technique.
 * `stalled` means no technique finds a step. `invalid` proves the grid has no solution.
 * A grid with no solution can also end `stalled`.
 * Throws a RangeError for a grid that is not 81 integers from 0 to 9.
 */
export function solveWithTechniques(givens: readonly number[], options: SolveOptions = {}): TechniqueSolve {
  const techniques = options.techniques ?? TECHNIQUES
  const steps: Step[] = []
  let state = createCandidateState(givens)

  for (;;) {
    if (isContradiction(state)) return { status: 'invalid', steps, values: [...state.values] }
    if (state.values.every((value) => value !== 0)) return { status: 'solved', steps, values: [...state.values] }
    let step: Step | null = null
    for (const technique of techniques) {
      step = technique.find(state)
      if (step) break
    }
    if (!step) return { status: 'stalled', steps, values: [...state.values] }
    steps.push(step)
    state = applyStep(state, step)
  }
}
