import { describe, expect, it } from 'vitest'
import { hint, pause, place, select, tick, toggleNote } from './actions'
import { createGame } from './createGame'
import { SAMPLE_GIVENS, SAMPLE_SOLUTION, solvedExcept } from './samplePuzzle'
import { fromSavedGame, SAVED_GAME_VERSION, toSavedGame } from './savedGame'

function gameInProgress() {
  const entries = solvedExcept(2, 3, 40)
  let game = select(createGame({ givens: SAMPLE_GIVENS, solution: SAMPLE_SOLUTION, entries }), 3)
  game = place(game, 4).game
  game = toggleNote(select(game, 40), 8).game
  game = hint(game, () => 0).game
  return pause(tick(game, 61_500))
}

const roundTrip = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

describe('saved game', () => {
  it('converts a game to a plain object and back', () => {
    const game = gameInProgress()
    expect(fromSavedGame(roundTrip(toSavedGame(game)))).toEqual(game)
  })

  it('writes the version', () => {
    expect(toSavedGame(gameInProgress()).version).toBe(SAVED_GAME_VERSION)
  })

  it('refuses a value that is not an object', () => {
    expect(() => fromSavedGame(null)).toThrow(RangeError)
    expect(() => fromSavedGame('game')).toThrow(RangeError)
  })

  it('refuses another version', () => {
    const saved = { ...toSavedGame(gameInProgress()), version: 2 }
    expect(() => fromSavedGame(saved)).toThrow(RangeError)
  })

  it('refuses grids that do not fit together', () => {
    const saved = toSavedGame(gameInProgress())
    saved.givens[0] = 9
    expect(() => fromSavedGame(saved)).toThrow(RangeError)
  })

  it('refuses notes that are not sorted digits', () => {
    const saved = toSavedGame(gameInProgress())
    saved.notes[40] = [8, 2]
    expect(() => fromSavedGame(saved)).toThrow(RangeError)
  })

  it('refuses an unknown status and counts out of range', () => {
    const saved = toSavedGame(gameInProgress())
    expect(() => fromSavedGame({ ...saved, status: 'done' })).toThrow(RangeError)
    expect(() => fromSavedGame({ ...saved, mistakes: 4 })).toThrow(RangeError)
    expect(() => fromSavedGame({ ...saved, playedMs: -1 })).toThrow(RangeError)
    expect(() => fromSavedGame({ ...saved, selected: 81 })).toThrow(RangeError)
  })

  it('refuses notes on a cell with a given or an entry', () => {
    const onGiven = toSavedGame(gameInProgress())
    onGiven.notes[0] = [5]
    expect(() => fromSavedGame(onGiven)).toThrow(RangeError)
    const onEntry = toSavedGame(gameInProgress())
    onEntry.notes[3] = [5]
    expect(() => fromSavedGame(onEntry)).toThrow(RangeError)
    const inStep = toSavedGame(gameInProgress())
    const step = inStep.undoSteps[0]
    if (step) step.notes[0] = [5]
    expect(() => fromSavedGame(inStep)).toThrow(RangeError)
  })

  it('refuses a status that does not fit the mistakes or the grid', () => {
    const saved = toSavedGame(gameInProgress())
    expect(() => fromSavedGame({ ...saved, mistakes: 3 })).toThrow(RangeError)
    expect(() => fromSavedGame({ ...saved, status: 'lost' })).toThrow(RangeError)
    expect(() => fromSavedGame({ ...saved, status: 'won' })).toThrow(RangeError)
    const solved = toSavedGame(
      createGame({ givens: SAMPLE_GIVENS, solution: SAMPLE_SOLUTION, entries: solvedExcept() }),
    )
    expect(() => fromSavedGame({ ...solved, status: 'playing' })).toThrow(RangeError)
  })

  it('copies the notes, so a later change of the saved object does not reach the game', () => {
    const saved = toSavedGame(gameInProgress())
    const game = fromSavedGame(saved)
    saved.notes[40]?.push(9)
    expect(game.notes[40]).toEqual([8])
  })

  it('refuses a damaged undo step', () => {
    const saved = toSavedGame(gameInProgress())
    saved.undoSteps[0] = { entries: [1], notes: [] }
    expect(() => fromSavedGame(saved)).toThrow(RangeError)
  })
})
