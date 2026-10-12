import { describe, expect, it } from 'vitest'
import { erase, place, select, toggleNote } from './actions'
import { NOTHING_COMPLETED } from './completion'
import { createGame } from './createGame'
import { SAMPLE_GIVENS, SAMPLE_SOLUTION, solvedExcept } from './samplePuzzle'
import type { Digit, Game } from './types'

const newGame = (entries?: number[]): Game =>
  createGame({ givens: SAMPLE_GIVENS, solution: SAMPLE_SOLUTION, ...(entries ? { entries } : {}) })

const at = (cell: number, entries?: number[]): Game => select(newGame(entries), cell)

const placed = (game: Game, digit: Digit): Game => place(game, digit).game

const noted = (game: Game, ...digits: Digit[]): Game =>
  digits.reduce((current, digit) => toggleNote(current, digit).game, game)

describe('select', () => {
  it('selects a cell and clears the selection', () => {
    const game = at(40)
    expect(game.selected).toBe(40)
    expect(select(game, null).selected).toBeNull()
  })

  it('refuses a cell outside the grid', () => {
    expect(() => select(newGame(), 81)).toThrow(RangeError)
    expect(() => select(newGame(), 1.5)).toThrow(RangeError)
  })
})

describe('place', () => {
  it('places an entry in the selected cell', () => {
    const result = place(at(2), 4)
    expect(result.game.entries[2]).toBe(4)
    expect(result.game.mistakes).toBe(0)
  })

  it('does nothing without a selected cell', () => {
    const game = newGame()
    expect(place(game, 4).game).toBe(game)
  })

  it('cannot change a given', () => {
    const game = at(1)
    expect(place(game, 9)).toEqual({ game, completed: NOTHING_COMPLETED })
    expect(place(game, 9).game).toBe(game)
  })

  it('clears the cell when the same number is placed again, without a mistake', () => {
    const game = placed(placed(at(2), 1), 1)
    expect(game.entries[2]).toBe(0)
    expect(game.mistakes).toBe(1)
  })

  it('removes the placed number from the notes in its row, column and box', () => {
    let game = noted(at(3), 4, 7)
    game = noted(select(game, 40), 4)
    game = noted(select(game, 2), 4, 7)
    game = placed(game, 4)
    expect(game.notes[2]).toEqual([])
    expect(game.notes[3]).toEqual([7])
    expect(game.notes[40]).toEqual([4])
  })

  it('counts a wrong number as a mistake and keeps it on the grid', () => {
    const game = placed(at(2), 1)
    expect(game.mistakes).toBe(1)
    expect(game.entries[2]).toBe(1)
    expect(game.status).toBe('playing')
  })

  it('ends the game at the third mistake', () => {
    const game = placed(placed(placed(at(2), 1), 2), 3)
    expect(game.mistakes).toBe(3)
    expect(game.status).toBe('lost')
  })

  it('refuses a number whose nine are all placed correctly', () => {
    const game = at(3, solvedExcept(2, 3))
    expect(place(game, 9).game).toBe(game)
  })

  it('reports what the number completed and wins the game on the last cell', () => {
    const result = place(at(2, solvedExcept(2)), 4)
    expect(result.completed).toEqual({
      rows: [0],
      columns: [2],
      boxes: [0],
      digits: [4],
      grid: true,
    })
    expect(result.game.status).toBe('won')
  })

  it('reports nothing for a wrong number', () => {
    const result = place(at(2, solvedExcept(2, 3)), 6)
    expect(result.game.mistakes).toBe(1)
    expect(result.completed).toEqual(NOTHING_COMPLETED)
  })
})

describe('toggleNote', () => {
  it('keeps the notes of a cell sorted', () => {
    expect(noted(at(2), 7, 3).notes[2]).toEqual([3, 7])
  })

  it('removes a note that is already there', () => {
    expect(noted(at(2), 7, 3, 3).notes[2]).toEqual([7])
  })

  it('does nothing on a cell with an entry or a given', () => {
    const withEntry = placed(at(2), 4)
    expect(toggleNote(withEntry, 5).game).toBe(withEntry)
    const onGiven = at(1)
    expect(toggleNote(onGiven, 5).game).toBe(onGiven)
  })
})

describe('erase', () => {
  it('clears the entry and the notes of the selected cell', () => {
    expect(erase(placed(at(2), 4)).game.entries[2]).toBe(0)
    expect(erase(noted(at(2), 5)).game.notes[2]).toEqual([])
  })

  it('clears an entry the player did not make', () => {
    const entries = solvedExcept()
    entries[2] = 1
    expect(erase(at(2, entries)).game.entries[2]).toBe(0)
  })

  it('does nothing on a given or an empty cell', () => {
    const onGiven = at(1)
    expect(erase(onGiven).game).toBe(onGiven)
    const empty = at(2)
    expect(erase(empty).game).toBe(empty)
  })
})

describe('a lost game', () => {
  it('refuses every edit', () => {
    const lost = select(placed(placed(placed(at(2), 1), 2), 3), 3)
    expect(lost.status).toBe('lost')
    expect(place(lost, 6).game).toBe(lost)
    expect(toggleNote(lost, 6).game).toBe(lost)
    expect(erase(lost).game).toBe(lost)
    expect(select(lost, 40)).toBe(lost)
  })
})
