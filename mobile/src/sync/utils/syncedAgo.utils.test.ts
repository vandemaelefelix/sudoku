import { formatSyncedAgo } from './syncedAgo.utils'

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
  expect(formatSyncedAgo(ago(elapsed), NOW)).toBe(text)
})
