import { place, select } from '@sudoku/core'
import { OPEN, sampleGame } from '@/game/sample.testkit'
import { rightCells } from './result.utils'

// The canvas puzzle has 30 givens. Cell 2 is empty. Its solution is 4.
const start = () => select(sampleGame(), OPEN)

it('counts the givens of a new game', () => {
  expect(rightCells(start())).toBe(30)
})

it('counts a right entry', () => {
  expect(rightCells(place(start(), 4).game)).toBe(31)
})

it('does not count a wrong entry', () => {
  expect(rightCells(place(start(), 5).game)).toBe(30)
})
