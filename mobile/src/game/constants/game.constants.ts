/** The puzzle of the design canvas. 0 marks an empty cell. */
export const SAMPLE_GIVENS = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'

/** A position whose hint plan is a pointing pair, then the single that it unlocks: the givens, then the board. */
export const SAMPLE_POINTING = [
  '071000005006005903030000000000000438060000700493708000340016000009803000100497000',
  '971034005006175943534080017710000438060341700493708001347016000609803174100497306',
] as const

/** A position where no hint technique applies, so a hint takes the fallback: the givens, then the board. */
export const SAMPLE_STUCK = [
  '005400020009600000000003007050000006100000009700908400080170054000000700010050093',
  '005490320009600540001503967950042106100065209700918435080179654590830712017250893',
] as const

/** How often the clock reports the elapsed time, in milliseconds. */
export const CLOCK_INTERVAL_MS = 1000

/**
 * The most time that one clock report counts, in milliseconds. iOS can suspend JavaScript before
 * the pause on AppState stops the clock. The first report after the return then holds the suspended time.
 */
export const MAX_ELAPSED_MS = 2 * CLOCK_INTERVAL_MS
