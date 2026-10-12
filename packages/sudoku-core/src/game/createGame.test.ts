import { describe, expect, it } from 'vitest'
import { createGame } from './createGame'
import { SAMPLE_GIVENS, SAMPLE_SOLUTION, solvedExcept } from './samplePuzzle'

const base = { givens: SAMPLE_GIVENS, solution: SAMPLE_SOLUTION }

describe('createGame', () => {
  it('starts a game in play with no entries, notes, mistakes, hints or time', () => {
    const game = createGame(base)
    expect(game.status).toBe('playing')
    expect(game.entries.every((value) => value === 0)).toBe(true)
    expect(game.notes.every((cellNotes) => cellNotes.length === 0)).toBe(true)
    expect(game.selected).toBeNull()
    expect(game.mistakes).toBe(0)
    expect(game.hintsUsed).toBe(0)
    expect(game.playedMs).toBe(0)
    expect(game.undoSteps).toEqual([])
  })

  it('holds the givens and the solution', () => {
    const game = createGame(base)
    expect(game.givens).toEqual(SAMPLE_GIVENS)
    expect(game.solution).toEqual(SAMPLE_SOLUTION)
  })

  it('copies its input, so a later change outside does not reach the game', () => {
    const entries = solvedExcept(2)
    const game = createGame({ ...base, entries })
    entries[3] = 0
    expect(game.entries[3]).toBe(6)
  })

  it('accepts entries the player did not make, and counts no mistake for them', () => {
    const entries = solvedExcept()
    entries[2] = 1
    const game = createGame({ ...base, entries })
    expect(game.entries[2]).toBe(1)
    expect(game.mistakes).toBe(0)
    expect(game.undoSteps).toEqual([])
  })

  it('is won at once when the entries complete the grid', () => {
    expect(createGame({ ...base, entries: solvedExcept() }).status).toBe('won')
  })

  it('refuses a grid without 81 cells', () => {
    expect(() => createGame({ ...base, givens: [0] })).toThrow(RangeError)
  })

  it('refuses a value outside 0 to 9', () => {
    const givens = [...SAMPLE_GIVENS]
    givens[2] = 10
    expect(() => createGame({ ...base, givens })).toThrow(RangeError)
  })

  it('refuses a solution with an empty cell', () => {
    const solution = [...SAMPLE_SOLUTION]
    solution[0] = 0
    expect(() => createGame({ ...base, solution })).toThrow(RangeError)
  })

  it('refuses a given that differs from the solution', () => {
    const givens = [...SAMPLE_GIVENS]
    givens[0] = 6
    expect(() => createGame({ ...base, givens })).toThrow(RangeError)
  })

  it('refuses an entry on a cell with a given', () => {
    const entries = solvedExcept()
    entries[0] = 5
    expect(() => createGame({ ...base, entries })).toThrow(RangeError)
  })
})
