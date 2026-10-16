import { describe, expect, it } from 'vitest'
import { solve } from '../solver'
import { erase, place, select } from './actions'
import { isWrong } from './completion'
import { createGame } from './createGame'
import { SAMPLE_GIVENS, SAMPLE_SOLUTION } from './samplePuzzle'
import { fromSavedGame, toSavedGame } from './savedGame'

// Cell 0 holds the printed 5. Cells 2 and 3 are open: their solution digits are 4 and 6.
const scannedEntries = SAMPLE_GIVENS.map((_, cell) => (cell === 2 ? 1 : cell === 3 ? 6 : 0))

function scannedGame() {
  const solved = solve(SAMPLE_GIVENS)
  if (solved.count !== 1) throw new Error('The sample puzzle must have one solution')
  return createGame({ givens: SAMPLE_GIVENS, solution: solved.solution, entries: scannedEntries })
}

describe('a scanned game', () => {
  it('solves the givens alone to the solution', () => {
    expect(solve(SAMPLE_GIVENS)).toEqual({ count: 1, solution: SAMPLE_SOLUTION })
  })

  it('loads the handwritten digits as entries: a wrong one is wrong, and none is a mistake', () => {
    const game = scannedGame()
    expect(game.entries[2]).toBe(1)
    expect(isWrong(game, 2)).toBe(true)
    expect(isWrong(game, 3)).toBe(false)
    expect(game.mistakes).toBe(0)
    expect(game.status).toBe('playing')
  })

  it('keeps a given locked', () => {
    const onGiven = select(scannedGame(), 0)
    expect(place(onGiven, 9).game.givens[0]).toBe(5)
    expect(place(onGiven, 9).game.entries[0]).toBe(0)
    expect(erase(onGiven).game.givens[0]).toBe(5)
  })

  it('lets the player fix a scanned entry', () => {
    const fixed = place(select(scannedGame(), 2), 4).game
    expect(fixed.entries[2]).toBe(4)
    expect(isWrong(fixed, 2)).toBe(false)
    expect(fixed.mistakes).toBe(0)
  })

  it('keeps the scanned entries and no mistake through a save', () => {
    const loaded = fromSavedGame(JSON.parse(JSON.stringify(toSavedGame(scannedGame()))))
    expect(loaded.entries[2]).toBe(1)
    expect(isWrong(loaded, 2)).toBe(true)
    expect(loaded.mistakes).toBe(0)
  })
})
