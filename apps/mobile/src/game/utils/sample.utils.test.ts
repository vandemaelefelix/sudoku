import { solve } from '@sudoku/core'
import { sampleStart } from './sample.utils'

it('gives the canvas puzzle with its one solution', () => {
  const { givens, solution } = sampleStart()
  expect(givens.slice(0, 9)).toEqual([5, 3, 0, 0, 7, 0, 0, 0, 0])
  expect(solve(givens)).toEqual({ count: 1, solution })
})
