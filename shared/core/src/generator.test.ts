import { describe, expect, it } from 'vitest'
import { fullGrid, generateWithTarget, MAX_ATTEMPTS } from './generator'
import { generate, GIVENS_TARGET, LEVELS, solve, type Level } from './index'
import { createRandom } from './random'

const givensCount = (grid: readonly number[]): number => grid.filter((digit) => digit !== 0).length
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1)

describe('fullGrid', () => {
  it('fills a complete grid that obeys every rule', () => {
    const full = fullGrid(createRandom(5))
    expect(givensCount(full)).toBe(81)
    expect(solve(full)).toEqual({ count: 1, solution: full })
  })

  it('gives the same grid for the same seed', () => {
    expect(fullGrid(createRandom(5))).toEqual(fullGrid(createRandom(5)))
  })
})

describe('generate', () => {
  it('has four levels with fewer givens at each step', () => {
    expect(LEVELS).toEqual(['easy', 'medium', 'hard', 'expert'])
    expect(GIVENS_TARGET).toEqual({ easy: 40, medium: 34, hard: 29, expert: 25 })
  })

  describe.for(LEVELS)('%s', (level) => {
    it.for(SEEDS)('seed %i has the target givens and exactly one solution', (seed) => {
      const puzzle = generate(level, seed)
      expect(puzzle.level).toBe(level)
      expect(puzzle.seed).toBe(seed)
      expect(givensCount(puzzle.givens)).toBe(GIVENS_TARGET[level])
      expect(solve(puzzle.givens)).toEqual({ count: 1, solution: puzzle.solution })
    })
  })

  it('only keeps givens that match the solution', () => {
    const { givens, solution } = generate('easy', 11)
    const kept = givens.map((digit, cell) => (digit === 0 ? 0 : solution[cell]))
    expect(givens).toEqual(kept)
  })

  it('gives the same puzzle for the same level and seed', () => {
    expect(generate('expert', 99)).toEqual(generate('expert', 99))
  })

  it('gives another puzzle for another seed', () => {
    expect(generate('medium', 1).givens).not.toEqual(generate('medium', 2).givens)
  })

  it('pins the puzzle of hard seed 42, so a change of the generator shows', () => {
    const puzzle = generate('hard', 42)
    expect(puzzle.givens.join('')).toBe(
      '000740001910080460004150000301020090002830076400000020680910700000005080000000000',
    )
    expect(puzzle.solution.join('')).toBe(
      '836749251915283467724156938361527894592834176478691523683912745149375682257468319',
    )
  })

  it.for([Number.NaN, -1, 1.5, 2 ** 32, Number.POSITIVE_INFINITY])('refuses the seed %s', (seed) => {
    expect(() => generate('easy', seed)).toThrow(RangeError)
  })

  it.for([0, 0xffffffff])('accepts the seed %i', (seed) => {
    expect(generate('easy', seed).seed).toBe(seed)
  })

  it('refuses a level it does not know', () => {
    expect(() => generate('nightmare' as Level, 1)).toThrow(RangeError)
  })
})

describe('generateWithTarget', () => {
  it('returns the fewest givens it found when no attempt reaches the target', () => {
    const { givens, solution } = generateWithTarget(17, 3)
    expect(givensCount(givens)).toBeGreaterThan(17)
    expect(solve(givens)).toEqual({ count: 1, solution })
    expect(MAX_ATTEMPTS).toBe(50)
  })
})

describe('generation time', () => {
  it.for(LEVELS)('records the time of %s', async (level, { annotate }) => {
    const times = SEEDS.map((seed) => {
      const start = performance.now()
      generate(level as Level, seed)
      return performance.now() - start
    })
    const slowest = Math.max(...times)
    await annotate(`slowest of ${SEEDS.length}: ${slowest.toFixed(1)} ms`, 'generation time')
    expect(slowest).toBeLessThan(1000)
  })
})
