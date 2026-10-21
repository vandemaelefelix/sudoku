import { expect, test } from 'vitest'
import { generate, LEVELS, type Level } from '../src/generator'
import { TECHNIQUE_ORDER } from '../src/technique/order'
import { playThrough } from '../src/technique/playThrough'
import type { Step } from '../src/technique/types'

const PUZZLES_PER_LEVEL = 1000

type Group = { name: string; limit: number }

// A puzzle is in the first group whose limit holds its hardest step. Each group adds techniques.
const GROUPS: readonly Group[] = [
  { name: 'singles only', limit: 2.3 },
  { name: 'and pointing or box-line', limit: 2.8 },
  { name: 'and pairs', limit: 3.4 },
  { name: 'and triples (all of tier 1)', limit: 4.0 },
]

function weightOf(step: Step): number {
  const box = step.technique === 'hiddenSingle' && step.units[0]! >= 18
  const rank = TECHNIQUE_ORDER.find(
    (item) =>
      item.technique === step.technique &&
      (item.unitKinds === undefined || item.unitKinds.includes(box ? 'box' : 'row')),
  )
  return rank!.weight
}

const percent = (part: number, whole: number): string => `${((part / whole) * 100).toFixed(1)} %`

type Result = { solved: boolean; steps: number; hardest: number; emptyLeft: number }

function measure(level: Level): Result[] {
  const results: Result[] = []
  for (let seed = 1; seed <= PUZZLES_PER_LEVEL; seed++) {
    const { givens: board } = generate(level, seed)
    const run = playThrough(board)
    const placed = run.steps.reduce((sum, step) => sum + step.placements.length, 0)
    const givens = board.filter((digit) => digit !== 0).length
    results.push({
      solved: run.solved,
      steps: run.steps.length,
      hardest: Math.max(0, ...run.steps.map(weightOf)),
      emptyLeft: 81 - givens - placed,
    })
  }
  return results
}

test('the share of generated puzzles that tier 1 solves to the end', () => {
  const started = performance.now()
  const rows = LEVELS.map((level) => ({ level, results: measure(level) }))
  const lines: string[] = []

  lines.push(
    `Seeds 1 to ${PUZZLES_PER_LEVEL} of each level, from \`generate\`. All tier 1 techniques, easiest first.`,
    '',
  )
  lines.push(
    '| Level | Puzzles | Solved to the end | Stuck | Steps for a solved puzzle (mean, largest) | Empty cells left when stuck (mean) |',
  )
  lines.push('| --- | --- | --- | --- | --- | --- |')
  for (const { level, results } of rows) {
    const solved = results.filter((result) => result.solved)
    const stuck = results.filter((result) => !result.solved)
    const mean = solved.reduce((sum, result) => sum + result.steps, 0) / Math.max(1, solved.length)
    const largest = Math.max(0, ...solved.map((result) => result.steps))
    const left = stuck.reduce((sum, result) => sum + result.emptyLeft, 0) / Math.max(1, stuck.length)
    lines.push(
      `| ${level} | ${results.length} | ${percent(solved.length, results.length)} | ${stuck.length} | ${mean.toFixed(1)}, ${largest} | ${stuck.length === 0 ? '-' : left.toFixed(1)} |`,
    )
  }

  lines.push('', 'Share of the puzzles that the techniques of each group solve to the end (the groups add up):', '')
  lines.push(`| Level | ${GROUPS.map((group) => group.name).join(' | ')} | Stuck |`)
  lines.push(`| --- | ${GROUPS.map(() => '---').join(' | ')} | --- |`)
  for (const { level, results } of rows) {
    const cells = GROUPS.map((group, i) => {
      const lower = i === 0 ? 0 : GROUPS[i - 1]!.limit
      const count = results.filter(
        (result) => result.solved && result.hardest > lower && result.hardest <= group.limit,
      ).length
      return percent(count, results.length)
    })
    const stuck = results.filter((result) => !result.solved).length
    lines.push(`| ${level} | ${cells.join(' | ')} | ${percent(stuck, results.length)} |`)
  }

  lines.push('', `Run time: ${((performance.now() - started) / 1000).toFixed(0)} s.`)
  console.log(`\n${lines.join('\n')}\n`)
  expect(rows).toHaveLength(LEVELS.length)
})
