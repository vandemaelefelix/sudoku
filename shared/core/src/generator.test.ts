import { describe, expect, it } from 'vitest'
import {
  fallbackRank,
  fullGrid,
  generateAtLevel,
  generateWithTarget,
  GIVENS_FLOOR,
  MAX_ATTEMPTS,
  removeGivens,
} from './generator'
import { EASY_MIN_CHOICE, grade, gradesAs } from './grading/grade'
import { generate, LEVELS, solve, type Level } from './index'
import { createRandom, shuffled } from './random'

const givensCount = (grid: readonly number[]): number => grid.filter((digit) => digit !== 0).length
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1)
const BELOW_SEED = 258
const AT_SEED = 7
const BEYOND_SEED = 22

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

describe('removeGivens', () => {
  it.for([40, 34, 17])('keeps exactly one solution down to %i givens, as the solver counts it', (floor) => {
    const solution = fullGrid(createRandom(floor))
    const givens = removeGivens(solution, floor, createRandom(floor + 1))
    expect(givensCount(givens)).toBeGreaterThanOrEqual(floor)
    expect(solve(givens)).toEqual({ count: 1, solution })
  })

  it('stops at a minimal puzzle: no given can go', () => {
    const givens = removeGivens(fullGrid(createRandom(8)), 17, createRandom(9))
    givens.forEach((digit, cell) => {
      if (digit === 0) return
      expect(solve(givens.map((value, at) => (at === cell ? 0 : value))).count).toBe(2)
    })
  })

  it.for([40, 29, 17])('removes the same givens as a removal that counts solutions, down to %i', (floor) => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const solution = fullGrid(createRandom(seed))
      const slow = [...solution]
      let count = 81
      const random = createRandom(seed + 100)
      for (const cell of shuffled(
        Array.from({ length: 81 }, (_, at) => at),
        random,
      )) {
        if (count === floor) break
        const digit = slow[cell]!
        slow[cell] = 0
        if (solve(slow).count === 1) count--
        else slow[cell] = digit
      }
      expect(removeGivens(solution, floor, createRandom(seed + 100))).toEqual(slow)
    }
  })
})

describe('generate', () => {
  it('has four levels, and a floor of givens that falls with the level', () => {
    expect(LEVELS).toEqual(['easy', 'medium', 'hard', 'expert'])
    expect(GIVENS_FLOOR).toEqual({ easy: 40, medium: 34, hard: 29, expert: 25 })
  })

  describe.for(LEVELS)('%s', (level) => {
    it.for(SEEDS)('seed %i has the grade of the level and exactly one solution', (seed) => {
      const puzzle = generate(level, seed)
      expect(puzzle.level).toBe(level)
      expect(puzzle.seed).toBe(seed)
      expect(grade(puzzle.givens).level).toBe(level)
      expect(givensCount(puzzle.givens)).toBeGreaterThanOrEqual(GIVENS_FLOOR[level])
      expect(solve(puzzle.givens)).toEqual({ count: 1, solution: puzzle.solution })
    })
  })

  it('gives an easy puzzle at least the floor of givens, so it stays open', () => {
    for (const seed of SEEDS) expect(givensCount(generate('easy', seed).givens)).toBeGreaterThanOrEqual(40)
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

describe('gradesAs', () => {
  it.for([40, 34, 29, 17])('agrees with the level of grade() for every level at %i givens', (floor) => {
    for (const seed of Array.from({ length: 40 }, (_, i) => i)) {
      const givens = removeGivens(fullGrid(createRandom(seed)), floor, createRandom(seed))
      const level = grade(givens).level
      for (const wanted of LEVELS) expect(gradesAs(givens, wanted)).toBe(level === wanted)
    }
  })

  // The choice of a singles-only puzzle is the mean of 25 moves, so it is not a whole number.
  it('puts a singles-only puzzle just below EASY_MIN_CHOICE in medium', () => {
    const { givens } = generateWithTarget(34, BELOW_SEED)
    const result = grade(givens)
    expect(result.choice).toBeLessThan(EASY_MIN_CHOICE)
    expect(EASY_MIN_CHOICE - result.choice).toBeLessThan(0.2)
    expect(result.level).toBe('medium')
    expect(gradesAs(givens, 'medium')).toBe(true)
    expect(gradesAs(givens, 'easy')).toBe(false)
  })

  it('puts a singles-only puzzle at EASY_MIN_CHOICE in easy', () => {
    const { givens } = generateWithTarget(40, AT_SEED)
    const result = grade(givens)
    expect(result.choice).toBeGreaterThanOrEqual(EASY_MIN_CHOICE)
    expect(result.choice - EASY_MIN_CHOICE).toBeLessThan(0.2)
    expect(result.level).toBe('easy')
    expect(gradesAs(givens, 'easy')).toBe(true)
    expect(gradesAs(givens, 'medium')).toBe(false)
  })
})

const never = () => false

describe('generateAtLevel', () => {
  it('uses the same random stream for the same seed, so a larger limit gives the same puzzle', () => {
    expect(generateAtLevel('hard', 7, 5)).toEqual(generateAtLevel('hard', 7, MAX_ATTEMPTS))
  })

  it('ranks a level below the wanted one before a level above it, at the same distance', () => {
    expect(fallbackRank('medium', 'hard')).toBeLessThan(fallbackRank('expert', 'hard'))
    expect(fallbackRank('easy', 'medium')).toBeLessThan(fallbackRank('hard', 'medium'))
  })

  it('ranks a nearer level above a farther one, and the wanted level first', () => {
    expect(fallbackRank('hard', 'hard')).toBe(0)
    expect(fallbackRank('expert', 'hard')).toBeLessThan(fallbackRank('easy', 'hard'))
    expect(fallbackRank('easy', 'hard')).toBeLessThan(fallbackRank('easy', 'expert'))
  })

  it('returns the puzzle of the nearest level when the matcher misses every attempt', () => {
    const puzzle = generateAtLevel('hard', 3, 30, never)
    expect(puzzle.level).toBe('hard')
    expect(grade(puzzle.givens).level).toBe('hard')
    expect(solve(puzzle.givens)).toEqual({ count: 1, solution: puzzle.solution })
  })

  it('never returns a puzzle that is beyond, even when every attempt is', () => {
    const puzzle = generateAtLevel('expert', 3, 1, never)
    expect(grade(puzzle.givens).level).not.toBe('beyond')
    expect(solve(puzzle.givens)).toEqual({ count: 1, solution: puzzle.solution })
  })

  it('reveals givens when every attempt is beyond', () => {
    const seed = BEYOND_SEED
    const first = generateAtLevel('expert', seed, 1, never)
    const random = createRandom(seed)
    const attempt = removeGivens(fullGrid(random), GIVENS_FLOOR.expert, random)
    expect(grade(attempt).level).toBe('beyond')
    expect(givensCount(first.givens)).toBeGreaterThan(givensCount(attempt))
    expect(grade(first.givens).level).not.toBe('beyond')
  })

  it('takes a level above when no level below exists', () => {
    let easy: Level | 'beyond' = 'beyond'
    for (let seed = 0; seed < 50 && easy !== 'medium'; seed++) {
      const puzzle = generateAtLevel('easy', seed, 1, never)
      easy = grade(puzzle.givens).level
    }
    expect(easy).toBe('medium')
  })

  it('has a limit that makes a miss negligible for expert', () => {
    // 0.922 is the share of attempts that miss: the yield of expert at 25 givens is 7.8 % (ADR-011).
    expect(0.922 ** MAX_ATTEMPTS).toBeLessThan(1e-8)
  })
})

describe('generateWithTarget', () => {
  it('returns the fewest givens it found when no attempt reaches the target', () => {
    const { givens, solution } = generateWithTarget(17, 3)
    expect(givensCount(givens)).toBeGreaterThan(17)
    expect(solve(givens)).toEqual({ count: 1, solution })
  })
})

describe('generation time', () => {
  // Timing differs by machine. The bound is on the median, so a busy CI worker does not fail one slow seed.
  // It is a loose guard against a slow search, not a target.
  it.for(LEVELS)('records the time of %s', async (level, { annotate }) => {
    const times = SEEDS.map((seed) => {
      const start = performance.now()
      generate(level as Level, seed)
      return performance.now() - start
    })
    // oxlint-disable-next-line unicorn/no-array-sort -- the core target has no toSorted, and this array is local
    times.sort((a, b) => a - b)
    const median = (times[9]! + times[10]!) / 2
    const slowest = times.at(-1)!
    await annotate(
      `median ${median.toFixed(1)} ms, slowest ${slowest.toFixed(1)} ms over ${SEEDS.length} seeds`,
      'generation time',
    )
    expect(median).toBeLessThan(500)
  })
})
