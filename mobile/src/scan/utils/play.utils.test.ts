import { generate } from '@sudoku/core'
import type { CorrectedGrid } from '@/scan/utils/correctionEdit.utils'
import { checkPlay } from './play.utils'

const EMPTY: readonly number[] = Array.from({ length: 81 }, () => 0)
const NO_CONFLICTS: readonly boolean[] = EMPTY.map(() => false)
const gridOf = (givens: readonly number[], entries: readonly number[] = EMPTY): CorrectedGrid => ({
  givens: [...givens],
  entries: [...entries],
})

describe('checkPlay', () => {
  const puzzle = generate('medium', 11)
  const open = puzzle.givens.findIndex((digit) => digit === 0)
  const wrongDigit = ((puzzle.solution[open] ?? 0) % 9) + 1

  it('passes givens with one solution, with the solution and the entries', () => {
    expect(checkPlay(gridOf(puzzle.givens), NO_CONFLICTS)).toEqual({
      ok: true,
      start: { givens: puzzle.givens, solution: puzzle.solution, entries: EMPTY },
    })
  })

  it('ignores a wrong entry, and keeps it for the game', () => {
    const entries = EMPTY.map((_, cell) => (cell === open ? wrongDigit : 0))
    expect(checkPlay(gridOf(puzzle.givens, entries), NO_CONFLICTS)).toEqual({
      ok: true,
      start: { givens: puzzle.givens, solution: puzzle.solution, entries },
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

  it('blocks a full grid, whatever its entries', () => {
    const right = puzzle.solution.map((digit, cell) => (puzzle.givens[cell] === 0 ? digit : 0))
    expect(checkPlay(gridOf(puzzle.givens, right), NO_CONFLICTS)).toEqual({ ok: false, block: 'full' })
    const wrong = right.map((digit, cell) => (cell === open ? wrongDigit : digit))
    expect(checkPlay(gridOf(puzzle.givens, wrong), NO_CONFLICTS)).toEqual({ ok: false, block: 'full' })
  })

  it('blocks a full grid that has no given, as a page read as all handwritten', () => {
    expect(checkPlay(gridOf(EMPTY, puzzle.solution), NO_CONFLICTS)).toEqual({ ok: false, block: 'full' })
  })

  it('reports a given conflict before a full grid', () => {
    const conflicts = NO_CONFLICTS.map((_, cell) => cell === 0 || cell === 1)
    expect(checkPlay(gridOf(puzzle.solution), conflicts)).toEqual({ ok: false, block: 'conflict' })
  })
})
