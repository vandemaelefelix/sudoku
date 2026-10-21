import { describe, expect, it } from 'vitest'
import { fullGrid, generateWithTarget, LEVELS, type Level } from '../generator'
import { createRandom, shuffled } from '../random'
import { solve } from '../solver'
import { TECHNIQUE_ORDER } from '../technique/order'
import { playThrough } from '../technique/playThrough'
import type { Grid } from '../types'
import { grade, type Grade } from './grade'
import { TECHNIQUE_LEVEL } from './levels'
import { TRANSFORM_KINDS, transformGrid } from './symmetry'

/**
 * Re-runs the measurement of docs/research/2026-10-21-technique-grading.md. It does nothing in a
 * normal test run. Command:
 *   MEASURE_GRADES=1 pnpm --filter @sudoku/core exec vitest run src/grading/measure.test.ts --silent=false
 * MEASURE_PER_SET sets the puzzles per set (default 2000). MEASURE_SYMMETRY_PER_SET sets the
 * puzzles per set for the symmetry check (default 1000). The report goes to the console, as
 * Markdown tables.
 */
// Core has no Node types. Vitest fills `import.meta.env` from the process env, but its types come
// from `vite/client`, which pnpm does not expose to this package. So the file declares `process`.
declare const process: { env: Record<string, string | undefined> }
const env = process.env
const PER_SET = Number(env.MEASURE_PER_SET ?? 2000)
const TARGETS: readonly (number | 'minimal')[] = [40, 34, 29, 25, 'minimal']
const SYMMETRY_PER_SET = Number(env.MEASURE_SYMMETRY_PER_SET ?? 1000)
const CELL_ORDER = Array.from({ length: 81 }, (_, cell) => cell)

/** One removal pass that runs until no given can go. The generator stops at its target instead. */
function minimalPuzzle(seed: number): Grid {
  const random = createRandom(seed)
  const givens = fullGrid(random)
  for (const cell of shuffled(CELL_ORDER, random)) {
    const digit = givens[cell]!
    givens[cell] = 0
    if (solve(givens).count !== 1) givens[cell] = digit
  }
  return givens
}

type Row = Grade & { seed: number; givens: number; gradeMs: number; generateMs: number; puzzle: string }

const percentile = (sorted: readonly number[], p: number): number =>
  sorted.length === 0 ? NaN : sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!

// oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array, and the es2022 lib has no toSorted
const ascending = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b)

const sortedBy = (rows: readonly Row[], pick: (row: Row) => number): number[] => ascending(rows.map(pick))

const fixed = (value: number, digits = 1): string => value.toFixed(digits)

// One expression for every share, so that the same quantity prints the same value in every table.
const percent = (part: number, total: number): string => fixed((100 * part) / total)

const isSingle = (row: Row): boolean => row.hardest !== null && TECHNIQUE_LEVEL[row.hardest] === 'easy'

function report(rows: Record<string, Row[]>): string {
  const out: string[] = []
  const levels = ['easy', 'medium', 'hard', 'expert', 'beyond']
  out.push(
    '## Level shares (percent of puzzles)',
    '',
    '| set | puzzles | mean givens | easy | medium | hard | expert | beyond |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  )
  for (const [name, set] of Object.entries(rows)) {
    const mean = set.reduce((sum, row) => sum + row.givens, 0) / set.length
    const shares = levels.map((level) => percent(set.filter((row) => row.level === level).length, set.length))
    out.push(`| ${name} | ${set.length} | ${fixed(mean)} | ${shares.join(' | ')} |`)
  }
  out.push('', '## Hardest technique (percent of puzzles)', '')
  for (const [name, set] of Object.entries(rows)) {
    const counts = new Map<string, number>()
    for (const row of set) counts.set(String(row.hardest), (counts.get(String(row.hardest)) ?? 0) + 1)
    const text: string[] = []
    while (counts.size > 0) {
      const [id, n] = [...counts].reduce((best, entry) => (entry[1] > best[1] ? entry : best))
      text.push(`${id} ${percent(n, set.length)}`)
      counts.delete(id)
    }
    out.push(`- ${name}: ${text.join(', ')}`)
  }
  out.push(
    '',
    '## Choice of the singles-only puzzles (hardest is a single)',
    '',
    '| set | puzzles | p10 | p25 | p50 | p75 | p90 | share with choice below 2 / 3 / 4 / 5 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  )
  for (const [name, set] of Object.entries(rows)) {
    const singles = set.filter(isSingle)
    const choices = sortedBy(singles, (row) => row.choice)
    const below = [2, 3, 4, 5].map((t) =>
      fixed((100 * choices.filter((c) => c < t).length) / Math.max(1, choices.length), 0),
    )
    out.push(
      `| ${name} | ${singles.length} | ${[10, 25, 50, 75, 90].map((p) => fixed(percentile(choices, p), 2)).join(' | ')} | ${below.join(' / ')} |`,
    )
  }
  out.push('', '## Share of each set that grades easy, per threshold T (percent)', '')
  out.push(
    `| T | ${Object.keys(rows).join(' | ')} |`,
    `| --- | ${Object.keys(rows)
      .map(() => '---')
      .join(' | ')} |`,
  )
  for (const t of [6, 8, 10, 12, 14, 16, 17, 18, 19, 20, 21, 22, 24]) {
    const shares = Object.values(rows).map((set) =>
      percent(set.filter((row) => isSingle(row) && row.choice >= t).length, set.length),
    )
    out.push(`| ${t} | ${shares.join(' | ')} |`)
  }
  out.push(
    '',
    '## Score per level (level of the grade, so the choice rule counts)',
    '',
    '| set | level | puzzles | p10 | p50 | p90 | max |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  )
  for (const [name, set] of Object.entries(rows)) {
    for (const level of levels) {
      const part = set.filter((row) => row.level === level)
      if (part.length === 0) continue
      const scores = sortedBy(part, (row) => row.score)
      out.push(
        `| ${name} | ${level} | ${part.length} | ${[10, 50, 90].map((p) => percentile(scores, p)).join(' | ')} | ${scores.at(-1)} |`,
      )
    }
  }
  out.push(
    '',
    '## Time in ms',
    '',
    '| set | grade median | grade p99 | grade max | generate median | generate p99 |',
    '| --- | --- | --- | --- | --- | --- |',
  )
  for (const [name, set] of Object.entries(rows)) {
    const g = sortedBy(set, (row) => row.gradeMs)
    const s = sortedBy(set, (row) => row.generateMs)
    out.push(
      `| ${name} | ${fixed(percentile(g, 50), 2)} | ${fixed(percentile(g, 99), 1)} | ${fixed(g.at(-1)!, 1)} | ${fixed(percentile(s, 50), 2)} | ${fixed(percentile(s, 99), 1)} |`,
    )
  }
  out.push(
    '',
    '## Yield for the generator',
    '',
    '| set | level | yield % | attempts | expected time (ms) |',
    '| --- | --- | --- | --- | --- |',
  )
  for (const [name, set] of Object.entries(rows)) {
    const meanMs = set.reduce((sum, row) => sum + row.gradeMs + row.generateMs, 0) / set.length
    for (const level of levels.slice(0, 4)) {
      const count = set.filter((row) => row.level === level).length
      if (count === 0) continue
      const share = count / set.length
      out.push(
        `| ${name} | ${level} | ${percent(count, set.length)} | ${fixed(1 / share)} | ${fixed(meanMs / share, 1)} |`,
      )
    }
  }
  return out.join('\n')
}

const rank = (level: Level): number => LEVELS.indexOf(level)

/** Grades with the hint order and compares with the grade order. Both solves use the unique option, as `grade` does. */
function orderReport(rows: Record<string, Row[]>): string {
  const out = [
    '## Hint order against grade order',
    '',
    '| set | both solve | hint order finds a higher hardest level | hint order solves, grade order is beyond | grade order solves, hint order is beyond |',
    '| --- | --- | --- | --- | --- |',
  ]
  for (const [name, set] of Object.entries(rows)) {
    let both = 0
    let higher = 0
    let hintOnly = 0
    let gradeOnly = 0
    for (const row of set) {
      const hint = playThrough(row.puzzle.split('').map(Number), TECHNIQUE_ORDER, { unique: true })
      const gradeSolved = row.level !== 'beyond'
      if (hint.solved && gradeSolved) {
        both++
        const top = Math.max(-1, ...hint.steps.map((step) => rank(TECHNIQUE_LEVEL[step.technique])))
        if (row.hardest !== null && top > rank(TECHNIQUE_LEVEL[row.hardest])) higher++
      } else if (hint.solved) hintOnly++
      else if (gradeSolved) gradeOnly++
    }
    out.push(`| ${name} | ${both} | ${higher} | ${hintOnly} | ${gradeOnly} |`)
  }
  return out.join('\n')
}

/** How often a transform changes the grade. The choice of a puzzle with steps that are not singles can still shift, since those steps follow the scan order. */
function symmetryReport(rows: Record<string, Row[]>): string {
  const random = createRandom(7)
  const out = [
    '## Symmetry transforms',
    '',
    '| transform | pairs | level differs | hardest level differs | hardest technique differs | level changes | choice shift median / p99 | singles-only choice differs |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ]
  const puzzles = Object.keys(rows).flatMap((name) => rows[name]!.slice(0, SYMMETRY_PER_SET))
  for (const kind of [...TRANSFORM_KINDS, 'all']) {
    let level = 0
    let hardestLevel = 0
    let technique = 0
    const moves = new Map<string, number>()
    const shifts: number[] = []
    let singlesDiffer = 0
    for (const row of puzzles) {
      const base = row.puzzle.split('').map(Number)
      const moved =
        kind === 'all'
          ? TRANSFORM_KINDS.reduce((grid, k) => transformGrid(grid, k, random), base)
          : transformGrid(base, kind as never, random)
      const other = grade(moved)
      shifts.push(Math.abs(other.choice - row.choice))
      if (isSingle(row) && Math.abs(other.choice - row.choice) > 1e-9) singlesDiffer++
      if (other.level !== row.level) {
        level++
        const move = `${row.level}>${other.level}`
        moves.set(move, (moves.get(move) ?? 0) + 1)
      }
      if (row.hardest && other.hardest && TECHNIQUE_LEVEL[row.hardest] !== TECHNIQUE_LEVEL[other.hardest])
        hardestLevel++
      if (other.hardest !== row.hardest) technique++
    }
    const sortedShifts = ascending(shifts)
    out.push(
      `| ${kind} | ${puzzles.length} | ${level} | ${hardestLevel} | ${technique} | ${[...moves].map(([m, n]) => `${m} ${n}`).join(', ') || 'none'} | ${fixed(percentile(sortedShifts, 50), 2)} / ${fixed(percentile(sortedShifts, 99), 2)} | ${singlesDiffer} |`,
    )
  }
  return out.join('\n')
}

describe.runIf(env.MEASURE_GRADES)('measure grades', () => {
  it('grades the generated puzzles', { timeout: 3_600_000 }, () => {
    const rows: Record<string, Row[]> = {}
    for (const target of TARGETS) {
      const set: Row[] = []
      for (let seed = 0; seed < PER_SET; seed++) {
        const t0 = performance.now()
        const givens = target === 'minimal' ? minimalPuzzle(seed) : generateWithTarget(target, seed).givens
        const t1 = performance.now()
        const result = grade(givens)
        const t2 = performance.now()
        set.push({
          ...result,
          seed,
          givens: givens.filter((digit) => digit !== 0).length,
          generateMs: t1 - t0,
          gradeMs: t2 - t1,
          puzzle: givens.join(''),
        })
      }
      rows[target === 'minimal' ? 'minimal' : `${target} givens`] = set
    }
    const text = `${report(rows)}\n\n${orderReport(rows)}\n\n${symmetryReport(rows)}`
    console.log(text)
    expect(Object.keys(rows)).toHaveLength(TARGETS.length)
  })
})
