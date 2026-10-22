/** The bits of CellView.hintEdges: the sides of a cell where the outline of the focus units runs. */
export const HINT_EDGE = { top: 1, right: 2, bottom: 4, left: 8 } as const

/** The pulse of the target outline: it shrinks to this scale and grows back once. Inward, so it never covers a neighbour. */
export const TARGET_PULSE_SCALE = 0.86

/** Milliseconds of the pulse of the target outline. */
export const TARGET_PULSE_MS = 520

/** Points that the tool row and the keypad sink while the hint card rises the same distance into their place. */
export const HINT_SLIDE = 40

// The entrance of the hint roles on the grid. Each role waits for the role before it: the focus sweep, then the pattern,
// then the support digits and the struck candidates, then the ghost of the target.

/** Milliseconds between two cells of a sweep, in reading order. */
export const ROLE_STEP_MS = 30

/** Milliseconds of the fade of one focus cell. */
export const FOCUS_FADE_MS = 200

/** Milliseconds of the one pulse of the new focus cells after the sweep. */
export const FOCUS_PULSE_MS = 420

/** The strongest opacity of the glow of the focus pulse. */
export const FOCUS_PULSE_PEAK = 0.3

/** Milliseconds of the pop of a pattern cell or a support ring. */
export const ROLE_POP_MS = 260

/** The scale that a pop starts from. */
export const ROLE_POP_FROM = 0.6

/** Milliseconds that a strike takes to cross its note from left to right. */
export const STRIKE_DRAW_MS = 220

/** Milliseconds of the fade of the ghost digit at the answer rung. */
export const GHOST_FADE_MS = 240

/** Milliseconds of the fade of every role with Reduce Motion: no sweep, no pop, no draw. */
export const ROLE_FADE_MS = 150

/** The pulse time of a change without new focus cells. */
export const NO_FOCUS_PULSE = -1
