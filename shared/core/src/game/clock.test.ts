import { describe, expect, it } from 'vitest'
import { formatClock, wholeSeconds } from './clock'

describe('formatClock', () => {
  it.each([
    [0, '00:00'],
    [999, '00:00'],
    [59_999, '00:59'],
    [65_999, '01:05'],
    [3_600_000, '60:00'],
    [6_000_000, '100:00'],
  ])('shows %d ms as %s', (ms, text) => {
    expect(formatClock(ms)).toBe(text)
  })
})

describe('wholeSeconds', () => {
  it('rounds down', () => {
    expect(wholeSeconds(59_999)).toBe(59)
    expect(wholeSeconds(60_000)).toBe(60)
  })
})
