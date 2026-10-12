import { describe, expect, it } from 'vitest'
import { erase, hint, pause, place, resume, select, tick, toggleNote, undo } from './actions'
import { NOTHING_COMPLETED } from './completion'
import { UNDO_LIMIT } from './constants'
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

const first = () => 0
const last = () => 0.999_999

describe('undo', () => {
  it('takes back the entry but not the mistake', () => {
    const game = undo(placed(at(2), 1)).game
    expect(game.entries[2]).toBe(0)
    expect(game.mistakes).toBe(1)
  })

  it('brings back the notes that a placed number removed', () => {
    const game = undo(placed(noted(at(2), 4, 7), 4)).game
    expect(game.entries[2]).toBe(0)
    expect(game.notes[2]).toEqual([4, 7])
  })

  it('does nothing without a step to undo', () => {
    const game = at(2)
    expect(undo(game).game).toBe(game)
  })

  it('cannot remove an entry the player did not make', () => {
    const game = at(3, solvedExcept(2))
    expect(undo(game).game).toBe(game)
  })

  it('keeps at most UNDO_LIMIT steps', () => {
    let game = at(2)
    for (let step = 0; step <= UNDO_LIMIT; step++) game = toggleNote(game, 5).game
    expect(game.undoSteps).toHaveLength(UNDO_LIMIT)
  })

  it('takes back a hint entry but keeps the hint count', () => {
    const game = undo(hint(at(2), first).game).game
    expect(game.entries[2]).toBe(0)
    expect(game.hintsUsed).toBe(1)
  })
})

describe('hint', () => {
  const openCells = SAMPLE_GIVENS.flatMap((given, cell) => (given === 0 ? [cell] : []))

  it('fills a random open cell with its correct number and counts one hint', () => {
    const result = hint(newGame(), first)
    expect(result.game.entries[2]).toBe(4)
    expect(result.game.hintsUsed).toBe(1)
    expect(result.game.selected).toBe(2)
    expect(result.game.mistakes).toBe(0)
  })

  it('takes the cell from the random source', () => {
    const cell = openCells[openCells.length - 1] ?? -1
    const game = hint(newGame(), last).game
    expect(game.selected).toBe(cell)
    expect(game.entries[cell]).toBe(SAMPLE_SOLUTION[cell])
  })

  it('can pick a wrong cell and correct it, without a mistake', () => {
    const wrong = placed(at(3, solvedExcept(2, 3)), 4)
    const game = hint(wrong, last).game
    expect(game.entries[3]).toBe(6)
    expect(game.mistakes).toBe(1)
  })

  it('picks a wrong entry from the start', () => {
    const entries = solvedExcept()
    entries[3] = 1
    const game = hint(newGame(entries), first).game
    expect(game.entries[3]).toBe(6)
    expect(game.mistakes).toBe(0)
  })

  it('removes the number from the notes of its peers', () => {
    const game = hint(noted(at(3), 4), first).game
    expect(game.notes[3]).toEqual([])
  })

  it('reports what it completed and wins the game on the last cell', () => {
    const result = hint(newGame(solvedExcept(2)), first)
    expect(result.completed.grid).toBe(true)
    expect(result.game.status).toBe('won')
  })

  it('does nothing when the game is won', () => {
    const won = newGame(solvedExcept())
    expect(hint(won, first).game).toBe(won)
  })
})

describe('pause and resume', () => {
  it('pauses a game in play and resumes it', () => {
    const paused = pause(at(2))
    expect(paused.status).toBe('paused')
    expect(resume(paused).status).toBe('playing')
  })

  it('refuses every action except resume while paused', () => {
    const paused = pause(placed(at(2), 4))
    expect(select(paused, 40)).toBe(paused)
    expect(place(paused, 5).game).toBe(paused)
    expect(toggleNote(paused, 5).game).toBe(paused)
    expect(erase(paused).game).toBe(paused)
    expect(undo(paused).game).toBe(paused)
    expect(hint(paused, first).game).toBe(paused)
    expect(pause(paused)).toBe(paused)
  })

  it('cannot pause or resume a game that ended', () => {
    const won = newGame(solvedExcept())
    expect(pause(won)).toBe(won)
    expect(resume(won)).toBe(won)
  })
})

describe('tick', () => {
  it('adds the elapsed time while the game is in play', () => {
    expect(tick(tick(newGame(), 1000), 250).playedMs).toBe(1250)
  })

  it('does not count a pause', () => {
    const game = resume(tick(pause(tick(newGame(), 1000)), 5000))
    expect(game.playedMs).toBe(1000)
  })

  it('does not count after the game ended', () => {
    const lost = placed(placed(placed(at(2), 1), 2), 3)
    expect(tick(lost, 1000)).toBe(lost)
    const won = newGame(solvedExcept())
    expect(tick(won, 1000)).toBe(won)
  })

  it('ignores a time that is negative or not a number', () => {
    const game = newGame()
    expect(tick(game, -5)).toBe(game)
    expect(tick(game, Number.NaN)).toBe(game)
    expect(tick(game, Number.POSITIVE_INFINITY)).toBe(game)
  })
})
