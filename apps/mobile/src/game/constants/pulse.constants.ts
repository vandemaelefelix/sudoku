// The pulse of the design canvas (Main.dc.html, celebrate). Times in milliseconds.

/** The delay of a cell outside the pulse. */
export const NO_PULSE = -1

/** The delay per step of Manhattan distance from the cell of the move. Equals SHARED_MOTION.pulseStep. */
export const PULSE_STEP_MS = 45

/** The wave of one cell. Equals SHARED_MOTION.long. */
export const WAVE_MS = 700

/** The part of WAVE_MS at which the wave is strongest. */
export const WAVE_PEAK_AT = 0.35

/** The opacity of the accent colour at the peak of the wave. */
export const WAVE_PEAK_OPACITY = 0.3

/** The pop of one digit. */
export const POP_MS = 450

/** The part of POP_MS at which the digit is largest. */
export const POP_PEAK_AT = 0.4

export const POP_SCALE = 1.3

/** The longest solve pulse: from a corner to the opposite corner is 16 steps. */
export const SOLVE_PULSE_MS = 16 * PULSE_STEP_MS + WAVE_MS
