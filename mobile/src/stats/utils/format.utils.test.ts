import { NONE } from '@/stats/constants/stats.constants'
import { countOf, formatAverage, formatPercent, formatTime, timeWords } from './format.utils'

describe('formatTime', () => {
  it.each([
    [272_000, '04:32'],
    [0, '00:00'],
    [59_600, '01:00'],
    [6_000_000, '100:00'],
  ])('writes %p ms as %p', (ms, text) => {
    expect(formatTime(ms)).toBe(text)
  })

  it('writes a dash for no time', () => {
    expect(formatTime(null)).toBe(NONE)
  })
})

describe('timeWords', () => {
  it('reads a time as words for a screen reader', () => {
    expect(timeWords(272_000)).toBe('4 minutes 32 seconds')
    expect(timeWords(61_000)).toBe('1 minute 1 second')
    expect(timeWords(30_000)).toBe('30 seconds')
  })
})

describe('formatPercent', () => {
  it('rounds to a whole percent, and writes a dash for none', () => {
    expect(formatPercent(0.75)).toBe('75%')
    expect(formatPercent(19 / 25)).toBe('76%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(null)).toBe(NONE)
  })
})

describe('formatAverage', () => {
  it('writes one decimal, and a dash for none', () => {
    expect(formatAverage(1.4)).toBe('1.4')
    expect(formatAverage(0)).toBe('0.0')
    expect(formatAverage(null)).toBe(NONE)
  })
})

describe('countOf', () => {
  it('writes the noun in the singular for 1 and the plural for the rest', () => {
    expect(countOf(1, 'day')).toBe('1 day')
    expect(countOf(0, 'day')).toBe('0 days')
    expect(countOf(14, 'win')).toBe('14 wins')
  })
})
