import type { HintRung } from '@sudoku/core'

export const RUNGS: readonly HintRung[] = [1, 2, 3, 4]

/** Milliseconds of the fade of the card. A fade moves nothing, so Reduce Motion keeps it. */
export const CARD_FADE_MS = 180

/** Points around the 24 pt close icon, for a touch target of 44 pt. */
export const CLOSE_SLOP = 10
