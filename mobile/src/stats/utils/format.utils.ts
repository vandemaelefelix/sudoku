import { formatClock, wholeSeconds } from '@sudoku/core'
import type { Formatter } from '@/i18n/utils/intl.utils'
import { NONE } from '@/stats/constants/stats.constants'

/** Minutes and seconds, such as "04:32": the format of the finish card and the timer. A dash for no time. */
export function formatTime(ms: number | null): string {
  return ms === null ? NONE : formatClock(ms)
}

/** The same time as words, for an accessibility label. */
export function timeWords(intl: Formatter, ms: number): string {
  const total = wholeSeconds(ms)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  const seconds = intl.formatMessage({ id: 'stats.time.seconds' }, { count: rest })
  if (minutes === 0) return seconds
  const minuteWords = intl.formatMessage({ id: 'stats.time.minutes' }, { count: minutes })
  return rest === 0
    ? minuteWords
    : intl.formatMessage({ id: 'stats.time.minutesSeconds' }, { minutes: minuteWords, seconds })
}

export function formatPercent(intl: Formatter, rate: number | null): string {
  return rate === null ? NONE : intl.formatNumber(rate, { style: 'percent', maximumFractionDigits: 0 })
}

export function formatAverage(intl: Formatter, value: number | null): string {
  return value === null ? NONE : intl.formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
