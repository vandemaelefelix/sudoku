import { CLOCK_INTERVAL_MS } from '@/game/constants/game.constants'

/**
 * The most time that one clock report counts, in milliseconds. iOS can suspend JavaScript before
 * the pause on AppState stops the clock. The first report after the return then holds the suspended time.
 */
export const MAX_ELAPSED_MS = 2 * CLOCK_INTERVAL_MS
