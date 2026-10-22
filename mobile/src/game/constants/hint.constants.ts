/** The bits of CellView.hintEdges: the sides of a cell where the outline of the focus units runs. */
export const HINT_EDGE = { top: 1, right: 2, bottom: 4, left: 8 } as const

/** The pulse of the target outline: it shrinks to this scale and grows back once. Inward, so it never covers a neighbour. */
export const TARGET_PULSE_SCALE = 0.86

/** Milliseconds of the pulse of the target outline. */
export const TARGET_PULSE_MS = 520
