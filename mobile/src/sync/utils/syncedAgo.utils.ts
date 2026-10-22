import type { Formatter } from '@/i18n/utils/intl.utils'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * The muted line of the stats screen. A time in the future, from a clock that is ahead, reads as just now. ICU plurals, not
 * Intl.RelativeTimeFormat: Hermes lacks it (ADR-033, point 7).
 */
export function formatSyncedAgo(intl: Formatter, iso: string, now: number): string {
  const elapsed = now - Date.parse(iso)
  if (elapsed < MINUTE) return intl.formatMessage({ id: 'sync.syncedNow' })
  if (elapsed < HOUR) return intl.formatMessage({ id: 'sync.syncedMinutes' }, { count: Math.floor(elapsed / MINUTE) })
  if (elapsed < DAY) return intl.formatMessage({ id: 'sync.syncedHours' }, { count: Math.floor(elapsed / HOUR) })
  return intl.formatMessage({ id: 'sync.syncedDays' }, { count: Math.floor(elapsed / DAY) })
}
