import { expect, test } from 'vitest'
import { nextSteps } from '../src/technique/nextSteps'
import { benchPositions } from '../src/technique/samplePositions'

const TARGET_MS = 5

const positions = benchPositions()

function timeOf({ board, candidates }: (typeof positions)[number]): number {
  const start = performance.now()
  nextSteps(candidates, board, undefined, { unique: true })
  return performance.now() - start
}

test('one nextSteps call takes under 5 ms at every position of the bench set', async ({ bench }) => {
  for (const position of positions) timeOf(position)
  const slowest = positions.reduce((worst, position) => (timeOf(position) > timeOf(worst) ? position : worst))

  const oneCall = bench('the slowest position', () => {
    nextSteps(slowest.candidates, slowest.board, undefined, { unique: true })
  })
  const allCalls = bench(`all ${positions.length} positions, time for each call`, () => {
    for (const { board, candidates } of positions) nextSteps(candidates, board, undefined, { unique: true })
  })
  const storage = await bench.compare(oneCall, allCalls)

  expect(storage.get('the slowest position').latency.mean).toBeLessThan(TARGET_MS)
  const perCall = storage.get(`all ${positions.length} positions, time for each call`).latency.mean / positions.length
  expect(perCall).toBeLessThan(TARGET_MS)
})
