# Verify a Full Scanned Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a scan fills the whole grid, the correction screen offers Check instead of Play and Solve. Check says whether the grid is solved. A solved grid plays the solved pulse. A wrong grid marks the wrong cells.

**Architecture:** A pure `verifyGrid` function in `@sudoku/core` compares the entries with the unique solution of the printed digits. It falls back to rule marks when the printed digits have no unique solution. `checkPlay` returns the block `'full'` for a full grid. A `useVerify` hook holds the verify state. `CorrectionSummary` gets a full-grid state, `CorrectionCell` gets a corner hint and a pulse, and `CorrectionScreen` wires them. The pulse reuses the game's `pulseLook`, `waveOpacity` and `popScale`.

**Tech Stack:** Expo SDK 57, React Native 0.86, Reanimated 4.5.1, Unistyles 3.5, Jest with `@testing-library/react-native` 13.3, Vitest for `@sudoku/core`.

**Spec:** The design canvas "Check mode for a full grid" (https://claude.ai/artifact/DW1vJLBEyEK6casEuKL4so), four screens in Op-art. Concepts: `docs/architecture/00-concepts/scan-pipeline.md` ("Loading the result") and `docs/architecture/00-concepts/game-screen.md` (pulses).

## Decisions to confirm before Task 1

These differ from, or add to, the approved canvas. The developer confirms them or changes them.

1. **Name in code: "verify". Name on screen: "Check".** The correction screen already uses "check" for the per-cell check (`CorrectionCheck`, "N cells to check"). AGENTS.md rule 1 says one word, one meaning. The button label stays "Check", as designed. Code, tests and the glossary say "verify".
2. **The verify result updates live.** After the first tap on Check, an edit recomputes the result at once. The wrong state therefore has no "Check again" button. When the player fixes the last wrong cell, the solved pulse plays. If an edit empties a cell, the screen leaves verify mode and shows Play and Solve again.
3. **The solved buttons are "Scan another" and "Home".** The canvas says "New puzzle". On the scan screen that wording is unclear, and "Scan another" is the existing Retake action. "Home" calls `router.dismissTo('/')`.
4. **The check badge scales in. It does not draw its stroke.** A drawn stroke needs a Skia path animation. The scale-in keeps the badge simple and testable. A drawn stroke is a later polish.
5. **A third result, `clash`, covers a grid that the printed digits cannot judge.** The canvas shows two printed digits that clash (screen 4). It does not show printed digits with no unique solution. A full grid with no unique solution must not be a dead end, so it gets rule marks and the status "N cells clash".

## Global Constraints

- Rules in `AGENTS.md` and `apps/mobile/AGENTS.md` apply: folder layout, `@/` imports, `index.ts` re-exports only, no `../`.
- `@sudoku/core` is pure TypeScript with no React Native import (SUD-04). All rules live there.
- A cell reads no theme hook (ADR-015). Themed styles live in `<Name>.styles.ts` with `StyleSheet.create(theme => …)`.
- `tsconfig.base.json` sets `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. An optional prop that can receive `undefined` is typed `x?: T | undefined`.
- Scan data never leaves the device (SUD-02). This change adds no network call.
- Comments and commit messages follow the Simplified Technical English rules in `AGENTS.md`. No TODO comments.
- Branch from `origin/develop`. Name it `feature/<issue>-verify-full-grid`. Commits are Conventional Commits with `(#<issue>)`. Do not push or open the pull request until the developer asks.
- Before done: `just lint`, `just typecheck` and `just test-ts` pass. The iPhone check of Task 8 passes.

## Review Focus

1. **A full grid with a wrong digit must not be playable.** Before this change, `checkPlay` enabled Play for a full grid with one wrong entry. Task 2 changes that on purpose. The test `blocks a full grid, whatever its entries` pins it.
2. **A solved grid with no printed digit.** A page that the scanner reads as all handwritten has 0 givens. `solve` finds several solutions. The grid still counts as solved when every row, column and box holds 1 to 9. Task 1 tests this.
3. **Two swapped digits.** Swapping two entries of a row makes duplicates in the columns. Both cells differ from the solution. Task 1 tests that both get a hint.
4. **A given conflict wins.** Two printed digits that clash keep the existing "givens clash" state, with Check off. Task 2 tests that `checkPlay` returns `'conflict'` before `'full'`.
5. **An edit empties a cell.** The live result must stop, and Play and Solve must return. Task 3 tests that the result is `null` when the grid is not full.
6. **Reduce Motion.** The solved pulse must not run with Reduce Motion. The title still changes to "Solved". Task 5 tests this.

---

### Task 1: `verifyGrid` in `@sudoku/core`

**Files:**
- Create: `packages/sudoku-core/src/verify.ts`
- Create: `packages/sudoku-core/src/verify.test.ts`
- Modify: `packages/sudoku-core/src/index.ts`

**Interfaces:**
- Consumes: `solve(puzzle: readonly number[]): SolveResult` from `./solver`, and `ROWS`, `COLUMNS`, `BOXES` from `./units`.
- Produces:
  ```ts
  export type GridVerdict =
    | { status: 'solved' }
    | { status: 'wrong'; hints: Readonly<Record<number, number>> }
    | { status: 'clash'; cells: readonly number[] }
  export function verifyGrid(givens: readonly number[], entries: readonly number[]): GridVerdict
  ```
  `hints` maps a cell index to the digit of the solution. `cells` are the cell indexes that share a digit with another cell in a row, a column or a box.

- [ ] **Step 1: Write the failing test**

Create `packages/sudoku-core/src/verify.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { generate } from './generator'
import { verifyGrid } from './verify'

const puzzle = generate('medium', 11)
const zeros = puzzle.solution.map(() => 0)
const entriesOf = (digits: readonly number[]) => digits.map((digit, cell) => (puzzle.givens[cell] === 0 ? digit : 0))
const open = puzzle.givens.flatMap((digit, cell) => (digit === 0 ? [cell] : []))
const wrongDigit = (cell: number) => ((puzzle.solution[cell] ?? 0) % 9) + 1

describe('verifyGrid', () => {
  it('says solved for the givens and the right entries', () => {
    expect(verifyGrid(puzzle.givens, entriesOf(puzzle.solution))).toEqual({ status: 'solved' })
  })

  it('says solved for a full grid without a given, as a page read as all handwritten', () => {
    expect(verifyGrid(zeros, puzzle.solution)).toEqual({ status: 'solved' })
  })

  it('hints the solution digit of a wrong entry, and only of that entry', () => {
    const cell = open[0]!
    const entries = entriesOf(puzzle.solution)
    entries[cell] = wrongDigit(cell)
    expect(verifyGrid(puzzle.givens, entries)).toEqual({
      status: 'wrong',
      hints: { [cell]: puzzle.solution[cell] },
    })
  })

  it('hints both cells of two swapped entries in a row', () => {
    const [a, b] = open.filter((cell) => cell < 9)
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    const entries = entriesOf(puzzle.solution)
    entries[a!] = puzzle.solution[b!]!
    entries[b!] = puzzle.solution[a!]!
    expect(verifyGrid(puzzle.givens, entries)).toEqual({
      status: 'wrong',
      hints: { [a!]: puzzle.solution[a!], [b!]: puzzle.solution[b!] },
    })
  })

  it('marks the cells that break a rule when the givens have no unique solution', () => {
    const cell = 0
    const grid = [...puzzle.solution]
    grid[cell] = grid[1]!
    const verdict = verifyGrid(zeros, grid)
    expect(verdict.status).toBe('clash')
    if (verdict.status === 'clash') {
      expect(verdict.cells).toContain(0)
      expect(verdict.cells).toContain(1)
    }
  })

  it('throws a RangeError for a grid with an empty cell', () => {
    const entries = entriesOf(puzzle.solution)
    entries[open[0]!] = 0
    expect(() => verifyGrid(puzzle.givens, entries)).toThrow(RangeError)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @sudoku/core test -- verify`
Expected: FAIL with "Failed to resolve import './verify'".

- [ ] **Step 3: Write the minimal implementation**

Create `packages/sudoku-core/src/verify.ts`:

```ts
import { GRID_CELLS } from './grid'
import { solve } from './solver'
import { BOXES, COLUMNS, ROWS } from './units'

/**
 * wrong: the givens have one solution, and these entries differ from it. hints: cell index to solution digit.
 * clash: the givens cannot judge the grid, so these cells share a digit in a unit.
 */
export type GridVerdict =
  | { status: 'solved' }
  | { status: 'wrong'; hints: Readonly<Record<number, number>> }
  | { status: 'clash'; cells: readonly number[] }

const UNITS = [...ROWS, ...COLUMNS, ...BOXES]

function duplicateCells(grid: readonly number[]): number[] {
  const marked = new Set<number>()
  for (const unit of UNITS) {
    const seen = new Map<number, number>()
    for (const cell of unit) {
      const digit = grid[cell]!
      const first = seen.get(digit)
      if (first === undefined) {
        seen.set(digit, cell)
      } else {
        marked.add(first)
        marked.add(cell)
      }
    }
  }
  return [...marked].sort((a, b) => a - b)
}

/**
 * Judges a full grid. The printed digits (givens) are trusted and the handwritten digits (entries) are judged.
 * A grid that follows every rule is solved, whatever the givens are. Throws a RangeError when a cell holds neither.
 */
export function verifyGrid(givens: readonly number[], entries: readonly number[]): GridVerdict {
  const grid = Array.from({ length: GRID_CELLS }, (_, cell) => givens[cell] || entries[cell] || 0)
  const empty = grid.indexOf(0)
  if (empty !== -1) throw new RangeError(`Cell ${empty} is empty`)

  const cells = duplicateCells(grid)
  if (cells.length === 0) return { status: 'solved' }

  const solved = solve(givens)
  if (solved.count !== 1) return { status: 'clash', cells }
  const hints: Record<number, number> = {}
  solved.solution.forEach((digit, cell) => {
    if (grid[cell] !== digit) hints[cell] = digit
  })
  return { status: 'wrong', hints }
}
```

Add to `packages/sudoku-core/src/index.ts`, after the `solve` export line:

```ts
export { verifyGrid, type GridVerdict } from './verify'
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @sudoku/core test`
Expected: PASS, all suites, including the new `verify.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/sudoku-core/src/verify.ts packages/sudoku-core/src/verify.test.ts packages/sudoku-core/src/index.ts
git commit -m "feat(core): add verifyGrid for a full grid (#<issue>)"
```

---

### Task 2: `checkPlay` returns the block `'full'`

**Files:**
- Modify: `apps/mobile/src/scan/utils/play.utils.ts:4-35`
- Modify: `apps/mobile/src/scan/utils/play.utils.test.ts:76-87`
- Modify: `apps/mobile/src/scan/screens/CorrectionScreen/CorrectionScreen.constants.ts:17-22`

**Interfaces:**
- Consumes: `CorrectedGrid` from `@/scan/utils/correctionEdit.utils`.
- Produces: `PlayBlock = 'conflict' | 'none' | 'several' | 'full'`. `checkPlay` returns `{ ok: false, block: 'full' }` for a grid with no empty cell, after the conflict check and before the solver.

- [ ] **Step 1: Write the failing tests**

In `play.utils.test.ts`, replace the two tests `blocks a grid that the givens and the entries fill` and `does not block a full grid with one wrong entry` with:

```ts
  it('blocks a full grid, whatever its entries', () => {
    const right = puzzle.solution.map((digit, cell) => (puzzle.givens[cell] === 0 ? digit : 0))
    expect(checkPlay(gridOf(puzzle.givens, right), NO_CONFLICTS)).toEqual({ ok: false, block: 'full' })
    const wrong = right.map((digit, cell) => (cell === open ? wrongDigit : digit))
    expect(checkPlay(gridOf(puzzle.givens, wrong), NO_CONFLICTS)).toEqual({ ok: false, block: 'full' })
  })

  it('blocks a full grid that has no given, as a page read as all handwritten', () => {
    expect(checkPlay(gridOf(EMPTY, puzzle.solution), NO_CONFLICTS)).toEqual({ ok: false, block: 'full' })
  })

  it('reports a given conflict before a full grid', () => {
    const conflicts = NO_CONFLICTS.map((_, cell) => cell === 0 || cell === 1)
    expect(checkPlay(gridOf(puzzle.solution), conflicts)).toEqual({ ok: false, block: 'conflict' })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter mobile test -- play.utils`
Expected: FAIL. The first test gets `block: 'solved'`, and the second gets `block: 'several'`.

- [ ] **Step 3: Implement**

In `play.utils.ts`:

```ts
/** Why "Play this puzzle" stays off. none and several: the number of solutions of the givens. full: no cell is empty, so there is nothing to play. */
export type PlayBlock = 'conflict' | 'none' | 'several' | 'full'
```

In `checkPlay`, replace the body after the conflict line with:

```ts
  if (conflicts.some(Boolean)) return { ok: false, block: 'conflict' }
  // A full grid has nothing to play. The screen offers verify, and verifyGrid judges it (a wrong entry is a mistake here).
  if (grid.givens.every((digit, cell) => digit !== 0 || grid.entries[cell] !== 0)) return { ok: false, block: 'full' }
  const solved = solve(grid.givens)
  if (solved.count === 0) return { ok: false, block: 'none' }
  if (solved.count === 2) return { ok: false, block: 'several' }
  const { solution } = solved
  return {
    ok: true,
    start: { level: levelOf(grid.givens), puzzle: { givens: grid.givens, solution, entries: grid.entries } },
  }
```

In `CorrectionScreen.constants.ts`, change the `solved` row of `PLAY_BLOCK_TEXT`:

```ts
  full: null,
```

Also update the comment above the table: `A given conflict and a full grid have none: their status line and their marks say it.`

- [ ] **Step 4: Run the tests and the typecheck**

Run: `pnpm --filter mobile test -- play.utils && pnpm --filter mobile typecheck`
Expected: PASS. The typecheck fails if any other file still uses `'solved'` as a `PlayBlock`. Fix each hit. `git grep -n "'solved'" -- apps/mobile/src` lists them.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/scan
git commit -m "feat(scan): block Play on a full grid (#<issue>)"
```

---

### Task 3: `useVerify` hook

**Files:**
- Create: `apps/mobile/src/scan/hooks/useVerify/useVerify.ts`
- Create: `apps/mobile/src/scan/hooks/useVerify/useVerify.test.ts`
- Create: `apps/mobile/src/scan/hooks/useVerify/index.ts`

**Interfaces:**
- Consumes: `verifyGrid`, `GridVerdict` from `@sudoku/core`. `CorrectedGrid` from `@/scan/utils/correctionEdit.utils`.
- Produces:
  ```ts
  export type Verify = {
    /** null while the grid is not full, or the player has not tapped Check. */
    verdict: GridVerdict | null
    verify(): void
  }
  export function useVerify(grid: CorrectedGrid, full: boolean): Verify
  ```
  `full` is true when `checkPlay` returns the block `'full'`. The verdict follows the grid live once the player taps Check. It becomes `null` when `full` turns false. The tap state resets then.

- [ ] **Step 1: Write the failing test**

```ts
import { act, renderHook } from '@testing-library/react-native'
import { generate } from '@sudoku/core'
import type { CorrectedGrid } from '@/scan/utils/correctionEdit.utils'
import { useVerify } from './useVerify'

const puzzle = generate('medium', 11)
const open = puzzle.givens.findIndex((digit) => digit === 0)
const fullGrid = (): CorrectedGrid => ({
  givens: [...puzzle.givens],
  entries: puzzle.solution.map((digit, cell) => (puzzle.givens[cell] === 0 ? digit : 0)),
})

it('gives no verdict before the player taps Check', () => {
  const { result } = renderHook(() => useVerify(fullGrid(), true))
  expect(result.current.verdict).toBeNull()
})

it('gives the verdict after a tap, and follows later edits', () => {
  const { result, rerender } = renderHook(({ grid }: { grid: CorrectedGrid }) => useVerify(grid, true), {
    initialProps: { grid: fullGrid() },
  })
  act(() => result.current.verify())
  expect(result.current.verdict).toEqual({ status: 'solved' })

  const wrong = fullGrid()
  wrong.entries[open] = ((puzzle.solution[open] ?? 0) % 9) + 1
  rerender({ grid: wrong })
  expect(result.current.verdict).toEqual({ status: 'wrong', hints: { [open]: puzzle.solution[open] } })

  rerender({ grid: fullGrid() })
  expect(result.current.verdict).toEqual({ status: 'solved' })
})

it('gives no verdict while the grid is not full, and forgets the tap', () => {
  const { result, rerender } = renderHook(
    ({ grid, full }: { grid: CorrectedGrid; full: boolean }) => useVerify(grid, full),
    { initialProps: { grid: fullGrid(), full: true } },
  )
  act(() => result.current.verify())
  const emptied = fullGrid()
  emptied.entries[open] = 0
  rerender({ grid: emptied, full: false })
  expect(result.current.verdict).toBeNull()

  rerender({ grid: fullGrid(), full: true })
  expect(result.current.verdict).toBeNull()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter mobile test -- useVerify`
Expected: FAIL with "Cannot find module './useVerify'".

- [ ] **Step 3: Implement**

`useVerify.ts`:

```ts
import { useEffect, useMemo, useState } from 'react'
import { verifyGrid, type GridVerdict } from '@sudoku/core'
import type { CorrectedGrid } from '@/scan/utils/correctionEdit.utils'

export type Verify = {
  verdict: GridVerdict | null
  verify(): void
}

/**
 * The verify state of a full grid. After the first tap the verdict follows every edit, so fixing the last wrong cell
 * solves the grid. The solver runs only for a full grid that the player verified, never per key.
 */
export function useVerify(grid: CorrectedGrid, full: boolean): Verify {
  const [tapped, setTapped] = useState(false)
  useEffect(() => {
    if (!full) setTapped(false)
  }, [full])
  const verdict = useMemo(
    () => (tapped && full ? verifyGrid(grid.givens, grid.entries) : null),
    [tapped, full, grid],
  )
  return useMemo(() => ({ verdict, verify: () => setTapped(true) }), [verdict])
}
```

`index.ts`:

```ts
export { useVerify, type Verify } from './useVerify'
```

If the test file needs JSX-free hooks only, keep the name `useVerify.test.ts`. Match the neighbouring hooks if they use `.test.tsx`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter mobile test -- useVerify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/scan/hooks/useVerify
git commit -m "feat(scan): add the useVerify hook (#<issue>)"
```

---

### Task 4: `CorrectionCell` corner hint

**Files:**
- Modify: `apps/mobile/src/scan/components/CorrectionCell/CorrectionCell.tsx`
- Modify: `apps/mobile/src/scan/components/CorrectionCell/CorrectionCell.styles.ts`
- Modify: `apps/mobile/src/scan/components/CorrectionCell/CorrectionCell.test.tsx`

**Interfaces:**
- Consumes: the existing props.
- Produces: a new prop `hint?: string` on `CorrectionCell`. Empty string means none. The hint is the solution digit of a wrong cell. It renders in the top-right corner with the note type role. testID `correction-hint-${n}`.

- [ ] **Step 1: Write the failing tests**

Append to `CorrectionCell.test.tsx`:

```tsx
it('draws the solution digit of a wrong cell in the corner, and keeps the digit of the player', () => {
  render(<CorrectionCell n={0} look={look} conflict hint="2" {...at} />)
  expect(screen.getByTestId('correction-cell-0')).toHaveTextContent('7')
  expect(screen.getByTestId('correction-hint-0')).toHaveTextContent('2')
  expect(StyleSheet.flatten(screen.getByTestId('correction-hint-0').props.style)).toMatchObject({
    color: daylight.colors.textMuted,
    position: 'absolute',
  })
})

it('draws no hint without one', () => {
  render(<CorrectionCell n={0} look={look} {...at} />)
  expect(screen.queryByTestId('correction-hint-0')).toBeNull()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter mobile test -- CorrectionCell`
Expected: FAIL. `correction-hint-0` does not exist.

- [ ] **Step 3: Implement**

In `CorrectionCell.styles.ts`, add after `confidenceLow`:

```ts
  // The note role and the note corner: a hint reads as a small note of the solution, never as a digit of the player.
  hint: {
    ...roleFont(theme.type.note),
    position: 'absolute',
    top: theme.size.noteInset,
    right: theme.size.noteInset,
    color: theme.colors.textMuted,
  },
```

In `CorrectionCell.tsx`: add the prop and the node.

```tsx
  /** The solution digit of a wrong cell, drawn small in the corner. Empty for none. */
  hint?: string
```

Destructure `hint = ''` next to `solution = ''`. Add after the solution `Animated.Text` block:

```tsx
        {hint !== '' && (
          <Text testID={`correction-hint-${n}`} style={styles.hint}>
            {hint}
          </Text>
        )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter mobile test -- CorrectionCell`
Expected: PASS. The contrast test (`theme/contrast.test.ts`) already covers muted text on the conflict fill only if a pair exists. Add this pair to `TEXT_PAIRS` in `apps/mobile/src/theme/contrast.test.ts`:

```ts
  ['muted on conflict fill', (t) => t.colors.textMuted, (t) => t.components.cell.conflictFill],
```

Run: `pnpm --filter mobile test -- contrast`
Expected: PASS for all four themes. If a theme fails, darken `textMuted` for that hint only: do not change `textMuted` globally. Tell the developer which theme failed.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/scan/components/CorrectionCell apps/mobile/src/theme/contrast.test.ts
git commit -m "feat(scan): show the solution digit of a wrong cell as a hint (#<issue>)"
```

---

### Task 5: Solved pulse

**Files:**
- Create: `apps/mobile/src/scan/utils/solvedPulse.utils.ts`
- Create: `apps/mobile/src/scan/utils/solvedPulse.utils.test.ts`
- Create: `apps/mobile/src/scan/hooks/useSolvedPulse/useSolvedPulse.ts`
- Create: `apps/mobile/src/scan/hooks/useSolvedPulse/useSolvedPulse.test.tsx`
- Create: `apps/mobile/src/scan/hooks/useSolvedPulse/index.ts`
- Modify: `apps/mobile/src/scan/components/CorrectionCell/CorrectionCell.tsx`, `CorrectionCell.styles.ts`, `CorrectionCell.test.tsx`

**Interfaces:**
- Consumes: `Pulse` from `@/game/hooks/usePulse`. `pulseLook`, `pulseDuration`, `waveOpacity`, `popScale` from `@/game/utils/pulse.utils`. `NO_PULSE` from `@/game/constants/pulse.constants`.
- Produces:
  ```ts
  export const CENTRE_CELL = 40
  export function solvedDelays(stepMs: number): number[]   // 81 delays in ms, steps from CENTRE_CELL
  export function useSolvedPulse(active: boolean): Pulse
  ```
  `CorrectionCell` gets `pulse?: Pulse`. With a pulse it draws a wave overlay (`testID correction-wave-${n}`) and scales its digit.

- [ ] **Step 1: Write the failing util test**

`solvedPulse.utils.test.ts`:

```ts
import { CENTRE_CELL, solvedDelays } from './solvedPulse.utils'

describe('solvedDelays', () => {
  it('starts at the centre cell and adds one step for each cell of distance', () => {
    const delays = solvedDelays(45)
    expect(delays).toHaveLength(81)
    expect(delays[CENTRE_CELL]).toBe(0)
    expect(delays[CENTRE_CELL + 1]).toBe(45)
    expect(delays[CENTRE_CELL + 9]).toBe(45)
    expect(delays[0]).toBe(8 * 45)
    expect(delays[80]).toBe(8 * 45)
  })
})
```

- [ ] **Step 2: Run it, see it fail**

Run: `pnpm --filter mobile test -- solvedPulse.utils`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the util**

```ts
import { GRID_CELLS } from '@sudoku/core'

/** The middle cell of the grid. The solved pulse starts here (the design canvas, "Check: solved"). */
export const CENTRE_CELL = 40

/** One delay in ms for each cell: stepMs for each row and column step away from the centre cell. */
export function solvedDelays(stepMs: number): number[] {
  const row = Math.floor(CENTRE_CELL / 9)
  const column = CENTRE_CELL % 9
  return Array.from(
    { length: GRID_CELLS },
    (_, cell) => (Math.abs(Math.floor(cell / 9) - row) + Math.abs((cell % 9) - column)) * stepMs,
  )
}
```

Run: `pnpm --filter mobile test -- solvedPulse.utils`. Expected: PASS.

- [ ] **Step 4: Write the failing hook test**

Open `apps/mobile/src/game/hooks/usePulse/usePulse.test.tsx` first. Copy its `AccessibilityInfo` and `useReducedMotion` setup (lines 1 to 50). The new test file is:

```tsx
import { renderHook } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { NO_PULSE } from '@/game/constants/pulse.constants'
import { pulseLook } from '@/game/utils/pulse.utils'
import { daylight } from '@/theme/themes/daylight'
import { solvedDelays } from '@/scan/utils/solvedPulse.utils'
import { useSolvedPulse } from './useSolvedPulse'

const STEP = pulseLook(daylight).stepMs

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(async () => false)
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(
    () => ({ remove: jest.fn() }) as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>,
  )
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.mocked(useReducedMotion).mockReturnValue(false)
})

it('stays still while inactive', () => {
  const { result } = renderHook(() => useSolvedPulse(false))
  expect(result.current.delays.get().every((delay) => delay === NO_PULSE)).toBe(true)
})

it('pulses out from the centre when it becomes active', () => {
  const { result, rerender } = renderHook(({ active }: { active: boolean }) => useSolvedPulse(active), {
    initialProps: { active: false },
  })
  rerender({ active: true })
  expect(result.current.delays.get()).toEqual(solvedDelays(STEP))
})

it('does not pulse with Reduce Motion', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(async () => true)
  const { result, rerender } = renderHook(({ active }: { active: boolean }) => useSolvedPulse(active), {
    initialProps: { active: false },
  })
  rerender({ active: true })
  expect(result.current.delays.get().every((delay) => delay === NO_PULSE)).toBe(true)
})
```

- [ ] **Step 5: Run it, see it fail**

Run: `pnpm --filter mobile test -- useSolvedPulse`
Expected: FAIL, module not found.

- [ ] **Step 6: Implement the hook**

```ts
import { useEffect, useMemo, useRef } from 'react'
import { AccessibilityInfo } from 'react-native'
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { UnistylesRuntime } from 'react-native-unistyles'
import { GRID_CELLS } from '@sudoku/core'
import { NO_PULSE } from '@/game/constants/pulse.constants'
import type { Pulse } from '@/game/hooks/usePulse'
import { pulseDuration, pulseLook, type PulseLook } from '@/game/utils/pulse.utils'
import { solvedDelays } from '@/scan/utils/solvedPulse.utils'

const STILL: readonly number[] = Array.from({ length: GRID_CELLS }, () => NO_PULSE)

/**
 * The pulse of a solved scan: it starts when `active` turns true, from the centre cell, with the theme tokens of the game pulse.
 * Reduce Motion keeps it still. The hook reads the live setting like usePulse does, because Reanimated reads it at app start only.
 */
export function useSolvedPulse(active: boolean): Pulse {
  const delays = useSharedValue<readonly number[]>(STILL)
  const elapsed = useSharedValue(0)
  const look = useSharedValue<PulseLook>(pulseLook(UnistylesRuntime.getTheme()))
  const reduceMotion = useRef(useReducedMotion())
  useEffect(() => {
    let mounted = true
    const follow = (enabled: boolean) => {
      reduceMotion.current = enabled
      if (!enabled) return
      cancelAnimation(elapsed)
      delays.set(STILL)
    }
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => mounted && follow(enabled))
      .catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', follow)
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [delays, elapsed])
  useEffect(() => {
    if (!active) {
      cancelAnimation(elapsed)
      delays.set(STILL)
      return
    }
    if (reduceMotion.current) return
    const next = pulseLook(UnistylesRuntime.getTheme())
    const nextDelays = solvedDelays(next.stepMs)
    const end = pulseDuration(nextDelays, next)
    cancelAnimation(elapsed)
    elapsed.set(0)
    look.set(next)
    delays.set(nextDelays)
    elapsed.set(withTiming(end, { duration: end, easing: Easing.linear, reduceMotion: ReduceMotion.Never }))
  }, [active, delays, elapsed, look])
  return useMemo(() => ({ delays, elapsed, look }), [delays, elapsed, look])
}
```

`index.ts`: `export { useSolvedPulse } from './useSolvedPulse'`.

Run: `pnpm --filter mobile test -- useSolvedPulse`
Expected: PASS. If `Pulse` is not exported from `@/game/hooks/usePulse/index.ts`, export it there (`export type { Pulse } from './usePulse'`).

- [ ] **Step 7: Write the failing cell test**

Append to `CorrectionCell.test.tsx`. Read the pulse test in `game/components/Cell/Cell.test.tsx:60-90` and copy how it builds a `pulse` with shared values. The new test:

```tsx
it('draws a wave and pops its digit while the solved pulse runs', () => {
  const pulse = {
    delays: { get: () => Array.from({ length: 81 }, () => 0), set: jest.fn() },
    elapsed: { get: () => 0.35 * daylight.motion.long },
    look: { get: () => ({ stepMs: 45, waveMs: 700, popMs: 450, waveOpacity: 0.3, popScale: 1.3 }) },
  } as unknown as import('@/game/hooks/usePulse').Pulse
  render(<CorrectionCell n={0} look={given} pulse={pulse} {...at} />)
  expect(StyleSheet.flatten(screen.getByTestId('correction-wave-0').props.style).opacity).toBeCloseTo(0.3)
  expect(StyleSheet.flatten(screen.getByTestId('correction-cell-0').props.style).transform).toEqual([
    { scale: expect.closeTo(1.3, 1) },
  ])
})

it('draws no wave without a pulse', () => {
  render(<CorrectionCell n={0} look={given} {...at} />)
  expect(screen.queryByTestId('correction-wave-0')).toBeNull()
})
```

If the shared-value mock shape differs from the Cell test, match the Cell test: it is the proven one.

- [ ] **Step 8: Run, see it fail**

Run: `pnpm --filter mobile test -- CorrectionCell`
Expected: FAIL. `correction-wave-0` does not exist.

- [ ] **Step 9: Implement the cell pulse**

In `CorrectionCell.styles.ts` add:

```ts
  // The solved wave covers the cell and lies under the digit. Its opacity comes from the pulse.
  wave: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.accent },
```

In `CorrectionCell.tsx`:

- Import `NO_PULSE` from `@/game/constants/pulse.constants`, `type Pulse` from `@/game/hooks/usePulse`, `popScale`, `waveOpacity` from `@/game/utils/pulse.utils`.
- Add the prop `pulse?: Pulse | undefined` with the comment `/** The solved pulse of the grid. Without it, the cell stays still. */`.
- Inside the component, before `digitStyle`:

```tsx
  const { delays, elapsed, look: pulseLook } = pulse ?? {}
  const waveStyle = useAnimatedStyle(() => ({
    opacity: pulseLook ? waveOpacity(elapsed?.get() ?? 0, delays?.get()[n] ?? NO_PULSE, pulseLook.get()) : 0,
  }))
```

- In `digitStyle`, extend the returned transform:

```tsx
    const pop = pulseLook ? popScale(elapsed?.get() ?? 0, delays?.get()[n] ?? NO_PULSE, pulseLook.get()) : 1
    return { opacity: alpha * picked, transform: [{ translateY: rise }, { scale: pop }] }
```

  Then change the test expectation in Step 7 to match the transform array: `[{ translateY: expect.any(Number) }, { scale: expect.closeTo(1.3, 1) }]`.
- Draw the wave before the digit, inside the `Pressable`, after the fill block:

```tsx
        {pulse && <Animated.View testID={`correction-wave-${n}`} pointerEvents="none" style={[styles.wave, waveStyle]} />}
```

- [ ] **Step 10: Run the tests**

Run: `pnpm --filter mobile test -- CorrectionCell useSolvedPulse solvedPulse`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/mobile/src/scan apps/mobile/src/game/hooks/usePulse
git commit -m "feat(scan): add the solved pulse to the correction cell (#<issue>)"
```

---

### Task 6: `CorrectionSummary` full-grid state

**Files:**
- Modify: `apps/mobile/src/scan/components/CorrectionSummary/CorrectionSummary.tsx`
- Modify: `apps/mobile/src/scan/components/CorrectionSummary/CorrectionSummary.styles.ts`
- Create: `apps/mobile/src/scan/components/CorrectionSummary/CorrectionSummary.test.tsx`
- Modify: `apps/mobile/src/game/components/Icon/Icon.constants.ts` (a `check` icon)

**Interfaces:**
- Consumes: `PanelButton` (props `testID`, `label`, `kind`, `grow`, `disabled`, `onPress`).
- Produces: a new optional prop on `CorrectionSummary`:
  ```ts
  /** Set for a full grid. phase 'ready': the player has not tapped Check. */
  full?: {
    phase: 'ready' | 'wrong' | 'clash' | 'solved'
    /** The cells to show in the status: wrong or clashing cells. */
    count: number
    onVerify(): void
    onScanAnother(): void
    onHome(): void
  } | null
  ```
  Status precedence: `toCheck > 0`, then `conflictCount > 0`, then `full`, then the existing `blocked` and `ready`. With `full` set, the buttons row shows these buttons instead of Play and Solve:
  - `ready`: `testID="verify"`, label "Check", primary, grows. `disabled` while `conflictCount > 0`.
  - `wrong` and `clash`: no buttons.
  - `solved`: `testID="scan-another"` label "Scan another" (primary, grows) and `testID="home"` label "Home" (second).

  Status text: `ready` "Grid is full". `wrong` "N cell(s) differ" with a sample cell glyph. `clash` "N cells clash". `solved`: no status text.

- [ ] **Step 1: Write the failing tests**

Create `CorrectionSummary.test.tsx`. Use the render pattern of `CorrectionCell.test.tsx` (plain `render`, themes from the Unistyles mock):

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { CorrectionSummary } from './CorrectionSummary'

const base = {
  toCheck: 0,
  conflictCount: 0,
  level: 'Hard',
  blockText: null,
  canPlay: false,
  animate: false,
  canSolve: false,
  solutionShown: false,
  onStartCheck: jest.fn(),
  onToggleSolve: jest.fn(),
} as const
const handlers = () => ({ onVerify: jest.fn(), onScanAnother: jest.fn(), onHome: jest.fn() })

it('offers one Check button for a full grid that the player has not checked', () => {
  const full = { phase: 'ready', count: 0, ...handlers() } as const
  render(<CorrectionSummary {...base} full={full} />)
  expect(screen.getByText('Grid is full')).toBeTruthy()
  expect(screen.queryByTestId('play')).toBeNull()
  expect(screen.queryByTestId('solve')).toBeNull()
  fireEvent.press(screen.getByTestId('verify'))
  expect(full.onVerify).toHaveBeenCalledTimes(1)
})

it('keeps Check off while two given digits clash', () => {
  render(<CorrectionSummary {...base} conflictCount={2} full={{ phase: 'ready', count: 0, ...handlers() }} />)
  expect(screen.getByText('2 givens clash')).toBeTruthy()
  expect(screen.getByTestId('verify').props.accessibilityState).toMatchObject({ disabled: true })
})

it('says how many cells differ, with no button', () => {
  render(<CorrectionSummary {...base} full={{ phase: 'wrong', count: 2, ...handlers() }} />)
  expect(screen.getByText('2 cells differ')).toBeTruthy()
  expect(screen.queryByTestId('verify')).toBeNull()
})

it('says one cell differs in the singular', () => {
  render(<CorrectionSummary {...base} full={{ phase: 'wrong', count: 1, ...handlers() }} />)
  expect(screen.getByText('1 cell differs')).toBeTruthy()
})

it('says how many cells clash', () => {
  render(<CorrectionSummary {...base} full={{ phase: 'clash', count: 4, ...handlers() }} />)
  expect(screen.getByText('4 cells clash')).toBeTruthy()
})

it('offers Scan another and Home for a solved grid', () => {
  const full = { phase: 'solved', count: 0, ...handlers() } as const
  render(<CorrectionSummary {...base} full={full} />)
  fireEvent.press(screen.getByTestId('scan-another'))
  fireEvent.press(screen.getByTestId('home'))
  expect(full.onScanAnother).toHaveBeenCalledTimes(1)
  expect(full.onHome).toHaveBeenCalledTimes(1)
})

it('still shows Play and Solve without a full grid', () => {
  render(<CorrectionSummary {...base} />)
  expect(screen.getByTestId('play')).toBeTruthy()
  expect(screen.getByTestId('solve')).toBeTruthy()
})
```

- [ ] **Step 2: Run, see it fail**

Run: `pnpm --filter mobile test -- CorrectionSummary`
Expected: FAIL. The prop `full` is unknown, and `Grid is full` does not render.

- [ ] **Step 3: Implement**

In `CorrectionSummary.tsx`:

- Add the `full` prop with the type above, exported as `FullGridPanel`.
- Extend `Status` with `'full'`. Compute it after `clash`: `else if (full != null) status = 'full'`, and keep `blocked` after it.
- In the status slot, add a branch before the final `<Text>`:

```tsx
          ) : full != null ? (
            <FullStatus phase={full.phase} count={full.count} />
```

- Add this component below `CorrectionSummary` in the same file (it is small and private):

```tsx
function FullStatus({ phase, count }: { phase: FullGridPanel['phase']; count: number }) {
  if (phase === 'solved') return null
  if (phase === 'ready') return <Text style={styles.status}>Grid is full</Text>
  const text = phase === 'wrong' ? `${count} ${count === 1 ? 'cell differs' : 'cells differ'}` : `${count} cells clash`
  return (
    <View style={styles.differ}>
      {phase === 'wrong' && <View testID="differ-sample" style={styles.sample} />}
      <Text style={[styles.status, styles.statusDanger]}>{text}</Text>
    </View>
  )
}
```

  A count of 1 for `clash` cannot happen: a clash has two cells at least.
- Hide the level label while `full != null`: `{full == null && <Text testID="correction-level" …>}`.
- Replace the buttons block with a branch on `full`:

```tsx
      {full != null ? (
        full.phase === 'wrong' || full.phase === 'clash' ? null : (
          <Animated.View {...(animate ? { entering: swapInButtons, layout: GLIDE } : {})} style={styles.buttons}>
            {full.phase === 'ready' ? (
              <PanelButton
                testID="verify"
                label="Check"
                kind="primary"
                grow
                disabled={conflictCount > 0}
                onPress={full.onVerify}
              />
            ) : (
              <>
                <PanelButton testID="scan-another" label="Scan another" kind="primary" grow onPress={full.onScanAnother} />
                <PanelButton testID="home" label="Home" kind="second" onPress={full.onHome} />
              </>
            )}
          </Animated.View>
        )
      ) : (
        /* the existing Play and Solve block, unchanged */
      )}
```

  Keep the existing `Animated.View` with `PanelButton testID="play"` and `testID="solve"` inside the `else` branch exactly as it is now. Do not retype it: move it.

In `CorrectionSummary.styles.ts` add:

```ts
  differ: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // A small sample of a wrong cell: the conflict fill and a corner note. It explains the marks without a sentence.
  sample: { width: 22, height: 22, backgroundColor: theme.components.cell.conflictFill },
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter mobile test -- CorrectionSummary`
Expected: PASS.

- [ ] **Step 5: Add the `check` icon**

`Icon.test.tsx` and `scripts/icons/*.test.mjs` define the icon rules. Read `Icon.constants.ts` and `scripts/icons` first. Add one entry in the existing style (24 × 24 stroke path):

```ts
  check: 'M5 12.5l4.5 4.5L19 7.5',
```

Run: `pnpm --filter mobile test -- Icon && node --test 'scripts/icons/*.test.mjs'`
Expected: PASS. If the script lists icon names elsewhere, add `check` there.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/scan/components/CorrectionSummary apps/mobile/src/game/components/Icon
git commit -m "feat(scan): show Check and the verify result in the correction panel (#<issue>)"
```

---

### Task 7: Wire it in `CorrectionScreen`

**Files:**
- Create: `apps/mobile/src/scan/components/SolvedBadge/SolvedBadge.tsx`, `SolvedBadge.styles.ts`, `SolvedBadge.test.tsx`, `index.ts`
- Modify: `apps/mobile/src/scan/screens/CorrectionScreen/CorrectionScreen.tsx`
- Modify: `apps/mobile/src/scan/screens/CorrectionScreen/CorrectionScreen.constants.ts`
- Modify: `apps/mobile/src/scan/screens/CorrectionScreen/CorrectionScreen.test.tsx`
- Modify: `apps/mobile/src/scan/screens/ScanFlow/ScanFlow.tsx`, `apps/mobile/src/scan/screens/CameraScreen/CameraScreen.tsx` (the `review` pick)

**Interfaces:**
- Consumes: `useVerify`, `useSolvedPulse`, `CorrectionSummary` with `full`, `CorrectionCell` with `hint` and `pulse`, `Icon name="check"`.
- Produces:
  - `SolvedBadge`: a square badge in `theme.colors.accent`, radius `theme.shape.radius.sm`, 40 × 40, with a `check` icon in `theme.colors.onAccent`. It enters with `ZoomIn` unless Reduce Motion is on. `testID="solved-badge"`.
  - `CorrectionProps` gains `onHome?: () => void`. `CameraScreen`'s `review` type is `Pick<CorrectionProps, 'onPlay' | 'onSave' | 'onHome'>`.
  - `CorrectionScreen.constants.ts` gains `SOLVED_TITLE = 'Solved'`.

- [ ] **Step 1: Write the failing badge test**

```tsx
import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { daylight } from '@/theme/themes/daylight'
import { SolvedBadge } from './SolvedBadge'

it('is a square in the accent colour with an accessible name', () => {
  render(<SolvedBadge />)
  const badge = screen.getByTestId('solved-badge')
  expect(StyleSheet.flatten(badge.props.style)).toMatchObject({ backgroundColor: daylight.colors.accent })
  expect(badge.props.accessibilityLabel).toBe('Solved')
})
```

- [ ] **Step 2: Run it, see it fail**

Run: `pnpm --filter mobile test -- SolvedBadge`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the badge**

`SolvedBadge.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  badge: {
    width: theme.size.touch - 4,
    height: theme.size.touch - 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.shape.radius.sm,
    backgroundColor: theme.colors.accent,
  },
}))
```

`SolvedBadge.tsx`:

```tsx
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated'
import { Icon } from '@/game/components/Icon'
import { easeOut } from '@/utils/motion.utils'
import { styles } from './SolvedBadge.styles'

const IN = ZoomIn.duration(280).easing(easeOut).delay(300)

/** The mark of a solved scan, in the title block. With Reduce Motion it appears at once. */
export function SolvedBadge() {
  return (
    <Animated.View
      testID="solved-badge"
      accessibilityRole="image"
      accessibilityLabel="Solved"
      entering={IN.reduceMotion(ReduceMotion.System)}
      style={styles.badge}
    >
      <Icon name="check" tone="onAccent" />
    </Animated.View>
  )
}
```

`index.ts`: `export { SolvedBadge } from './SolvedBadge'`. If `Icon` has no `onAccent` tone, read `Icon.tsx` for the tone names and use the one that maps to `theme.colors.onAccent`, or add `onAccent` to the tone map in the same style. Use `theme.shape` and `theme.motion` values for the duration instead of 280 if a token fits (`theme.motion.medium` is 280): read it through `useUnistyles`? The badge is not a cell, so it may read the theme: replace `280` with `theme.motion.medium`.

Run: `pnpm --filter mobile test -- SolvedBadge`. Expected: PASS.

- [ ] **Step 4: Write the failing screen tests**

Append to `CorrectionScreen.test.tsx`, in a new `describe('CorrectionScreen with a full grid')`. Use `okResult` with 81 cells that make a full grid. Build it from a generated puzzle:

```tsx
const puzzle = generate('medium', 11)
const fullCells = (wrong?: { cell: number; digit: number }) => {
  const over: { [n: number]: Partial<CellResult> } = {}
  puzzle.solution.forEach((digit, n) => {
    const printed = puzzle.givens[n] !== 0
    over[n] = { digit: wrong?.cell === n ? wrong.digit : digit, kind: printed ? 'printed' : 'handwritten', confidence: 1 }
  })
  return okResult(over)
}
const open = puzzle.givens.findIndex((digit) => digit === 0)
const wrongDigit = ((puzzle.solution[open] ?? 0) % 9) + 1

describe('CorrectionScreen with a full grid', () => {
  it('offers Check, and no Play or Solve', () => {
    render(<CorrectionScreen result={fullCells()} layout={layout} onRetake={jest.fn()} onPlay={jest.fn()} />)
    expect(screen.getByTestId('verify')).toBeTruthy()
    expect(screen.queryByTestId('play')).toBeNull()
    expect(screen.queryByTestId('solve')).toBeNull()
  })

  it('shows Solved, the badge and the buttons when the grid is right', () => {
    render(<CorrectionScreen result={fullCells()} layout={layout} onRetake={jest.fn()} onHome={jest.fn()} />)
    fireEvent.press(screen.getByTestId('verify'))
    expect(screen.getByText('Solved')).toBeTruthy()
    expect(screen.getByTestId('solved-badge')).toBeTruthy()
    expect(screen.getByTestId('scan-another')).toBeTruthy()
    expect(screen.getByTestId('correction-wave-0')).toBeTruthy()
  })

  it('marks a wrong entry with the conflict fill and the hint, and keeps its digit', () => {
    render(<CorrectionScreen result={fullCells({ cell: open, digit: wrongDigit })} layout={layout} onRetake={jest.fn()} />)
    fireEvent.press(screen.getByTestId('verify'))
    expect(screen.getByText('1 cell differs')).toBeTruthy()
    expect(screen.getByTestId(`correction-hint-${open}`)).toHaveTextContent(String(puzzle.solution[open]))
    expect(screen.getByTestId(`correction-cell-${open}`)).toHaveTextContent(String(wrongDigit))
    expect(screen.getByTestId(`correction-fill-${open}`)).toBeTruthy()
  })

  it('marks no cell before the player taps Check', () => {
    render(<CorrectionScreen result={fullCells({ cell: open, digit: wrongDigit })} layout={layout} onRetake={jest.fn()} />)
    expect(screen.queryByTestId(`correction-hint-${open}`)).toBeNull()
    expect(screen.queryByTestId(`correction-fill-${open}`)).toBeNull()
  })

  it('plays the success haptic once when the grid turns solved', async () => {
    render(<CorrectionScreen result={fullCells()} layout={layout} onRetake={jest.fn()} />)
    jest.mocked(Haptics.notificationAsync).mockClear()
    fireEvent.press(screen.getByTestId('verify'))
    await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1))
  })

  it('does not mark a cell for a grid that is not full', () => {
    render(<CorrectionScreen result={okResult({ 0: given })} layout={layout} onRetake={jest.fn()} />)
    expect(screen.queryByTestId('verify')).toBeNull()
  })
})
```

Check the exact Haptics mock call in the existing tests of this file (`play('success')` maps to a `Haptics` call) and mirror its assertion. Do not invent the call name.

- [ ] **Step 5: Run, see them fail**

Run: `pnpm --filter mobile test -- CorrectionScreen`
Expected: FAIL. `verify` does not exist.

- [ ] **Step 6: Implement the wiring**

In `CorrectionScreen.constants.ts`: `export const SOLVED_TITLE = 'Solved'`.

In `CorrectionScreen.tsx`:

1. Imports: `useVerify`, `useSolvedPulse`, `SolvedBadge`, `SOLVED_TITLE`.
2. Add the prop `onHome?: (() => void) | undefined` to `CorrectionProps`, with the comment `/** Home, on the solved panel. */`, and destructure it.
3. After `const canPlay = …`:

```tsx
  const full = check !== null && !check.ok && check.block === 'full'
  const { verdict, verify } = useVerify(corrected, full)
  const solved = verdict?.status === 'solved'
  const pulse = useSolvedPulse(solved)
  // The cells to mark: the wrong entries of the unique solution, or the cells that break a rule.
  const marked = useMemo<ReadonlySet<number>>(() => {
    if (verdict?.status === 'wrong') return new Set(Object.keys(verdict.hints).map(Number))
    if (verdict?.status === 'clash') return new Set(verdict.cells)
    return new Set()
  }, [verdict])
  const fullPanel = useMemo(
    () =>
      full
        ? {
            phase: verdict === null ? ('ready' as const) : verdict.status,
            count: marked.size,
            onVerify: verify,
            onScanAnother: () => onRetake(looks),
            onHome: () => onHome?.(),
          }
        : null,
    [full, verdict, marked, verify, onRetake, looks, onHome],
  )
```

   Move `useVerify` and `useSolvedPulse` calls above any early return. Hooks stay unconditional.
4. Success haptic: extend the existing `readyBefore` effect pattern with a second effect:

```tsx
  const solvedBefore = useRef(false)
  useEffect(() => {
    if (solved && !solvedBefore.current) play('success')
    solvedBefore.current = solved
  }, [solved, play])
```

5. The title: replace both uses of `{TITLE}` in the large title and the bar with `{solved ? SOLVED_TITLE : TITLE}`. In the large title block, render `{solved && <SolvedBadge />}` next to `<ThemeDecoration slot="titleMark" />`. When `largeTitle` is false (a theme without a title block), show the badge in the bar's `barEnd` view instead: `{solved && !largeTitle && <SolvedBadge />}`.
6. The cell props: change `conflict` and add `hint` and `pulse`:

```tsx
          conflict={editable && ((conflicts[n] ?? false) || marked.has(n))}
          hint={verdict?.status === 'wrong' ? String(verdict.hints[n] ?? '') : ''}
          pulse={solved ? pulse : undefined}
```

7. The summary: pass `full={fullPanel}`. Also pass `canSolve={start !== null}` as before.
8. A tap on a marked cell opens the existing check sheet. No new code is needed: `onSelect={editable ? actions.select : undefined}` stays.

In `ScanFlow.tsx`, add Home to the review props. Add `const router = useRouter()` (from `expo-router`), `const home = useCallback(() => router.dismissTo('/'), [router])`, and pass `onHome: home` in `reviewProps`. In `CameraScreen.tsx` change the type of `review` to `Pick<CorrectionProps, 'onPlay' | 'onSave' | 'onHome'>`, and make sure the object reaches `CorrectionScreen` as it does today (`git grep -n "review" apps/mobile/src/scan/screens/CameraScreen/CameraScreen.tsx` shows the line that spreads it). Add a `ScanFlow.test.tsx` case that renders the flow in review with a full result, taps Check then Home, and expects `router.dismissTo` to be called with `'/'`. Use the router mock that `ScanFlow.test.tsx` already sets up.

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter mobile test -- CorrectionScreen ScanFlow SolvedBadge CorrectionSummary useVerify`
Expected: PASS.

- [ ] **Step 8: Run lint and the typecheck**

Run: `just lint && just typecheck`
Expected: PASS. Fix hits. A comment in any new file follows the AGENTS.md rules: no repeat of the name, no TODO.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src
git commit -m "feat(scan): verify a full scanned grid on the correction screen (#<issue>)"
```

---

### Task 8: Documentation and the iPhone check

**Files:**
- Modify: `docs/architecture/00-concepts/scan-pipeline.md` ("Loading the result" table)
- Modify: `docs/architecture/00-concepts/game-screen.md` (the Pulses section, one sentence)
- Modify: `docs/architecture/12-glossary.md`

- [ ] **Step 1: Update the play gate table**

In `scan-pipeline.md`, replace the row `The givens and the entries fill the grid | Yes | "This puzzle is already solved."` with:

```
| The givens and the entries fill the grid | Yes. The panel offers Check | "Grid is full" |
```

Add this paragraph under the table, after the paragraph that starts "A scanned game takes the level":

```
A full grid has nothing to play, so the correction screen verifies it. The player taps Check. `verifyGrid` in `@sudoku/core` trusts the printed digits and judges the handwritten digits.

| Result | When | The screen shows |
| --- | --- | --- |
| Solved | Every row, column and box holds 1 to 9 | The title "Solved", a badge and the solved pulse. The buttons are Scan another and Home |
| Wrong | The printed digits have one solution, and an entry differs | The conflict fill on each wrong entry, with the solution digit small in the corner. The status counts the cells |
| Clash | The printed digits have no unique solution, and cells share a digit in a unit | The conflict fill on those cells. The status counts the cells |

After the first tap, each edit updates the result. An edit that empties a cell brings back Play and Solve.
```

- [ ] **Step 2: Update the pulse concept**

In `game-screen.md`, add to the Pulses section one sentence: `The correction screen plays the same pulse across the whole grid from the centre cell when a scanned grid verifies as solved.`

- [ ] **Step 3: Add the glossary entry**

Add this row to `12-glossary.md`:

```
| Verify | The check of a full scanned grid. `verifyGrid` says solved, wrong or clash. The button says "Check". "Check" in code means the per-cell check of an uncertain cell |
```

- [ ] **Step 4: Check every relative link in the changed docs**

Run: `git diff --name-only -- docs | xargs grep -n "](\./\|](\.\./" | head -40`
Expected: each link target exists. Fix any that do not.

- [ ] **Step 5: Run the whole suite**

Run: `just lint && just typecheck && just test-ts`
Expected: PASS.

- [ ] **Step 6: Check on the iPhone**

Use the notes in the memory file `iphone-build-environment.md` for `DEVELOPER_DIR`, Metro and `CI=1`. Scan a sudoku that is fully solved on paper. Check each line and tell the developer the result:

1. The panel shows "Grid is full" and one Check button. Play and Solve are gone.
2. Check on a right grid: the pulse spreads from the centre, the digits pop, the title reads "Solved", the badge scales in, and the success haptic plays once. Scan another and Home work.
3. Scan a grid with one wrong handwritten digit. The cell has the conflict fill and a small solution digit. The status reads "1 cell differs". Tap the cell, correct it, and close the sheet: the pulse plays.
4. Clear a cell of a full grid. Play and Solve return.
5. Turn Reduce Motion on. The pulse does not run. The title and the badge still show.
6. Check the corner hint at the real size in Daylight, Midnight, Op-art and Progressive. Report any theme where it is hard to read.
7. Scan a grid with two printed digits that clash. The status reads "2 givens clash". Check is off.

- [ ] **Step 7: Commit**

```bash
git add docs
git commit -m "docs: describe verifying a full scanned grid (#<issue>)"
```

---

## Self-review

**Spec coverage.** Check button instead of Play and Solve: Tasks 2, 6, 7. Marks and corner hint for wrong cells: Tasks 1, 4, 7. Solved animation (pulse, digit pop, badge, title): Tasks 5, 7. Printed against handwritten distinction: Task 1 (`verifyGrid` trusts the givens). Less text: Task 6 (one status line, no sentence). Op-art and reuse of components: Tasks 4 to 7 reuse `PanelButton`, `CorrectionSummary`, `CorrectionCell`, `pulseLook`, `waveOpacity`, `popScale` and the theme tokens. The canvas shows the waves of the panel edge as still: no task animates them. Two canvas items are not built as drawn: the stroke draw of the badge check (Decision 4) and the "Check again" button (Decision 2).

**Placeholder scan.** `<issue>` in commit messages stands for the GitHub issue number. The developer approves the issue first (AGENTS.md, Work tracking). No other placeholder.

**Type consistency.** `GridVerdict` (Task 1) feeds `useVerify` (Task 3) and `CorrectionScreen` (Task 7). `PlayBlock` `'full'` (Task 2) feeds `full` in Task 7. `Pulse` is reused in Tasks 5 and 7. `FullGridPanel.phase` equals `GridVerdict['status']` plus `'ready'`, and Task 7 builds it that way. The test ids `verify`, `scan-another`, `home`, `correction-hint-N` and `correction-wave-N` match between Tasks 4 to 7.

**Open risks the executor must read.**
- Task 5, Step 7 and Task 7, Step 4 copy mock shapes from existing tests. Read `Cell.test.tsx` and the existing `CorrectionScreen.test.tsx` haptic assertions first.
- Task 7 touches `CameraScreen.tsx` without a full read of it. Read the file before editing.
- Task 4 may fail the contrast test in one theme. The plan says what to do.
