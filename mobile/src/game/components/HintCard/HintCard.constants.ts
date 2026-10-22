import type { HintRung } from '@sudoku/core'

export const RUNGS: readonly HintRung[] = [1, 2, 3, 4]

/** Milliseconds that one rung dot takes to fill. A jump of several rungs fills the dots in turn. */
export const DOT_FILL_MS = 90

/** Points around the 24 pt close icon, for a touch target of 44 pt. */
export const CLOSE_SLOP = 10

/** The largest Dynamic Type scale of the top row and the text buttons, so the rung text keeps its room in the card. */
export const CONTROL_MAX_SCALE = 1.3
