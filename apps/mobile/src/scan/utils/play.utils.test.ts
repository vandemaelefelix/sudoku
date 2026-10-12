import { GIVENS_TARGET, LEVELS, generate, type Level } from '@sudoku/core'
import type { CorrectedGrid } from '@/scan/utils/correctionEdit.utils'
import { checkPlay, levelOf } from './play.utils'

const EMPTY: readonly number[] = Array.from({ length: 81 }, () => 0)
const NO_CONFLICTS: readonly boolean[] = EMPTY.map(() => false)
const withGivens = (count: number) => EMPTY.map((_, cell) => (cell < count ? 1 : 0))
const gridOf = (givens: readonly number[], entries: readonly number[] = EMPTY): CorrectedGrid => ({
  givens: [...givens],
  entries: [...entries],
})

describe('levelOf', () => {
  it.each<[number, Level]>([
    [81, 'easy'],
    [40, 'easy'],
    [37, 'easy'],
    [36, 'medium'],
    [34, 'medium'],
    [32, 'medium'],
    [31, 'hard'],
    [29, 'hard'],
    [27, 'hard'],
    [26, 'expert'],
    [25, 'expert'],
    [17, 'expert'],
    [0, 'expert'],
  ])('gives %i givens the level %s', (count, level) => {
    expect(levelOf(withGivens(count))).toBe(level)
  })

  it('gives each generated puzzle its own level back', () => {
    for (const level of LEVELS) {
      const { givens } = generate(level, 3)
      expect(givens.filter((digit) => digit !== 0)).toHaveLength(GIVENS_TARGET[level])
      expect(levelOf(givens)).toBe(level)
    }
  })
})

describe('checkPlay', () => {
  const puzzle = generate('medium', 11)
  const open = puzzle.givens.findIndex((digit) => digit === 0)
  const wrongDigit = ((puzzle.solution[open] ?? 0) % 9) + 1

  it('passes givens with one solution, with the solution, the entries and the level', () => {
    expect(checkPlay(gridOf(puzzle.givens), NO_CONFLICTS)).toEqual({
      ok: true,
      start: { level: 'medium', puzzle: { givens: puzzle.givens, solution: puzzle.solution, entries: EMPTY } },
    })
  })

  it('ignores a wrong entry, and keeps it for the game', () => {
    const entries = EMPTY.map((_, cell) => (cell === open ? wrongDigit : 0))
    expect(checkPlay(gridOf(puzzle.givens, entries), NO_CONFLICTS)).toEqual({
      ok: true,
      start: { level: 'medium', puzzle: { givens: puzzle.givens, solution: puzzle.solution, entries } },
    })
  })

  it('blocks two givens that break a rule', () => {
    const conflicts = NO_CONFLICTS.map((_, cell) => cell === 0 || cell === 1)
    expect(checkPlay(gridOf(puzzle.givens), conflicts)).toEqual({ ok: false, block: 'conflict' })
  })

  it('blocks givens with no solution', () => {
    // Row 1 holds 1 to 8, so its last cell needs the 9. The 9 below it in row 2 forbids it. No two givens share a digit in a unit.
    const givens = EMPTY.map((_, cell) => (cell < 8 ? cell + 1 : cell === 17 ? 9 : 0))
    expect(checkPlay(gridOf(givens), NO_CONFLICTS)).toEqual({ ok: false, block: 'none' })
  })

  it('blocks givens with several solutions', () => {
    expect(checkPlay(gridOf(EMPTY), NO_CONFLICTS)).toEqual({ ok: false, block: 'several' })
  })

  it('blocks a grid that the givens and the entries fill', () => {
    const entries = puzzle.solution.map((digit, cell) => (puzzle.givens[cell] === 0 ? digit : 0))
    expect(checkPlay(gridOf(puzzle.givens, entries), NO_CONFLICTS)).toEqual({ ok: false, block: 'solved' })
  })

  it('does not block a full grid with one wrong entry', () => {
    const entries = puzzle.solution.map((digit, cell) =>
      cell === open ? wrongDigit : puzzle.givens[cell] === 0 ? digit : 0,
    )
    expect(checkPlay(gridOf(puzzle.givens, entries), NO_CONFLICTS).ok).toBe(true)
  })
})
