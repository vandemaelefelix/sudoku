import { formatClock, wholeSeconds } from '@sudoku/core'
import { NONE } from '@/stats/constants/stats.constants'

/** Minutes and seconds, such as "04:32": the format of the finish card and the timer. A dash for no time. */
export function formatTime(ms: number | null): string {
  return ms === null ? NONE : formatClock(ms)
}

/** A count with its noun, such as "1 day" or "3 days". */
export function countOf(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/** The same time as words, for an accessibility label. */
export function timeWords(ms: number): string {
  const seconds = wholeSeconds(ms)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes === 0) return countOf(rest, 'second')
  return `${countOf(minutes, 'minute')}${rest === 0 ? '' : ` ${countOf(rest, 'second')}`}`
}

export function formatPercent(rate: number | null): string {
  return rate === null ? NONE : `${Math.round(rate * 100)}%`
}

export function formatAverage(value: number | null): string {
  return value === null ? NONE : value.toFixed(1)
}
