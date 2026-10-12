import { describe, expect, it } from 'vitest'
import { solve } from './index'

const grid = (digits: string): number[] => digits.split('').map(Number)

const EASY = grid('530070000600195000098000060800060003400803001700020006060000280000419005000080079')
const EASY_SOLUTION = grid('534678912672195348198342567859761423426853791713924856961537284287419635345286179')

describe('solve', () => {
  it('returns the one solution of a puzzle with one solution', () => {
    expect(solve(EASY)).toEqual({ count: 1, solution: EASY_SOLUTION })
  })

  it('returns a full valid grid as its own solution', () => {
    expect(solve(EASY_SOLUTION)).toEqual({ count: 1, solution: EASY_SOLUTION })
  })

  it('counts two when the puzzle has several solutions', () => {
    const several = [...EASY]
    for (const cell of [0, 1, 4, 9, 10, 13]) several[cell] = 0
    expect(solve(several)).toEqual({ count: 2 })
  })

  it('counts two for the empty grid', () => {
    expect(solve(Array.from({ length: 81 }, () => 0))).toEqual({ count: 2 })
  })

  it('gives zero solutions when a digit repeats in a row', () => {
    const puzzle = [...EASY]
    puzzle[2] = 5
    expect(solve(puzzle)).toEqual({ count: 0 })
  })

  it('gives zero solutions when a digit repeats in a column', () => {
    const puzzle = [...EASY]
    puzzle[18] = 5
    expect(solve(puzzle)).toEqual({ count: 0 })
  })

  it('gives zero solutions when a digit repeats in a box', () => {
    const puzzle = [...EASY]
    puzzle[10] = 5
    expect(solve(puzzle)).toEqual({ count: 0 })
  })

  it('gives zero solutions when an empty cell has no candidate', () => {
    // Row 1 holds 1 to 8 in its first eight cells. The 9 in the column of the last cell blocks it.
    const puzzle = Array.from({ length: 81 }, () => 0)
    for (let k = 0; k < 8; k++) puzzle[k] = k + 1
    puzzle[17] = 9
    expect(solve(puzzle)).toEqual({ count: 0 })
  })

  it('does not change the puzzle and returns a new array', () => {
    const puzzle = [...EASY]
    const result = solve(puzzle)
    expect(puzzle).toEqual(EASY)
    expect(result.count === 1 && result.solution).not.toBe(puzzle)
  })

  it.each([
    ['80 cells', Array.from({ length: 80 }, () => 0)],
    ['82 cells', Array.from({ length: 82 }, () => 0)],
    ['a 10', [10, ...Array.from({ length: 80 }, () => 0)]],
    ['a -1', [-1, ...Array.from({ length: 80 }, () => 0)]],
    ['a fraction', [1.5, ...Array.from({ length: 80 }, () => 0)]],
    ['NaN', [Number.NaN, ...Array.from({ length: 80 }, () => 0)]],
  ])('throws a RangeError for %s', (_name, puzzle) => {
    expect(() => solve(puzzle)).toThrow(RangeError)
  })
})

const HARD = [
  {
    name: 'Arto Inkala',
    puzzle: grid('800000000003600000070090200050007000000045700000100030001000068008500010090000400'),
    solution: grid('812753649943682175675491283154237896369845721287169534521974368438526917796318452'),
  },
  {
    name: 'Platinum Blonde',
    puzzle: grid('000000012000000003002300400001800005060070800000009000008500000900040500470006000'),
    solution: grid('839465712146782953752391486391824675564173829287659341628537194913248567475916238'),
  },
]

describe('solve time', () => {
  it.for(HARD)('solves $name and records the time', async ({ puzzle, solution }, { annotate }) => {
    const start = performance.now()
    const result = solve(puzzle)
    const elapsed = performance.now() - start

    await annotate(`${elapsed.toFixed(1)} ms`, 'solve time')
    expect(result).toEqual({ count: 1, solution })
    expect(elapsed).toBeLessThan(1000)
  })
})
