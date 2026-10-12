import { describe, expect, it } from 'vitest'
import { createRandom, shuffled } from './random'

const take = (random: () => number, n: number): number[] => Array.from({ length: n }, () => random())

describe('createRandom', () => {
  it('gives the same sequence for the same seed', () => {
    expect(take(createRandom(42), 20)).toEqual(take(createRandom(42), 20))
  })

  it('gives another sequence for another seed', () => {
    expect(take(createRandom(42), 20)).not.toEqual(take(createRandom(43), 20))
  })

  it('gives numbers from 0 up to but not including 1', () => {
    for (const value of take(createRandom(7), 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('pins the first value of seed 1, so a change of the algorithm shows', () => {
    expect(createRandom(1)()).toBe(0.6270739405881613)
  })
})

describe('shuffled', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9]

  it('returns the same items in another order', () => {
    const out = shuffled(items, createRandom(3))
    expect(new Set(out)).toEqual(new Set(items))
    expect(out).toHaveLength(items.length)
    expect(out).not.toEqual(items)
  })

  it('does not change its input', () => {
    const input = [...items]
    shuffled(input, createRandom(3))
    expect(input).toEqual(items)
  })

  it('gives the same order for the same seed', () => {
    expect(shuffled(items, createRandom(9))).toEqual(shuffled(items, createRandom(9)))
  })
})
