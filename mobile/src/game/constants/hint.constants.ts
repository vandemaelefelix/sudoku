/** The bits of CellView.hintEdges: the sides of a cell where the outline of the focus units runs. */
export const HINT_EDGE = { top: 1, right: 2, bottom: 4, left: 8 } as const

/** The pulse of the target outline: it shrinks to this scale and grows back once. Inward, so it never covers a neighbour. */
export const TARGET_PULSE_SCALE = 0.86

/** Milliseconds of the pulse of the target outline. */
export const TARGET_PULSE_MS = 520

/** The labels of the hint card buttons. */
export const HINT_LABELS = {
  hintMore: 'More help',
  hintAnswer: 'Show answer',
  hintTry: 'Try it',
  hintNext: 'Next step',
  hintFill: 'Fill it',
  hintDoIt: "I'll do it",
  hintErase: 'Erase it',
} as const

/** The title of the card before rung 2 names the technique, and of the mistake and the fallback card. */
export const HINT_TITLE = 'Hint'

/** What the strip says when the player placed the target digit. */
export const HINT_NICE = 'Nice.'
