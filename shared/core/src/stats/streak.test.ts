import { describe, expect, it } from 'vitest'
import { computeStreak, STREAK_WINDOW_DAYS } from './streak'

const noon = (day: string) => `${day}T12:00:00.000Z`

describe('computeStreak', () => {
  it('has no streak without a win', () => {
    expect(computeStreak([], noon('2026-10-12'), 'UTC')).toEqual({
      current: 0,
      longest: 0,
      recent: Array.from({ length: STREAK_WINDOW_DAYS }, () => false),
    })
  })

  it('counts the days in a row up to today', () => {
    const wins = ['2026-10-10', '2026-10-11', '2026-10-12'].map(noon)
    const streak = computeStreak(wins, '2026-10-12T20:00:00.000Z', 'UTC')
    expect(streak).toMatchObject({ current: 3, longest: 3 })
    expect(streak.recent).toHaveLength(STREAK_WINDOW_DAYS)
    expect(streak.recent.slice(-4)).toEqual([false, true, true, true])
  })

  it('keeps a streak alive until the end of the next day', () => {
    const wins = ['2026-10-10', '2026-10-11', '2026-10-12'].map(noon)
    expect(computeStreak(wins, '2026-10-13T08:00:00.000Z', 'UTC')).toMatchObject({ current: 3 })
    expect(computeStreak(wins, '2026-10-14T08:00:00.000Z', 'UTC')).toMatchObject({ current: 0, longest: 3 })
  })

  it('finds the longest run in the past', () => {
    const wins = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-12'].map(noon)
    expect(computeStreak(wins, noon('2026-10-12'), 'UTC')).toMatchObject({ current: 1, longest: 4 })
  })

  it('counts two wins on one day once', () => {
    const wins = ['2026-10-12T08:00:00.000Z', '2026-10-12T18:00:00.000Z']
    expect(computeStreak(wins, noon('2026-10-12'), 'UTC')).toMatchObject({ current: 1, longest: 1 })
  })

  it('counts the day in the time zone of the player', () => {
    // 09:00 UTC is 23:00 on 12 Oct and 11:00 UTC is 01:00 on 13 Oct in Kiritimati (UTC+14).
    const wins = ['2026-10-12T09:00:00.000Z', '2026-10-12T11:00:00.000Z']
    const now = '2026-10-12T12:00:00.000Z'
    expect(computeStreak(wins, now, 'UTC')).toMatchObject({ current: 1 })
    expect(computeStreak(wins, now, 'Pacific/Kiritimati')).toMatchObject({ current: 2 })
  })

  it('shows the last 14 days with today on the right', () => {
    const wins = ['2026-09-29', '2026-09-30', '2026-10-12'].map(noon)
    const { recent } = computeStreak(wins, noon('2026-10-12'), 'UTC')
    // 29 Sep is 13 days before 12 Oct: the first day of the window. 30 Sep is the second.
    expect(recent[0]).toBe(true)
    expect(recent[1]).toBe(true)
    expect(recent[13]).toBe(true)
    expect(recent.filter(Boolean)).toHaveLength(3)
    const older = computeStreak([noon('2026-09-28')], noon('2026-10-12'), 'UTC')
    expect(older.recent.some(Boolean)).toBe(false)
  })

  it('ignores a win in the future', () => {
    expect(computeStreak([noon('2026-10-20')], noon('2026-10-12'), 'UTC')).toMatchObject({ current: 0, longest: 1 })
  })

  it('throws for a time zone that does not exist', () => {
    expect(() => computeStreak([noon('2026-10-12')], noon('2026-10-12'), 'Nowhere/Land')).toThrow(RangeError)
  })
})
