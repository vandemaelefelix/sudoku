import { describe, expect, it } from 'vitest'
import { hint, place, select, toggleNote, undo } from './actions'
import { createGame } from './createGame'
import { hasMoves } from './progress'
import { SAMPLE_GIVENS, SAMPLE_SOLUTION } from './samplePuzzle'

const newGame = () => createGame({ givens: SAMPLE_GIVENS, solution: SAMPLE_SOLUTION })

describe('hasMoves', () => {
  it('is false for a new game and for a selected cell', () => {
    expect(hasMoves(newGame())).toBe(false)
    expect(hasMoves(select(newGame(), 2))).toBe(false)
  })

  it('is true after a number, a note or a hint', () => {
    const selected = select(newGame(), 2)
    expect(hasMoves(place(selected, 4).game)).toBe(true)
    expect(hasMoves(toggleNote(selected, 4).game)).toBe(true)
    expect(hasMoves(hint(newGame(), () => 0).game)).toBe(true)
  })

  it('is false when every move is undone and none was a mistake', () => {
    const placed = place(select(newGame(), 2), 4).game
    expect(hasMoves(undo(placed).game)).toBe(false)
  })

  it('stays true after a mistake that is undone, because undo keeps the mistake', () => {
    const wrong = place(select(newGame(), 2), 1).game
    expect(wrong.mistakes).toBe(1)
    expect(hasMoves(undo(wrong).game)).toBe(true)
  })
})
