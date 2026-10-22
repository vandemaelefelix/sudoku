import { createGame, planHint, solve } from '@sudoku/core'
import { pointingStart, sampleStart, stuckStart } from './sample.utils'

it('gives the canvas puzzle with its one solution', () => {
  const { givens, solution } = sampleStart()
  expect(givens.slice(0, 9)).toEqual([5, 3, 0, 0, 7, 0, 0, 0, 0])
  expect(solve(givens)).toEqual({ count: 1, solution })
})

it('gives a position with a hint of two steps and a position for the fallback', () => {
  const pointing = planHint(createGame(pointingStart()))
  expect(pointing).toMatchObject({
    kind: 'steps',
    steps: [{ technique: 'pointing' }, { placements: [expect.anything()] }],
  })
  expect(planHint(createGame(stuckStart()))?.kind).toBe('fallback')
})
