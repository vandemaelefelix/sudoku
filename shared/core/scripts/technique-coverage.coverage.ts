import { expect, test } from 'vitest'
import { LEVELS, type Level } from '../src/level'
import { ungradedPuzzle } from '../src/technique/testKit'
import { stepWeight, TECHNIQUE_ORDER, TIER_1_ORDER } from '../src/technique/order'
import { playThrough } from '../src/technique/playThrough'
import type { TechniqueId, TechniqueRank } from '../src/technique/types'

const PUZZLES_PER_LEVEL = 1000

type Group = { name: string; limit: number }

// A puzzle is in the first group whose limit holds its hardest step. Each group adds techniques.
const GROUPS: readonly Group[] = [
  { name: 'singles only', limit: 2.3 },
  { name: 'and pointing or box-line', limit: 2.8 },
  { name: 'and pairs', limit: 3.4 },
  { name: 'and triples (all of tier 1)', limit: 4.0 },
]

// The techniques that the full solver adds to tier 1 and tier 2. The unique rectangle runs because every generated puzzle has one solution.
const FULL_ONLY: ReadonlySet<TechniqueId> = new Set(['simpleColouring', 'uniqueRectangle', 'xChain', 'xyChain'])
const TIER_2_ORDER = TECHNIQUE_ORDER.filter((rank) => !FULL_ONLY.has(rank.technique))

const percent = (part: number, whole: number): string => `${((part / whole) * 100).toFixed(1)} %`

type Result = { solved: boolean; steps: number; hardest: number; emptyLeft: number; used: Set<string> }

function measure(level: Level, ranks: readonly TechniqueRank[]): Result[] {
  const results: Result[] = []
  for (let seed = 1; seed <= PUZZLES_PER_LEVEL; seed++) {
    const { givens: board } = ungradedPuzzle(level, seed)
    const run = playThrough(board, ranks, { unique: true })
    const placed = run.steps.reduce((sum, step) => sum + step.placements.length, 0)
    const givens = board.filter((digit) => digit !== 0).length
    results.push({
      solved: run.solved,
      steps: run.steps.length,
      hardest: Math.max(0, ...run.steps.map(stepWeight)),
      emptyLeft: 81 - givens - placed,
      used: new Set(run.steps.map((step) => step.technique)),
    })
  }
  return results
}

test('the share of generated puzzles that tier 1 and tier 2 solve to the end', () => {
  const started = performance.now()
  const rows = LEVELS.map((level) => ({ level, results: measure(level, TIER_1_ORDER) }))
  const tier2 = LEVELS.map((level) => ({ level, results: measure(level, TIER_2_ORDER) }))
  const full = LEVELS.map((level) => ({ level, results: measure(level, TECHNIQUE_ORDER) }))
  const lines: string[] = []

  lines.push(
    `Seeds 1 to ${PUZZLES_PER_LEVEL} of each level, from the v1 givens counts (ADR-011). All tier 1 techniques, easiest first.`,
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

  lines.push(
    '',
    'Tier 2: tier 1 plus the quads, X-wing, swordfish, jellyfish, skyscraper, two-string kite, XY-wing, XYZ-wing and W-wing:',
    '',
  )
  lines.push(
    '| Level | Puzzles | Tier 1 solved | Tier 2 solved | Stuck at tier 2 | Steps for a solved puzzle (mean, largest) | Empty cells left when stuck (mean) |',
  )
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  for (const [index, { level, results }] of tier2.entries()) {
    const solved = results.filter((result) => result.solved)
    const stuck = results.filter((result) => !result.solved)
    const mean = solved.reduce((sum, result) => sum + result.steps, 0) / Math.max(1, solved.length)
    const largest = Math.max(0, ...solved.map((result) => result.steps))
    const left = stuck.reduce((sum, result) => sum + result.emptyLeft, 0) / Math.max(1, stuck.length)
    const tier1Solved = rows[index]!.results.filter((result) => result.solved).length
    lines.push(
      `| ${level} | ${results.length} | ${percent(tier1Solved, results.length)} | ${percent(solved.length, results.length)} | ${stuck.length} | ${mean.toFixed(1)}, ${largest} | ${stuck.length === 0 ? '-' : left.toFixed(1)} |`,
    )
  }

  const tier2Techniques = TIER_2_ORDER.map((rank) => rank.technique).filter(
    (technique, i, all) => !TIER_1_ORDER.some((rank) => rank.technique === technique) && all.indexOf(technique) === i,
  )
  lines.push('', 'Solved puzzles that use each tier 2 technique at least once (of 1 000 puzzles per level):', '')
  lines.push(`| Level | ${tier2Techniques.join(' | ')} |`)
  lines.push(`| --- | ${tier2Techniques.map(() => '---').join(' | ')} |`)
  for (const { level, results } of tier2) {
    const counts = tier2Techniques.map(
      (technique) => results.filter((result) => result.solved && result.used.has(technique)).length,
    )
    lines.push(`| ${level} | ${counts.join(' | ')} |`)
  }

  lines.push(
    '',
    'Full solver: tier 1, tier 2, simple colouring, unique rectangle, X-chain and XY-chain (a chain has at most 12 cells):',
    '',
  )
  lines.push(
    '| Level | Puzzles | Tier 1 solved | Tier 2 solved | Full solver solved | Stuck | Steps for a solved puzzle (mean, largest) | Empty cells left when stuck (mean) |',
  )
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const [index, { level, results }] of full.entries()) {
    const solved = results.filter((result) => result.solved)
    const stuck = results.filter((result) => !result.solved)
    const mean = solved.reduce((sum, result) => sum + result.steps, 0) / Math.max(1, solved.length)
    const largest = Math.max(0, ...solved.map((result) => result.steps))
    const left = stuck.reduce((sum, result) => sum + result.emptyLeft, 0) / Math.max(1, stuck.length)
    const tier1Solved = rows[index]!.results.filter((result) => result.solved).length
    const tier2Solved = tier2[index]!.results.filter((result) => result.solved).length
    lines.push(
      `| ${level} | ${results.length} | ${percent(tier1Solved, results.length)} | ${percent(tier2Solved, results.length)} | ${percent(solved.length, results.length)} | ${stuck.length} | ${mean.toFixed(1)}, ${largest} | ${stuck.length === 0 ? '-' : left.toFixed(1)} |`,
    )
  }

  const fullTechniques = TECHNIQUE_ORDER.map((rank) => rank.technique).filter((technique) => FULL_ONLY.has(technique))
  lines.push('', 'Solved puzzles that use each added technique at least once (of 1 000 puzzles per level):', '')
  lines.push(`| Level | ${fullTechniques.join(' | ')} |`)
  lines.push(`| --- | ${fullTechniques.map(() => '---').join(' | ')} |`)
  for (const { level, results } of full) {
    const counts = fullTechniques.map(
      (technique) => results.filter((result) => result.solved && result.used.has(technique)).length,
    )
    lines.push(`| ${level} | ${counts.join(' | ')} |`)
  }

  lines.push('', `Run time: ${((performance.now() - started) / 1000).toFixed(0)} s.`)
  console.log(`\n${lines.join('\n')}\n`)
  expect(rows).toHaveLength(LEVELS.length)
})
