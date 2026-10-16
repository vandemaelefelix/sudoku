import { NONE } from '@/stats/constants/stats.constants'

/** Minutes and seconds, such as "04:32". A time of 100 minutes or more keeps its third digit. */
export function formatTime(ms: number | null): string {
  if (ms === null) return NONE
  // Round first: 59.6 seconds must read 01:00, not 00:60.
  const seconds = Math.round(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/** A count with its noun, such as "1 day" or "3 days". */
export function countOf(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/** The same time as words, for an accessibility label. */
export function timeWords(ms: number): string {
  const seconds = Math.round(ms / 1000)
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
