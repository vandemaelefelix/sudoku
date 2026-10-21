import { expect, it } from 'vitest'
import { nextSteps } from './nextSteps'
import { benchPositions } from './samplePositions'

// The target is 5 ms on a Mac, shown by `just bench-core`. The limit here is wider so that a slow
// CI machine does not fail the run.
const LIMIT_MS = 25

it('finds the next steps of every position of the bench set within the limit', async ({ annotate }) => {
  const positions = benchPositions()
  for (const { board, candidates } of positions) nextSteps(candidates, board)
  const times = positions.map(({ board, candidates }) => {
    const start = performance.now()
    nextSteps(candidates, board)
    return performance.now() - start
  })
  const slowest = Math.max(...times)
  await annotate(`slowest of ${positions.length}: ${slowest.toFixed(2)} ms`, 'nextSteps time')
  expect(slowest).toBeLessThan(LIMIT_MS)
}, 60_000)
