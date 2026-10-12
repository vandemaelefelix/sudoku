import { formatClock } from './time.utils'

it.each([
  [0, '00:00'],
  [999, '00:00'],
  [65_999, '01:05'],
  [3_600_000, '60:00'],
  [6_000_000, '100:00'],
])('shows %d ms as %s', (ms, text) => {
  expect(formatClock(ms)).toBe(text)
})
