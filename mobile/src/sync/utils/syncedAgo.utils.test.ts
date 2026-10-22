import { createAppIntl } from '@/i18n/utils/intl.utils'
import { formatSyncedAgo } from './syncedAgo.utils'

const en = createAppIntl('en')

const NOW = Date.parse('2026-10-15T12:00:00.000Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

it.each([
  [0, 'Synced just now'],
  [59 * SECOND, 'Synced just now'],
  [60 * SECOND, 'Synced 1 min ago'],
  [59 * MINUTE, 'Synced 59 min ago'],
  [60 * MINUTE, 'Synced 1 h ago'],
  [23 * HOUR, 'Synced 23 h ago'],
  [24 * HOUR, 'Synced 1 day ago'],
  [2 * DAY, 'Synced 2 days ago'],
  [-5 * MINUTE, 'Synced just now'],
])('formats %d ms as "%s"', (elapsed, text) => {
  expect(formatSyncedAgo(en, ago(elapsed), NOW)).toBe(text)
})

it.each([
  [30 * SECOND, 'Net gesynchroniseerd'],
  [5 * MINUTE, '5 min geleden gesynchroniseerd'],
  [24 * HOUR, '1 dag geleden gesynchroniseerd'],
  [3 * DAY, '3 dagen geleden gesynchroniseerd'],
])('formats %d ms in Dutch as "%s"', (elapsed, text) => {
  expect(formatSyncedAgo(createAppIntl('nl'), ago(elapsed), NOW)).toBe(text)
})
