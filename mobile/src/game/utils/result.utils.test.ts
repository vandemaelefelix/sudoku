import { createGame, place, select } from '@sudoku/core'
import { sampleStart } from './sample.utils'
import { rightCells } from './result.utils'

// The canvas puzzle has 30 givens. Cell 2 is empty. Its solution is 4.
const start = () => select(createGame(sampleStart()), 2)

it('counts the givens of a new game', () => {
  expect(rightCells(start())).toBe(30)
})

it('counts a right entry', () => {
  expect(rightCells(place(start(), 4).game)).toBe(31)
})

it('does not count a wrong entry', () => {
  expect(rightCells(place(start(), 5).game)).toBe(30)
})
