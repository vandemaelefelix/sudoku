import { describe, expect, it } from 'vitest'
import { erase, hint, pause, place, select, tick, toggleNote, undo } from './actions'
import { createGame } from './createGame'
import { SAMPLE_GIVENS, SAMPLE_SOLUTION, solvedExcept } from './samplePuzzle'
import { fromSavedGame, needsSave, SAVED_GAME_VERSION, toSavedGame } from './savedGame'
import type { Game } from './types'

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

  it('keeps the start entries', () => {
    const saved = roundTrip(toSavedGame(gameInProgress()))
    expect(fromSavedGame(saved).startEntries).toEqual(solvedExcept(2, 3, 40))
  })

  it('writes the version', () => {
    expect(toSavedGame(gameInProgress()).version).toBe(SAVED_GAME_VERSION)
  })

  it('refuses a value that is not an object', () => {
    expect(() => fromSavedGame(null)).toThrow(RangeError)
    expect(() => fromSavedGame('game')).toThrow(RangeError)
  })

  it('refuses another version', () => {
    const saved = toSavedGame(gameInProgress())
    expect(() => fromSavedGame({ ...saved, version: 1 })).toThrow(RangeError)
    expect(() => fromSavedGame({ ...saved, version: 3 })).toThrow(RangeError)
  })

  it('refuses start entries that do not fit the givens', () => {
    const onGiven = toSavedGame(gameInProgress())
    onGiven.startEntries[0] = 5
    expect(() => fromSavedGame(onGiven)).toThrow(RangeError)
    const short = toSavedGame(gameInProgress())
    expect(() => fromSavedGame({ ...short, startEntries: [0] })).toThrow(RangeError)
  })

  it('refuses entries of the wrong length', () => {
    const saved = toSavedGame(gameInProgress())
    expect(() => fromSavedGame({ ...saved, entries: [0] })).toThrow(RangeError)
  })

  it('refuses an entry on a given', () => {
    const saved = toSavedGame(gameInProgress())
    saved.entries[0] = 5
    expect(() => fromSavedGame(saved)).toThrow(RangeError)
  })

  it('loads entries that differ from the start entries', () => {
    const saved = toSavedGame(gameInProgress())
    saved.entries[5] = 0
    expect(fromSavedGame(saved).entries[5]).toBe(0)
    expect(fromSavedGame(saved).startEntries[5]).toBe(8)
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

describe('needsSave', () => {
  const OPEN = 2
  const fresh = () =>
    createGame({ givens: SAMPLE_GIVENS, solution: SAMPLE_SOLUTION, entries: solvedExcept(OPEN, 3, 40) })

  it('a selection alone does not need a save', () => {
    const game = fresh()
    expect(needsSave(game, select(game, OPEN))).toBe(false)
  })

  it('a clock tick alone does not need a save', () => {
    const game = fresh()
    expect(needsSave(game, tick(game, 1000))).toBe(false)
  })

  it.each([
    ['a number', (game: Game) => place(select(game, OPEN), 4).game],
    ['a wrong number', (game: Game) => place(select(game, OPEN), 5).game],
    ['a note', (game: Game) => toggleNote(select(game, OPEN), 3).game],
    ['an undo', (game: Game) => undo(place(select(game, OPEN), 4).game).game],
    ['an erase', (game: Game) => erase(place(select(game, OPEN), 4).game).game],
    ['a hint', (game: Game) => hint(game, () => 0).game],
    ['a pause', (game: Game) => pause(game)],
  ])('%s needs a save', (_name, act) => {
    const game = fresh()
    expect(needsSave(game, act(game))).toBe(true)
  })

  it('stores exactly the fields of a game, so needsSave sees every stored field', () => {
    // A field that the save stores and that needsSave does not know would never trigger a write.
    const game = gameInProgress()
    const stored = Object.keys(toSavedGame(game)).filter((field) => field !== 'version')
    expect(new Set(stored)).toEqual(new Set(Object.keys(game)))
  })

  it('notices a change of each other field', () => {
    const game = fresh()
    const changed: Partial<Game>[] = [
      { entries: [...game.entries] },
      { notes: [...game.notes] },
      { undoSteps: [...game.undoSteps] },
      { mistakes: game.mistakes + 1 },
      { hintsUsed: game.hintsUsed + 1 },
      { status: 'paused' },
    ]
    for (const change of changed) expect(needsSave(game, { ...game, ...change })).toBe(true)
  })
})
