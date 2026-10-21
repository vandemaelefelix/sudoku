import { expect, it } from 'vitest'
import { generate, LEVELS } from '../generator'
import { playThrough } from './playThrough'

// The target of #200 is 30 ms for the slowest solve on a Mac. The limit here is wider so that a slow
// CI machine does not fail the run.
const LIMIT_MS = 300
const PER_LEVEL = 25

it('solves 100 generated puzzles with all techniques within the limit (30 ms target on a Mac)', async ({
  annotate,
}) => {
  const puzzles = LEVELS.flatMap((level) => Array.from({ length: PER_LEVEL }, (_, i) => generate(level, i + 1).givens))
  for (const givens of puzzles.slice(0, 4)) playThrough(givens)
  const times = puzzles
    .map((givens) => {
      const start = performance.now()
      playThrough(givens)
      return performance.now() - start
    })
    .toSorted((a, b) => a - b)
  const slowest = times.at(-1)!
  const median = times[times.length >> 1]!
  await annotate(
    `slowest of ${times.length}: ${slowest.toFixed(1)} ms, median ${median.toFixed(1)} ms (target 30 ms on a Mac)`,
    'solve time',
  )
  expect(slowest).toBeLessThan(LIMIT_MS)
}, 120_000)
