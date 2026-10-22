import { createAppIntl } from '@/i18n/utils/intl.utils'
import { NONE } from '@/stats/constants/stats.constants'
import { formatAverage, formatPercent, formatTime, timeWords } from './format.utils'

const en = createAppIntl('en')
const nl = createAppIntl('nl', 'nl-BE')

describe('formatTime', () => {
  it.each([
    [272_000, '04:32'],
    [0, '00:00'],
    [59_600, '00:59'],
    [59_999, '00:59'],
    [60_000, '01:00'],
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
    expect(timeWords(en, 272_000)).toBe('4 minutes 32 seconds')
    expect(timeWords(en, 61_000)).toBe('1 minute 1 second')
    expect(timeWords(en, 30_000)).toBe('30 seconds')
    expect(timeWords(en, 59_999)).toBe('59 seconds')
    expect(timeWords(en, 120_000)).toBe('2 minutes')
  })

  it('reads a time as Dutch words', () => {
    expect(timeWords(nl, 272_000)).toBe('4 minuten en 32 seconden')
    expect(timeWords(nl, 61_000)).toBe('1 minuut en 1 seconde')
    expect(timeWords(nl, 60_000)).toBe('1 minuut')
  })
})

describe('formatPercent', () => {
  it('rounds to a whole percent, and writes a dash for none', () => {
    expect(formatPercent(en, 0.75)).toBe('75%')
    expect(formatPercent(en, 19 / 25)).toBe('76%')
    expect(formatPercent(en, 0)).toBe('0%')
    expect(formatPercent(en, null)).toBe(NONE)
  })

  it('follows the locale', () => {
    expect(formatPercent(nl, 0.755)).toMatch(/^76\s?%$/)
  })
})

describe('formatAverage', () => {
  it('writes one decimal, and a dash for none', () => {
    expect(formatAverage(en, 1.4)).toBe('1.4')
    expect(formatAverage(en, 0)).toBe('0.0')
    expect(formatAverage(en, null)).toBe(NONE)
  })

  it('writes a decimal comma in Dutch', () => {
    expect(formatAverage(nl, 1.4)).toBe('1,4')
  })
})
