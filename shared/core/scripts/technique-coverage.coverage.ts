import { expect, test } from 'vitest'
import { createGame } from '../src/game/createGame'
import { planHint } from '../src/hint/plan'
import { computeCandidates } from '../src/technique/candidates'
import { nextSteps } from '../src/technique/nextSteps'
import { HINT_ORDER } from '../src/hint/techniques'
import { LEVELS, type Level } from '../src/level'
import { ungradedPuzzle } from '../src/technique/testKit'
import { stepWeight, TECHNIQUE_ORDER, TIER_1_ORDER } from '../src/technique/order'
import { playThrough } from '../src/technique/playThrough'
import type { TechniqueId, TechniqueRank } from '../src/technique/types'

const PUZZLES_PER_LEVEL = 1000
// A plan per position costs more than a solve, so the hint section uses fewer puzzles.
const HINT_PUZZLES_PER_LEVEL = 200

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

type HintCount = {
  hints: number
  taughtTier1: number
  taughtTier2: number
  hard: number
  hardTier1: number
  hardTier2: number
  puzzlesAllTaught: number
  slowestMs: number
}

/**
 * A player can ask for a hint at any position of a solve. Each position of the full solver's solve
 * gets one plan with the tier 1 techniques and one with tier 1 and tier 2. A plan teaches when it has steps.
 * A position is one board of that solve: each board counts once. It is hard when the easiest step on
 * its fresh candidates is an elimination. A player who is stuck most likely asks there.
 */
function countHints(level: Level): HintCount {
  const count: HintCount = {
    hints: 0,
    taughtTier1: 0,
    taughtTier2: 0,
    hard: 0,
    hardTier1: 0,
    hardTier2: 0,
    puzzlesAllTaught: 0,
    slowestMs: 0,
  }
  for (let seed = 1; seed <= HINT_PUZZLES_PER_LEVEL; seed++) {
    const { givens, solution } = ungradedPuzzle(level, seed)
    const run = playThrough(givens, TECHNIQUE_ORDER, { unique: true })
    const boards = new Set(run.positions.map((position) => position.board.join()))
    let allTaught = true
    for (const text of boards) {
      const board = text.split(',').map(Number)
      // The plan starts from fresh candidates, so the hard test does too.
      const next = nextSteps(computeCandidates(board), board, TECHNIQUE_ORDER, { unique: true })[0]
      const hard = next !== undefined && next.placements.length === 0
      const entries = board.map((digit, cell) => (givens[cell] === 0 ? digit : 0))
      const game = createGame({ givens, solution, entries })
      const started = performance.now()
      const plan = planHint(game, HINT_ORDER)
      count.slowestMs = Math.max(count.slowestMs, performance.now() - started)
      count.hints++
      const tier1 = planHint(game, TIER_1_HINTS)?.kind === 'steps'
      const tier2 = plan?.kind === 'steps'
      count.taughtTier1 += Number(tier1)
      count.taughtTier2 += Number(tier2)
      if (hard) {
        count.hard++
        count.hardTier1 += Number(tier1)
        count.hardTier2 += Number(tier2)
      }
      if (!tier2) allTaught = false
    }
    if (allTaught) count.puzzlesAllTaught++
  }
  return count
}

const TIER_1_HINTS = HINT_ORDER.filter((rank) => TIER_1_ORDER.some((tier1) => tier1.technique === rank.technique))

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

  lines.push(
    '',
    `Hints: seeds 1 to ${HINT_PUZZLES_PER_LEVEL} of each level. One hint at each position of the full solver's solve. ` +
      'A hint teaches when its plan has steps. Else it uses the fallback (ADR-032 point 9):',
    '',
  )
  lines.push(
    '| Level | Hints | Teach with tier 1 | Teach with tier 1 and tier 2 | Hard positions | Teach there with tier 1 | Teach there with tier 1 and tier 2 | Puzzles where every hint teaches | Slowest plan |',
  )
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const level of LEVELS) {
    const hints = countHints(level)
    const hard = (taught: number): string => (hints.hard === 0 ? '-' : percent(taught, hints.hard))
    lines.push(
      `| ${level} | ${hints.hints} | ${percent(hints.taughtTier1, hints.hints)} | ${percent(hints.taughtTier2, hints.hints)} | ${hints.hard} | ${hard(hints.hardTier1)} | ${hard(hints.hardTier2)} | ${percent(hints.puzzlesAllTaught, HINT_PUZZLES_PER_LEVEL)} | ${hints.slowestMs.toFixed(0)} ms |`,
    )
  }

  lines.push('', `Run time: ${((performance.now() - started) / 1000).toFixed(0)} s.`)
  console.log(`\n${lines.join('\n')}\n`)
  expect(rows).toHaveLength(LEVELS.length)
})
