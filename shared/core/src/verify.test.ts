import { describe, expect, it } from 'vitest'
import { generate } from './generator'
import { verifyGrid } from './verify'

const puzzle = generate('medium', 11)
const zeros = puzzle.solution.map(() => 0)
const entriesOf = (digits: readonly number[]) => digits.map((digit, cell) => (puzzle.givens[cell] === 0 ? digit : 0))
const open = puzzle.givens.flatMap((digit, cell) => (digit === 0 ? [cell] : []))
const wrongDigit = (cell: number) => ((puzzle.solution[cell] ?? 0) % 9) + 1

describe('verifyGrid', () => {
  it('says solved for the givens and the right entries', () => {
    expect(verifyGrid(puzzle.givens, entriesOf(puzzle.solution))).toEqual({ status: 'solved' })
  })

  it('says solved for a full grid without a given, as a page read as all handwritten', () => {
    expect(verifyGrid(zeros, puzzle.solution)).toEqual({ status: 'solved' })
  })

  it('hints the solution digit of a wrong entry, and only of that entry', () => {
    const cell = open[0]!
    const entries = entriesOf(puzzle.solution)
    entries[cell] = wrongDigit(cell)
    expect(verifyGrid(puzzle.givens, entries)).toEqual({
      status: 'wrong',
      hints: { [cell]: puzzle.solution[cell] },
    })
  })

  it('hints both cells of two swapped entries in a row', () => {
    const [a, b] = open.filter((cell) => cell < 9)
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    const entries = entriesOf(puzzle.solution)
    entries[a!] = puzzle.solution[b!]!
    entries[b!] = puzzle.solution[a!]!
    expect(verifyGrid(puzzle.givens, entries)).toEqual({
      status: 'wrong',
      hints: { [a!]: puzzle.solution[a!], [b!]: puzzle.solution[b!] },
    })
  })

  it('marks the cells that break a rule when the givens have no unique solution', () => {
    const cell = 0
    const grid = [...puzzle.solution]
    grid[cell] = grid[1]!
    expect(verifyGrid(zeros, grid)).toEqual({ status: 'clash', cells: expect.arrayContaining([0, 1]) })
  })

  it('throws a RangeError for a grid with an empty cell', () => {
    const entries = entriesOf(puzzle.solution)
    entries[open[0]!] = 0
    expect(() => verifyGrid(puzzle.givens, entries)).toThrow(RangeError)
  })
})
