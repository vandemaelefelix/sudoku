import { describe, expect, it } from 'vitest'
import { countsForBestTime } from './bestTime'

describe('countsForBestTime', () => {
  it('counts a won generated game without hints', () => {
    expect(countsForBestTime({ result: 'won', source: 'generated', hintsUsed: 0 })).toBe(true)
  })

  it.each([
    ['a lost game', { result: 'lost', source: 'generated', hintsUsed: 0 }],
    ['an abandoned game', { result: 'abandoned', source: 'generated', hintsUsed: 0 }],
    ['a scanned game', { result: 'won', source: 'scanned', hintsUsed: 0 }],
    ['a game with a hint', { result: 'won', source: 'generated', hintsUsed: 1 }],
  ] as const)('does not count %s', (_name, game) => {
    expect(countsForBestTime(game)).toBe(false)
  })
})
