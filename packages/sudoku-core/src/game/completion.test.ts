import { describe, expect, it } from 'vitest'
import { completedBetween, completeDigits, isWrong, NOTHING_COMPLETED, valueAt } from './completion'
import { createGame } from './createGame'
import { SAMPLE_GIVENS, SAMPLE_SOLUTION, solvedExcept } from './samplePuzzle'

const withEntries = (entries: number[]) =>
  createGame({ givens: SAMPLE_GIVENS, solution: SAMPLE_SOLUTION, entries })

describe('valueAt and isWrong', () => {
  it('reads a given or an entry', () => {
    const entries = solvedExcept()
    entries[2] = 1
    const game = withEntries(entries)
    expect(valueAt(game, 1)).toBe(3)
    expect(valueAt(game, 2)).toBe(1)
    expect(isWrong(game, 2)).toBe(true)
    expect(isWrong(game, 3)).toBe(false)
  })
})

describe('completeDigits', () => {
  it('lists the numbers with all nine placed correctly', () => {
    expect(completeDigits(withEntries(solvedExcept(2)))).toEqual([1, 2, 3, 5, 6, 7, 8, 9])
  })

  it('does not count a wrong placement', () => {
    const entries = solvedExcept(2, 3)
    entries[3] = 4
    expect(completeDigits(withEntries(entries))).toEqual([1, 2, 3, 5, 7, 8, 9])
  })
})

describe('completedBetween', () => {
  it('reports the row, column, box, number and grid that the last cell completes', () => {
    expect(completedBetween(withEntries(solvedExcept(2)), withEntries(solvedExcept()))).toEqual({
      rows: [0],
      columns: [2],
      boxes: [0],
      digits: [4],
      grid: true,
    })
  })

  it('reports only what was not complete before', () => {
    const rowZero = SAMPLE_GIVENS.map(() => 0)
    for (const cell of [3, 5, 6, 7, 8]) rowZero[cell] = SAMPLE_SOLUTION[cell] ?? 0
    const after = [...rowZero]
    after[2] = 4
    expect(completedBetween(withEntries(rowZero), withEntries(after))).toEqual({
      ...NOTHING_COMPLETED,
      rows: [0],
    })
  })

  it('never reports a unit that holds a wrong number', () => {
    const after = solvedExcept()
    after[2] = 1
    expect(completedBetween(withEntries(solvedExcept(2)), withEntries(after))).toEqual(
      NOTHING_COMPLETED,
    )
  })
})
