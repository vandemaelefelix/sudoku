import { expect, it } from 'vitest'
import { generate, LEVELS } from '../generator'
import { nextSteps } from './nextSteps'
import { playThrough } from './playThrough'
import { benchPositions } from './samplePositions'

// The target is 5 ms on a Mac, shown by `just bench-core`. The limit here is wider so that a slow
// CI machine does not fail the run.
const LIMIT_MS = 25

it('finds the next steps of every position of the bench set within the limit', async ({ annotate }) => {
  const positions = benchPositions()
  for (const { board, candidates } of positions) nextSteps(candidates, board, undefined, { unique: true })
  const times = positions.map(({ board, candidates }) => {
    const start = performance.now()
    nextSteps(candidates, board, undefined, { unique: true })
    return performance.now() - start
  })
  const slowest = Math.max(...times)
  await annotate(`slowest of ${positions.length}: ${slowest.toFixed(2)} ms`, 'nextSteps time')
  expect(slowest).toBeLessThan(LIMIT_MS)
}, 60_000)

// A whole solve takes a few milliseconds on a Mac. The limit leaves room for a slow CI machine.
const SOLVE_LIMIT_MS = 50
const PUZZLES_PER_LEVEL = 25

it('solves each of 100 generated puzzles with all techniques within the limit', async ({ annotate }) => {
  const puzzles = LEVELS.flatMap((level) =>
    Array.from({ length: PUZZLES_PER_LEVEL }, (_, index) => generate(level, index + 1).givens),
  )
  playThrough(puzzles[0]!, undefined, { unique: true })
  const times = puzzles.map((givens) => {
    const start = performance.now()
    playThrough(givens, undefined, { unique: true })
    return performance.now() - start
  })
  const slowest = Math.max(...times)
  await annotate(`slowest of ${puzzles.length}: ${slowest.toFixed(2)} ms`, 'solve time')
  expect(slowest).toBeLessThan(SOLVE_LIMIT_MS)
}, 60_000)
