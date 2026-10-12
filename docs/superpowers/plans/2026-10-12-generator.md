# Puzzle Generator (simple v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@sudoku/core` generates a puzzle with exactly one solution at four levels. A level and a seed give the same puzzle on every device.

**Architecture:** a seeded PRNG (mulberry32) drives two steps. Step 1 fills a full solution with randomised backtracking. Step 2 removes givens in a random order. A removal stays only when `solve()` (#48) still finds exactly one solution. Removal stops at the level's target number of givens. When one pass cannot reach the target, the generator tries a new full solution from the same random stream, up to 50 times. ADR-011 gets an amendment for these v1 rules.

**Tech Stack:** TypeScript 6, Vitest 5.0.3, pnpm workspaces, oxlint.

**Spec:** issue #35 (`gh issue view 35`), ADR-011 (`docs/architecture/adr/adr-011-puzzle-generation-and-hints.md`), epic #34 "Decisions for v1".

## Global Constraints

- SUD-04: no React Native, no Expo and no I/O in `packages/sudoku-core`. No `Math.random`, no clock in the generator itself (the time test only measures).
- Level names in code: `'easy' | 'medium' | 'hard' | 'expert'`. These match the glossary row "Level" (easy, medium, hard or expert).
- Givens targets: easy 40, medium 34, hard 29, expert 25. `MAX_ATTEMPTS` = 50.
- A seed is an integer from 0 to 4 294 967 295 (`0xffffffff`). Anything else throws a `RangeError`.
- Do not depend on the game rules of #49 (PR #57). Do not export a type named `Random` from the package: #49 exports one already. Keep the PRNG type local to `random.ts`.
- `packages/sudoku-core/src/index.ts` is shared with #49. Append lines only. Keep every existing line.
- Prose and comments follow `AGENTS.md`: STE light, comment rules, no TODO. Commits: Conventional Commits with `(#35)`.
- Branch `feature/35-generator` from `origin/develop`. PR against `develop` with `Closes #35`.

## Measured on the prototype (Node 24, Apple Silicon, this exact code)

| Level | Target givens | Median | p95 | Max (100 seeds) | Missed target |
| --- | --- | --- | --- | --- | --- |
| easy | 40 | 0.2 ms | 0.3 ms | 0.4 ms | 0 |
| medium | 34 | 0.3 ms | 0.3 ms | 0.4 ms | 0 |
| hard | 29 | 0.4 ms | 0.6 ms | 0.7 ms | 0 |
| expert | 25 | 0.9 ms | 3.3 ms | 4.5 ms | 0 |

- One greedy pass reaches 25 givens or fewer for 78.5 % of full grids (over 200 grids: minimum 22, median 25, p90 26, max 28). So expert 25 needs about 1.3 attempts on average. The chance that 50 attempts all miss is below 10⁻³³.
- The worst case (a target that no pass reaches, 50 full passes) takes 85 ms.
- Every level stays far under 1 s, so **no pool is needed now**. ADR-011 point 4 waits until a level takes more than 1 s (amendment below). QR-12 (2 s to a playable board) holds without a pool.

## Review Focus

1. **Determinism across versions.** A saved game or a "Puzzle 412" label names a puzzle by its seed. A change in the PRNG, the shuffle or the removal order silently changes every puzzle. Task 2 pins the exact givens of `generate('hard', 42)`.
2. **A bad seed or level from the app.** `NaN`, `-1`, `1.5`, `2 ** 32` or an unknown level must throw a `RangeError`, not make a puzzle quietly. Tests in Task 2.
3. **A target that no attempt reaches.** The generator must return a unique puzzle with the fewest givens it found, and stop after 50 attempts. Test in Task 2 with target 17.
4. **Givens that are not the solution.** Every given must equal the solution's digit in that cell. Test in Task 2.
5. **Two levels on one seed.** The same seed at two levels may share a solution. That is allowed, but each must hit its own target and stay unique. Test in Task 2.

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/sudoku-core/src/random.ts` | `createRandom(seed)` (mulberry32) and `shuffled(items, random)` |
| `packages/sudoku-core/src/random.test.ts` | Tests of `random.ts` |
| `packages/sudoku-core/src/generator.ts` | `Level`, `LEVELS`, `GIVENS_TARGET`, `MAX_ATTEMPTS`, `Puzzle`, `fullGrid`, `generateWithTarget`, `generate` |
| `packages/sudoku-core/src/generator.test.ts` | Tests of `generator.ts`, including the time record |
| `packages/sudoku-core/src/index.ts` | Append the export lines (shared with #49) |
| `docs/architecture/adr/adr-011-puzzle-generation-and-hints.md` | Amendment for v1 |
| `docs/architecture/00-DECISIONS.md` | ADR-011 row |
| `docs/architecture/09-architecture-decisions.md` | ADR-011 row |
| `docs/architecture/12-glossary.md` | Rows "Technique solver" (now later) and "Seed" (new) |

---

### Task 0: Worktree and plan copy

- [ ] **Step 1:** `git fetch origin`, then `git switch -c feature/35-generator origin/develop`. If a hook refuses `git`, call `/usr/bin/git`.
- [ ] **Step 2:** `pnpm install`. If `node_modules` is a symlink to another checkout, remove the symlink first.
- [ ] **Step 3:** Copy this plan to `docs/superpowers/plans/2026-10-12-generator.md`. Commit: `docs(plan): generate puzzles at four levels (#35)`.

---

### Task 1: The seeded random source

**Files:**
- Create: `packages/sudoku-core/src/random.ts`
- Create: `packages/sudoku-core/src/random.test.ts`

**Interfaces:**
- Produces: `createRandom(seed: number): () => number` and `shuffled<T>(items: readonly T[], random: () => number): T[]`. Not exported from the package.

- [ ] **Step 1: Write the failing test** `packages/sudoku-core/src/random.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { createRandom, shuffled } from './random'

const take = (random: () => number, n: number): number[] => Array.from({ length: n }, () => random())

describe('createRandom', () => {
  it('gives the same sequence for the same seed', () => {
    expect(take(createRandom(42), 20)).toEqual(take(createRandom(42), 20))
  })

  it('gives another sequence for another seed', () => {
    expect(take(createRandom(42), 20)).not.toEqual(take(createRandom(43), 20))
  })

  it('gives numbers from 0 up to but not including 1', () => {
    for (const value of take(createRandom(7), 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('pins the first value of seed 1, so a change of the algorithm shows', () => {
    expect(createRandom(1)()).toBe(0.6270739405881613)
  })
})

describe('shuffled', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9]

  it('returns the same items in another order', () => {
    const out = shuffled(items, createRandom(3))
    expect(out.toSorted((a, b) => a - b)).toEqual(items)
    expect(out).not.toEqual(items)
  })

  it('does not change its input', () => {
    const input = [...items]
    shuffled(input, createRandom(3))
    expect(input).toEqual(items)
  })

  it('gives the same order for the same seed', () => {
    expect(shuffled(items, createRandom(9))).toEqual(shuffled(items, createRandom(9)))
  })
})
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm --filter @sudoku/core exec vitest run src/random.test.ts`
Expected: FAIL, "Failed to resolve import './random'".

- [ ] **Step 3: Write `packages/sudoku-core/src/random.ts`**

```ts
type Random = () => number

/**
 * Mulberry32. The same seed gives the same sequence on every device, so a seed names a puzzle.
 * Returns numbers in [0, 1). The seed is truncated to an unsigned 32-bit integer.
 */
export function createRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** Fisher–Yates on a copy. */
export function shuffled<T>(items: readonly T[], random: Random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const swap = out[i]!
    out[i] = out[j]!
    out[j] = swap
  }
  return out
}
```

If oxlint refuses `toSorted` in the test (it should not: it is the non-mutating form), use `[...out].toSorted(...)`. Do not use `Array#sort` in source code; #49 found that oxlint refuses it.

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm --filter @sudoku/core exec vitest run src/random.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/sudoku-core/src/random.ts packages/sudoku-core/src/random.test.ts
git commit -m "feat(core): seeded random source for the generator (#35)"
```

---

### Task 2: Generate a puzzle at a level

**Files:**
- Create: `packages/sudoku-core/src/generator.ts`
- Create: `packages/sudoku-core/src/generator.test.ts`
- Modify: `packages/sudoku-core/src/index.ts` (append two lines)

**Interfaces:**
- Consumes: `solve(puzzle): SolveResult` from `./solver` (on `origin/develop`), `Grid` from `./types`, Task 1's `createRandom` and `shuffled`.
- Produces (exported from the package): `type Level = 'easy' | 'medium' | 'hard' | 'expert'`, `LEVELS: readonly Level[]`, `GIVENS_TARGET: Readonly<Record<Level, number>>`, `type Puzzle = { level: Level; seed: number; givens: Grid; solution: Grid }`, `generate(level: Level, seed: number): Puzzle`. `fullGrid`, `generateWithTarget` and `MAX_ATTEMPTS` stay inside `generator.ts` (exported from the file for tests only).

- [ ] **Step 1: Write the failing test** `packages/sudoku-core/src/generator.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { fullGrid, generateWithTarget, MAX_ATTEMPTS } from './generator'
import { generate, GIVENS_TARGET, LEVELS, solve, type Level } from './index'
import { createRandom } from './random'

const givensCount = (grid: readonly number[]): number => grid.filter((digit) => digit !== 0).length
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1)

describe('fullGrid', () => {
  it('fills a complete grid that obeys every rule', () => {
    const full = fullGrid(createRandom(5))
    expect(givensCount(full)).toBe(81)
    expect(solve(full)).toEqual({ count: 1, solution: full })
  })

  it('gives the same grid for the same seed', () => {
    expect(fullGrid(createRandom(5))).toEqual(fullGrid(createRandom(5)))
  })
})

describe('generate', () => {
  it('has four levels with fewer givens at each step', () => {
    expect(LEVELS).toEqual(['easy', 'medium', 'hard', 'expert'])
    expect(GIVENS_TARGET).toEqual({ easy: 40, medium: 34, hard: 29, expert: 25 })
  })

  describe.for(LEVELS)('%s', (level) => {
    it.for(SEEDS)('seed %i has the target givens and exactly one solution', (seed) => {
      const puzzle = generate(level, seed)
      expect(puzzle.level).toBe(level)
      expect(puzzle.seed).toBe(seed)
      expect(givensCount(puzzle.givens)).toBe(GIVENS_TARGET[level])
      expect(solve(puzzle.givens)).toEqual({ count: 1, solution: puzzle.solution })
    })
  })

  it('only keeps givens that match the solution', () => {
    const { givens, solution } = generate('easy', 11)
    givens.forEach((digit, cell) => {
      if (digit !== 0) expect(digit).toBe(solution[cell])
    })
  })

  it('gives the same puzzle for the same level and seed', () => {
    expect(generate('expert', 99)).toEqual(generate('expert', 99))
  })

  it('gives another puzzle for another seed', () => {
    expect(generate('medium', 1).givens).not.toEqual(generate('medium', 2).givens)
  })

  it('pins the puzzle of hard seed 42, so a change of the generator shows', () => {
    const puzzle = generate('hard', 42)
    expect(puzzle.givens.join('')).toBe(
      '000740001910080460004150000301020090002830076400000020680910700000005080000000000',
    )
    expect(puzzle.solution.join('')).toBe(
      '836749251915283467724156938361527894592834176478691523683912745149375682257468319',
    )
  })

  it.for([Number.NaN, -1, 1.5, 2 ** 32, Number.POSITIVE_INFINITY])('refuses the seed %s', (seed) => {
    expect(() => generate('easy', seed)).toThrow(RangeError)
  })

  it('refuses a level it does not know', () => {
    expect(() => generate('nightmare' as Level, 1)).toThrow(RangeError)
  })
})

describe('generateWithTarget', () => {
  it('returns the fewest givens it found when no attempt reaches the target', () => {
    const { givens, solution } = generateWithTarget(17, 3)
    expect(givensCount(givens)).toBeGreaterThan(17)
    expect(solve(givens)).toEqual({ count: 1, solution })
    expect(MAX_ATTEMPTS).toBe(50)
  })
})

describe('generation time', () => {
  it.for(LEVELS)('records the time of %s', async (level, { annotate }) => {
    const times = SEEDS.map((seed) => {
      const start = performance.now()
      generate(level as Level, seed)
      return performance.now() - start
    })
    const slowest = Math.max(...times)
    await annotate(`slowest of ${SEEDS.length}: ${slowest.toFixed(1)} ms`, 'generation time')
    expect(slowest).toBeLessThan(1000)
  })
})
```

Notes for the implementer:
- `describe.for` and `it.for` exist in Vitest 5. `it.each` does not pass the test context (#48 found this), so the time test uses `it.for`.
- If `annotate` is not available for `it.for` in this Vitest version, check how `solver.test.ts` on `origin/develop` records its time, and copy that form.

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm --filter @sudoku/core exec vitest run src/generator.test.ts`
Expected: FAIL, "Failed to resolve import './generator'".

- [ ] **Step 3: Write `packages/sudoku-core/src/generator.ts`**

```ts
import { createRandom, shuffled } from './random'
import { solve } from './solver'
import type { Grid } from './types'

export type Level = 'easy' | 'medium' | 'hard' | 'expert'

export const LEVELS: readonly Level[] = ['easy', 'medium', 'hard', 'expert']

/** v1 grades a puzzle by its number of givens only (ADR-011, amendment 2026-10-12). */
export const GIVENS_TARGET: Readonly<Record<Level, number>> = {
  easy: 40,
  medium: 34,
  hard: 29,
  expert: 25,
}

/** One removal pass reaches 25 givens for about 4 grids in 5, so 50 attempts never run out in practice. */
export const MAX_ATTEMPTS = 50

export type Puzzle = {
  level: Level
  seed: number
  givens: Grid
  solution: Grid
}

const CELLS = 81
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const CELL_ORDER = Array.from({ length: CELLS }, (_, cell) => cell)

function boxOf(cell: number): number {
  return Math.floor(cell / 27) * 3 + Math.floor((cell % 9) / 3)
}

function givensCount(grid: readonly number[]): number {
  return grid.filter((digit) => digit !== 0).length
}

/** A complete valid grid. Bit d of a mask stands for digit d. */
export function fullGrid(random: () => number): Grid {
  const cells: Grid = Array.from({ length: CELLS }, () => 0)
  const rows = Array.from({ length: 9 }, () => 0)
  const cols = Array.from({ length: 9 }, () => 0)
  const boxes = Array.from({ length: 9 }, () => 0)

  function fill(cell: number): boolean {
    if (cell === CELLS) return true
    const row = Math.floor(cell / 9)
    const col = cell % 9
    const box = boxOf(cell)
    for (const digit of shuffled(DIGITS, random)) {
      const bit = 1 << digit
      if ((rows[row]! | cols[col]! | boxes[box]!) & bit) continue
      cells[cell] = digit
      rows[row]! |= bit
      cols[col]! |= bit
      boxes[box]! |= bit
      if (fill(cell + 1)) return true
      cells[cell] = 0
      rows[row]! &= ~bit
      cols[col]! &= ~bit
      boxes[box]! &= ~bit
    }
    return false
  }

  fill(0)
  return cells
}

function removeGivens(solution: Grid, target: number, random: () => number): Grid {
  const givens = [...solution]
  let count = CELLS
  for (const cell of shuffled(CELL_ORDER, random)) {
    if (count === target) break
    const digit = givens[cell]!
    givens[cell] = 0
    if (solve(givens).count === 1) count--
    else givens[cell] = digit
  }
  return givens
}

/**
 * Tries up to MAX_ATTEMPTS full grids from one random stream. When no attempt reaches the
 * target, returns the attempt with the fewest givens. Every result has exactly one solution.
 */
export function generateWithTarget(target: number, seed: number): { givens: Grid; solution: Grid } {
  const random = createRandom(seed)
  let best: { givens: Grid; solution: Grid } | undefined
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const solution = fullGrid(random)
    const givens = removeGivens(solution, target, random)
    if (givensCount(givens) === target) return { givens, solution }
    if (!best || givensCount(givens) < givensCount(best.givens)) best = { givens, solution }
  }
  return best!
}

/**
 * The same level and seed give the same puzzle on every device.
 * Throws a RangeError for an unknown level, or a seed that is not an integer from 0 to 0xffffffff.
 */
export function generate(level: Level, seed: number): Puzzle {
  if (!LEVELS.includes(level)) throw new RangeError(`Unknown level ${String(level)}`)
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError(`A seed is an integer from 0 to ${0xffffffff}, not ${seed}`)
  }
  const { givens, solution } = generateWithTarget(GIVENS_TARGET[level], seed)
  return { level, seed, givens, solution }
}
```

- [ ] **Step 4: Append to `packages/sudoku-core/src/index.ts`** (keep every existing line)

```ts
export { generate, GIVENS_TARGET, LEVELS } from './generator'
export type { Level, Puzzle } from './generator'
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm --filter @sudoku/core exec vitest run`
Expected: PASS. The 80 level/seed cases, the pins and the four time records. The time annotations show a few ms per level.

If the pin of hard seed 42 fails, the code differs from the prototype. Do not change the expected strings. Compare `random.ts` and `generator.ts` with this plan character by character.

- [ ] **Step 6: Lint, typecheck, format**

Run: `just format`, then `just lint` and `just typecheck`.
Expected: "All checks passed!", no dependency violations, typecheck exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/sudoku-core/src/generator.ts packages/sudoku-core/src/generator.test.ts packages/sudoku-core/src/index.ts
git commit -m "feat(core): generate unique puzzles at four levels from a seed (#35)"
```

---

### Task 3: ADR-011 amendment for v1

**Files:**
- Modify: `docs/architecture/adr/adr-011-puzzle-generation-and-hints.md` (new section before "## Consequences")
- Modify: `docs/architecture/00-DECISIONS.md` (row ADR-011)
- Modify: `docs/architecture/09-architecture-decisions.md` (row ADR-011)
- Modify: `docs/architecture/12-glossary.md` (row "Technique solver", new row "Seed")

Do not change the Decision section of ADR-011. AGENTS.md: amend, do not rewrite. The ADR status stays `Proposed`.

- [ ] **Step 1: Insert the amendment** before `## Consequences` in ADR-011

```markdown
## Amendment: v1 rules for the level and the hint (2026-10-12)

v1 does not build the technique solver. The game must be playable first. These rules apply
until the technique solver exists:

- **Level by givens.** The generator makes a full solution, then removes givens in a random
  order while the backtracking solver still finds exactly one solution. It stops at the target
  of the level: easy 40, medium 34, hard 29, expert 25 givens.
- **Seed.** A seed and a level name one puzzle. The same seed and level give the same puzzle on
  every device. The random source is mulberry32.
- **Hint.** A hint reveals one random empty or wrong cell (point 3, the fallback). It does not
  name an area or a technique yet.
- **No pool.** Generation takes less than 5 ms per puzzle on a Mac (median below 1 ms at every
  level). That is far below the 2 s of QR-12, so v1 has no pool (point 4). The pool returns when
  a level takes more than 1 s.
- **Scanned puzzles** get no level in v1 (point 5).
- Grading by technique comes back with #53. Hints that teach come back with #45.
- Consequence: two puzzles at the same level can differ a lot in difficulty, because the number
  of givens is a poor measure (see Context). v1 accepts this.
```

- [ ] **Step 2: Add a reassessment trigger** at the end of `## Reassessment Triggers`

```markdown
- Players find that the levels of v1 do not match the difficulty they feel. Bring grading by
  technique forward.
```

- [ ] **Step 3: Update the ADR-011 row in `00-DECISIONS.md`**

Replace the Decision text of the ADR-011 row with:

```
Generate on the device. A technique solver grades difficulty and gives hints, later. v1: the level comes from the number of givens, a hint reveals a random cell, no pool (amendment 2026-10-12).
```

- [ ] **Step 4: Update the ADR-011 row in `09-architecture-decisions.md`**

Replace the Decision text of the ADR-011 row with:

```
On-device generation. A technique solver grades difficulty and gives hints, with reveal-a-cell as fallback. A pool of 3 per level. v1: level by number of givens, a random-cell hint, no pool (amendment 2026-10-12)
```

- [ ] **Step 5: Glossary**

Replace the row "Technique solver":

```markdown
| Technique solver | The solver in `@sudoku/core` that will solve like a person. It will grade difficulty and give hints (ADR-011). v1 does not have it |
```

Add this row after the row "Solution":

```markdown
| Seed | An integer that names one generated puzzle. The same seed and level give the same puzzle on every device (ADR-011) |
```

Also add these three rows for #36 (saving), which runs in parallel. This wave gives the glossary to #35 only. Append them at the end of the table:

```markdown
| Game in progress | The one game that the app saves after every move, so the player can resume it. Starting a new game discards it (ADR-012) |
| History | The list of won and lost games: level, source, result, time played, mistakes, hints and date (ADR-012) |
| Best time | The shortest time played of a won game at one level |
```

The rows "Level" and "Hint" say "ADR-011 decides". That stays true after the amendment, so they do not change.

- [ ] **Step 6: Check the links**

Run: `just docs-check`
Expected: "0 broken link(s)".

- [ ] **Step 7: Commit**

```bash
git add docs/architecture
git commit -m "docs(adr): ADR-011 amendment, v1 level by givens and a random-cell hint (#35)"
```

---

### Task 4: Rebase, checks, pull request

- [ ] **Step 1: Rebase on the newest `develop`**

`git fetch origin`, then `git rebase origin/develop`. PR #57 (#49 game rules) may be merged by now. It appends lines to `packages/sudoku-core/src/index.ts`. On a conflict, keep every line of both sides: #49's game exports and Task 2's two generator lines.

- [ ] **Step 2: All checks**

Run: `just lint`, `just typecheck`, `just test-ts`, `just docs-check`.
Expected: every one passes. Paste the result lines into the PR body. The mobile App tests can time out on a cold Jest cache; rerun once before you report a failure.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feature/35-generator
gh pr create --base develop --title "feat(core): generate puzzles at four levels (#35)" --body-file <file>
```

The body: a short summary, the table of measured times from the test annotations, the givens targets, the note that no pool is needed, the check results and `Closes #35`.

- [ ] **Step 4: Tick the met criteria in #35** (`gh issue view 35 --json body`, edit the checkboxes, `gh issue edit 35 --body-file <file>`). All seven should be met. The pool criterion is met by the measurement: no level takes more than 1 s, so no pool is needed.

---

## Self-Review

- Spec coverage: criterion 1 (full solution, removal while unique) → Task 2. Criterion 2 (target per level) → Task 2 constants. Criterion 3 (same seed, same puzzle) → Tasks 1 and 2 pins. Criterion 4 (uniqueness and givens count on fixed seeds) → Task 2, 20 seeds × 4 levels. Criterion 5 (time per level, pool if > 1 s) → Task 2 time test and the measurement table. Criterion 6 (ADR-011 amendment) → Task 3. Criterion 7 (SUD-04) → Global Constraints; the core imports nothing outside itself.
- Type names: `Level`, `Puzzle`, `GIVENS_TARGET`, `LEVELS`, `generate`, `generateWithTarget`, `fullGrid`, `MAX_ATTEMPTS`, `createRandom`, `shuffled` are the same in every task. No package export collides with #49 (`Random`, `DIGITS` stay local).
- Review Focus: every line has a test in Task 2 (pin, bad seeds, unknown level, target 17, givens match the solution, two levels on one seed via the per-level seed loop).
