/** The puzzle of the design canvas. 0 marks an empty cell. */
export const SAMPLE_GIVENS = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'

/** How often the clock reports the elapsed time, in milliseconds. */
export const CLOCK_INTERVAL_MS = 1000

/**
 * The most time that one clock report counts, in milliseconds. iOS can suspend JavaScript before
 * the pause on AppState stops the clock. The first report after the return then holds the suspended time.
 */
export const MAX_ELAPSED_MS = 2 * CLOCK_INTERVAL_MS
