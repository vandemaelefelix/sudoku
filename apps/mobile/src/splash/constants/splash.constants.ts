// The timing and the sizes of the splash. Times are in milliseconds. The design is in ADR-024 and the splash concept.
// The intro times count from the mount of the overlay. The exit times count from the start of the exit.

/** The plain ground before the first letter. */
export const HOLD_MS = 250

export const WORD = 'Sudoku'
export const LETTER_COUNT = 6
export const LETTER_STEP_MS = 45
export const LETTER_RISE_MS = 450

/** Points that a letter rises while it fades in, at the size of the splash word. */
export const LETTER_RISE_BY = 36

/** The intro ends when the last letter is at rest. */
export const INTRO_END_MS = HOLD_MS + (LETTER_COUNT - 1) * LETTER_STEP_MS + LETTER_RISE_MS

/** The splash word is this many times the size of the home title. */
export const WORD_SCALE = 2

export const GRID_COLUMNS = 9
export const ROW_STEP_MS = 30
export const JITTER_MS = 120
export const GLOW_MS = 600

/** The part of GLOW_MS at which a cell glows most. */
export const GLOW_PEAK_AT = 0.3
export const TINT_ALPHA = 0.28
export const LINE_ALPHA = 0.9

export const GROUND_FADE_START_MS = 100
export const GROUND_FADE_END_MS = 800
export const GLIDE_START_MS = 150
export const GLIDE_MS = 750

/** The word fades out here. Every cell under the title has cleared by then. */
export const HANDOFF_AT_MS = 1350
export const HANDOFF_MS = 100

/** The last frame of the exit. */
export const EXIT_END_MS = 1500

/** The exit starts after this time even when no screen is ready. */
export const MAX_WAIT_MS = 3000
