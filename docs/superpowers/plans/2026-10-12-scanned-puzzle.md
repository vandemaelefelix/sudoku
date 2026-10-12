# Play a Scanned Puzzle with Locked Givens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Play this puzzle" on the correction screen loads the corrected scan as the game in progress. Printed digits load as locked givens. Handwritten digits load as editable entries, and a wrong one shows as wrong but is not a mistake. The button is on only when the developer's play gate passes. Otherwise the panel says why.

**Architecture:** A new util `src/scan/utils/play.utils.ts` holds the play gate (`checkPlay`) and the level of a scan (`levelOf`). `checkPlay` takes the `CorrectedGrid` and the given conflicts of `useCorrectionEdits` (#26). It calls `solve()` from `@sudoku/core` on the givens only. On a pass it returns a `ScannedStart`: a level and a plain `NewGame` (givens, solution, entries). `CorrectionScreen` gets an optional `onPlay(start)` prop. After #51 merges, a new hook `useScannedStart` (in `src/scan/hooks/`) asks before it replaces a game in progress, calls `PuzzleRepository.start({ level, source: 'scanned', game: createGame(puzzle) })` and replaces the `scan` route with `/game`. `PlayScreen` (#51) then reads the game from storage as it does for every game. `src/game/` never sees the scanner (SUD-03). The confirm question of `HomeScreen` (#51) moves into a hook `useConfirmReplace` in `src/home/hooks/`, so Home and Scan ask the same question.

**Tech Stack:** Expo SDK 57, Expo Router 57 (from #51, ADR-016), React Native 0.86, React 19.2, Unistyles 3.5, `@sudoku/core` (`solve`, `createGame`, `GIVENS_TARGET`, `LEVELS`), `src/storage/` (`PuzzleRepository`, `useGameStorage` from #51), Jest with jest-expo, Testing Library 13.3 and `expo-router/testing-library`, Vitest 5 in `@sudoku/core`.

**Spec:** GitHub issue #27 (`gh issue view 27`). The developer's play gate in the comment on #27 (`gh issue view 27 --comments`, 2026-10-12). The scan-pipeline concept, "Loading the result". QR-04, SUD-03, SUD-04. ADR-011 (amendment 2026-10-12), ADR-012, ADR-016 (#51).

## Coordinator rulings (2026-10-12, binding)

- The play gate is the developer's table on #27. Implement exactly this:

  | Situation | Blocks "Play this puzzle" | Panel text |
  | --- | --- | --- |
  | Uncertain cells that the player did not check | No. The ring is a hint, not a gate | none |
  | Two givens break a rule | Yes | none new: the "● N givens in conflict" chip and the marks of #26 say it |
  | The givens have no solution | Yes | "This puzzle has no solution. Check the marked cells." |
  | The givens have more than one solution | Yes | "A given is missing or wrong." |
  | A handwritten entry is wrong | No. It loads as a wrong entry, not a mistake (#49) | none |

- A scanned puzzle gets the level whose givens count is nearest, with the targets of `GIVENS_TARGET`. Its source is `scanned`.
- #27 runs after #51 merges. It builds on #51's design: the `game` route reads its game from storage through `PuzzleRepository`, with `start({ level, source, game })`.
- #27 owns the play button wiring of the correction screen, what it needs in `src/scan/`, a small util for the level and the gate, and the route wiring after #51. Glossary and decision index needs are open questions.
- Answers to the open questions (coordinator, 2026-10-12):
  1. A scan that is already full and correct blocks Play with "This puzzle is already solved." Accepted.
  2. #27 owns the glossary, `00-DECISIONS.md` and `09-architecture-decisions.md` for its rows after #51 merges. #27 merges before #43; #43's doc task runs after #27 merges.
  3. Add the glossary rows "Play gate" and "Scanned puzzle", and extend "Correction screen". Accepted.
  4. The "Scanned from paper" half of the source criterion moves to #43. #27 stores `source: 'scanned'`. Say so in the PR and in #27's criterion.
  5. Moving the replace question out of `HomeScreen` into `useConfirmReplace` is accepted; #27 owns `HomeScreen` for that change after #51 merges.
  6. CHANGED: a retry of a lost scanned game keeps the handwritten digits. #51 builds the retry from the saved start with its initial entries. Do not accept the loss; add an end-to-end test that checks it after #51 merges.
  7. "New puzzle" after a scanned game gives a generated puzzle at the same level. Accepted.
  8. Keep "Check the marked cells" even when no cell is marked. Accepted.

## Facts checked for this plan (2026-10-12, `origin/develop` and the #51 plan)

| Fact | Source |
| --- | --- |
| `useCorrectionEdits(result)` returns `looks`, `selected`, `conflicts`, `toCheck`, `grid` and `actions`. `grid` is `{ givens, entries }`, 81 cells each, and a cell holds a given or an entry, never both | `src/scan/hooks/useCorrectionEdits/useCorrectionEdits.ts`, `src/scan/utils/correctionEdit.utils.ts` |
| `CorrectionScreen` renders a disabled `Pressable` with `testID="play"` and the style `play` (opacity 0.5). `CameraScreen` renders `CorrectionScreen` with a `clock` during the transition. Then `ScanFlow` renders it without a clock | `src/scan/screens/*` |
| `solve(puzzle)` returns `{ count: 0 }`, `{ count: 1, solution }` or `{ count: 2 }` (two or more) | `packages/sudoku-core/src/solver.ts` |
| `createGame({ givens, solution, entries })` accepts entries that differ from the solution and counts no mistake for them. It returns a `won` game when the grid is complete | `packages/sudoku-core/src/game/createGame.ts` and its test |
| `PuzzleRepository.start` throws a `RangeError` for a won or lost game. `PuzzleSource` is `'generated' \| 'scanned'`. The level is required | `src/storage/PuzzleRepository.ts`, `storage.types.ts` |
| `GIVENS_TARGET`: easy 40, medium 34, hard 29, expert 25. `LEVELS` is ordered easy to expert. A generated puzzle has exactly its target | `packages/sudoku-core/src/generator.ts`, the #51 route test |
| ADR-011 amendment 2026-10-12 says: "Scanned puzzles get no level in v1 (point 5)." ADR-011 is `Proposed` | `docs/architecture/adr/adr-011-puzzle-generation-and-hints.md` |
| #51: `useGameStorage()` from `@/storage/hooks/useGameStorage`, `GameStorageContext`, `PlayScreen` reads `puzzles.current()`, `HomeScreen` holds a private `confirmReplace()` with `REPLACE_*` in `HomeScreen.constants.ts`. The `scan` route renders `ScanFlow`. The route tests use `renderRouter` in `apps/mobile/test/` | `plans/51-start-a-game.md`, tasks 6 to 9 |
| Game screen labels: a cell is "Row r, column c, given d", "…, wrong d" or "…, d". The mistake dots are "N of 3 mistakes". A number key is "Enter d" | `src/game/utils/cellLabel.utils.ts`, `MistakeDots.tsx`, `NumberKey.tsx` |
| The finish card (#43) is not built yet. It will read `source` from the history | `gh issue view 43` |

## Global Constraints

- Branch `feature/27-scanned-puzzle` from `origin/develop` **after #51 merges**. The PR goes against `develop` with `Closes #27`.
- Tasks 1 to 4 do not need #51. Tasks 5 to 9 need #51 on `develop`. Task 0 checks this.
- SUD-03: `src/game/**` does not import `src/scanner/**`. This plan adds no import into `src/game/`. The scan hands over a plain `NewGame`.
- SUD-02: no game data, cell or image leaves the device. Logs hold no grid.
- The play gate is the table above. Do not add a gate for uncertain cells.
- `checkPlay` runs only on the finished correction screen with the pad closed. It never runs during the capture transition (no `solve()` on the JS thread while the clock runs).
- Theme: use semantic tokens only (`colors.danger`, `colors.textMuted`). This plan adds no component token and touches no theme file. No colour literal.
- Import rules, folder layout and comment rules follow root `AGENTS.md` and `apps/mobile/AGENTS.md`. Prose, comments and commit messages follow STE light. No issue number in a code comment.
- No new dependency. No change to `jest.setup.ts`. No new native code, so no new development build after #51's build.
- Every commit message ends with `(#27)`. Do not push until the developer asks.

## Review Focus

1. **The gate is exactly the developer's table.** Uncertain cells never block (task 4, "keeps Play on with uncertain cells"). Wrong entries never block (task 2, "ignores a wrong entry"). Conflicts, no solution and several solutions block (task 2; task 4).
2. **Givens only go to the solver.** Entries never change the result of `solve()`. A wrong entry must not make a good puzzle look broken (task 2).
3. **A complete scan.** If the entries complete the grid, `createGame` returns a won game and `PuzzleRepository.start` throws. The gate blocks this case with "This puzzle is already solved." This case is not in the developer's table. Open question 1.
4. **No solver on the JS thread during the transition, and none per key.** `checkPlay` runs in a `useMemo` that returns `null` while a clock runs or the pad is open (task 4, "does not check the givens during the transition").
5. **A game in progress is never lost without a question.** Play asks the same question as Home. Cancel keeps the game in progress (task 6).
6. **A double tap on Play starts one game** (task 6).
7. **Scan to game, end to end.** A Jest test goes from a recognised result through the real correction screen and `PlayScreen` to the game screen: locked givens, a wrong entry, 0 mistakes, source `scanned` (task 8).

## Files owned

All app paths are under `apps/mobile/`.

| File | Change | Needs #51 |
| --- | --- | --- |
| `docs/architecture/adr/adr-011-puzzle-generation-and-hints.md` | A dated amendment: a scanned puzzle takes the nearest level | No |
| `docs/architecture/00-concepts/scan-pipeline.md` | "Loading the result": the level, the source and the play gate | No |
| `docs/superpowers/plans/2026-10-12-scanned-puzzle.md` | New: the copy of this plan | No |
| `packages/sudoku-core/src/game/scannedGame.test.ts` | New Vitest test: a scanned grid in the game rules | No |
| `src/scan/utils/play.utils.ts`, `play.utils.test.ts` | New: `levelOf`, `checkPlay`, `ScannedStart`, `PlayBlock` | No |
| `src/scan/screens/CorrectionScreen/CorrectionScreen.tsx`, `.styles.ts`, `.constants.ts`, `.test.tsx` | `onPlay`, the gate, the block text | No |
| `src/home/hooks/useConfirmReplace/*` | New: the confirm question, moved from `HomeScreen` | Yes |
| `src/home/screens/HomeScreen/HomeScreen.tsx`, `HomeScreen.constants.ts` | Use `useConfirmReplace`. Delete the moved constants (and the file, if it is empty then) | Yes (#51's files, edited after #51 merges) |
| `src/scan/hooks/useScannedStart/*` | New: start the scanned game, then open `/game` | Yes |
| `src/scan/screens/ScanFlow/ScanFlow.tsx`, `ScanFlow.test.tsx` | Pass `onPlay` | Yes |
| `src/scan/README.md` | The new hook and util | Yes |
| `test/scannedGame.test.tsx` | New: scan review to game screen, on the router | Yes |

Not touched: every file of `src/game/**`, `src/storage/**`, `src/app/**`, `CameraScreen`, `useCorrectionEdits`, `correctionEdit.utils.ts`, every theme file, `jest.setup.ts`, `package.json`, `00-DECISIONS.md`, `09-architecture-decisions.md`, `12-glossary.md`.

---

### Task 0: Branch, check #51, plan copy

- [ ] **Step 1: Check that #51 is on `develop`**

```bash
cd /Users/felix/projects/sudoku
/usr/bin/git fetch origin
/usr/bin/git log origin/develop --oneline --grep '(#51)' | head -3
/usr/bin/git show origin/develop:apps/mobile/src/storage/hooks/useGameStorage/index.ts
/usr/bin/git show origin/develop:apps/mobile/src/home/screens/HomeScreen/HomeScreen.tsx
/usr/bin/git show origin/develop:apps/mobile/src/app/scan.tsx
```

Expected: #51 commits, `useGameStorage`, a `HomeScreen` with `confirmReplace` and the `REPLACE_*` constants, and a `scan` route that renders `ScanFlow`. If #51 is not merged, do tasks 1 to 4 only and stop. If the merged names differ from the #51 plan, use the merged names and say so in the PR.

- [ ] **Step 2: Make the worktree and the branch**

```bash
/usr/bin/git worktree add ../sudoku-27 -b feature/27-scanned-puzzle origin/develop
cd ../sudoku-27
just setup
just install-model
```

- [ ] **Step 3: Copy this plan**

Copy this file to `docs/superpowers/plans/2026-10-12-scanned-puzzle.md`.

```bash
just docs-check
/usr/bin/git add docs/superpowers/plans/2026-10-12-scanned-puzzle.md
/usr/bin/git commit -m "docs(plan): play a scanned puzzle with locked givens (#27)"
```

---

### Task 1: ADR-011 amendment and the scan-pipeline concept

Rule 2 of root `AGENTS.md`: the code must not change the decision "Scanned puzzles get no level in v1" alone. `PuzzleRepository` needs a level for every game, so a scanned game needs one.

**Files:**
- Modify: `docs/architecture/adr/adr-011-puzzle-generation-and-hints.md`
- Modify: `docs/architecture/00-concepts/scan-pipeline.md`

- [ ] **Step 1: Amend ADR-011**

In the section "Amendment: v1 rules for the level and the hint (2026-10-12)", do not change the bullet "Scanned puzzles get no level in v1 (point 5)." Add a new section after that section, before "## Consequences":

```markdown
## Amendment: a level for scanned puzzles (2026-10-12)

The game in progress and the history need a level for every game (ADR-012). So a scanned puzzle
gets a level in v1, against the bullet "Scanned puzzles get no level in v1" above.

- A scanned puzzle takes the level whose givens target is nearest to its number of givens. The
  targets are the targets of the generator: easy 40, medium 34, hard 29, expert 25.
- A tie goes to the easier level. More than 40 givens is easy. Fewer than 25 givens is expert.
- The source of a scanned game is `scanned` (ADR-012). The finish card and the history show it.
- The technique solver (#53) replaces this rule. Then a scanned puzzle gets the level of its
  techniques (point 5).
```

- [ ] **Step 2: Update the scan-pipeline concept**

In `docs/architecture/00-concepts/scan-pipeline.md`, section "Loading the result", replace the paragraph under the table ("The givens alone must have exactly one solution, …") with:

```markdown
The givens alone must have exactly one solution, checked by `@sudoku/core` before the puzzle
loads. The correction screen turns "Play this puzzle" on only when this play gate passes:

| Situation | Blocks Play | The correction screen says |
| --- | --- | --- |
| Uncertain cells | No. The ring is a hint | Nothing more |
| Two givens break a rule | Yes | The conflict chip and the marks |
| The givens have no solution | Yes | "This puzzle has no solution. Check the marked cells." |
| The givens have more than one solution | Yes | "A given is missing or wrong." |
| The givens and the entries fill the grid | Yes | "This puzzle is already solved." |
| A handwritten entry is wrong | No. It loads as a wrong entry, not a mistake | Nothing |

A scanned game takes the level of the nearest givens target and the source `scanned`
(ADR-011, amendment "a level for scanned puzzles").
```

If the developer rules against the "already solved" row (open question 1), delete that row.

- [ ] **Step 3: Check and commit**

```bash
just docs-check
/usr/bin/git add docs/architecture/adr/adr-011-puzzle-generation-and-hints.md docs/architecture/00-concepts/scan-pipeline.md
/usr/bin/git commit -m "docs(adr): a scanned puzzle takes the level of the nearest givens target (#27)"
```

The rows of ADR-011 in `00-DECISIONS.md` and `09-architecture-decisions.md` need one more clause. Open question 2.

---

### Task 2: The play gate and the level

**Files:**
- Create: `apps/mobile/src/scan/utils/play.utils.ts`, `play.utils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/scan/utils/play.utils.test.ts`:

```ts
import { GIVENS_TARGET, LEVELS, generate, type Level } from '@sudoku/core'
import type { CorrectedGrid } from '@/scan/utils/correctionEdit.utils'
import { checkPlay, levelOf } from './play.utils'

const EMPTY: readonly number[] = Array.from({ length: 81 }, () => 0)
const NO_CONFLICTS: readonly boolean[] = EMPTY.map(() => false)
const withGivens = (count: number) => EMPTY.map((_, cell) => (cell < count ? 1 : 0))
const gridOf = (givens: readonly number[], entries: readonly number[] = EMPTY): CorrectedGrid => ({
  givens: [...givens],
  entries: [...entries],
})

describe('levelOf', () => {
  it.each<[number, Level]>([
    [81, 'easy'],
    [40, 'easy'],
    [37, 'easy'],
    [36, 'medium'],
    [34, 'medium'],
    [32, 'medium'],
    [31, 'hard'],
    [29, 'hard'],
    [27, 'hard'],
    [26, 'expert'],
    [25, 'expert'],
    [17, 'expert'],
    [0, 'expert'],
  ])('gives %i givens the level %s', (count, level) => {
    expect(levelOf(withGivens(count))).toBe(level)
  })

  it('gives each generated puzzle its own level back', () => {
    for (const level of LEVELS) {
      const { givens } = generate(level, 3)
      expect(givens.filter((digit) => digit !== 0)).toHaveLength(GIVENS_TARGET[level])
      expect(levelOf(givens)).toBe(level)
    }
  })
})

describe('checkPlay', () => {
  const puzzle = generate('medium', 11)
  const open = puzzle.givens.findIndex((digit) => digit === 0)
  const wrongDigit = ((puzzle.solution[open] ?? 0) % 9) + 1

  it('passes givens with one solution, with the solution, the entries and the level', () => {
    expect(checkPlay(gridOf(puzzle.givens), NO_CONFLICTS)).toEqual({
      ok: true,
      start: { level: 'medium', puzzle: { givens: puzzle.givens, solution: puzzle.solution, entries: EMPTY } },
    })
  })

  it('ignores a wrong entry, and keeps it for the game', () => {
    const entries = EMPTY.map((_, cell) => (cell === open ? wrongDigit : 0))
    const check = checkPlay(gridOf(puzzle.givens, entries), NO_CONFLICTS)
    expect(check.ok).toBe(true)
    if (check.ok) expect(check.start.puzzle.entries[open]).toBe(wrongDigit)
  })

  it('blocks two givens that break a rule', () => {
    const conflicts = NO_CONFLICTS.map((_, cell) => cell === 0 || cell === 1)
    expect(checkPlay(gridOf(puzzle.givens), conflicts)).toEqual({ ok: false, block: 'conflict' })
  })

  it('blocks givens with no solution', () => {
    // Row 1 holds 1 to 8, so its last cell needs the 9. The 9 below it in row 2 forbids it. No two givens share a digit in a unit.
    const givens = EMPTY.map((_, cell) => (cell < 8 ? cell + 1 : cell === 17 ? 9 : 0))
    expect(checkPlay(gridOf(givens), NO_CONFLICTS)).toEqual({ ok: false, block: 'none' })
  })

  it('blocks givens with several solutions', () => {
    expect(checkPlay(gridOf(EMPTY), NO_CONFLICTS)).toEqual({ ok: false, block: 'several' })
  })

  it('blocks a grid that the givens and the entries fill', () => {
    const entries = puzzle.solution.map((digit, cell) => (puzzle.givens[cell] === 0 ? digit : 0))
    expect(checkPlay(gridOf(puzzle.givens, entries), NO_CONFLICTS)).toEqual({ ok: false, block: 'solved' })
  })

  it('does not block a full grid with one wrong entry', () => {
    const entries = puzzle.solution.map((digit, cell) =>
      cell === open ? wrongDigit : puzzle.givens[cell] === 0 ? digit : 0,
    )
    expect(checkPlay(gridOf(puzzle.givens, entries), NO_CONFLICTS).ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run it and see it fail**

```bash
pnpm --filter mobile exec jest src/scan/utils/play.utils
```

Expected: FAIL, `Cannot find module './play.utils'`.

- [ ] **Step 3: Implement**

Create `src/scan/utils/play.utils.ts`:

```ts
import { GIVENS_TARGET, LEVELS, solve, type Level, type NewGame } from '@sudoku/core'
import type { CorrectedGrid } from '@/scan/utils/correctionEdit.utils'

/** Why "Play this puzzle" stays off. none and several: the number of solutions of the givens. */
export type PlayBlock = 'conflict' | 'none' | 'several' | 'solved'

/** The plain grid that a scan hands to the game (SUD-03), with the level of its givens. */
export type ScannedStart = { level: Level; puzzle: Required<NewGame> }

export type PlayCheck = { ok: true; start: ScannedStart } | { ok: false; block: PlayBlock }

/** The level whose givens target is nearest (ADR-011, amendment "a level for scanned puzzles"). A tie goes to the easier level. */
export function levelOf(givens: readonly number[]): Level {
  const count = givens.filter((digit) => digit !== 0).length
  const distance = (level: Level) => Math.abs(GIVENS_TARGET[level] - count)
  // LEVELS runs from easy to expert, and only a nearer level replaces the best one.
  return LEVELS.reduce((best, level) => (distance(level) < distance(best) ? level : best))
}

/**
 * The play gate of the correction screen (QR-04). Uncertain cells never block: the ring is a hint.
 * Only the givens go to the solver. A wrong entry loads as a wrong entry and is not a mistake.
 */
export function checkPlay(grid: CorrectedGrid, conflicts: readonly boolean[]): PlayCheck {
  if (conflicts.some(Boolean)) return { ok: false, block: 'conflict' }
  const solved = solve(grid.givens)
  if (solved.count === 0) return { ok: false, block: 'none' }
  if (solved.count === 2) return { ok: false, block: 'several' }
  const { solution } = solved
  // createGame makes a full, correct grid a won game, and PuzzleRepository.start refuses a won game.
  const full = solution.every((digit, cell) => grid.givens[cell] === digit || grid.entries[cell] === digit)
  if (full) return { ok: false, block: 'solved' }
  return {
    ok: true,
    start: { level: levelOf(grid.givens), puzzle: { givens: grid.givens, solution, entries: grid.entries } },
  }
}
```

- [ ] **Step 4: Run the tests and the lint, then commit**

```bash
pnpm --filter mobile exec jest src/scan/utils/play.utils
just lint
just typecheck
/usr/bin/git add apps/mobile/src/scan/utils/play.utils.ts apps/mobile/src/scan/utils/play.utils.test.ts
/usr/bin/git commit -m "feat(scan): the play gate and the level of a scanned puzzle (#27)"
```

---

### Task 3: A scanned grid in the game rules (Vitest)

The game rules of #49 already accept entries. This test pins the scan case in one place: the givens stay locked, a wrong scanned entry is wrong but no mistake, the player can change a scanned entry, and a save keeps all of it.

**Files:**
- Create: `packages/sudoku-core/src/game/scannedGame.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, expect, it } from 'vitest'
import { solve } from '../solver'
import { erase, place, select } from './actions'
import { isWrong } from './completion'
import { createGame } from './createGame'
import { SAMPLE_GIVENS, SAMPLE_SOLUTION } from './samplePuzzle'
import { fromSavedGame, toSavedGame } from './savedGame'

// Cell 0 holds the printed 5. Cells 2 and 3 are open: their solution digits are 4 and 6.
const scannedEntries = SAMPLE_GIVENS.map((_, cell) => (cell === 2 ? 1 : cell === 3 ? 6 : 0))

function scannedGame() {
  const solved = solve(SAMPLE_GIVENS)
  if (solved.count !== 1) throw new Error('The sample puzzle must have one solution')
  return createGame({ givens: SAMPLE_GIVENS, solution: solved.solution, entries: scannedEntries })
}

describe('a scanned game', () => {
  it('solves the givens alone to the solution', () => {
    expect(solve(SAMPLE_GIVENS)).toEqual({ count: 1, solution: SAMPLE_SOLUTION })
  })

  it('loads the handwritten digits as entries: a wrong one is wrong, and none is a mistake', () => {
    const game = scannedGame()
    expect(game.entries[2]).toBe(1)
    expect(isWrong(game, 2)).toBe(true)
    expect(isWrong(game, 3)).toBe(false)
    expect(game.mistakes).toBe(0)
    expect(game.status).toBe('playing')
  })

  it('keeps a given locked', () => {
    const onGiven = select(scannedGame(), 0)
    expect(place(onGiven, 9).game.givens[0]).toBe(5)
    expect(place(onGiven, 9).game.entries[0]).toBe(0)
    expect(erase(onGiven).game.givens[0]).toBe(5)
  })

  it('lets the player fix a scanned entry', () => {
    const fixed = place(select(scannedGame(), 2), 4).game
    expect(fixed.entries[2]).toBe(4)
    expect(isWrong(fixed, 2)).toBe(false)
    expect(fixed.mistakes).toBe(0)
  })

  it('keeps the scanned entries and no mistake through a save', () => {
    const loaded = fromSavedGame(JSON.parse(JSON.stringify(toSavedGame(scannedGame()))))
    expect(loaded.entries[2]).toBe(1)
    expect(isWrong(loaded, 2)).toBe(true)
    expect(loaded.mistakes).toBe(0)
  })
})
```

- [ ] **Step 2: Run it**

```bash
pnpm --filter @sudoku/core exec vitest run src/game/scannedGame.test.ts
```

Expected: PASS. The rules exist since #49. If a test fails, the rules differ from the scan-pipeline concept: stop and report it. Do not change `@sudoku/core` in this issue.

- [ ] **Step 3: Commit**

```bash
just lint
/usr/bin/git add packages/sudoku-core/src/game/scannedGame.test.ts
/usr/bin/git commit -m "test(core): a scanned grid keeps its givens locked and its entries free (#27)"
```

---

### Task 4: The play button on the correction screen

**Files:**
- Modify: `apps/mobile/src/scan/screens/CorrectionScreen/CorrectionScreen.tsx`, `CorrectionScreen.styles.ts`, `CorrectionScreen.constants.ts`, `CorrectionScreen.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `CorrectionScreen.test.tsx`, add `import { generate } from '@sudoku/core'` and `import type { ScannedStart } from '@/scan/utils/play.utils'`. Replace the test "shows the title and a disabled Play button" with the block below. Add the describe block at the end of the file.

```tsx
  it('shows the title and a disabled Play button', () => {
    render(<CorrectionScreen result={okResult()} layout={layout} onRetake={jest.fn()} />)
    expect(screen.getByText('Check the scan')).toBeTruthy()
    expect(screen.getByText('Tap a cell to fix it')).toBeTruthy()
    expect(screen.getByTestId('play').props.accessibilityState).toMatchObject({ disabled: true })
    expect(style('play').opacity).toBe(0.5)
  })
```

(The empty grid has several solutions, so the button stays off. The test body does not change.)

```tsx
const puzzle = generate('hard', 5)
const firstOpen = puzzle.givens.findIndex((digit) => digit === 0)
const wrongDigit = ((puzzle.solution[firstOpen] ?? 0) % 9) + 1

/** A recognised result with every given of `givens` printed, and `over` on top. */
function scanOf(givens: readonly number[], over: { [n: number]: Partial<CellResult> } = {}): RecogniseResult {
  const printed: { [n: number]: Partial<CellResult> } = {}
  givens.forEach((digit, n) => {
    if (digit !== 0) printed[n] = { digit, kind: 'printed', confidence: 1 }
  })
  return okResult({ ...printed, ...over })
}

const playUi = (result: RecogniseResult, onPlay = jest.fn<void, [ScannedStart]>()) => {
  render(<CorrectionScreen result={result} layout={layout} onRetake={jest.fn()} onPlay={onPlay} />)
  return onPlay
}
const playOn = () => screen.getByTestId('play').props.accessibilityState.disabled === false

describe('CorrectionScreen play gate', () => {
  it('turns Play on for givens with one solution, and hands over the plain grid', () => {
    const onPlay = playUi(scanOf(puzzle.givens, { [firstOpen]: { digit: wrongDigit, kind: 'handwritten', confidence: 1 } }))
    expect(playOn()).toBe(true)
    expect(style('play').opacity).toBeUndefined()
    expect(screen.queryByTestId('play-blocked')).toBeNull()
    press('play')
    expect(onPlay).toHaveBeenCalledTimes(1)
    const start = onPlay.mock.calls[0]![0]
    expect(start.level).toBe('hard')
    expect(start.puzzle.givens).toEqual(puzzle.givens)
    expect(start.puzzle.solution).toEqual(puzzle.solution)
    expect(start.puzzle.entries[firstOpen]).toBe(wrongDigit)
  })

  it('keeps Play on with uncertain cells', () => {
    const shaky = puzzle.givens.findIndex((digit) => digit !== 0)
    playUi(scanOf(puzzle.givens, { [shaky]: { digit: puzzle.givens[shaky], kind: 'printed', confidence: 0.2 } }))
    expect(screen.getByText('● 1 cell to check')).toBeTruthy()
    expect(playOn()).toBe(true)
  })

  it('blocks two givens in conflict, and the chip says why', () => {
    playUi(okResult({ 0: given, 8: given }))
    expect(playOn()).toBe(false)
    expect(screen.getByText('● 2 givens in conflict')).toBeTruthy()
    expect(screen.queryByTestId('play-blocked')).toBeNull()
  })

  it('blocks givens with no solution and says so', () => {
    const givens = puzzle.givens.map((_, cell) => (cell < 8 ? cell + 1 : cell === 17 ? 9 : 0))
    playUi(scanOf(givens))
    expect(playOn()).toBe(false)
    expect(screen.getByTestId('play-blocked')).toHaveTextContent('This puzzle has no solution. Check the marked cells.')
    expect(style('play-blocked')).toMatchObject({ color: daylight.colors.danger })
  })

  it('blocks givens with several solutions and says so', () => {
    const onPlay = playUi(scanOf(puzzle.givens.map((digit, cell) => (cell < 40 ? 0 : digit))))
    expect(playOn()).toBe(false)
    expect(screen.getByTestId('play-blocked')).toHaveTextContent('A given is missing or wrong.')
    expect(screen.getByTestId('play').props.accessibilityHint).toBe('A given is missing or wrong.')
    press('play')
    expect(onPlay).not.toHaveBeenCalled()
  })

  it('blocks a scan that is already solved', () => {
    const over: { [n: number]: Partial<CellResult> } = {}
    puzzle.solution.forEach((digit, n) => {
      if (puzzle.givens[n] === 0) over[n] = { digit, kind: 'handwritten', confidence: 1 }
    })
    playUi(scanOf(puzzle.givens, over))
    expect(screen.getByTestId('play-blocked')).toHaveTextContent('This puzzle is already solved.')
  })

  it('follows an edit: a fixed conflict turns Play on', () => {
    // A misread gives the second given of row 1 the digit of the first.
    const row = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((cell) => puzzle.givens[cell] !== 0)
    const [first, second] = row as [number, number]
    playUi(scanOf(puzzle.givens, { [second]: { digit: puzzle.givens[first], kind: 'printed', confidence: 1 } }))
    expect(playOn()).toBe(false)
    press(`correction-press-${second}`)
    press(`correction-key-${puzzle.givens[second]}`)
    press('correction-done')
    expect(playOn()).toBe(true)
  })

  it('keeps Play off without onPlay', () => {
    render(<CorrectionScreen result={scanOf(puzzle.givens)} layout={layout} onRetake={jest.fn()} />)
    expect(playOn()).toBe(false)
  })

  it('does not check the givens during the transition', () => {
    render(
      <CorrectionScreen
        result={scanOf(puzzle.givens)}
        layout={layout}
        onRetake={jest.fn()}
        onPlay={jest.fn()}
        clock={clock(1.5)}
      />,
    )
    expect(playOn()).toBe(false)
    expect(screen.queryByTestId('play-blocked')).toBeNull()
  })
})
```

The test "several solutions" removes the first 40 cells of the givens. A hard puzzle with 29 givens then has far fewer than 17 givens, so it always has several solutions. The test "follows an edit" needs two givens in row 1. If `generate('hard', 5)` has fewer, pick another seed for `puzzle`.

- [ ] **Step 2: Run them and see them fail**

```bash
pnpm --filter mobile exec jest src/scan/screens/CorrectionScreen
```

Expected: FAIL. `onPlay` is not a prop, Play is always off, and `play-blocked` does not exist.

- [ ] **Step 3: Add the block texts**

Append to `CorrectionScreen.constants.ts`:

```ts
import type { PlayBlock } from '@/scan/utils/play.utils'

/** The panel line for each play block. A given conflict has none: its chip and its marks say it. */
export const PLAY_BLOCK_TEXT: Readonly<Record<PlayBlock, string | null>> = {
  conflict: null,
  none: 'This puzzle has no solution. Check the marked cells.',
  several: 'A given is missing or wrong.',
  solved: 'This puzzle is already solved.',
}
```

Put the `import type` line at the top of the file.

- [ ] **Step 4: Change the styles**

In `CorrectionScreen.styles.ts`, remove `opacity: 0.5` from `play`, and add two styles:

```ts
  playDisabled: { opacity: 0.5 },
  blocked: { fontSize: 13, fontWeight: '500', color: theme.colors.danger },
```

- [ ] **Step 5: Wire the screen**

In `CorrectionScreen.tsx`:

1. Import `checkPlay` and `type ScannedStart` from `@/scan/utils/play.utils`, and `PLAY_BLOCK_TEXT` from `./CorrectionScreen.constants`.
2. Add to `CorrectionProps`:

```ts
  /** Play this puzzle. Without it, the button stays off: the transition shows the panel but cannot start a game. */
  onPlay?: (start: ScannedStart) => void
```

3. Take `onPlay` in the parameter list. Take `grid` from `useCorrectionEdits`:

```ts
  const { looks, selected, conflicts, toCheck, grid, actions } = useCorrectionEdits(result)
```

4. After `conflictCount`, add:

```ts
  // The solver runs once when the pad closes, never per key and never while the transition clock runs.
  const check = useMemo(
    () => (editable && selected === null ? checkPlay(grid, conflicts) : null),
    [editable, selected, grid, conflicts],
  )
  const start = check?.ok ? check.start : null
  const blockText = check !== null && !check.ok ? PLAY_BLOCK_TEXT[check.block] : null
  const canPlay = start !== null && onPlay !== undefined
```

5. Replace the `Pressable` with `testID="play"`:

```tsx
              {blockText !== null && (
                <Text testID="play-blocked" style={styles.blocked}>
                  {blockText}
                </Text>
              )}
              <Pressable
                testID="play"
                accessibilityRole="button"
                accessibilityState={{ disabled: !canPlay }}
                accessibilityHint={blockText ?? undefined}
                disabled={!canPlay}
                onPress={canPlay ? () => onPlay(start) : undefined}
                style={[styles.play, !canPlay && styles.playDisabled]}
              >
                <Text style={styles.playText}>Play this puzzle</Text>
              </Pressable>
```

If TypeScript does not narrow `onPlay` and `start` inside the arrow, write `onPress={start !== null && onPlay ? () => onPlay(start) : undefined}`.

The panel is 168 pt high with 12 pt padding. Chips (about 24 pt), the block line (about 18 pt), Play (about 44 pt), Retake (about 20 pt) and three 9 pt gaps fit in the 144 pt inside. iPhone step 3 checks it on the smallest screen.

- [ ] **Step 6: Run the tests and the checks, then commit**

```bash
pnpm --filter mobile exec jest src/scan
just lint
just typecheck
/usr/bin/git add apps/mobile/src/scan/screens/CorrectionScreen
/usr/bin/git commit -m "feat(scan): Play this puzzle turns on when the givens have one solution (#27)"
```

---

### Task 5 (needs #51): One confirm question for Home and Scan

**Files:**
- Create: `apps/mobile/src/home/hooks/useConfirmReplace/useConfirmReplace.ts`, `useConfirmReplace.constants.ts`, `useConfirmReplace.test.tsx`, `index.ts`
- Modify: `apps/mobile/src/home/screens/HomeScreen/HomeScreen.tsx`
- Modify or delete: `apps/mobile/src/home/screens/HomeScreen/HomeScreen.constants.ts`

- [ ] **Step 1: Write the failing test**

Create `src/home/hooks/useConfirmReplace/useConfirmReplace.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'
import { useConfirmReplace } from './useConfirmReplace'

function answerAlert(text: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
    buttons?.find((button) => button.text === text)?.onPress?.()
  })
}

afterEach(() => jest.restoreAllMocks())

it('asks before the game in progress ends', async () => {
  const alert = answerAlert('New game')
  const { result } = renderHook(() => useConfirmReplace())
  await expect(result.current()).resolves.toBe(true)
  expect(alert).toHaveBeenCalledWith('Start a new game?', 'Your current game ends.', expect.any(Array))
})

it('resolves false on Cancel', async () => {
  answerAlert('Cancel')
  const { result } = renderHook(() => useConfirmReplace())
  await expect(result.current()).resolves.toBe(false)
})
```

- [ ] **Step 2: Run it and see it fail**

```bash
pnpm --filter mobile exec jest src/home/hooks
```

Expected: FAIL, `Cannot find module './useConfirmReplace'`.

- [ ] **Step 3: Move the question**

Create `src/home/hooks/useConfirmReplace/useConfirmReplace.constants.ts` with the four `REPLACE_*` constants moved unchanged from `HomeScreen.constants.ts`:

```ts
export const REPLACE_TITLE = 'Start a new game?'
export const REPLACE_MESSAGE = 'Your current game ends.'
export const REPLACE_CONFIRM = 'New game'
export const REPLACE_CANCEL = 'Cancel'
```

Create `src/home/hooks/useConfirmReplace/useConfirmReplace.ts`:

```ts
import { useCallback } from 'react'
import { Alert } from 'react-native'
import { REPLACE_CANCEL, REPLACE_CONFIRM, REPLACE_MESSAGE, REPLACE_TITLE } from './useConfirmReplace.constants'

/** The question before a new game ends the game in progress. The promise gives true for New game. */
export function useConfirmReplace(): () => Promise<boolean> {
  return useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        Alert.alert(REPLACE_TITLE, REPLACE_MESSAGE, [
          { text: REPLACE_CANCEL, style: 'cancel', onPress: () => resolve(false) },
          { text: REPLACE_CONFIRM, style: 'destructive', onPress: () => resolve(true) },
        ])
      }),
    [],
  )
}
```

Create `src/home/hooks/useConfirmReplace/index.ts`:

```ts
export { useConfirmReplace } from './useConfirmReplace'
```

In `HomeScreen.tsx`, delete the function `confirmReplace` and the `Alert` and `REPLACE_*` imports. Add `import { useConfirmReplace } from '@/home/hooks/useConfirmReplace'` and, in the component, `const confirmReplace = useConfirmReplace()`. The call `await confirmReplace()` does not change. Add `confirmReplace` to the dependencies of any `useCallback` that calls it. Delete the four constants from `HomeScreen.constants.ts`. Delete the file if it is empty then.

- [ ] **Step 4: Run the tests, then commit**

The route tests of #51 cover the Home question. They must pass unchanged.

```bash
pnpm --filter mobile exec jest src/home test/routes.test.tsx
just lint
just typecheck
/usr/bin/git add apps/mobile/src/home
/usr/bin/git commit -m "refactor(home): one hook asks before a new game replaces the game in progress (#27)"
```

---

### Task 6 (needs #51): Start the scanned game

**Files:**
- Create: `apps/mobile/src/scan/hooks/useScannedStart/useScannedStart.ts`, `useScannedStart.test.tsx`, `index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/scan/hooks/useScannedStart/useScannedStart.test.tsx`:

```tsx
import { Stack } from 'expo-router'
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { Alert, Pressable, Text, type AlertButton } from 'react-native'
import { createGame, generate, isWrong } from '@sudoku/core'
import type { ScannedStart } from '@/scan/utils/play.utils'
import { createMemoryStorage, type GameStorage } from '@/storage'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { useScannedStart } from './useScannedStart'

const { givens, solution } = generate('hard', 4)
const open = givens.findIndex((digit) => digit === 0)
const entries = givens.map((_, cell) => (cell === open ? ((solution[open] ?? 0) % 9) + 1 : 0))
const START: ScannedStart = { level: 'hard', puzzle: { givens, solution, entries } }

function PlayProbe() {
  const play = useScannedStart()
  return (
    <Pressable accessibilityRole="button" onPress={() => play(START)}>
      <Text>Play this puzzle</Text>
    </Pressable>
  )
}

function renderScan(storage: GameStorage = createMemoryStorage()) {
  renderRouter(
    {
      _layout: () => (
        <GameStorageContext value={storage}>
          <Stack screenOptions={{ headerShown: false }} />
        </GameStorageContext>
      ),
      index: () => <Text>home</Text>,
      scan: PlayProbe,
      game: () => <Text>game</Text>,
    },
    { initialUrl: '/scan' },
  )
  return storage
}

function answerAlert(text: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
    buttons?.find((button) => button.text === text)?.onPress?.()
  })
}

const pressPlay = async () => fireEvent.press(await screen.findByRole('button', { name: 'Play this puzzle' }))

async function startGenerated(storage: GameStorage) {
  const other = generate('easy', 9)
  await storage.puzzles.start({ level: 'easy', source: 'generated', game: createGame(other) })
}

afterEach(() => jest.restoreAllMocks())

it('starts the scan as the game in progress, then opens the game', async () => {
  const storage = renderScan()
  await pressPlay()
  await waitFor(() => expect(screen).toHavePathname('/game'))
  const progress = await storage.puzzles.current()
  expect(progress).toMatchObject({ level: 'hard', source: 'scanned' })
  expect(progress?.game.givens).toEqual(givens)
  expect(progress?.game.entries[open]).toBe(entries[open])
  expect(progress && isWrong(progress.game, open)).toBe(true)
  expect(progress?.game.mistakes).toBe(0)
})

it('asks before it replaces a game in progress, and Cancel keeps that game', async () => {
  const storage = createMemoryStorage()
  await startGenerated(storage)
  const alert = answerAlert('Cancel')
  renderScan(storage)
  await pressPlay()
  await waitFor(() => expect(alert).toHaveBeenCalledTimes(1))
  expect(screen).toHavePathname('/scan')
  expect(await storage.puzzles.current()).toMatchObject({ source: 'generated' })
})

it('replaces the game in progress on New game', async () => {
  const storage = createMemoryStorage()
  await startGenerated(storage)
  answerAlert('New game')
  renderScan(storage)
  await pressPlay()
  await waitFor(() => expect(screen).toHavePathname('/game'))
  expect(await storage.puzzles.current()).toMatchObject({ source: 'scanned', level: 'hard' })
})

it('a double tap on Play starts one game', async () => {
  const storage = createMemoryStorage()
  const start = jest.spyOn(storage.puzzles, 'start')
  renderScan(storage)
  const play = await screen.findByRole('button', { name: 'Play this puzzle' })
  fireEvent.press(play)
  fireEvent.press(play)
  await waitFor(() => expect(screen).toHavePathname('/game'))
  expect(start).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run it and see it fail**

```bash
pnpm --filter mobile exec jest src/scan/hooks/useScannedStart
```

Expected: FAIL, `Cannot find module './useScannedStart'`.

- [ ] **Step 3: Implement**

Create `src/scan/hooks/useScannedStart/useScannedStart.ts`:

```ts
import { useRouter } from 'expo-router'
import { useCallback, useRef } from 'react'
import { createGame } from '@sudoku/core'
import { useConfirmReplace } from '@/home/hooks/useConfirmReplace'
import type { ScannedStart } from '@/scan/utils/play.utils'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { devWarn, errorMessage } from '@/utils/log.utils'

/** Starts a scanned puzzle as the game in progress (source scanned), then shows the game in place of the scan. */
export function useScannedStart(): (start: ScannedStart) => Promise<void> {
  const router = useRouter()
  const { puzzles } = useGameStorage()
  const confirmReplace = useConfirmReplace()
  // start() discards the game before it, so a second tap must not start a second game.
  const busy = useRef(false)

  return useCallback(
    async ({ level, puzzle }: ScannedStart) => {
      if (busy.current) return
      busy.current = true
      try {
        // Ask from the stored state at the tap, as the home screen does.
        if ((await puzzles.current()) !== null && !(await confirmReplace())) return
        await puzzles.start({ level, source: 'scanned', game: createGame(puzzle) })
        // Replace, not push: Back on the game goes home, and the camera stops with the scan route.
        router.replace('/game')
      } catch (error) {
        devWarn('storage', `The scanned game does not start: ${errorMessage(error)}`)
      } finally {
        busy.current = false
      }
    },
    [puzzles, confirmReplace, router],
  )
}
```

Create `src/scan/hooks/useScannedStart/index.ts`:

```ts
export { useScannedStart } from './useScannedStart'
```

`CorrectionScreen` types `onPlay` as `(start) => void`. A function that returns a promise fits that type. `HomeScreen` passes its async `newGame` the same way.

- [ ] **Step 4: Run the tests, then commit**

```bash
pnpm --filter mobile exec jest src/scan/hooks/useScannedStart
just lint
just typecheck
/usr/bin/git add apps/mobile/src/scan/hooks/useScannedStart
/usr/bin/git commit -m "feat(scan): Play starts the scanned puzzle as the game in progress (#27)"
```

---

### Task 7 (needs #51): Wire the scan flow

**Files:**
- Modify: `apps/mobile/src/scan/screens/ScanFlow/ScanFlow.tsx`, `ScanFlow.test.tsx`
- Modify: `apps/mobile/src/scan/README.md`

- [ ] **Step 1: Write the failing test**

In `ScanFlow.test.tsx`, add after the other `jest.mock` calls:

```ts
jest.mock('@/scan/hooks/useScannedStart', () => ({ useScannedStart: jest.fn() }))
```

Add `import { useScannedStart } from '@/scan/hooks/useScannedStart'`. In `beforeEach`, after `jest.clearAllMocks()`, add `jest.mocked(useScannedStart).mockReturnValue(mockPlay)`, with `const mockPlay = jest.fn()` above `beforeEach`. Add the test:

```tsx
it('hands Play of the review to the scanned start', () => {
  render(<ScanFlow />)
  act(() => jest.mocked(CameraScreen).mock.calls.at(-1)![0].onDone(OK))
  expect(jest.mocked(CorrectionScreen).mock.calls.at(-1)![0].onPlay).toBe(mockPlay)
})
```

- [ ] **Step 2: Run it and see it fail**

```bash
pnpm --filter mobile exec jest src/scan/screens/ScanFlow
```

Expected: FAIL, `onPlay` is `undefined`.

- [ ] **Step 3: Implement**

In `ScanFlow.tsx`, add `import { useScannedStart } from '@/scan/hooks/useScannedStart'`. In the component, add `const play = useScannedStart()`. In the review branch, render:

```tsx
        <CorrectionScreen result={phase.result} layout={layout} onRetake={retake} onPlay={play} />
```

`CameraScreen` does not change. Its correction screen during the transition has no `onPlay`, so Play stays off there.

In `src/scan/README.md`, add `useScannedStart` (start the scanned game) to the hooks row and `play.utils` (the play gate and the level) to the utils row, in the style of the rows that are there.

- [ ] **Step 4: Run the tests, then commit**

The #51 route test "opens the scan flow" now renders `useScannedStart` on the real router with the storage. It must pass unchanged.

```bash
pnpm --filter mobile exec jest src/scan test/routes.test.tsx
just lint
just typecheck
/usr/bin/git add apps/mobile/src/scan/screens/ScanFlow apps/mobile/src/scan/README.md
/usr/bin/git commit -m "feat(scan): the scan review opens the scanned puzzle on the game screen (#27)"
```

---

### Task 8 (needs #51): Scan review to game screen, on the router

**Files:**
- Create: `apps/mobile/test/scannedGame.test.tsx`

This test renders the real correction screen as the `scan` route, without the camera. The real `game` route of #51 then reads the game from storage.

- [ ] **Step 1: Write the test**

```tsx
import { Stack } from 'expo-router'
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { generate } from '@sudoku/core'
import GameRoute from '@/app/game'
import type { CellResult, RecogniseResult } from '@/scanner'
import { useScannedStart } from '@/scan/hooks/useScannedStart'
import { CorrectionScreen } from '@/scan/screens/CorrectionScreen'
import { correctionLayout } from '@/scan/utils/correction.utils'
import { createMemoryStorage, type GameStorage } from '@/storage'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'

const layout = correctionLayout({ width: 402, height: 874 }, { top: 62, bottom: 34, left: 0, right: 0 })
const { givens, solution } = generate('medium', 21)
const opens = givens.flatMap((digit, cell) => (digit === 0 ? [cell] : []))
const wrongCell = opens[0] ?? 0
const rightCell = opens[1] ?? 0
const wrongDigit = ((solution[wrongCell] ?? 0) % 9) + 1
const givenCell = givens.findIndex((digit) => digit !== 0)

function scanResult(): RecogniseResult {
  const cells: CellResult[] = givens.map((digit, cell) => {
    if (digit !== 0) return { digit, kind: 'printed', confidence: 1, validPair: true }
    if (cell === wrongCell) return { digit: wrongDigit, kind: 'handwritten', confidence: 1, validPair: true }
    if (cell === rightCell) return { digit: solution[cell] ?? 0, kind: 'handwritten', confidence: 1, validPair: true }
    return { digit: 0, kind: 'none', confidence: 1, validPair: true }
  })
  return { ok: true, cells, quad: [] as never, corners: 'detected' as never, cornerOffset: null, timings: {} as never }
}

function ScanReview() {
  const play = useScannedStart()
  return <CorrectionScreen result={scanResult()} layout={layout} onRetake={jest.fn()} onPlay={play} />
}

function renderScan(storage: GameStorage = createMemoryStorage()) {
  renderRouter(
    {
      _layout: () => (
        <GameStorageContext value={storage}>
          <Stack screenOptions={{ headerShown: false }} />
        </GameStorageContext>
      ),
      index: () => null,
      scan: ScanReview,
      game: GameRoute,
    },
    { initialUrl: '/scan' },
  )
  return storage
}

const place = (cell: number) => `Row ${Math.floor(cell / 9) + 1}, column ${(cell % 9) + 1}`
const labelOf = (cell: number) => screen.getByTestId(`cell-${cell}`).props.accessibilityLabel as string

async function playScan() {
  const storage = renderScan()
  fireEvent.press(await screen.findByTestId('play'))
  await waitFor(() => expect(screen).toHavePathname('/game'))
  fireEvent(await screen.findByTestId('board'), 'layout', { nativeEvent: { layout: { width: 358, height: 358 } } })
  return storage
}

it('plays the scan: printed digits are givens, handwritten digits are entries', async () => {
  const storage = await playScan()
  expect(labelOf(givenCell)).toBe(`${place(givenCell)}, given ${givens[givenCell]}`)
  expect(labelOf(rightCell)).toBe(`${place(rightCell)}, ${solution[rightCell]}`)
  expect(await storage.puzzles.current()).toMatchObject({ source: 'scanned', level: 'medium' })
})

it('shows a wrong handwritten digit as wrong, without a mistake', async () => {
  await playScan()
  expect(labelOf(wrongCell)).toBe(`${place(wrongCell)}, wrong ${wrongDigit}`)
  expect(screen.getByLabelText('0 of 3 mistakes')).toBeTruthy()
})

it('keeps a given locked on the game screen', async () => {
  await playScan()
  const other = ((givens[givenCell] ?? 0) % 9) + 1
  fireEvent.press(screen.getByTestId(`cell-${givenCell}`))
  fireEvent.press(screen.getByLabelText(new RegExp(`^Enter ${other}`)))
  expect(labelOf(givenCell)).toBe(`${place(givenCell)}, given ${givens[givenCell]}`)
  expect(screen.getByLabelText('0 of 3 mistakes')).toBeTruthy()
})
```

`generate('medium', 21)` has 34 givens, so the level is medium. If the game screen labels differ on `develop` by then, read `cellLabel.utils.ts` and `MistakeDots.tsx` and use their texts.

- [ ] **Step 2: Run it**

```bash
pnpm --filter mobile exec jest test/scannedGame.test.tsx
```

Expected: PASS. A failure here is a wiring bug in tasks 4 to 7. Fix it there.

- [ ] **Step 3: Run every check, then commit**

```bash
just lint
just typecheck
just test-ts
just docs-check
/usr/bin/git add apps/mobile/test/scannedGame.test.tsx
/usr/bin/git commit -m "test(scan): a scan plays on the game screen with locked givens and free entries (#27)"
```

---

### Task 9: iPhone check, criteria, pull request

- [ ] **Step 1:** The developer runs the iPhone steps below on #51's development build, with `just app`. No new build is needed: this plan adds no native code.
- [ ] **Step 2: Tick the criteria of #27** that pass, with `gh issue edit 27 --body-file <file>`. The finish card part of "The finish card shows 'Scanned from paper' (#43)" stays open until #43 merges. Open question 4.
- [ ] **Step 3: Open the pull request** when the developer asks. Body: a summary, the play gate table, the "Files owned" table, the result lines of `just lint`, `just typecheck`, `just test-ts`, `just docs-check`, the iPhone results, and `Closes #27`. Link the ADR-011 amendment from #27. Then a second agent reviews the PR without this session's context (root `AGENTS.md`, Work tracking 8).

---

## iPhone steps for the developer

Use a printed sudoku with a few digits written in by hand, one of them wrong. Do the steps in Daylight. Repeat step 3 in Midnight.

1. Tap Scan a puzzle on the home screen. Scan the paper puzzle. The correction screen shows. If rings show, do not touch them. "Play this puzzle" is on (full colour), and no red line shows above it.
2. Tap Play this puzzle. No question shows (no game in progress). The game screen opens. The printed digits look like givens. The handwritten digits look like entries, and the wrong one shows as wrong. The mistake dots show 0.
3. Tap a printed digit. Tap a number key. The given does not change. Tap the wrong handwritten digit. Tap its correct number. The digit changes and is no longer wrong. The mistake dots still show 0.
4. Tap Back. The home screen shows Continue with the level of the scan. Count the printed digits: 37 or more is Easy, 32 to 36 Medium, 27 to 31 Hard, 26 or fewer Expert.
5. Scan again. On the correction screen, tap a printed digit and tap Clear, then Done. Do this for printed digits until "A given is missing or wrong." shows in red above a dim Play. Tap Play. Nothing happens.
6. Change one printed digit to the same digit as a given in its row. Both cells turn red, and the chip shows "2 givens in conflict". Play is dim. No red line shows.
7. Change a printed digit so that the grid has no solution, but no conflict shows (for example, a digit that leaves an empty cell with no possible number). "This puzzle has no solution. Check the marked cells." shows. If you cannot make this case by hand, skip it: Jest covers it.
8. Fix the givens until Play is on. Tap Play. The question "Start a new game? Your current game ends." shows, because step 2 left a game in progress. Tap Cancel. The correction screen stays. Tap Play again, then New game. The scanned game opens.
9. On the game screen, swipe from the left edge. The home screen shows, not the camera. The green camera dot is gone.
10. Check the panel on the correction screen with a red line shown. The line, Play and Retake fit inside the panel and do not overlap.

Report each step as passed or failed, with a screenshot of any failure.

## Open questions

1. **A scan that is already solved.** If the givens and the entries fill the grid correctly, `createGame` makes a won game and `PuzzleRepository.start` refuses it. The developer's table does not cover this case. **Recommendation:** block Play with "This puzzle is already solved." (planned in tasks 2 and 4). The other choice is to show the finish card at once, which needs #43.
2. **The ADR-011 rows in `00-DECISIONS.md` and `09-architecture-decisions.md`.** The amendment of task 1 changes "Scanned puzzles get no level in v1". Root `AGENTS.md` asks for both index rows in the same change. #51 owns these files in this wave. **Recommendation:** #27 runs after #51 merges, so #27 adds this clause to both ADR-011 rows: "A scanned puzzle takes the level of the nearest givens target (amendment 2026-10-12)." If #38 still runs then and touches the files, #27 rebases on it.
3. **Glossary rows.** **Recommendation:** add these rows (by #51, or by #27 after #51 merges):
   - `| Play gate | The check before "Play this puzzle" loads a scan. Given conflicts, no solution and several solutions block it. Uncertain cells and wrong entries do not |`
   - `| Scanned puzzle | A puzzle loaded from a scan. Its source is scanned. Its level is the level of the nearest givens target (ADR-011) |`
   - Amend "Correction screen" (the #51 text) to end with: "… The player can fix a digit and its kind there. Play this puzzle loads it when the play gate passes".
4. **The finish card criterion.** "The finish card shows 'Scanned from paper' (#43)" needs #43, which is not built. #27 stores the source `scanned` in the game in progress and in the history, which is all #43 needs. **Recommendation:** #27 ticks "The game screen (#37) plays the scanned puzzle". Move the finish card half to #43, which already has "The card shows the source: 'Scanned from paper' or the puzzle number".
5. **`HomeScreen` is #51's file.** Task 5 moves `confirmReplace` out of it into `useConfirmReplace`, so Home and Scan ask the same question. #51 is merged by then, so no parallel work touches it. **Recommendation:** approve the move. The other choice is a second copy of the question in `src/scan/`, which can drift.
6. **"Try this puzzle again" on a lost scanned game.** #51's plan (task 13, part A) retries with `createGame({ givens, solution })`. For a scanned game, this drops the handwritten digits. **Recommendation:** accept it: the handwritten digits were the old attempt, and the retry starts from the givens. The `Game` does not record which entries came from the scan, so the other choice needs a new field in `SavedGame`.
7. **"New puzzle" after a scanned game.** `PlayScreen.newPuzzle` (#51) starts a generated puzzle at the level of the scan. **Recommendation:** accept it. A second scan goes through Home, Scan a puzzle.
8. **"Check the marked cells" with no marked cell.** The developer's text says "Check the marked cells". A grid with no solution can have no ring and no conflict mark. **Recommendation:** keep the developer's exact text. The rings, when there are any, show before the text, as the developer asked.
