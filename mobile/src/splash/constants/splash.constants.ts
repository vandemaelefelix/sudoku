// The timing and the sizes of the splash. Times are in milliseconds. The design is in ADR-024 and the splash concept.
// The intro times count from the mount of the overlay. The exit times count from the start of the exit.

/** The plain ground before the first letter. */
export const HOLD_MS = 250

/**
 * The ground fades from the white of the native splash to the page colour of the saved look. It fades inside HOLD_MS, before
 * the first letter. In Light the page is white, so nothing shows (ADR-026).
 */
export const GROUND_FADE_MS = 150

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
export const ROW_STEP_MS = 21
export const JITTER_MS = 120
export const GLOW_MS = 396

/** The part of GLOW_MS at which a cell glows most. */
export const GLOW_PEAK_AT = 0.3
/** The share of the cells that show a digit. */
export const DIGIT_SHARE = 0.29

/** The size of a digit, as a part of the cell. */
export const DIGIT_SIZE = 0.55
export const DIGIT_ALPHA = 0.6
export const TINT_ALPHA = 0.28
export const LINE_ALPHA = 0.9

/** The word rises this many points and fades out at the start of the exit. */
export const WORD_RISE_BY = 40
export const WORD_FADE_START_MS = 0
export const WORD_FADE_MS = 600

/**
 * The edge of the ground rises with the wave. Below the edge the home shows. The edge is a gradient REVEAL_BAND points
 * high, and it trails the wave by REVEAL_LAG_MS.
 */
export const REVEAL_BAND = 500
export const REVEAL_LAG_MS = 246

/**
 * A theme switch (ADR-025) draws the wave over a picture of the old screen. A cell is solid at its peak, so it covers
 * the picture there. The picture is erased in each cell from its peak on. Points that the erased rectangle of a cell
 * grows on each side, so two cells leave no gap between them.
 */
export const ERASE_OVERLAP = 0.5

/** The last frame of the exit. The last cell and the edge of the ground are gone by then, on every window size. */
export const EXIT_END_MS = 1000

/** The exit starts after this time even when no screen is ready. */
export const MAX_WAIT_MS = 3000
