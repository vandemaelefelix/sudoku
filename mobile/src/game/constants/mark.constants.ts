// The marks of one cell after a move: a shake for a mistake, a glow for a hint and a flash for an undo.

/** Points of each step of the mistake shake, from the rest position. The last step returns to rest. */
export const SHAKE_STEPS = [-3, 3, -2, 2, 0] as const

/** Milliseconds of one step of the mistake shake. */
export const SHAKE_STEP_MS = 48

/** Milliseconds of the rise and of the fade of a glow or a flash. */
export const FLASH_IN_MS = 120
export const FLASH_OUT_MS = 420

/** The strongest opacity of the hint glow and of the undo flash. The undo flash is quieter: it only shows where. */
export const HINT_PEAK = 0.35
export const UNDO_PEAK = 0.22

/** Milliseconds: the crossfade of a cell fill in a display grid, such as the assist preview. */
export const FILL_FADE_MS = 180
