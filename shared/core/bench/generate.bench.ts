import { expect, test } from 'vitest'
import { generate } from '../src/generator'
import { LEVELS } from '../src/level'

// QR-12: a cold start reaches a playable board within 2 s, and the app generates the puzzle at the tap. This bench
// only prints the times for the quality record. It sets no bar: the load of the machine moves the numbers a lot.
const SEEDS = 200

const ms = (value: number): string => `${value.toFixed(1)} ms`

/** The share of the times at or below which `share` of the sorted times fall. */
function percentile(sorted: readonly number[], share: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil(share * sorted.length) - 1)]!
}

test('one generated puzzle at each level, time for each seed (QR-12)', () => {
  const lines = ['| Level | Seeds | Mean | p95 | Slowest |', '| --- | --- | --- | --- | --- |']
  for (const level of LEVELS) {
    const times: number[] = []
    for (let seed = 1; seed <= SEEDS; seed++) {
      const start = performance.now()
      generate(level, seed)
      times.push(performance.now() - start)
    }
    expect(times).toHaveLength(SEEDS)
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts the fresh array of this level
    const sorted = times.sort((a, b) => a - b)
    const mean = sorted.reduce((sum, time) => sum + time, 0) / sorted.length
    lines.push(`| ${level} | ${SEEDS} | ${ms(mean)} | ${ms(percentile(sorted, 0.95))} | ${ms(sorted.at(-1)!)} |`)
  }
  console.log(`\n${lines.join('\n')}\n`)
}, 600_000)
