import type { Level } from '@sudoku/core'

/** The tab bar of the stats screen: the overview of all levels, or one level. */
export type StatsTab = 'all' | Level

/** How many wins the chart of a level shows. */
export const TIMES_COUNT = 10

/** The text for a number that does not exist, such as the best time of a level without a win. */
export const NONE = '–'
