import type { CellDigit, Step } from '../technique/types'

/**
 * What one hint shows (ADR-032).
 * - mistake: the board holds a wrong entry. The hint teaches nothing until the player erases it.
 * - steps: 1 to 6 steps. Only the last step places a digit, its `answer`.
 * - fallback: no hint technique reaches a placement within 6 steps. `answer` is the empty cell with the fewest candidates.
 */
export type HintPlan =
  | { readonly kind: 'mistake'; readonly cell: number }
  | { readonly kind: 'steps'; readonly steps: readonly Step[]; readonly answer: CellDigit }
  | { readonly kind: 'fallback'; readonly answer: CellDigit }

/** 1 look, 2 technique, 3 why, 4 answer. */
export type HintRung = 1 | 2 | 3 | 4
