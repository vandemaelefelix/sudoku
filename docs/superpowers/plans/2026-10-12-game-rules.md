# Game Rules (#49) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@sudoku/core` holds one immutable model of a game in progress, with every rule of issue #49 as a pure function, covered by Vitest.

**Architecture:** A `Game` is a plain, readonly value. Each action is a pure function that takes a game and returns a new game. The edit actions (place, toggle a note, erase, undo, hint) return a `MoveResult`: the new game plus a `Completion` report. The core never reads a clock or `Math.random`: the app passes the elapsed time to `tick()` and a random source to `hint()`. The game gets its solution as input and does not use the solver of #48.

**Tech Stack:** TypeScript 6 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, target ES2022), Vitest 5, pnpm workspace, oxlint, oxfmt, dependency-cruiser.

**Spec:** GitHub issue #49 (`gh issue view 49`). Details the issue leaves open follow the design canvas prototype `project/Main.dc.html` of https://claude.ai/artifact/U23JHiGA1Pq3HJX6oMiBF4. The coordinator has read it. The relevant rules are copied into this plan, so the implementer does not need the canvas.

## Global Constraints

- SUD-04: `@sudoku/core` MUST NOT depend on React Native, Expo or any I/O. No `Date`, no `Math.random`, no `setTimeout` in `src/`.
- Branch `feature/49-game-rules` from `origin/develop`, in its own worktree. Pull request against `develop`, never `main`. Body holds `Closes #49`.
- Commits follow Conventional Commits with `(#49)`, for example `feat(core): add the game model (#49)`.
- Do not create `packages/sudoku-core/src/types.ts` or `src/solver.ts`. Issue #48 owns them and runs in parallel.
- `packages/sudoku-core/src/index.ts` is shared with #48. Only append the export lines of this plan. Do not reorder or rewrite the existing lines. The second pull request to merge rebases and keeps both sets of lines.
- No `export *`, no barrel files (`oxc/no-barrel-file` threshold 0). Do not create `src/game/index.ts`. Only `src/index.ts`, the package entry, re-exports by name.
- Do not edit `docs/architecture/12-glossary.md`. The epic docs pull request owns it.
- Comments follow the root `AGENTS.md`: only facts the code cannot show, no TODO/FIXME, no issue numbers in comments, Simplified Technical English.
- Use the glossary words: **given** (a locked digit of the puzzle), **entry** (a digit the player filled in, editable), **notes** (small pencil marks). Cells are indexed 0 to 80, row-major. `0` marks an empty cell.
- Before the pull request: `just lint`, `just typecheck` and `just test-ts` pass from the repository root.

## Rules decided for details the issue leaves open

These come from the canvas prototype. The implementer follows them exactly.

1. Placing the number that the selected cell already holds clears the cell. This is not a mistake.
2. A placed number empties the notes of its own cell and removes that number from the notes of its row, column and box. This applies to a wrong number too.
3. Notes stay sorted. A note toggles only on a cell without a given or an entry.
4. While the game is paused, lost or won, every action except `resume` (from paused) returns the game unchanged. This includes `select`.
5. **The core refuses a number whose nine are all placed correctly** (the prototype disables that key). `place` returns the game unchanged. As a result, placing that number again on its own correct cell does not clear it. `erase` still clears it.
6. A wrong entry stays on the grid after the mistake is counted. A wrong entry on top of another entry counts again.
7. Undo restores the entries and the notes before the last edit action. It never changes the mistakes, the hints used, the selected cell or the time. Undo keeps at most 100 steps.
8. Hint picks one cell at random from the cells that are empty or wrong, fills the correct number, selects that cell and counts one hint. It is never a mistake. Undo can take back the entry of a hint, but not the hint count.
9. Entries given to `createGame` (handwritten digits from a scan) are not mistakes, even when wrong. They are not undo steps: undo cannot remove them. Erase and hint treat them as normal entries.
10. Only `place` and `hint` report completions. The report names only what this action completed (a unit that was complete before is not repeated). A unit, a number or the grid counts as complete only when every value in it is correct.
11. When the last correct number fills the grid, the status becomes `won`. When the third mistake happens, the status becomes `lost`.

## Review Focus

1. **A wrong handwritten entry from a scan.** It must not count as a mistake, and `hint` must still pick it as a wrong cell. Test: Task 5, "hint picks a wrong entry from the start".
2. **A saved game from an older app, or a damaged one.** `fromSavedGame` must throw a `RangeError` and never return a half-built game. Test: Task 7, the "refuses" cases.
3. **Undo after a hint.** The entry goes back, the hint count stays. Test: Task 5, "undo takes back a hint entry but keeps the hint count".
4. **Taps after the game ended.** Every action returns the very same object when the game is lost or won. Test: Task 4, "a lost game refuses every edit", and Task 6.
5. **A very long game.** The undo steps stop at 100, so the saved object stays small. Test: Task 5, "keeps at most UNDO_LIMIT steps".

## File Structure

All paths are under `packages/sudoku-core/src/`. This plan owns every file in this list.

| File | Responsibility |
| --- | --- |
| `units.ts` | Rows, columns, boxes and peers of a cell. Pure lookup tables |
| `units.test.ts` | Tests of `units.ts` |
| `game/types.ts` | `Digit`, `GameStatus`, `Game`, `UndoStep`, `Completion`, `MoveResult`, `Random` |
| `game/constants.ts` | `MAX_MISTAKES`, `UNDO_LIMIT` |
| `game/samplePuzzle.ts` | The canvas puzzle and its solution, for tests only. Not exported from the package |
| `game/createGame.ts` | `createGame()` with input checks |
| `game/createGame.test.ts` | Tests of `createGame()` |
| `game/completion.ts` | `valueAt`, `isWrong`, `isSolved`, `completeDigits`, `completedBetween`, `DIGITS`, `NOTHING_COMPLETED` |
| `game/completion.test.ts` | Tests of `completion.ts` |
| `game/actions.ts` | `select`, `place`, `toggleNote`, `erase`, `undo`, `hint`, `pause`, `resume`, `tick` |
| `game/actions.test.ts` | Tests of `actions.ts` |
| `game/savedGame.ts` | `SavedGame`, `toSavedGame()`, `fromSavedGame()` |
| `game/savedGame.test.ts` | Tests of `savedGame.ts` |
| `index.ts` (shared with #48) | Append the export lines of Task 8 only |

`units.ts` sits beside `grid.ts`, not in `game/`, because the solver can use it later. #48 may write its own unit tables. A later issue can merge them. Do not import from #48's files.

---

### Task 0: Worktree

- [ ] **Step 1: Create the worktree and install**

The `rtk` hook can block `git` in a worktree session. Use `/usr/bin/git` if `git` is refused.

```bash
cd /Users/felix/projects/sudoku-18-dot-field
/usr/bin/git fetch origin
/usr/bin/git worktree add ../sudoku-49-game-rules -b feature/49-game-rules origin/develop
cd ../sudoku-49-game-rules
pnpm install
pnpm --filter @sudoku/core test
```

Expected: the existing `grid.test.ts` passes (3 tests). Work in `../sudoku-49-game-rules` from now on.

---

### Task 1: Units of the grid

**Files:**
- Create: `packages/sudoku-core/src/units.ts`
- Test: `packages/sudoku-core/src/units.test.ts`

**Interfaces:**
- Consumes: `GRID_CELLS` from `./grid`.
- Produces: `ROWS`, `COLUMNS`, `BOXES: readonly (readonly number[])[]` (9 units of 9 cell indices each, unit `k` is row/column/box `k`, boxes numbered left to right, top to bottom); `peersOf(cell: number): readonly number[]` (20 cells, sorted, without the cell itself).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { BOXES, COLUMNS, peersOf, ROWS } from './units'

describe('units', () => {
  it('has nine rows, columns and boxes of nine cells', () => {
    for (const units of [ROWS, COLUMNS, BOXES]) {
      expect(units).toHaveLength(9)
      for (const unit of units) expect(unit).toHaveLength(9)
    }
  })

  it('numbers the cells row by row', () => {
    expect(ROWS[1]).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17])
    expect(COLUMNS[2]).toEqual([2, 11, 20, 29, 38, 47, 56, 65, 74])
  })

  it('numbers the boxes left to right, then top to bottom', () => {
    expect(BOXES[0]).toEqual([0, 1, 2, 9, 10, 11, 18, 19, 20])
    expect(BOXES[4]).toEqual([30, 31, 32, 39, 40, 41, 48, 49, 50])
    expect(BOXES[8]).toEqual([60, 61, 62, 69, 70, 71, 78, 79, 80])
  })

  it('gives every cell 20 peers, without the cell itself', () => {
    for (let cell = 0; cell < 81; cell++) {
      const peers = peersOf(cell)
      expect(peers).toHaveLength(20)
      expect(peers).not.toContain(cell)
    }
  })

  it('takes the peers from the row, the column and the box', () => {
    expect(peersOf(0)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20, 27, 36, 45, 54, 63, 72])
  })
})
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm --filter @sudoku/core exec vitest run src/units.test.ts`
Expected: FAIL, "Failed to resolve import './units'".

- [ ] **Step 3: Write the implementation**

```ts
import { GRID_CELLS } from './grid'

const NINE = [0, 1, 2, 3, 4, 5, 6, 7, 8]

export const ROWS: readonly (readonly number[])[] = NINE.map((row) => NINE.map((k) => row * 9 + k))

export const COLUMNS: readonly (readonly number[])[] = NINE.map((column) => NINE.map((k) => k * 9 + column))

export const BOXES: readonly (readonly number[])[] = NINE.map((box) => {
  const top = Math.floor(box / 3) * 3
  const left = (box % 3) * 3
  return NINE.map((k) => (top + Math.floor(k / 3)) * 9 + left + (k % 3))
})

const PEERS: readonly (readonly number[])[] = Array.from({ length: GRID_CELLS }, (_, cell) => {
  const units = [ROWS, COLUMNS, BOXES].flatMap((all) => all.filter((unit) => unit.includes(cell)))
  return [...new Set(units.flat())].filter((other) => other !== cell).sort((a, b) => a - b)
})

/** The 20 other cells in the row, the column and the box of `cell`, sorted. */
export function peersOf(cell: number): readonly number[] {
  return PEERS[cell] ?? []
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm --filter @sudoku/core exec vitest run src/units.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add packages/sudoku-core/src/units.ts packages/sudoku-core/src/units.test.ts
/usr/bin/git commit -m "feat(core): add rows, columns, boxes and peers (#49)"
```

---

### Task 2: The game value and `createGame`

**Files:**
- Create: `packages/sudoku-core/src/game/types.ts`
- Create: `packages/sudoku-core/src/game/constants.ts`
- Create: `packages/sudoku-core/src/game/samplePuzzle.ts`
- Create: `packages/sudoku-core/src/game/createGame.ts`
- Create (stub, finished in Task 3): `packages/sudoku-core/src/game/completion.ts`
- Test: `packages/sudoku-core/src/game/createGame.test.ts`

**Interfaces:**
- Consumes: `GRID_CELLS`, `createEmptyGrid` from `../grid`.
- Produces:
  - `type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9`
  - `type GameStatus = 'playing' | 'paused' | 'lost' | 'won'`
  - `type UndoStep = { readonly entries: readonly number[]; readonly notes: readonly (readonly Digit[])[] }`
  - `type Game` (fields in the code below)
  - `type Completion`, `type MoveResult`, `type Random`
  - `MAX_MISTAKES = 3`, `UNDO_LIMIT = 100`
  - `type NewGame = { givens: readonly number[]; solution: readonly number[]; entries?: readonly number[] }`
  - `createGame(input: NewGame): Game`. Throws `RangeError` on bad input.
  - Test only: `SAMPLE_GIVENS`, `SAMPLE_SOLUTION: number[]`, `solvedExcept(...cells: number[]): number[]`

- [ ] **Step 1: Write the types, the constants and the sample puzzle**

`game/types.ts`:

```ts
export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** `lost` follows the third mistake. `won` follows the last correct number. */
export type GameStatus = 'playing' | 'paused' | 'lost' | 'won'

/** The entries and notes before one edit action. */
export type UndoStep = {
  readonly entries: readonly number[]
  readonly notes: readonly (readonly Digit[])[]
}

/** Every grid array has 81 cells, row by row. 0 marks an empty cell. */
export type Game = {
  readonly givens: readonly number[]
  readonly solution: readonly number[]
  /** 0 on every cell with a given. */
  readonly entries: readonly number[]
  /** Sorted. Empty on every cell with a given or an entry. */
  readonly notes: readonly (readonly Digit[])[]
  readonly selected: number | null
  readonly mistakes: number
  readonly hintsUsed: number
  /** Time played in milliseconds. Pauses and the time after the end do not count. */
  readonly playedMs: number
  readonly status: GameStatus
  /** Oldest first, at most UNDO_LIMIT steps. */
  readonly undoSteps: readonly UndoStep[]
}

/** What one action completed. Each list holds unit indices 0 to 8, or digits. */
export type Completion = {
  readonly rows: readonly number[]
  readonly columns: readonly number[]
  readonly boxes: readonly number[]
  readonly digits: readonly Digit[]
  readonly grid: boolean
}

export type MoveResult = {
  readonly game: Game
  readonly completed: Completion
}

/** Returns a number in [0, 1), as Math.random does. */
export type Random = () => number
```

`game/constants.ts`:

```ts
export const MAX_MISTAKES = 3

export const UNDO_LIMIT = 100
```

`game/samplePuzzle.ts`:

```ts
const parse = (text: string): number[] => [...text].map(Number)

/** The puzzle of the design canvas. Tests use it. The package does not export it. */
export const SAMPLE_GIVENS = parse(
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
)

export const SAMPLE_SOLUTION = parse(
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
)

/** Entries that fill every open cell with its solution, except `cells`. */
export function solvedExcept(...cells: number[]): number[] {
  return SAMPLE_SOLUTION.map((digit, cell) =>
    SAMPLE_GIVENS[cell] !== 0 || cells.includes(cell) ? 0 : digit,
  )
}
```

Useful facts of the sample: cell 1 is the given 3. Cell 2 is open, its solution is 4. Cell 3 is open, its solution is 6. Cell 40 is open, its solution is 5, and it is not a peer of cell 2. Warning: in `solvedExcept(...)` games, every number of a filled-in cell has all nine correct, so `place` refuses it. A test that wants a mistake there must place a number of a cell that `solvedExcept` left open.

- [ ] **Step 2: Write the failing test**

`game/createGame.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createGame } from './createGame'
import { SAMPLE_GIVENS, SAMPLE_SOLUTION, solvedExcept } from './samplePuzzle'

const base = { givens: SAMPLE_GIVENS, solution: SAMPLE_SOLUTION }

describe('createGame', () => {
  it('starts a game in play with no entries, notes, mistakes, hints or time', () => {
    const game = createGame(base)
    expect(game.status).toBe('playing')
    expect(game.entries.every((value) => value === 0)).toBe(true)
    expect(game.notes.every((cellNotes) => cellNotes.length === 0)).toBe(true)
    expect(game.selected).toBeNull()
    expect(game.mistakes).toBe(0)
    expect(game.hintsUsed).toBe(0)
    expect(game.playedMs).toBe(0)
    expect(game.undoSteps).toEqual([])
  })

  it('holds the givens and the solution', () => {
    const game = createGame(base)
    expect(game.givens).toEqual(SAMPLE_GIVENS)
    expect(game.solution).toEqual(SAMPLE_SOLUTION)
  })

  it('copies its input, so a later change outside does not reach the game', () => {
    const entries = solvedExcept(2)
    const game = createGame({ ...base, entries })
    entries[3] = 0
    expect(game.entries[3]).toBe(6)
  })

  it('accepts entries the player did not make, and counts no mistake for them', () => {
    const entries = solvedExcept()
    entries[2] = 1
    const game = createGame({ ...base, entries })
    expect(game.entries[2]).toBe(1)
    expect(game.mistakes).toBe(0)
    expect(game.undoSteps).toEqual([])
  })

  it('is won at once when the entries complete the grid', () => {
    expect(createGame({ ...base, entries: solvedExcept() }).status).toBe('won')
  })

  it('refuses a grid without 81 cells', () => {
    expect(() => createGame({ ...base, givens: [0] })).toThrow(RangeError)
  })

  it('refuses a value outside 0 to 9', () => {
    const givens = [...SAMPLE_GIVENS]
    givens[2] = 10
    expect(() => createGame({ ...base, givens })).toThrow(RangeError)
  })

  it('refuses a solution with an empty cell', () => {
    const solution = [...SAMPLE_SOLUTION]
    solution[0] = 0
    expect(() => createGame({ ...base, solution })).toThrow(RangeError)
  })

  it('refuses a given that differs from the solution', () => {
    const givens = [...SAMPLE_GIVENS]
    givens[0] = 6
    expect(() => createGame({ ...base, givens })).toThrow(RangeError)
  })

  it('refuses an entry on a cell with a given', () => {
    const entries = solvedExcept()
    entries[0] = 5
    expect(() => createGame({ ...base, entries })).toThrow(RangeError)
  })
})
```

- [ ] **Step 3: Run the test to see it fail**

Run: `pnpm --filter @sudoku/core exec vitest run src/game/createGame.test.ts`
Expected: FAIL, "Failed to resolve import './createGame'".

- [ ] **Step 4: Write the implementation**

`game/completion.ts` (only what `createGame` needs now; Task 3 adds the rest):

```ts
import type { Game } from './types'

export function valueAt(game: Game, cell: number): number {
  return (game.givens[cell] ?? 0) || (game.entries[cell] ?? 0)
}

function isCorrect(game: Game, cell: number): boolean {
  return valueAt(game, cell) === game.solution[cell]
}

export function isSolved(game: Game): boolean {
  return game.solution.every((_, cell) => isCorrect(game, cell))
}
```

`game/createGame.ts`:

```ts
import { createEmptyGrid, GRID_CELLS } from '../grid'
import { isSolved } from './completion'
import type { Game } from './types'

export type NewGame = {
  givens: readonly number[]
  solution: readonly number[]
  /** Entries the player did not make, such as handwritten digits from a scan. Never mistakes. */
  entries?: readonly number[]
}

/** Throws a RangeError when the grids do not fit together. */
export function createGame({ givens, solution, entries }: NewGame): Game {
  const start = entries ?? createEmptyGrid()
  checkCells('givens', givens, 0)
  checkCells('solution', solution, 1)
  checkCells('entries', start, 0)
  for (let cell = 0; cell < GRID_CELLS; cell++) {
    const given = givens[cell] ?? 0
    if (given !== 0 && given !== solution[cell]) {
      throw new RangeError(`The given ${given} in cell ${cell} differs from the solution`)
    }
    if (given !== 0 && start[cell] !== 0) {
      throw new RangeError(`Cell ${cell} has a given and an entry`)
    }
  }
  const game: Game = {
    givens: [...givens],
    solution: [...solution],
    entries: [...start],
    notes: start.map(() => []),
    selected: null,
    mistakes: 0,
    hintsUsed: 0,
    playedMs: 0,
    status: 'playing',
    undoSteps: [],
  }
  return isSolved(game) ? { ...game, status: 'won' } : game
}

function checkCells(name: string, cells: readonly number[], lowest: number): void {
  if (cells.length !== GRID_CELLS) {
    throw new RangeError(`The ${name} have ${cells.length} cells, not ${GRID_CELLS}`)
  }
  for (const value of cells) {
    if (!Number.isInteger(value) || value < lowest || value > 9) {
      throw new RangeError(`The ${name} hold ${value}, outside ${lowest} to 9`)
    }
  }
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm --filter @sudoku/core exec vitest run src/game/createGame.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add packages/sudoku-core/src/game
/usr/bin/git commit -m "feat(core): add the game value and createGame (#49)"
```

---

### Task 3: Completion

**Files:**
- Modify: `packages/sudoku-core/src/game/completion.ts`
- Test: `packages/sudoku-core/src/game/completion.test.ts`

**Interfaces:**
- Consumes: `ROWS`, `COLUMNS`, `BOXES` from `../units`; `Game`, `Digit`, `Completion` from `./types`.
- Produces: `DIGITS: readonly Digit[]`, `NOTHING_COMPLETED: Completion`, `valueAt(game, cell): number`, `isWrong(game, cell): boolean`, `isSolved(game): boolean`, `completeDigits(game): Digit[]`, `completedBetween(before: Game, after: Game): Completion`.

- [ ] **Step 1: Write the failing test**

`game/completion.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { completedBetween, completeDigits, isWrong, NOTHING_COMPLETED, valueAt } from './completion'
import { createGame } from './createGame'
import { SAMPLE_GIVENS, SAMPLE_SOLUTION, solvedExcept } from './samplePuzzle'

const withEntries = (entries: number[]) =>
  createGame({ givens: SAMPLE_GIVENS, solution: SAMPLE_SOLUTION, entries })

describe('valueAt and isWrong', () => {
  it('reads a given or an entry', () => {
    const entries = solvedExcept()
    entries[2] = 1
    const game = withEntries(entries)
    expect(valueAt(game, 1)).toBe(3)
    expect(valueAt(game, 2)).toBe(1)
    expect(isWrong(game, 2)).toBe(true)
    expect(isWrong(game, 3)).toBe(false)
  })
})

describe('completeDigits', () => {
  it('lists the numbers with all nine placed correctly', () => {
    expect(completeDigits(withEntries(solvedExcept(2)))).toEqual([1, 2, 3, 5, 6, 7, 8, 9])
  })

  it('does not count a wrong placement', () => {
    const entries = solvedExcept(2, 3)
    entries[3] = 4
    expect(completeDigits(withEntries(entries))).toEqual([1, 2, 3, 5, 7, 8, 9])
  })
})

describe('completedBetween', () => {
  it('reports the row, column, box, number and grid that the last cell completes', () => {
    expect(completedBetween(withEntries(solvedExcept(2)), withEntries(solvedExcept()))).toEqual({
      rows: [0],
      columns: [2],
      boxes: [0],
      digits: [4],
      grid: true,
    })
  })

  it('reports only what was not complete before', () => {
    const rowZero = SAMPLE_GIVENS.map(() => 0)
    for (const cell of [3, 5, 6, 7, 8]) rowZero[cell] = SAMPLE_SOLUTION[cell] ?? 0
    const after = [...rowZero]
    after[2] = 4
    expect(completedBetween(withEntries(rowZero), withEntries(after))).toEqual({
      ...NOTHING_COMPLETED,
      rows: [0],
    })
  })

  it('never reports a unit that holds a wrong number', () => {
    const after = solvedExcept()
    after[2] = 1
    expect(completedBetween(withEntries(solvedExcept(2)), withEntries(after))).toEqual(
      NOTHING_COMPLETED,
    )
  })
})
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm --filter @sudoku/core exec vitest run src/game/completion.test.ts`
Expected: FAIL, "completedBetween is not a function" or a missing export.

- [ ] **Step 3: Write the implementation**

Replace `game/completion.ts` with:

```ts
import { BOXES, COLUMNS, ROWS } from '../units'
import type { Completion, Digit, Game } from './types'

export const DIGITS: readonly Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export const NOTHING_COMPLETED: Completion = {
  rows: [],
  columns: [],
  boxes: [],
  digits: [],
  grid: false,
}

/** The given or the entry of a cell. 0 when the cell is empty. */
export function valueAt(game: Game, cell: number): number {
  return (game.givens[cell] ?? 0) || (game.entries[cell] ?? 0)
}

function isCorrect(game: Game, cell: number): boolean {
  return valueAt(game, cell) === game.solution[cell]
}

export function isWrong(game: Game, cell: number): boolean {
  return valueAt(game, cell) !== 0 && !isCorrect(game, cell)
}

export function isSolved(game: Game): boolean {
  return game.solution.every((_, cell) => isCorrect(game, cell))
}

/** The numbers with nine correct cells. A wrong placement does not count. */
export function completeDigits(game: Game): Digit[] {
  const counts = new Map<number, number>()
  game.solution.forEach((_, cell) => {
    if (isCorrect(game, cell)) {
      const value = valueAt(game, cell)
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  })
  return DIGITS.filter((digit) => counts.get(digit) === 9)
}

function completeUnits(game: Game, units: readonly (readonly number[])[]): number[] {
  return units.flatMap((cells, index) => (cells.every((cell) => isCorrect(game, cell)) ? [index] : []))
}

function added<T>(before: readonly T[], after: readonly T[]): T[] {
  return after.filter((item) => !before.includes(item))
}

/** What is complete in `after` and was not complete in `before`. */
export function completedBetween(before: Game, after: Game): Completion {
  return {
    rows: added(completeUnits(before, ROWS), completeUnits(after, ROWS)),
    columns: added(completeUnits(before, COLUMNS), completeUnits(after, COLUMNS)),
    boxes: added(completeUnits(before, BOXES), completeUnits(after, BOXES)),
    digits: added(completeDigits(before), completeDigits(after)),
    grid: !isSolved(before) && isSolved(after),
  }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter @sudoku/core test`
Expected: PASS, every test file.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add packages/sudoku-core/src/game/completion.ts packages/sudoku-core/src/game/completion.test.ts
/usr/bin/git commit -m "feat(core): report completed rows, columns, boxes and numbers (#49)"
```

---

### Task 4: Select, place, notes and erase

**Files:**
- Create: `packages/sudoku-core/src/game/actions.ts`
- Test: `packages/sudoku-core/src/game/actions.test.ts`

**Interfaces:**
- Consumes: `peersOf` from `../units`; `completeDigits`, `completedBetween`, `isSolved`, `NOTHING_COMPLETED` from `./completion`; `MAX_MISTAKES`, `UNDO_LIMIT` from `./constants`; types from `./types`.
- Produces:
  - `select(game: Game, cell: number | null): Game`. Throws `RangeError` for a cell outside 0 to 80.
  - `place(game: Game, digit: Digit): MoveResult`
  - `toggleNote(game: Game, digit: Digit): MoveResult`
  - `erase(game: Game): MoveResult`
  - An action that changes nothing returns `{ game, completed: NOTHING_COMPLETED }` with the very same `game` object, so the app can compare with `===`.

- [ ] **Step 1: Write the failing test**

`game/actions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { erase, place, select, toggleNote } from './actions'
import { NOTHING_COMPLETED } from './completion'
import { createGame } from './createGame'
import { SAMPLE_GIVENS, SAMPLE_SOLUTION, solvedExcept } from './samplePuzzle'
import type { Digit, Game } from './types'

const newGame = (entries?: number[]): Game =>
  createGame({ givens: SAMPLE_GIVENS, solution: SAMPLE_SOLUTION, ...(entries ? { entries } : {}) })

const at = (cell: number, entries?: number[]): Game => select(newGame(entries), cell)

const placed = (game: Game, digit: Digit): Game => place(game, digit).game

const noted = (game: Game, ...digits: Digit[]): Game =>
  digits.reduce((current, digit) => toggleNote(current, digit).game, game)

describe('select', () => {
  it('selects a cell and clears the selection', () => {
    const game = at(40)
    expect(game.selected).toBe(40)
    expect(select(game, null).selected).toBeNull()
  })

  it('refuses a cell outside the grid', () => {
    expect(() => select(newGame(), 81)).toThrow(RangeError)
    expect(() => select(newGame(), 1.5)).toThrow(RangeError)
  })
})

describe('place', () => {
  it('places an entry in the selected cell', () => {
    const result = place(at(2), 4)
    expect(result.game.entries[2]).toBe(4)
    expect(result.game.mistakes).toBe(0)
  })

  it('does nothing without a selected cell', () => {
    const game = newGame()
    expect(place(game, 4).game).toBe(game)
  })

  it('cannot change a given', () => {
    const game = at(1)
    expect(place(game, 9)).toEqual({ game, completed: NOTHING_COMPLETED })
    expect(place(game, 9).game).toBe(game)
  })

  it('clears the cell when the same number is placed again, without a mistake', () => {
    const game = placed(placed(at(2), 1), 1)
    expect(game.entries[2]).toBe(0)
    expect(game.mistakes).toBe(1)
  })

  it('removes the placed number from the notes in its row, column and box', () => {
    let game = noted(at(3), 4, 7)
    game = noted(select(game, 40), 4)
    game = noted(select(game, 2), 4, 7)
    game = placed(game, 4)
    expect(game.notes[2]).toEqual([])
    expect(game.notes[3]).toEqual([7])
    expect(game.notes[40]).toEqual([4])
  })

  it('counts a wrong number as a mistake and keeps it on the grid', () => {
    const game = placed(at(2), 1)
    expect(game.mistakes).toBe(1)
    expect(game.entries[2]).toBe(1)
    expect(game.status).toBe('playing')
  })

  it('ends the game at the third mistake', () => {
    const game = placed(placed(placed(at(2), 1), 2), 3)
    expect(game.mistakes).toBe(3)
    expect(game.status).toBe('lost')
  })

  it('refuses a number whose nine are all placed correctly', () => {
    const game = at(3, solvedExcept(2, 3))
    expect(place(game, 9).game).toBe(game)
  })

  it('reports what the number completed and wins the game on the last cell', () => {
    const result = place(at(2, solvedExcept(2)), 4)
    expect(result.completed).toEqual({ rows: [0], columns: [2], boxes: [0], digits: [4], grid: true })
    expect(result.game.status).toBe('won')
  })

  it('reports nothing for a wrong number', () => {
    const result = place(at(2, solvedExcept(2, 3)), 6)
    expect(result.game.mistakes).toBe(1)
    expect(result.completed).toEqual(NOTHING_COMPLETED)
  })
})

describe('toggleNote', () => {
  it('keeps the notes of a cell sorted', () => {
    expect(noted(at(2), 7, 3).notes[2]).toEqual([3, 7])
  })

  it('removes a note that is already there', () => {
    expect(noted(at(2), 7, 3, 3).notes[2]).toEqual([7])
  })

  it('does nothing on a cell with an entry or a given', () => {
    const withEntry = placed(at(2), 4)
    expect(toggleNote(withEntry, 5).game).toBe(withEntry)
    const onGiven = at(1)
    expect(toggleNote(onGiven, 5).game).toBe(onGiven)
  })
})

describe('erase', () => {
  it('clears the entry and the notes of the selected cell', () => {
    expect(erase(placed(at(2), 4)).game.entries[2]).toBe(0)
    expect(erase(noted(at(2), 5)).game.notes[2]).toEqual([])
  })

  it('clears an entry the player did not make', () => {
    const entries = solvedExcept()
    entries[2] = 1
    expect(erase(at(2, entries)).game.entries[2]).toBe(0)
  })

  it('does nothing on a given or an empty cell', () => {
    const onGiven = at(1)
    expect(erase(onGiven).game).toBe(onGiven)
    const empty = at(2)
    expect(erase(empty).game).toBe(empty)
  })
})

describe('a lost game', () => {
  it('refuses every edit', () => {
    const lost = select(placed(placed(placed(at(2), 1), 2), 3), 3)
    expect(lost.status).toBe('lost')
    expect(place(lost, 6).game).toBe(lost)
    expect(toggleNote(lost, 6).game).toBe(lost)
    expect(erase(lost).game).toBe(lost)
    expect(select(lost, 40)).toBe(lost)
  })
})
```

Note for "a lost game": `select(lost, 3)` returns `lost` unchanged, because select does nothing after the end. The test still holds, because `lost.selected` stays 2.

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm --filter @sudoku/core exec vitest run src/game/actions.test.ts`
Expected: FAIL, "Failed to resolve import './actions'".

- [ ] **Step 3: Write the implementation**

`game/actions.ts`:

```ts
import { GRID_CELLS } from '../grid'
import { peersOf } from '../units'
import { completeDigits, completedBetween, isSolved, NOTHING_COMPLETED } from './completion'
import { MAX_MISTAKES, UNDO_LIMIT } from './constants'
import type { Digit, Game, MoveResult, UndoStep } from './types'

/** For an action that completes nothing. With the same game object, the action changed nothing. */
const noCompletion = (game: Game): MoveResult => ({ game, completed: NOTHING_COMPLETED })

function replaceAt<T>(items: readonly T[], index: number, value: T): T[] {
  const copy = [...items]
  copy[index] = value
  return copy
}

/** The selected cell when the player may change it, else null. */
function editableCell(game: Game): number | null {
  const cell = game.selected
  if (game.status !== 'playing' || cell === null || game.givens[cell] !== 0) return null
  return cell
}

function withUndoStep(game: Game): readonly UndoStep[] {
  return [...game.undoSteps, { entries: game.entries, notes: game.notes }].slice(-UNDO_LIMIT)
}

/** Puts `digit` in `cell`, empties its notes and removes `digit` from the notes of its peers. */
function withNumber(game: Game, cell: number, digit: Digit): Pick<Game, 'entries' | 'notes'> {
  const peers = new Set(peersOf(cell))
  return {
    entries: replaceAt(game.entries, cell, digit),
    notes: game.notes.map((cellNotes, other) => {
      if (other === cell) return []
      return peers.has(other) ? cellNotes.filter((note) => note !== digit) : cellNotes
    }),
  }
}

/** Wins the game when the grid is solved, and reports what `after` completed. */
function settle(before: Game, after: Game): MoveResult {
  const game: Game = isSolved(after) ? { ...after, status: 'won' } : after
  return { game, completed: completedBetween(before, game) }
}

export function select(game: Game, cell: number | null): Game {
  if (cell !== null && (!Number.isInteger(cell) || cell < 0 || cell >= GRID_CELLS)) {
    throw new RangeError(`Cell ${cell} is outside the grid`)
  }
  if (game.status !== 'playing' || game.selected === cell) return game
  return { ...game, selected: cell }
}

export function place(game: Game, digit: Digit): MoveResult {
  const cell = editableCell(game)
  if (cell === null || completeDigits(game).includes(digit)) return noCompletion(game)
  if (game.entries[cell] === digit) {
    return noCompletion({
      ...game,
      entries: replaceAt(game.entries, cell, 0),
      undoSteps: withUndoStep(game),
    })
  }
  const next: Game = { ...game, ...withNumber(game, cell, digit), undoSteps: withUndoStep(game) }
  if (digit !== game.solution[cell]) {
    const mistakes = game.mistakes + 1
    return noCompletion({ ...next, mistakes, status: mistakes >= MAX_MISTAKES ? 'lost' : 'playing' })
  }
  return settle(game, next)
}

export function toggleNote(game: Game, digit: Digit): MoveResult {
  const cell = editableCell(game)
  if (cell === null || game.entries[cell] !== 0) return noCompletion(game)
  const current = game.notes[cell] ?? []
  const cellNotes = current.includes(digit)
    ? current.filter((note) => note !== digit)
    : [...current, digit].sort((a, b) => a - b)
  return noCompletion({
    ...game,
    notes: replaceAt(game.notes, cell, cellNotes),
    undoSteps: withUndoStep(game),
  })
}

export function erase(game: Game): MoveResult {
  const cell = editableCell(game)
  if (cell === null || (game.entries[cell] === 0 && (game.notes[cell] ?? []).length === 0)) {
    return noCompletion(game)
  }
  return noCompletion({
    ...game,
    entries: replaceAt(game.entries, cell, 0),
    notes: replaceAt(game.notes, cell, []),
    undoSteps: withUndoStep(game),
  })
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm --filter @sudoku/core exec vitest run src/game/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add packages/sudoku-core/src/game/actions.ts packages/sudoku-core/src/game/actions.test.ts
/usr/bin/git commit -m "feat(core): select, place, notes and erase with mistakes (#49)"
```

---

### Task 5: Undo and hint

**Files:**
- Modify: `packages/sudoku-core/src/game/actions.ts`
- Modify: `packages/sudoku-core/src/game/actions.test.ts`

**Interfaces:**
- Consumes: Task 4 helpers in `actions.ts`; `UNDO_LIMIT`; `Random`.
- Produces:
  - `undo(game: Game): MoveResult`. Completion is always `NOTHING_COMPLETED`.
  - `hint(game: Game, random: Random): MoveResult`

- [ ] **Step 1: Write the failing tests**

Change the import lines of `actions.test.ts` to:

```ts
import { erase, hint, place, select, toggleNote, undo } from './actions'
import { UNDO_LIMIT } from './constants'
```

Append:

```ts
const first = () => 0
const last = () => 0.999_999

describe('undo', () => {
  it('takes back the entry but not the mistake', () => {
    const game = undo(placed(at(2), 1)).game
    expect(game.entries[2]).toBe(0)
    expect(game.mistakes).toBe(1)
  })

  it('brings back the notes that a placed number removed', () => {
    const game = undo(placed(noted(at(2), 4, 7), 4)).game
    expect(game.entries[2]).toBe(0)
    expect(game.notes[2]).toEqual([4, 7])
  })

  it('does nothing without a step to undo', () => {
    const game = at(2)
    expect(undo(game).game).toBe(game)
  })

  it('cannot remove an entry the player did not make', () => {
    const game = at(3, solvedExcept(2))
    expect(undo(game).game).toBe(game)
  })

  it('keeps at most UNDO_LIMIT steps', () => {
    let game = at(2)
    for (let step = 0; step <= UNDO_LIMIT; step++) game = toggleNote(game, 5).game
    expect(game.undoSteps).toHaveLength(UNDO_LIMIT)
  })

  it('takes back a hint entry but keeps the hint count', () => {
    const game = undo(hint(at(2), first).game).game
    expect(game.entries[2]).toBe(0)
    expect(game.hintsUsed).toBe(1)
  })
})

describe('hint', () => {
  const openCells = SAMPLE_GIVENS.flatMap((given, cell) => (given === 0 ? [cell] : []))

  it('fills a random open cell with its correct number and counts one hint', () => {
    const result = hint(newGame(), first)
    expect(result.game.entries[2]).toBe(4)
    expect(result.game.hintsUsed).toBe(1)
    expect(result.game.selected).toBe(2)
    expect(result.game.mistakes).toBe(0)
  })

  it('takes the cell from the random source', () => {
    const cell = openCells[openCells.length - 1] ?? -1
    const game = hint(newGame(), last).game
    expect(game.selected).toBe(cell)
    expect(game.entries[cell]).toBe(SAMPLE_SOLUTION[cell])
  })

  it('can pick a wrong cell and correct it, without a mistake', () => {
    const wrong = placed(at(3, solvedExcept(2, 3)), 4)
    const game = hint(wrong, last).game
    expect(game.entries[3]).toBe(6)
    expect(game.mistakes).toBe(1)
  })

  it('picks a wrong entry from the start', () => {
    const entries = solvedExcept()
    entries[3] = 1
    const game = hint(newGame(entries), first).game
    expect(game.entries[3]).toBe(6)
    expect(game.mistakes).toBe(0)
  })

  it('removes the number from the notes of its peers', () => {
    const game = hint(noted(at(3), 4), first).game
    expect(game.notes[3]).toEqual([])
  })

  it('reports what it completed and wins the game on the last cell', () => {
    const result = hint(newGame(solvedExcept(2)), first)
    expect(result.completed.grid).toBe(true)
    expect(result.game.status).toBe('won')
  })

  it('does nothing when the game is won', () => {
    const won = newGame(solvedExcept())
    expect(hint(won, first).game).toBe(won)
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm --filter @sudoku/core exec vitest run src/game/actions.test.ts`
Expected: FAIL, "hint is not a function" / "undo is not a function".

- [ ] **Step 3: Write the implementation**

Change the import of `completion` in `actions.ts` to:

```ts
import { completeDigits, completedBetween, isSolved, NOTHING_COMPLETED, valueAt } from './completion'
```

Change the type import to:

```ts
import type { Digit, Game, MoveResult, Random, UndoStep } from './types'
```

Append to `actions.ts`:

```ts
/** Undo never changes the mistakes, the hints used, the selected cell or the time. */
export function undo(game: Game): MoveResult {
  const step = game.undoSteps.at(-1)
  if (game.status !== 'playing' || step === undefined) return noCompletion(game)
  return noCompletion({
    ...game,
    entries: step.entries,
    notes: step.notes,
    undoSteps: game.undoSteps.slice(0, -1),
  })
}

/** Fills one random empty or wrong cell with its correct number. A hint is never a mistake. */
export function hint(game: Game, random: Random): MoveResult {
  if (game.status !== 'playing') return noCompletion(game)
  const open = game.solution.flatMap((digit, cell) => (valueAt(game, cell) === digit ? [] : [cell]))
  const cell = open[Math.min(open.length - 1, Math.floor(random() * open.length))]
  if (cell === undefined) return noCompletion(game)
  const digit = game.solution[cell] as Digit
  return settle(game, {
    ...game,
    ...withNumber(game, cell, digit),
    selected: cell,
    hintsUsed: game.hintsUsed + 1,
    undoSteps: withUndoStep(game),
  })
}
```

Note: `game.solution[cell] as Digit` is safe because `createGame` checks that every solution value is 1 to 9.

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter @sudoku/core exec vitest run src/game/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add packages/sudoku-core/src/game/actions.ts packages/sudoku-core/src/game/actions.test.ts
/usr/bin/git commit -m "feat(core): undo without taking back mistakes, and a random hint (#49)"
```

---

### Task 6: Pause, resume and time

**Files:**
- Modify: `packages/sudoku-core/src/game/actions.ts`
- Modify: `packages/sudoku-core/src/game/actions.test.ts`

**Interfaces:**
- Produces:
  - `pause(game: Game): Game` (playing → paused, else unchanged)
  - `resume(game: Game): Game` (paused → playing, else unchanged)
  - `tick(game: Game, elapsedMs: number): Game`. Adds `elapsedMs` only while playing. Ignores a value that is not finite or not above 0. The app measures the time; the core never reads a clock.

- [ ] **Step 1: Write the failing tests**

Change the first import line of `actions.test.ts` to:

```ts
import { erase, hint, pause, place, resume, select, tick, toggleNote, undo } from './actions'
```

Append:

```ts
describe('pause and resume', () => {
  it('pauses a game in play and resumes it', () => {
    const paused = pause(at(2))
    expect(paused.status).toBe('paused')
    expect(resume(paused).status).toBe('playing')
  })

  it('refuses every action except resume while paused', () => {
    const paused = pause(placed(at(2), 4))
    expect(select(paused, 40)).toBe(paused)
    expect(place(paused, 5).game).toBe(paused)
    expect(toggleNote(paused, 5).game).toBe(paused)
    expect(erase(paused).game).toBe(paused)
    expect(undo(paused).game).toBe(paused)
    expect(hint(paused, first).game).toBe(paused)
    expect(pause(paused)).toBe(paused)
  })

  it('cannot pause or resume a game that ended', () => {
    const won = newGame(solvedExcept())
    expect(pause(won)).toBe(won)
    expect(resume(won)).toBe(won)
  })
})

describe('tick', () => {
  it('adds the elapsed time while the game is in play', () => {
    expect(tick(tick(newGame(), 1000), 250).playedMs).toBe(1250)
  })

  it('does not count a pause', () => {
    const game = resume(tick(pause(tick(newGame(), 1000)), 5000))
    expect(game.playedMs).toBe(1000)
  })

  it('does not count after the game ended', () => {
    const lost = placed(placed(placed(at(2), 1), 2), 3)
    expect(tick(lost, 1000)).toBe(lost)
    const won = newGame(solvedExcept())
    expect(tick(won, 1000)).toBe(won)
  })

  it('ignores a time that is negative or not a number', () => {
    const game = newGame()
    expect(tick(game, -5)).toBe(game)
    expect(tick(game, Number.NaN)).toBe(game)
    expect(tick(game, Number.POSITIVE_INFINITY)).toBe(game)
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm --filter @sudoku/core exec vitest run src/game/actions.test.ts`
Expected: FAIL, "pause is not a function".

- [ ] **Step 3: Write the implementation**

Append to `actions.ts`:

```ts
export function pause(game: Game): Game {
  return game.status === 'playing' ? { ...game, status: 'paused' } : game
}

export function resume(game: Game): Game {
  return game.status === 'paused' ? { ...game, status: 'playing' } : game
}

export function tick(game: Game, elapsedMs: number): Game {
  if (game.status !== 'playing' || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return game
  return { ...game, playedMs: game.playedMs + elapsedMs }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter @sudoku/core exec vitest run src/game/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add packages/sudoku-core/src/game/actions.ts packages/sudoku-core/src/game/actions.test.ts
/usr/bin/git commit -m "feat(core): pause, resume and time played from outside the core (#49)"
```

---

### Task 7: Saved game

**Files:**
- Create: `packages/sudoku-core/src/game/savedGame.ts`
- Test: `packages/sudoku-core/src/game/savedGame.test.ts`

**Interfaces:**
- Consumes: `createGame`; `MAX_MISTAKES`, `UNDO_LIMIT`; `GRID_CELLS`; types.
- Produces:
  - `SAVED_GAME_VERSION = 1`
  - `type SavedGame` (JSON-safe, mutable arrays, `version: 1`)
  - `toSavedGame(game: Game): SavedGame`
  - `fromSavedGame(value: unknown): Game`. Throws `RangeError` on any value it cannot trust. #36 stores the result of `JSON.stringify(toSavedGame(game))`.

- [ ] **Step 1: Write the failing test**

`game/savedGame.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hint, pause, place, select, tick, toggleNote } from './actions'
import { createGame } from './createGame'
import { SAMPLE_GIVENS, SAMPLE_SOLUTION, solvedExcept } from './samplePuzzle'
import { fromSavedGame, SAVED_GAME_VERSION, toSavedGame } from './savedGame'

function gameInProgress() {
  const entries = solvedExcept(2, 3, 40)
  let game = select(createGame({ givens: SAMPLE_GIVENS, solution: SAMPLE_SOLUTION, entries }), 3)
  game = place(game, 4).game
  game = toggleNote(select(game, 40), 8).game
  game = hint(game, () => 0).game
  return pause(tick(game, 61_500))
}

const roundTrip = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

describe('saved game', () => {
  it('converts a game to a plain object and back', () => {
    const game = gameInProgress()
    expect(fromSavedGame(roundTrip(toSavedGame(game)))).toEqual(game)
  })

  it('writes the version', () => {
    expect(toSavedGame(gameInProgress()).version).toBe(SAVED_GAME_VERSION)
  })

  it('refuses a value that is not an object', () => {
    expect(() => fromSavedGame(null)).toThrow(RangeError)
    expect(() => fromSavedGame('game')).toThrow(RangeError)
  })

  it('refuses another version', () => {
    const saved = { ...toSavedGame(gameInProgress()), version: 2 }
    expect(() => fromSavedGame(saved)).toThrow(RangeError)
  })

  it('refuses grids that do not fit together', () => {
    const saved = toSavedGame(gameInProgress())
    saved.givens[0] = 9
    expect(() => fromSavedGame(saved)).toThrow(RangeError)
  })

  it('refuses notes that are not sorted digits', () => {
    const saved = toSavedGame(gameInProgress())
    saved.notes[40] = [8, 2]
    expect(() => fromSavedGame(saved)).toThrow(RangeError)
  })

  it('refuses an unknown status and counts out of range', () => {
    expect(() => fromSavedGame({ ...toSavedGame(gameInProgress()), status: 'done' })).toThrow(RangeError)
    expect(() => fromSavedGame({ ...toSavedGame(gameInProgress()), mistakes: 4 })).toThrow(RangeError)
    expect(() => fromSavedGame({ ...toSavedGame(gameInProgress()), playedMs: -1 })).toThrow(RangeError)
    expect(() => fromSavedGame({ ...toSavedGame(gameInProgress()), selected: 81 })).toThrow(RangeError)
  })

  it('refuses a damaged undo step', () => {
    const saved = toSavedGame(gameInProgress())
    saved.undoSteps[0] = { entries: [1], notes: [] }
    expect(() => fromSavedGame(saved)).toThrow(RangeError)
  })
})
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm --filter @sudoku/core exec vitest run src/game/savedGame.test.ts`
Expected: FAIL, "Failed to resolve import './savedGame'".

- [ ] **Step 3: Write the implementation**

`game/savedGame.ts`:

```ts
import { GRID_CELLS } from '../grid'
import { MAX_MISTAKES, UNDO_LIMIT } from './constants'
import { createGame } from './createGame'
import type { Digit, Game, GameStatus, UndoStep } from './types'

export const SAVED_GAME_VERSION = 1

/** A game as plain JSON data. Change SAVED_GAME_VERSION when this shape changes. */
export type SavedGame = {
  version: typeof SAVED_GAME_VERSION
  givens: number[]
  solution: number[]
  entries: number[]
  notes: number[][]
  selected: number | null
  mistakes: number
  hintsUsed: number
  playedMs: number
  status: GameStatus
  undoSteps: { entries: number[]; notes: number[][] }[]
}

const STATUSES: readonly GameStatus[] = ['playing', 'paused', 'lost', 'won']

export function toSavedGame(game: Game): SavedGame {
  return {
    version: SAVED_GAME_VERSION,
    givens: [...game.givens],
    solution: [...game.solution],
    entries: [...game.entries],
    notes: game.notes.map((cellNotes) => [...cellNotes]),
    selected: game.selected,
    mistakes: game.mistakes,
    hintsUsed: game.hintsUsed,
    playedMs: game.playedMs,
    status: game.status,
    undoSteps: game.undoSteps.map((step) => ({
      entries: [...step.entries],
      notes: step.notes.map((cellNotes) => [...cellNotes]),
    })),
  }
}

/** Throws a RangeError when `value` is not a valid saved game of this version. */
export function fromSavedGame(value: unknown): Game {
  const saved = record(value, 'The saved game')
  if (saved.version !== SAVED_GAME_VERSION) {
    throw new RangeError(`The saved game version ${String(saved.version)} is not ${SAVED_GAME_VERSION}`)
  }
  const board = createGame({
    givens: numbers(saved.givens, 'givens'),
    solution: numbers(saved.solution, 'solution'),
    entries: numbers(saved.entries, 'entries'),
  })
  const steps = list(saved.undoSteps, 'undoSteps')
  if (steps.length > UNDO_LIMIT) throw new RangeError(`More than ${UNDO_LIMIT} undo steps`)
  const undoSteps: UndoStep[] = steps.map((item, index) => {
    const step = record(item, `Undo step ${index}`)
    const entries = createGame({
      givens: board.givens,
      solution: board.solution,
      entries: numbers(step.entries, `undo step ${index} entries`),
    }).entries
    return { entries, notes: notes(step.notes, `undo step ${index} notes`) }
  })
  return {
    ...board,
    notes: notes(saved.notes, 'notes'),
    selected: saved.selected === null ? null : integer(saved.selected, 'selected', 0, GRID_CELLS - 1),
    mistakes: integer(saved.mistakes, 'mistakes', 0, MAX_MISTAKES),
    hintsUsed: integer(saved.hintsUsed, 'hintsUsed', 0, Number.MAX_SAFE_INTEGER),
    playedMs: duration(saved.playedMs),
    status: status(saved.status),
    undoSteps,
  }
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RangeError(`${name} is not an object`)
  }
  return value as Record<string, unknown>
}

function list(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new RangeError(`The ${name} are not a list`)
  return value
}

function numbers(value: unknown, name: string): number[] {
  const items = list(value, name)
  if (!items.every((item) => typeof item === 'number')) {
    throw new RangeError(`The ${name} hold a value that is not a number`)
  }
  return items as number[]
}

function integer(value: unknown, name: string, lowest: number, highest: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < lowest || value > highest) {
    throw new RangeError(`The ${name} value ${String(value)} is outside ${lowest} to ${highest}`)
  }
  return value
}

function duration(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`The time played ${String(value)} is not a duration`)
  }
  return value
}

function status(value: unknown): GameStatus {
  const found = STATUSES.find((item) => item === value)
  if (found === undefined) throw new RangeError(`The status ${String(value)} is not known`)
  return found
}

/** 81 lists of digits 1 to 9, each sorted, without repeats. */
function notes(value: unknown, name: string): Digit[][] {
  const cells = list(value, name)
  if (cells.length !== GRID_CELLS) throw new RangeError(`The ${name} have ${cells.length} cells`)
  return cells.map((cell) => {
    const digits = numbers(cell, name)
    const sorted = digits.every(
      (digit, index) =>
        Number.isInteger(digit) && digit >= 1 && digit <= 9 && (index === 0 || digit > (digits[index - 1] ?? 0)),
    )
    if (!sorted) throw new RangeError(`The ${name} hold notes that are not sorted digits`)
    return digits as Digit[]
  })
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm --filter @sudoku/core exec vitest run src/game/savedGame.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add packages/sudoku-core/src/game/savedGame.ts packages/sudoku-core/src/game/savedGame.test.ts
/usr/bin/git commit -m "feat(core): convert a game to a saved plain object and back (#49)"
```

---

### Task 8: Package exports, checks and pull request

**Files:**
- Modify: `packages/sudoku-core/src/index.ts` (shared with #48: append only)
- Test: `packages/sudoku-core/src/index.test.ts` (create)

**Interfaces:**
- Produces: the public API of `@sudoku/core` for the game: every name below.

- [ ] **Step 1: Write the failing test**

`src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import * as core from './index'

describe('@sudoku/core', () => {
  it('exports the game rules', () => {
    for (const name of [
      'createGame', 'select', 'place', 'toggleNote', 'erase', 'undo', 'hint', 'pause', 'resume',
      'tick', 'completeDigits', 'isWrong', 'valueAt', 'toSavedGame', 'fromSavedGame',
    ]) {
      expect(typeof core[name as keyof typeof core]).toBe('function')
    }
    expect(core.MAX_MISTAKES).toBe(3)
  })
})
```

If #48 already created `src/index.test.ts` on `develop` by the time you rebase, add this `it` block to that file instead.

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm --filter @sudoku/core exec vitest run src/index.test.ts`
Expected: FAIL, `typeof core.createGame` is "undefined".

- [ ] **Step 3: Append the exports**

Append these lines to `packages/sudoku-core/src/index.ts`. Do not change the existing line.

```ts
export { BOXES, COLUMNS, peersOf, ROWS } from './units'
export type { Completion, Digit, Game, GameStatus, MoveResult, Random, UndoStep } from './game/types'
export { MAX_MISTAKES, UNDO_LIMIT } from './game/constants'
export { createGame } from './game/createGame'
export type { NewGame } from './game/createGame'
export { completeDigits, DIGITS, isSolved, isWrong, NOTHING_COMPLETED, valueAt } from './game/completion'
export { erase, hint, pause, place, resume, select, tick, toggleNote, undo } from './game/actions'
export { fromSavedGame, SAVED_GAME_VERSION, toSavedGame } from './game/savedGame'
export type { SavedGame } from './game/savedGame'
```

- [ ] **Step 4: Run every check**

Run from the worktree root:

```bash
pnpm format
just lint
just typecheck
just test-ts
```

Expected: all pass. If `just lint` reports a rule, fix the code. Do not add a suppression unless it names the rule and the reason (root `AGENTS.md`, code comments rule 6). If the `mobile` Jest suite fails for a reason outside `packages/sudoku-core`, check that it also fails on `origin/develop` and report it in the pull request.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add packages/sudoku-core/src/index.ts packages/sudoku-core/src/index.test.ts
/usr/bin/git add -u
/usr/bin/git commit -m "feat(core): export the game rules from @sudoku/core (#49)"
```

- [ ] **Step 6: Rebase on develop**

```bash
/usr/bin/git fetch origin
/usr/bin/git rebase origin/develop
```

If #48 merged first, `src/index.ts` conflicts. Keep the lines of both sides. Run Step 4 again.

- [ ] **Step 7: Push and open the pull request**

```bash
/usr/bin/git push -u origin feature/49-game-rules
gh pr create --base develop --title "feat(core): game rules: moves, notes, undo, mistakes and completion (#49)" --body "$(cat <<'EOF'
## What

`@sudoku/core` gets one immutable model of a game in progress. Each action is a pure function. The edit actions return the new game and a report of what they completed.

## Rules the issue left open

These follow the design canvas prototype:

- Placing the number a cell already holds clears it.
- The core refuses a number whose nine are all correct. Erase still clears such a cell.
- Actions do nothing while the game is paused, lost or won. Select too.
- Undo keeps at most 100 steps. It cannot remove the entries a game started with.
- Only place and hint report completions.

## Shared file

`src/index.ts` is shared with #48. This pull request only appends lines.

## Checks

- `just lint`
- `just typecheck`
- `just test-ts`

Closes #49
EOF
)"
```

- [ ] **Step 8: Tick the acceptance criteria**

Read the issue body with `gh issue view 49 --json body --jq .body`. Change `- [ ]` to `- [x]` for each criterion that a test of this plan covers. Write the new body with `gh issue edit 49 --body-file <file>`. All 13 criteria are covered:

| Criterion | Test |
| --- | --- |
| A game holds givens, solution, entries, notes, selected cell, mistakes, hints used, time | `createGame.test.ts` first two tests |
| Actions: select, place, toggle a note, erase, undo, hint, pause, resume | `actions.test.ts` |
| A given cannot change | "cannot change a given", "does nothing on a given" |
| A placed number removes itself from the notes in its row, column and box | "removes the placed number from the notes…" |
| A wrong number is a mistake, undo keeps it, the third ends the game | "counts a wrong number…", "takes back the entry but not the mistake", "ends the game at the third mistake" |
| Hint fills a random empty or wrong cell and counts one hint | `describe('hint')` |
| Each action reports what it completed | `completion.test.ts`, "reports what the number completed…" |
| The model reports the numbers with all nine correct, wrong ones do not count | `describe('completeDigits')` |
| A game can start with entries that are not mistakes | "accepts entries the player did not make…" |
| Time comes from outside, not during a pause or after the end | `describe('tick')` |
| A game converts to a plain object and back | `savedGame.test.ts` |
| Vitest covers every rule | all of the above |
| No React Native, Expo or I/O | `just lint` (boundaries) and no imports outside `src/` |

---

## Open questions for the developer

1. **Hint: random cell or the selected cell?** The issue says "a random empty or wrong cell". The canvas prototype fills the selected cell first when it is open. This plan follows the issue. Should the hint prefer the selected cell?
2. **Refuse a complete number in the core?** This plan refuses it in `place`, like the disabled key of the canvas. The UI of #41 then needs no own check.
3. **Glossary terms for the epic docs pull request:** "mistake", "hint", "undo step", "completion" (what an action completed) and the statuses `paused`, `lost`, `won` have no glossary entry.
4. **Two unit tables.** #48 may build its own rows, columns and boxes. A later issue can make the solver use `units.ts`.
