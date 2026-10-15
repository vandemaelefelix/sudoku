import { describe, expect, it } from 'vitest'
import { DAILY_CAP, countExpiresAt, dayKey } from '../../src/dailyCount'

describe('dayKey', () => {
  it('is the UTC date, also around midnight', () => {
    expect(dayKey(new Date('2026-10-15T23:59:59.999Z'))).toBe('2026-10-15')
    expect(dayKey(new Date('2026-10-16T00:00:00.000Z'))).toBe('2026-10-16')
    expect(dayKey(new Date('2026-10-16T01:30:00.000+02:00'))).toBe('2026-10-15')
  })
})

describe('countExpiresAt', () => {
  it('is the start of the UTC day plus 2 days, in epoch seconds', () => {
    const expected = Date.parse('2026-10-17T00:00:00.000Z') / 1000
    expect(countExpiresAt(new Date('2026-10-15T00:00:00.000Z'))).toBe(expected)
    expect(countExpiresAt(new Date('2026-10-15T23:59:59.999Z'))).toBe(expected)
  })
})

describe('DAILY_CAP', () => {
  it('is 200 stored history entries per player per day (ADR-027 decision 9)', () => {
    expect(DAILY_CAP).toBe(200)
  })
})
