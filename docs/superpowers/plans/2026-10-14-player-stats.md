# Player Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The player sees their own stats on a home card and on a stats screen with an All tab and one tab per level.

**Architecture:** The game history on the device is the source of truth. A new `StatsRepository` counts the stats in SQL, with one contract test that the SQLite repository and the in-memory fake both pass. The day streak is the one stat that `@sudoku/core` counts, from the won times, because SQLite has no time zones. The history gets a third result, `abandoned`. A sync layer can wrap the local repositories later (SUD-01).

**Tech Stack:** TypeScript, Expo SDK 57, expo-sqlite, Expo Router 57, react-native-unistyles 3, Jest and `@testing-library/react-native` (app), Vitest (core).

**Spec:** [ADR-023](../../architecture/adr/adr-023-player-stats.md), the amendment to [ADR-021](../../architecture/adr/adr-021-four-themes.md) that Task 1 writes, and the [design drafts](https://claude.ai/artifact/WRpx2oWdg7bAh3WzvLh2BJ) (private artifact). Issue: [#95](https://github.com/vandemaelefelix/sudoku/issues/95) (show player stats).

## Global Constraints

- SUD-01: the game and the stats work offline.
- SUD-04: `@sudoku/core` has no React Native, Expo, npm package or Node I/O import. `Intl` is a language global, not an import.
- ADR-012: a screen never writes SQL. A screen reads stats through `StatsRepository`.
- ADR-015: no colour value outside `src/theme/`. A styles file imports only `react-native`, `react-native-unistyles` and `src/theme/`. Do not spread a Unistyles style.
- `apps/mobile/AGENTS.md` import rules: `@/` imports, a folder through its `index.ts`, no barrel, no cycle. A `utils` or `constants` file imports no React, React Native, component, screen or hook.
- Writing style (root `AGENTS.md`): simplified technical English. A comment gives a reason, never an action. No `TODO`, `FIXME`, `XXX` or `HACK`. No commented-out code. A lint suppression names its rule and its reason.
- Commits follow Conventional Commits and name the issue: `feat(core): add hasMoves (#95)`. **Commit steps run only when the developer has asked for commits** (root `AGENTS.md`).
- Branch: `feature/95-player-stats`. The pull request targets `develop` and says `Closes #95`. A second agent reviews it before merge.
- Test commands:
  - Core: `pnpm --filter @sudoku/core exec vitest run <path>`
  - App: `pnpm --filter mobile exec jest <path>`
  - Everything: `just test-ts`, `just typecheck`, `just lint`
- Colours of the design: the mocks use the Op-art palette. The code reads theme tokens only.

## Review Focus

Each line has its test in the task named at the end.

1. **A database that already holds history rows** must keep every row, the order of the list and the index after migration 4. (Task 4)
2. **A win near midnight** counts on the day of the player's time zone, not the UTC day. (Tasks 3 and 6)
3. **A device with no games, and a level with no games** show a dash, never `NaN`, `0%` or `Infinity`. (Tasks 6, 8 and 10)
4. **A saved game that does not load**, replaced by a new game, still lets the new game start and leaves no history entry. (Task 5)
5. **Retry and New puzzle after a finished game** must not add an `abandoned` entry for the game that already finished. (Task 5)

---

### Task 1: Write the decisions down and update the ticket

**Files:**
- Modify: `docs/architecture/adr/adr-023-player-stats.md`
- Modify: `docs/architecture/adr/adr-021-four-themes.md`
- Modify: `docs/architecture/00-DECISIONS.md` (the ADR-021 row)
- Modify: `docs/architecture/09-architecture-decisions.md` (the ADR-021 row)

**Interfaces:**
- Consumes: nothing.
- Produces: the names that every later task uses: `hasMoves`, `computeStreak`, `Streak`, `StatsRepository.summary / byLevel / recentTimes / streak`, `StatsFilter.includeScanned`, the slot `summaryEdge`, the token `components.summary`.

The first version of ADR-023 named `summary(filter)` with a time zone. The design needs the table of all levels and the last 14 days, so the interface changes. ADR-023 is `Proposed`, so it changes in place.

- [ ] **Step 1: Change point 2 of ADR-023**

Add this bullet after the bullet "A game with no move writes no entry":

```markdown
   - A game has moves when `hasMoves` in `@sudoku/core` says so. It has an undo step, a mistake or a hint. Selecting a cell is not a move.
```

- [ ] **Step 2: Replace point 3 of ADR-023**

Replace the whole of point 3 with:

```markdown
3. **A `StatsRepository` gives the stats.** It sits next to `HistoryRepository`. Every method takes `StatsFilter`, which is `{ includeScanned: boolean }`.
   - `summary(level, filter)` takes a level, or `null` for all levels. It returns the counts, the win rate, the best and average time, the flawless wins and the average mistakes and hints.
   - `byLevel(filter)` returns the summary of each of the four levels.
   - `recentTimes(level, count, filter)` returns the times of the last won games, oldest first.
   - `streak(timeZone, filter)` returns the current and the longest day streak and the last 14 days.
   - The SQLite version counts the first three with aggregate queries. A screen never writes SQL (ADR-012).
   - The streak is the exception. SQLite has no time zones, so `computeStreak` in `@sudoku/core` groups the won times by day. Every implementation uses the same function.
```

- [ ] **Step 3: Replace the last two rows of the rules table in point 4**

```markdown
   | Day streak | The number of days in a row with at least one won game, in the time zone that the caller gives. A streak stays alive until the end of the next day |
   | Scanned games | Off by default (`includeScanned`). A scanned level is an estimate (ADR-011). When on, scanned games count in every stat except the best time |
```

(The old "Day streak" and "Source" rows go away. Keep the rows above them.)

- [ ] **Step 4: Replace the streak bullet in Consequences**

Replace "The streak query needs a gaps-and-islands pattern and a time zone. It is the hardest query." with:

```markdown
- The streak is the one stat that SQL does not count. `computeStreak` reads every won time. This costs little until the history has tens of thousands of games.
```

- [ ] **Step 5: Amend ADR-021**

Append this section at the end of `adr-021-four-themes.md`:

```markdown
## Amendment 2026-10-14: the summary edge

The stats card (ADR-023) shows 4 wavy lines in Op-art, across a white card. The `panelEdge` slot is as wide as the window, and the `cardEdge` slot is as wide as the finish card and white. Neither fits.

1. **A fourth slot, `summaryEdge`.** It is a band on the top edge of the stats card.

   | Slot | Where | Daylight | Midnight | Op-art | Progressive |
   | --- | --- | --- | --- | --- | --- |
   | `summaryEdge` | A band on the top edge of the stats card | — | — | 4 wavy lines in `colors.lineStrong`, as wide as the content column | — |

   The height of the band is `size.panelEdge`. A theme with `size.panelEdge` of 0 draws nothing.
2. **A component token group, `components.summary`.** It holds `border`, `borderWidth`, `rule` and `ruleWidth`. The stats card and the rules between the sections of the stats screen read it.
```

- [ ] **Step 6: Update the two index rows of ADR-021**

In `00-DECISIONS.md` and `09-architecture-decisions.md`, add to the end of the ADR-021 decision text: ` Amended 2026-10-14: the \`summaryEdge\` slot and \`components.summary\`.` Keep the table format.

- [ ] **Step 7: Check that every relative link resolves**

Run: `grep -n "](" docs/architecture/adr/adr-023-player-stats.md docs/architecture/adr/adr-021-four-themes.md | head -30`
Expected: every `(...)` target exists. Open any you doubt with `ls`.

- [ ] **Step 8: Update the ticket**

Write the new body to the scratchpad file `issue-95.md`, then run `gh issue edit 95 --body-file <that file>`.

```markdown
## What and why

The player sees their own stats: games played and won, win rate, best and average time, flawless wins, mistakes, hints and a day streak. A card on the home screen opens a stats screen. The stats come from the game history on the device (F-09). They work offline (SUD-01).

The architecture is in `docs/architecture/adr/adr-023-player-stats.md` (ADR-023, status Proposed). It amends ADR-012 and, for the card edge, ADR-021. The designs for the Op-art theme are in the [design drafts](https://claude.ai/artifact/WRpx2oWdg7bAh3WzvLh2BJ) (private artifact). The plan is `docs/superpowers/plans/2026-10-14-player-stats.md`.

## Acceptance criteria

- [ ] Migration 4 adds the history result `abandoned`. It rebuilds `game_history`, keeps every row and creates the index `game_history_best_time` again.
- [ ] Starting a new game over a game that has moves writes an `abandoned` history entry in the same transaction that soft-deletes the old game. A game with no move writes no entry. A finished game never gets one.
- [ ] `StatsRepository` has `summary`, `byLevel`, `recentTimes` and `streak`. The SQLite version follows the rules table of ADR-023.
- [ ] `repositories.contract.ts` states the stats rules. The SQLite repository and the in-memory fake both pass it.
- [ ] A test covers the day streak around midnight in two time zones.
- [ ] The home screen shows the stats card: win rate and day streak. The card opens the stats screen. Without finished games the home screen shows a line of text instead.
- [ ] The stats screen has a tab bar: All, Easy, Medium, Hard and Expert. The All tab shows a table of the four levels and the streak with the last 14 days. A level tab shows the times, the chart of the last 10 wins and the game numbers of that level.
- [ ] A level without games shows the empty state of the design.
- [ ] A switch includes scanned puzzles in the stats. It is off by default and the player's choice is saved.
- [ ] Both screens use theme tokens and theme decorations only. They render in all four themes.
- [ ] The screens have accessibility labels. Time and percent values read as words.
- [ ] ADR-023 is accepted, or amended, when the work proves or changes it.

## References

F-09, SUD-01, SUD-04, ADR-011, ADR-012, ADR-016, ADR-021, ADR-023.

## Notes

- The card shows the win rate and streak of all levels. The tabs filter the rest of the screen. The streak counts a win at any level.
- Not in this issue: a leaderboard, a move log, cloud sync and a "New game" button in the empty state of a level. They need their own issues.
```

- [ ] **Step 9: Commit**

```bash
git add docs/architecture docs/superpowers/plans/2026-10-14-player-stats.md
git commit -m "docs(arch): settle the stats interface and the summary edge (#95)"
```

---

### Task 2: `hasMoves` in core

**Files:**
- Create: `packages/sudoku-core/src/game/progress.ts`
- Create: `packages/sudoku-core/src/game/progress.test.ts`
- Modify: `packages/sudoku-core/src/index.ts`
- Modify: `packages/sudoku-core/src/index.test.ts`

**Interfaces:**
- Consumes: `Game` (`packages/sudoku-core/src/game/types.ts`).
- Produces: `hasMoves(game: Game): boolean`, exported from `@sudoku/core`.

- [ ] **Step 1: Write the failing test**

`packages/sudoku-core/src/game/progress.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hint, place, select, toggleNote, undo } from './actions'
import { createGame } from './createGame'
import { hasMoves } from './progress'
import { SAMPLE_GIVENS, SAMPLE_SOLUTION } from './samplePuzzle'

const newGame = () => createGame({ givens: SAMPLE_GIVENS, solution: SAMPLE_SOLUTION })

describe('hasMoves', () => {
  it('is false for a new game and for a selected cell', () => {
    expect(hasMoves(newGame())).toBe(false)
    expect(hasMoves(select(newGame(), 2))).toBe(false)
  })

  it('is true after a number, a note or a hint', () => {
    const selected = select(newGame(), 2)
    expect(hasMoves(place(selected, 4).game)).toBe(true)
    expect(hasMoves(toggleNote(selected, 4).game)).toBe(true)
    expect(hasMoves(hint(newGame(), () => 0).game)).toBe(true)
  })

  it('is false when every move is undone and none was a mistake', () => {
    const placed = place(select(newGame(), 2), 4).game
    expect(hasMoves(undo(placed).game)).toBe(false)
  })

  it('stays true after a mistake that is undone, because undo keeps the mistake', () => {
    const wrong = place(select(newGame(), 2), 1).game
    expect(wrong.mistakes).toBe(1)
    expect(hasMoves(undo(wrong).game)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test and see it fail**

Run: `pnpm --filter @sudoku/core exec vitest run src/game/progress.test.ts`
Expected: FAIL, `Failed to resolve import "./progress"`.

- [ ] **Step 3: Write the code**

`packages/sudoku-core/src/game/progress.ts`:

```ts
import type { Game } from './types'

/**
 * True when the player edited the grid, made a mistake or used a hint. Undo gives back an edit but never a mistake or a hint,
 * so a game that the player undid back to its start can still have moves (ADR-023).
 */
export function hasMoves(game: Game): boolean {
  return game.undoSteps.length > 0 || game.mistakes > 0 || game.hintsUsed > 0
}
```

- [ ] **Step 4: Export it**

In `packages/sudoku-core/src/index.ts`, add after the `completion` export line:

```ts
export { hasMoves } from './game/progress'
```

In `packages/sudoku-core/src/index.test.ts`, add `'hasMoves',` to the list of names.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @sudoku/core exec vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/sudoku-core/src
git commit -m "feat(core): add hasMoves (#95)"
```

---

### Task 3: `computeStreak` in core

**Files:**
- Create: `packages/sudoku-core/src/stats/streak.ts`
- Create: `packages/sudoku-core/src/stats/streak.test.ts`
- Modify: `packages/sudoku-core/src/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `STREAK_WINDOW_DAYS = 14`
  - `type Streak = { readonly current: number; readonly longest: number; readonly recent: readonly boolean[] }`
  - `computeStreak(winTimes: readonly string[], now: string, timeZone: string): Streak`. `winTimes` and `now` are ISO 8601 UTC strings. `recent` is oldest first and its last item is today. It throws a `RangeError` for an unknown time zone.

- [ ] **Step 1: Write the failing tests**

`packages/sudoku-core/src/stats/streak.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeStreak, STREAK_WINDOW_DAYS } from './streak'

const noon = (day: string) => `${day}T12:00:00.000Z`

describe('computeStreak', () => {
  it('has no streak without a win', () => {
    expect(computeStreak([], noon('2026-10-12'), 'UTC')).toEqual({
      current: 0,
      longest: 0,
      recent: Array.from({ length: STREAK_WINDOW_DAYS }, () => false),
    })
  })

  it('counts the days in a row up to today', () => {
    const wins = ['2026-10-10', '2026-10-11', '2026-10-12'].map(noon)
    const streak = computeStreak(wins, '2026-10-12T20:00:00.000Z', 'UTC')
    expect(streak).toMatchObject({ current: 3, longest: 3 })
    expect(streak.recent).toHaveLength(STREAK_WINDOW_DAYS)
    expect(streak.recent.slice(-4)).toEqual([false, true, true, true])
  })

  it('keeps a streak alive until the end of the next day', () => {
    const wins = ['2026-10-10', '2026-10-11', '2026-10-12'].map(noon)
    expect(computeStreak(wins, '2026-10-13T08:00:00.000Z', 'UTC')).toMatchObject({ current: 3 })
    expect(computeStreak(wins, '2026-10-14T08:00:00.000Z', 'UTC')).toMatchObject({ current: 0, longest: 3 })
  })

  it('finds the longest run in the past', () => {
    const wins = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-12'].map(noon)
    expect(computeStreak(wins, noon('2026-10-12'), 'UTC')).toMatchObject({ current: 1, longest: 4 })
  })

  it('counts two wins on one day once', () => {
    const wins = ['2026-10-12T08:00:00.000Z', '2026-10-12T18:00:00.000Z']
    expect(computeStreak(wins, noon('2026-10-12'), 'UTC')).toMatchObject({ current: 1, longest: 1 })
  })

  it('counts the day in the time zone of the player', () => {
    // 09:00 UTC is 23:00 on 12 Oct and 11:00 UTC is 01:00 on 13 Oct in Kiritimati (UTC+14).
    const wins = ['2026-10-12T09:00:00.000Z', '2026-10-12T11:00:00.000Z']
    const now = '2026-10-12T12:00:00.000Z'
    expect(computeStreak(wins, now, 'UTC')).toMatchObject({ current: 1 })
    expect(computeStreak(wins, now, 'Pacific/Kiritimati')).toMatchObject({ current: 2 })
  })

  it('shows the last 14 days with today on the right', () => {
    const wins = ['2026-09-29', '2026-09-30', '2026-10-12'].map(noon)
    const { recent } = computeStreak(wins, noon('2026-10-12'), 'UTC')
    // 29 Sep is 13 days before 12 Oct: the first day of the window. 30 Sep is the second.
    expect(recent[0]).toBe(true)
    expect(recent[1]).toBe(true)
    expect(recent[13]).toBe(true)
    expect(recent.filter(Boolean)).toHaveLength(3)
    const older = computeStreak([noon('2026-09-28')], noon('2026-10-12'), 'UTC')
    expect(older.recent.some(Boolean)).toBe(false)
  })

  it('ignores a win in the future', () => {
    expect(computeStreak([noon('2026-10-20')], noon('2026-10-12'), 'UTC')).toMatchObject({ current: 0, longest: 1 })
  })

  it('throws for a time zone that does not exist', () => {
    expect(() => computeStreak([noon('2026-10-12')], noon('2026-10-12'), 'Nowhere/Land')).toThrow(RangeError)
  })
})
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `pnpm --filter @sudoku/core exec vitest run src/stats/streak.test.ts`
Expected: FAIL, `Failed to resolve import "./streak"`.

- [ ] **Step 3: Write the code**

`packages/sudoku-core/src/stats/streak.ts`:

```ts
/** How many days `Streak.recent` covers, today included. */
export const STREAK_WINDOW_DAYS = 14

export type Streak = {
  /** Days in a row with a win, counted back from today. A streak stays alive until the end of the next day (ADR-023). */
  readonly current: number
  readonly longest: number
  /** Oldest first. The last item is today. True for a day with a win. */
  readonly recent: readonly boolean[]
}

const DAY_MS = 86_400_000

/** One formatter for all times: building a formatter costs more than using it, and the history can hold thousands of wins. */
function dayNumberOf(timeZone: string): (iso: string) => number {
  const format = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' })
  return (iso) => {
    const parts = format.formatToParts(new Date(iso))
    const part = (type: string) => Number(parts.find((candidate) => candidate.type === type)?.value)
    return Date.UTC(part('year'), part('month') - 1, part('day')) / DAY_MS
  }
}

/**
 * Counts the streak from the times of the won games. The day of a time is its calendar day in `timeZone`, an IANA name
 * such as "Europe/Brussels". All times are ISO 8601 UTC. SQLite has no time zones, so every StatsRepository uses this function.
 * Throws a RangeError for a time zone that does not exist.
 */
export function computeStreak(winTimes: readonly string[], now: string, timeZone: string): Streak {
  const dayOf = dayNumberOf(timeZone)
  const days = new Set(winTimes.map(dayOf))
  const today = dayOf(now)

  let current = 0
  // Today may still get its win, so a streak that ends yesterday is alive.
  let day = days.has(today) ? today : today - 1
  while (days.has(day)) {
    current += 1
    day -= 1
  }

  let longest = 0
  let run = 0
  let previous = Number.NaN
  for (const next of [...days].sort((a, b) => a - b)) {
    run = next === previous + 1 ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = next
  }

  const recent = Array.from({ length: STREAK_WINDOW_DAYS }, (_, index) =>
    days.has(today - (STREAK_WINDOW_DAYS - 1 - index)),
  )
  return { current, longest, recent }
}
```

- [ ] **Step 4: Export it**

In `packages/sudoku-core/src/index.ts`, add:

```ts
export { computeStreak, STREAK_WINDOW_DAYS } from './stats/streak'
export type { Streak } from './stats/streak'
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @sudoku/core exec vitest run && pnpm --filter @sudoku/core typecheck`
Expected: PASS.

- [ ] **Step 6: Check the boundary rule**

Run: `just boundaries`
Expected: no `sud-04` error. `Intl` is a global and adds no import.

- [ ] **Step 7: Commit**

```bash
git add packages/sudoku-core/src
git commit -m "feat(core): count the day streak in the time zone of the player (#95)"
```

---

### Task 4: The `abandoned` result and migration 4

**Files:**
- Modify: `apps/mobile/src/storage/storage.types.ts` (the `GameResult` type)
- Modify: `apps/mobile/src/storage/migrations.ts`
- Modify: `apps/mobile/src/storage/migrations.test.ts`

**Interfaces:**
- Consumes: the migrations list `MIGRATIONS` and `migrate(db, migrations?)`.
- Produces: `GameResult = 'won' | 'lost' | 'abandoned'`. `MIGRATIONS` has a fourth item. The table `game_history` accepts the result `abandoned`.

- [ ] **Step 1: Write the failing tests**

Add to `apps/mobile/src/storage/migrations.test.ts`, inside the top-level `describe('migrate', ...)` before its closing `})` (the last one in the file), or as a new `describe` at the end:

```ts
describe('migration 4: the abandoned result', () => {
  const HISTORY_ROW = `INSERT INTO game_history
    (id, level, source, result, played_ms, mistakes, hints_used, finished_at, created_at, updated_at, seed)
    VALUES (?, ?, 'generated', ?, ?, 0, 0, ?, ?, ?, ?)`

  it('keeps every history row, its order and its index', async () => {
    await migrate(db, MIGRATIONS.slice(0, 3))
    const at = (second: number) => `2026-10-12T09:00:0${second}.000Z`
    await db.runAsync(HISTORY_ROW, ['a', 'easy', 'won', 60_000, at(1), at(1), at(1), 412_077])
    await db.runAsync(HISTORY_ROW, ['b', 'hard', 'lost', 30_000, at(2), at(2), at(2), null])

    await migrate(db)

    const rows = await db.getAllAsync<{ id: string; result: string; seed: number | null }>(
      'SELECT id, result, seed FROM game_history ORDER BY rowid',
      [],
    )
    expect(rows).toEqual([
      { id: 'a', result: 'won', seed: 412_077 },
      { id: 'b', result: 'lost', seed: null },
    ])
    const index = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'game_history_best_time'",
      [],
    )
    expect(index).toEqual({ name: 'game_history_best_time' })
  })

  it('accepts abandoned and refuses any other result', async () => {
    await migrate(db)
    const at = '2026-10-12T09:00:00.000Z'
    await db.runAsync(HISTORY_ROW, ['c', 'easy', 'abandoned', 1_000, at, at, at, null])
    await expect(db.runAsync(HISTORY_ROW, ['d', 'easy', 'paused', 1_000, at, at, at, null])).rejects.toThrow(
      'CHECK constraint failed',
    )
  })
})
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `pnpm --filter mobile exec jest src/storage/migrations.test.ts`
Expected: FAIL. `MIGRATIONS.slice(0, 3)` equals the full list, and `abandoned` fails the CHECK.

- [ ] **Step 3: Write the migration**

In `apps/mobile/src/storage/migrations.ts`, append a fourth item to `MIGRATIONS`, after the migration that adds the seed:

```ts
  // SQLite cannot change a CHECK constraint, so the history table is built again with the result abandoned (ADR-023).
  `CREATE TABLE game_history_next (
    id TEXT PRIMARY KEY NOT NULL,
    level TEXT NOT NULL CHECK (level IN ${LEVELS}),
    source TEXT NOT NULL CHECK (source IN ${SOURCES}),
    result TEXT NOT NULL CHECK (result IN ('won', 'lost', 'abandoned')),
    played_ms INTEGER NOT NULL CHECK (played_ms >= 0),
    mistakes INTEGER NOT NULL CHECK (mistakes >= 0),
    hints_used INTEGER NOT NULL CHECK (hints_used >= 0),
    finished_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    seed INTEGER CHECK (seed IS NULL OR seed >= 0)
  );
  INSERT INTO game_history_next
    (id, level, source, result, played_ms, mistakes, hints_used, finished_at, created_at, updated_at, deleted_at, seed)
    SELECT id, level, source, result, played_ms, mistakes, hints_used, finished_at, created_at, updated_at, deleted_at, seed
    FROM game_history;
  DROP TABLE game_history;
  ALTER TABLE game_history_next RENAME TO game_history;
  CREATE INDEX game_history_best_time ON game_history (level, result, played_ms) WHERE deleted_at IS NULL;`,
```

- [ ] **Step 4: Widen the type**

In `apps/mobile/src/storage/storage.types.ts`:

```ts
export type GameResult = 'won' | 'lost' | 'abandoned'
```

- [ ] **Step 5: Run the storage tests**

Run: `pnpm --filter mobile exec jest src/storage`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `just typecheck`
Expected: PASS. If a `switch` or a record over `GameResult` reports a missing case, add `abandoned` there. Nothing outside `src/storage` reads the result today.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/storage
git commit -m "feat(storage): add the abandoned history result (#95)"
```

---

### Task 5: A new game abandons the game it replaces

**Files:**
- Modify: `apps/mobile/src/storage/repositories.contract.ts`
- Modify: `apps/mobile/src/storage/PuzzleRepository.ts`
- Modify: `apps/mobile/src/storage/memoryStorage.ts`
- Modify: `apps/mobile/src/storage/sqliteStorage.test.ts`

**Interfaces:**
- Consumes: `hasMoves` (Task 2), `insertHistoryEntry` (`HistoryRepository.ts`), `GameResult` with `abandoned` (Task 4).
- Produces:
  - Contract helpers exported from `repositories.contract.ts`: `wonWithHint(playedMs)`, `wonWithMistake(playedMs)`, `movedGame()`.
  - Behaviour: `puzzles.start` over a game in progress that has moves writes a history entry with `result: 'abandoned'`, the id, level, source and seed of the old game, and its `playedMs`, `mistakes` and `hintsUsed`.

- [ ] **Step 1: Add helpers to the contract**

In `repositories.contract.ts`, change `function wonWithHint` to `export function wonWithHint`, and add after it:

```ts
/** One wrong number in cell 2, then the right one. */
export function wonWithMistake(playedMs: number): Game {
  const wrong = place(tick(nearlyWon(), playedMs), 1).game
  return place(wrong, 4).game
}

/** A game in progress that has one move and no mistake. */
export function movedGame(playedMs = 61_000): Game {
  return place(select(tick(newGame(), playedMs), 2), 4).game
}
```

- [ ] **Step 2: Write the failing contract tests**

Add inside `describeGameStorage`, after the test "discards the game in progress when a new one starts":

```ts
    it('records a game as abandoned when a new game replaces it after a move', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', seed: 77, game: newGame() })
      await storage.puzzles.save(first.id, movedGame(61_000))
      await storage.puzzles.start({ level: 'hard', source: 'generated', game: newGame() })
      await expect(storage.history.list()).resolves.toEqual([
        {
          id: first.id,
          level: 'easy',
          source: 'generated',
          seed: 77,
          result: 'abandoned',
          playedMs: 61_000,
          mistakes: 0,
          hintsUsed: 0,
          finishedAt: expect.any(String),
        },
      ])
    })

    it('keeps the mistakes and the hints of an abandoned game', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      const wrong = place(select(newGame(), 2), 1).game
      await storage.puzzles.save(first.id, wrong)
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      const [entry] = await storage.history.list()
      expect(entry).toMatchObject({ id: first.id, result: 'abandoned', mistakes: 1 })
    })

    it('records no entry for a game without a move', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await storage.puzzles.save(first.id, select(newGame(), 2))
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await expect(storage.history.list()).resolves.toEqual([])
    })

    it('records no abandoned entry when a new game follows a finished game', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: nearlyWon() })
      await storage.puzzles.save(first.id, wonGame(40_000))
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      const results = (await storage.history.list()).map((entry) => entry.result)
      expect(results).toEqual(['won'])
    })

    it('records no entry for a game that a discard removed', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await storage.puzzles.save(first.id, movedGame())
      await storage.puzzles.discard(first.id)
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await expect(storage.history.list()).resolves.toEqual([])
    })

    it('leaves an abandoned game out of the best time', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await storage.puzzles.save(first.id, movedGame(5_000))
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      await expect(storage.history.bestTimes()).resolves.toEqual({})
    })
```

- [ ] **Step 3: Run the tests and see them fail**

Run: `pnpm --filter mobile exec jest src/storage`
Expected: FAIL in both the SQLite and the in-memory describe blocks. The history is empty where an entry is expected.

- [ ] **Step 4: Write the SQLite code**

In `PuzzleRepository.ts`, change the import and add the helper above `createSqlitePuzzleRepository`:

```ts
import { fromSavedGame, hasMoves, toSavedGame, type Game } from '@sudoku/core'
import { devWarn, errorMessage } from '@/utils/log.utils'
import { insertHistoryEntry } from './HistoryRepository'
import type { SqlDatabase, SqlExecutor } from './sql.types'
```

```ts
/**
 * A game that a new game replaces is abandoned when the player made a move (ADR-023).
 * A saved game that does not load leaves no entry: its time and mistakes are unknown.
 */
async function recordAbandoned(txn: SqlExecutor, row: ProgressRow, now: string): Promise<void> {
  let game: Game
  try {
    game = fromSavedGame(JSON.parse(row.saved_game))
  } catch (error) {
    devWarn('storage', `The replaced game ${row.id} does not load, so it has no history entry: ${errorMessage(error)}`)
    return
  }
  if (!hasMoves(game)) return
  await insertHistoryEntry(txn, {
    id: row.id,
    level: row.level,
    source: row.source,
    seed: row.seed,
    result: 'abandoned',
    playedMs: game.playedMs,
    mistakes: game.mistakes,
    hintsUsed: game.hintsUsed,
    finishedAt: now,
  })
}
```

Then, in `insert`, read the old row before the `UPDATE`:

```ts
          await db.withExclusiveTransactionAsync(async (txn) => {
            const replaced = await txn.getFirstAsync<ProgressRow>(
              `SELECT id, level, source, seed, saved_game FROM game_in_progress
              WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
              [],
            )
            if (replaced !== null) await recordAbandoned(txn, replaced, now)
            await txn.runAsync('UPDATE game_in_progress SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL', [
```

(The rest of `insert` stays as it is.)

- [ ] **Step 5: Write the in-memory code**

In `memoryStorage.ts`, import `hasMoves`:

```ts
import { fromSavedGame, hasMoves, toSavedGame, type SavedGame } from '@sudoku/core'
```

Replace the start of `puzzles.start` so it records the replaced game:

```ts
    async start({ level, source, seed = null, game }) {
      if (resultOf(game) !== null) throw new RangeError(`A ${game.status} game cannot start`)
      const replaced = load()
      if (replaced !== null && hasMoves(replaced.game)) {
        entries.unshift({
          id: replaced.id,
          level: replaced.level,
          source: replaced.source,
          seed: replaced.seed,
          result: 'abandoned',
          playedMs: replaced.game.playedMs,
          mistakes: replaced.game.mistakes,
          hintsUsed: replaced.game.hintsUsed,
          finishedAt: deps.now(),
        })
      }
      progress = { id: deps.newId(), level, source, seed, saved: toSavedGame(game) }
      return { id: progress.id, level, source, seed, game }
    },
```

- [ ] **Step 6: Add the SQLite-only tests**

Add to `sqliteStorage.test.ts`, inside `describe('createSqliteStorage', ...)`:

```ts
  it('starts a game over a saved game that does not load, and writes no history entry', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { db, storage } = await openStorage()
    const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
    await db.runAsync('UPDATE game_in_progress SET saved_game = ? WHERE id = ?', ['{"version":99}', id])

    const next = await storage.puzzles.start({ level: 'hard', source: 'generated', game: newGame() })

    await expect(storage.puzzles.current()).resolves.toEqual(next)
    await expect(storage.history.list()).resolves.toEqual([])
    warn.mockRestore()
  })

  it('rolls back a start whose abandoned entry fails, and keeps the game in progress', async () => {
    const { db, storage } = await openStorage()
    const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
    await storage.puzzles.save(first.id, movedGame())
    // A history entry with the id of the game makes the abandoned entry fail on the primary key.
    const at = '2026-01-01T00:00:00.000Z'
    await db.runAsync(
      `INSERT INTO game_history
        (id, level, source, result, played_ms, mistakes, hints_used, finished_at, created_at, updated_at)
        VALUES (?, 'easy', 'generated', 'lost', 1, 3, 0, ?, ?, ?)`,
      [first.id, at, at, at],
    )

    await expect(storage.puzzles.start({ level: 'hard', source: 'generated', game: newGame() })).rejects.toThrow(
      'UNIQUE constraint failed',
    )
    await expect(storage.puzzles.current()).resolves.toMatchObject({ id: first.id })
  })
```

Add `movedGame` to the contract import at the top of `sqliteStorage.test.ts`:

```ts
import { describeGameStorage, movedGame, newGame, testDeps, wonGame } from './repositories.contract'
```

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter mobile exec jest src/storage`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/storage
git commit -m "feat(storage): record an abandoned game when a new game replaces it (#95)"
```

---

### Task 6: `StatsRepository`

**Files:**
- Create: `apps/mobile/src/storage/StatsRepository.ts`
- Create: `apps/mobile/src/storage/memoryStats.ts`
- Modify: `apps/mobile/src/storage/gameStorage.types.ts`
- Modify: `apps/mobile/src/storage/sqliteStorage.ts`
- Modify: `apps/mobile/src/storage/memoryStorage.ts`
- Modify: `apps/mobile/src/storage/index.ts`
- Modify: `apps/mobile/src/storage/repositories.contract.ts`

**Interfaces:**
- Consumes: `computeStreak`, `Streak` (Task 3), `GameResult` with `abandoned` (Task 4), `StorageDeps`, `SqlExecutor`.
- Produces (all exported from `@/storage` as types):

```ts
export type StatsFilter = { includeScanned: boolean }

export type LevelSummary = {
  played: number            // won + lost
  won: number
  lost: number
  abandoned: number
  winRate: number | null    // won / played, null when played is 0
  bestMs: number | null     // generated, won, no hints
  averageMs: number | null  // won
  flawlessWins: number
  averageMistakes: number | null  // over won and lost games
  averageHints: number | null
}

export type StatsRepository = {
  summary(level: Level | null, filter: StatsFilter): Promise<LevelSummary>
  byLevel(filter: StatsFilter): Promise<Record<Level, LevelSummary>>
  recentTimes(level: Level, count: number, filter: StatsFilter): Promise<number[]>   // oldest first
  streak(timeZone: string, filter: StatsFilter): Promise<Streak>
}
```

`GameStorage` gains `readonly stats: StatsRepository`.

- [ ] **Step 1: Write the interface file**

`apps/mobile/src/storage/StatsRepository.ts` (the interface now, the SQLite code in Step 5):

```ts
import { computeStreak, LEVELS, type Streak } from '@sudoku/core'
import type { SqlExecutor } from './sql.types'
import type { Level, StorageDeps } from './storage.types'

/** The stats that depend on which games count. Scanned games count only when `includeScanned` is true (ADR-023). */
export type StatsFilter = { includeScanned: boolean }

export type LevelSummary = {
  /** Won and lost games. An abandoned game is not played. */
  played: number
  won: number
  lost: number
  abandoned: number
  /** Won divided by played. Null when nothing was played. */
  winRate: number | null
  /** The shortest time of a won generated game without hints. A scanned game never counts, whatever the filter says. */
  bestMs: number | null
  /** The mean time of the won games. */
  averageMs: number | null
  /** Won games with no mistake and no hint. */
  flawlessWins: number
  /** The mean over the won and lost games. */
  averageMistakes: number | null
  averageHints: number | null
}

/** The counted stats of the history (ADR-023). Screens use this interface, never SQL. */
export type StatsRepository = {
  /** `level` null counts all levels. */
  summary(level: Level | null, filter: StatsFilter): Promise<LevelSummary>
  byLevel(filter: StatsFilter): Promise<Record<Level, LevelSummary>>
  /** The times of the last `count` won games of a level, oldest first. */
  recentTimes(level: Level, count: number, filter: StatsFilter): Promise<number[]>
  /** `timeZone` is an IANA name. Rejects with a RangeError for a name that does not exist. */
  streak(timeZone: string, filter: StatsFilter): Promise<Streak>
}
```

- [ ] **Step 2: Add the stats to the storage type**

`gameStorage.types.ts`:

```ts
import type { HistoryRepository } from './HistoryRepository'
import type { PuzzleRepository } from './PuzzleRepository'
import type { StatsRepository } from './StatsRepository'

export type GameStorage = {
  readonly puzzles: PuzzleRepository
  readonly history: HistoryRepository
  readonly stats: StatsRepository
}
```

`index.ts`, add:

```ts
export type { LevelSummary, StatsFilter, StatsRepository } from './StatsRepository'
```

- [ ] **Step 3: Write the failing contract tests**

In `repositories.contract.ts`, add the top-level helpers above `describeGameStorage` (add `PuzzleSource, Level` to the existing `./storage.types` import):

```ts
const GENERATED = { includeScanned: false }
const WITH_SCANNED = { includeScanned: true }

async function finish(storage: GameStorage, level: Level, game: Game, source: PuzzleSource = 'generated') {
  const { id } = await storage.puzzles.start({ level, source, game: newGame() })
  await storage.puzzles.save(id, game)
}
```

Add inside `describeGameStorage`, before its closing `})`s:

```ts
    describe('stats', () => {
      const NOTHING = {
        played: 0,
        won: 0,
        lost: 0,
        abandoned: 0,
        winRate: null,
        bestMs: null,
        averageMs: null,
        flawlessWins: 0,
        averageMistakes: null,
        averageHints: null,
      }

      it('has no numbers before the first game', async () => {
        await expect(storage.stats.summary(null, GENERATED)).resolves.toEqual(NOTHING)
        await expect(storage.stats.summary('easy', GENERATED)).resolves.toEqual(NOTHING)
      })

      it('counts the games of a level by the rules of ADR-023', async () => {
        await finish(storage, 'easy', wonGame(60_000))
        await finish(storage, 'easy', wonWithMistake(90_000))
        await finish(storage, 'easy', wonWithHint(30_000))
        await finish(storage, 'easy', lostGame(20_000))
        await expect(storage.stats.summary('easy', GENERATED)).resolves.toEqual({
          played: 4,
          won: 3,
          lost: 1,
          abandoned: 0,
          winRate: 0.75,
          bestMs: 60_000,
          averageMs: 60_000,
          flawlessWins: 1,
          averageMistakes: 1,
          averageHints: 0.25,
        })
      })

      it('gives a win rate of 0 for a level with only lost games', async () => {
        await finish(storage, 'hard', lostGame(20_000))
        await expect(storage.stats.summary('hard', GENERATED)).resolves.toMatchObject({ played: 1, winRate: 0 })
      })

      it('counts an abandoned game apart from the win rate', async () => {
        await finish(storage, 'easy', wonGame(60_000))
        const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
        await storage.puzzles.save(id, movedGame())
        await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
        await expect(storage.stats.summary('easy', GENERATED)).resolves.toMatchObject({
          played: 1,
          won: 1,
          abandoned: 1,
          winRate: 1,
        })
      })

      it('counts one level or all levels', async () => {
        await finish(storage, 'easy', wonGame(10_000))
        await finish(storage, 'hard', lostGame(20_000))
        await expect(storage.stats.summary(null, GENERATED)).resolves.toMatchObject({ played: 2, won: 1, lost: 1 })
        await expect(storage.stats.summary('hard', GENERATED)).resolves.toMatchObject({ played: 1, won: 0 })
      })

      it('counts a scanned game only when the filter says so, and never for the best time', async () => {
        await finish(storage, 'easy', wonGame(60_000))
        await finish(storage, 'easy', wonGame(10_000), 'scanned')
        await expect(storage.stats.summary('easy', GENERATED)).resolves.toMatchObject({
          played: 1,
          averageMs: 60_000,
          bestMs: 60_000,
        })
        await expect(storage.stats.summary('easy', WITH_SCANNED)).resolves.toMatchObject({
          played: 2,
          averageMs: 35_000,
          bestMs: 60_000,
        })
      })

      it('gives the summary of each of the four levels', async () => {
        await finish(storage, 'medium', wonGame(10_000))
        const levels = await storage.stats.byLevel(GENERATED)
        expect(Object.keys(levels)).toEqual(['easy', 'medium', 'hard', 'expert'])
        expect(levels.medium).toMatchObject({ played: 1, won: 1 })
        expect(levels.expert).toEqual(NOTHING)
      })

      it('gives the times of the last wins, oldest first', async () => {
        await finish(storage, 'easy', wonGame(10_000))
        await finish(storage, 'easy', wonGame(20_000))
        await finish(storage, 'easy', wonGame(30_000))
        await finish(storage, 'easy', lostGame(5_000))
        await expect(storage.stats.recentTimes('easy', 2, GENERATED)).resolves.toEqual([20_000, 30_000])
        await expect(storage.stats.recentTimes('hard', 5, GENERATED)).resolves.toEqual([])
      })

      describe('streak', () => {
        async function clocked() {
          let nowIso = '2026-10-10T09:00:00.000Z'
          let ids = 0
          const clockedStorage = await open({ newId: () => `clocked-${++ids}`, now: () => nowIso })
          return {
            storage: clockedStorage,
            setNow: (iso: string) => {
              nowIso = iso
            },
          }
        }

        it('counts the days in a row with a win, and lets a day pass', async () => {
          const { storage: clockedStorage, setNow } = await clocked()
          for (const day of ['2026-10-10', '2026-10-11', '2026-10-12']) {
            setNow(`${day}T09:00:00.000Z`)
            await finish(clockedStorage, 'easy', wonGame(60_000))
          }
          setNow('2026-10-12T20:00:00.000Z')
          const streak = await clockedStorage.stats.streak('UTC', GENERATED)
          expect(streak).toMatchObject({ current: 3, longest: 3 })
          expect(streak.recent).toHaveLength(14)
          expect(streak.recent.slice(-3)).toEqual([true, true, true])
          setNow('2026-10-13T08:00:00.000Z')
          await expect(clockedStorage.stats.streak('UTC', GENERATED)).resolves.toMatchObject({ current: 3 })
          setNow('2026-10-14T08:00:00.000Z')
          await expect(clockedStorage.stats.streak('UTC', GENERATED)).resolves.toMatchObject({ current: 0, longest: 3 })
        })

        it('counts the day in the time zone of the player', async () => {
          const { storage: clockedStorage, setNow } = await clocked()
          setNow('2026-10-12T09:00:00.000Z')
          await finish(clockedStorage, 'easy', wonGame(60_000))
          setNow('2026-10-12T11:00:00.000Z')
          await finish(clockedStorage, 'easy', wonGame(60_000))
          setNow('2026-10-12T12:00:00.000Z')
          await expect(clockedStorage.stats.streak('UTC', GENERATED)).resolves.toMatchObject({ current: 1 })
          await expect(clockedStorage.stats.streak('Pacific/Kiritimati', GENERATED)).resolves.toMatchObject({
            current: 2,
          })
        })

        it('does not count a lost game or an abandoned game as a win', async () => {
          const { storage: clockedStorage, setNow } = await clocked()
          setNow('2026-10-10T09:00:00.000Z')
          await finish(clockedStorage, 'easy', wonGame(60_000))
          setNow('2026-10-11T09:00:00.000Z')
          await finish(clockedStorage, 'easy', lostGame(20_000))
          setNow('2026-10-12T09:00:00.000Z')
          await finish(clockedStorage, 'easy', wonGame(60_000))
          await expect(clockedStorage.stats.streak('UTC', GENERATED)).resolves.toMatchObject({
            current: 1,
            longest: 1,
          })
        })

        it('counts a scanned win only when the filter says so', async () => {
          const { storage: clockedStorage, setNow } = await clocked()
          setNow('2026-10-12T09:00:00.000Z')
          await finish(clockedStorage, 'easy', wonGame(60_000), 'scanned')
          await expect(clockedStorage.stats.streak('UTC', GENERATED)).resolves.toMatchObject({ current: 0 })
          await expect(clockedStorage.stats.streak('UTC', WITH_SCANNED)).resolves.toMatchObject({ current: 1 })
        })
      })
    })
```

- [ ] **Step 4: Run the tests and see them fail**

Run: `pnpm --filter mobile exec jest src/storage`
Expected: FAIL, `Cannot read properties of undefined (reading 'summary')`.

- [ ] **Step 5: Write the SQLite repository**

Append to `StatsRepository.ts`:

```ts
type SummaryRow = {
  won: number
  lost: number
  abandoned: number
  flawless: number
  best_ms: number | null
  average_ms: number | null
  average_mistakes: number | null
  average_hints: number | null
}

// One row for every call: an aggregate without GROUP BY always returns a row, with NULL or 0 when no game matches.
// The best time reads only generated games, whatever the filter says (ADR-012, amendment).
const SUMMARY_SQL = `SELECT
    COALESCE(SUM(result = 'won'), 0) AS won,
    COALESCE(SUM(result = 'lost'), 0) AS lost,
    COALESCE(SUM(result = 'abandoned'), 0) AS abandoned,
    COALESCE(SUM(result = 'won' AND mistakes = 0 AND hints_used = 0), 0) AS flawless,
    MIN(CASE WHEN result = 'won' AND hints_used = 0 AND source = 'generated' THEN played_ms END) AS best_ms,
    AVG(CASE WHEN result = 'won' THEN played_ms END) AS average_ms,
    AVG(CASE WHEN result IN ('won', 'lost') THEN mistakes END) AS average_mistakes,
    AVG(CASE WHEN result IN ('won', 'lost') THEN hints_used END) AS average_hints
  FROM game_history
  WHERE deleted_at IS NULL AND (? IS NULL OR level = ?) AND (? = 1 OR source = 'generated')`

const RECENT_SQL = `SELECT played_ms FROM (
    SELECT played_ms, finished_at, rowid AS row_id FROM game_history
    WHERE result = 'won' AND level = ? AND deleted_at IS NULL AND (? = 1 OR source = 'generated')
    ORDER BY finished_at DESC, rowid DESC LIMIT ?
  ) ORDER BY finished_at ASC, row_id ASC`

const WINS_SQL = `SELECT finished_at FROM game_history
  WHERE result = 'won' AND deleted_at IS NULL AND (? = 1 OR source = 'generated')`

export function createSqliteStatsRepository(db: SqlExecutor, deps: StorageDeps): StatsRepository {
  const summary: StatsRepository['summary'] = async (level, { includeScanned }) => {
    const row = await db.getFirstAsync<SummaryRow>(SUMMARY_SQL, [level, level, includeScanned ? 1 : 0])
    // The query always gives a row.
    const counts = row ?? { won: 0, lost: 0, abandoned: 0, flawless: 0, best_ms: null, average_ms: null, average_mistakes: null, average_hints: null }
    const played = counts.won + counts.lost
    return {
      played,
      won: counts.won,
      lost: counts.lost,
      abandoned: counts.abandoned,
      winRate: played === 0 ? null : counts.won / played,
      bestMs: counts.best_ms,
      averageMs: counts.average_ms,
      flawlessWins: counts.flawless,
      averageMistakes: counts.average_mistakes,
      averageHints: counts.average_hints,
    }
  }

  return {
    summary,
    async byLevel(filter) {
      const summaries = await Promise.all(LEVELS.map((level) => summary(level, filter)))
      return Object.fromEntries(LEVELS.map((level, index) => [level, summaries[index]])) as Record<Level, LevelSummary>
    },
    recentTimes: async (level, count, { includeScanned }) => {
      const rows = await db.getAllAsync<{ played_ms: number }>(RECENT_SQL, [level, includeScanned ? 1 : 0, count])
      return rows.map((row) => row.played_ms)
    },
    async streak(timeZone, { includeScanned }) {
      const rows = await db.getAllAsync<{ finished_at: string }>(WINS_SQL, [includeScanned ? 1 : 0])
      return computeStreak(
        rows.map((row) => row.finished_at),
        deps.now(),
        timeZone,
      )
    },
  }
}
```

In `sqliteStorage.ts`:

```ts
import { createSqliteStatsRepository } from './StatsRepository'
```

and add to the returned object:

```ts
    stats: createSqliteStatsRepository(db, deps),
```

- [ ] **Step 6: Run the SQLite tests**

Run: `pnpm --filter mobile exec jest src/storage/sqliteStorage.test.ts`
Expected: the SQLite stats tests PASS. The in-memory ones still fail.

- [ ] **Step 7: Write the in-memory fake**

`apps/mobile/src/storage/memoryStats.ts`:

```ts
import { computeStreak, LEVELS } from '@sudoku/core'
import type { LevelSummary, StatsFilter, StatsRepository } from './StatsRepository'
import type { HistoryEntry, Level, StorageDeps } from './storage.types'

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
}

function counted(entries: readonly HistoryEntry[], { includeScanned }: StatsFilter): HistoryEntry[] {
  return entries.filter((entry) => includeScanned || entry.source === 'generated')
}

function summarize(entries: readonly HistoryEntry[], level: Level | null, filter: StatsFilter): LevelSummary {
  const rows = counted(entries, filter).filter((entry) => level === null || entry.level === level)
  const won = rows.filter((entry) => entry.result === 'won')
  const finished = rows.filter((entry) => entry.result === 'won' || entry.result === 'lost')
  const best = won.filter((entry) => entry.hintsUsed === 0 && entry.source === 'generated').map((entry) => entry.playedMs)
  return {
    played: finished.length,
    won: won.length,
    lost: finished.length - won.length,
    abandoned: rows.filter((entry) => entry.result === 'abandoned').length,
    winRate: finished.length === 0 ? null : won.length / finished.length,
    bestMs: best.length === 0 ? null : Math.min(...best),
    averageMs: mean(won.map((entry) => entry.playedMs)),
    flawlessWins: won.filter((entry) => entry.mistakes === 0 && entry.hintsUsed === 0).length,
    averageMistakes: mean(finished.map((entry) => entry.mistakes)),
    averageHints: mean(finished.map((entry) => entry.hintsUsed)),
  }
}

/** The in-memory fake of StatsRepository. It counts by the same rules as the SQL, and the contract test keeps both honest. */
export function createMemoryStatsRepository(entries: () => readonly HistoryEntry[], deps: StorageDeps): StatsRepository {
  return {
    async summary(level, filter) {
      return summarize(entries(), level, filter)
    },
    async byLevel(filter) {
      return Object.fromEntries(LEVELS.map((level) => [level, summarize(entries(), level, filter)])) as Record<
        Level,
        LevelSummary
      >
    },
    async recentTimes(level, count, filter) {
      // The entries run newest first.
      const wins = counted(entries(), filter).filter((entry) => entry.level === level && entry.result === 'won')
      return wins
        .slice(0, count)
        .reverse()
        .map((entry) => entry.playedMs)
    },
    async streak(timeZone, filter) {
      const wins = counted(entries(), filter).filter((entry) => entry.result === 'won')
      return computeStreak(
        wins.map((entry) => entry.finishedAt),
        deps.now(),
        timeZone,
      )
    },
  }
}
```

In `memoryStorage.ts`:

```ts
import { createMemoryStatsRepository } from './memoryStats'
```

and change the return line to:

```ts
  return { puzzles, history, stats: createMemoryStatsRepository(() => entries, deps) }
```

- [ ] **Step 8: Run all storage tests**

Run: `pnpm --filter mobile exec jest src/storage`
Expected: PASS for both implementations.

- [ ] **Step 9: Fix any storage object that the type change breaks**

Run: `just typecheck`
Expected: if a test or a mock builds a `GameStorage` literal without `stats`, TypeScript names it. Add `stats: createMemoryStorage().stats` there, or build the object from `createMemoryStorage()`. Search first: `grep -rn "history:" apps/mobile/src --include=*.ts --include=*.tsx | grep -v "src/storage/"`.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/src
git commit -m "feat(storage): add StatsRepository with one contract for every implementation (#95)"
```

---

### Task 7: The summary edge and the summary tokens

**Files:**
- Modify: `apps/mobile/src/theme/theme.types.ts`
- Modify: `apps/mobile/src/theme/themes/daylight/daylight.ts`, `midnight/midnight.ts`, `opart/opart.ts`, `progressive/progressive.ts`
- Modify: `apps/mobile/src/theme/decorations/decorations.types.ts`
- Modify: `apps/mobile/src/theme/decorations/OpartWaves/OpartWaves.tsx`, `OpartWaves/index.ts`
- Modify: `apps/mobile/src/theme/decorations/registry.ts`
- Modify: `apps/mobile/src/theme/decorations/ThemeDecoration/ThemeDecoration.test.tsx`

**Interfaces:**
- Consumes: `Waves` (private helper in `OpartWaves.tsx`), `useUnistyles`.
- Produces:
  - `Theme['components']['summary']`: `{ border: string; borderWidth: number; rule: string; ruleWidth: number }`
  - `DecorationSlot` includes `'summaryEdge'`. `<ThemeDecoration slot="summaryEdge" />` draws 4 waves in Op-art and nothing in the other themes.

- [ ] **Step 1: Write the failing test**

In `ThemeDecoration.test.tsx`, add `<ThemeDecoration slot="summaryEdge" />` to the "draws nothing in %s" test (next to the other slots), and add:

```tsx
it('draws the wavy lines on the Op-art summary edge, as wide as the content column', () => {
  inTheme(THEMES.opart)
  render(<ThemeDecoration slot="summaryEdge" />)
  expect(screen.getByTestId('decoration-opart-summary-waves')).toBeTruthy()
  expect(screen.getByTestId('skia-path').props.color).toBe(THEMES.opart.components.summary.border)
})

it('draws nothing on the Progressive summary edge', () => {
  inTheme(THEMES.progressive)
  render(<ThemeDecoration slot="summaryEdge" />)
  expect(screen.toJSON()).toBeNull()
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm --filter mobile exec jest src/theme/decorations`
Expected: FAIL (the slot and the token do not exist).

- [ ] **Step 3: Add the token to the type**

In `theme.types.ts`, add inside `components`, after the `pulse` entry:

```ts
    /** The stats card (the border) and the rules between the sections of the stats screen. Widths in points. */
    summary: { border: string; borderWidth: number; rule: string; ruleWidth: number }
```

- [ ] **Step 4: Fill the token in each theme**

Add as the last entry of `components` in each theme file:

- `opart.ts` and `progressive.ts`: `summary: { border: colors.lineStrong, borderWidth: 1.5, rule: colors.lineStrong, ruleWidth: 1.5 },`
- `daylight.ts` and `midnight.ts`: `summary: { border: colors.line, borderWidth: 1, rule: colors.line, ruleWidth: 1 },`

(If a theme file names its colours object differently, use the object that holds `line` and `lineStrong` in that file.)

- [ ] **Step 5: Add the slot and the component**

`decorations.types.ts`:

```ts
export type DecorationSlot = 'panelEdge' | 'titleMark' | 'cardEdge' | 'summaryEdge'
```

In `OpartWaves.tsx`, add:

```tsx
/** The Op-art stats card edge: the same 4 lines across the content column, inside the border of the card. */
export function OpartSummaryWaves() {
  const { theme } = useUnistyles()
  const { width } = useWindowDimensions()
  const { border, borderWidth } = theme.components.summary
  return (
    <Waves
      testID="decoration-opart-summary-waves"
      width={width - 2 * theme.space.lg - 2 * borderWidth}
      height={theme.size.panelEdge}
      color={border}
    />
  )
}
```

`OpartWaves/index.ts`:

```ts
export { OpartCardWaves, OpartSummaryWaves, OpartWaves } from './OpartWaves'
```

`registry.ts`: import `OpartSummaryWaves` with the others and set `opart: { panelEdge: OpartWaves, cardEdge: OpartCardWaves, summaryEdge: OpartSummaryWaves },`.

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter mobile exec jest src/theme && just typecheck`
Expected: PASS. The contrast and token tests need no change.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/theme
git commit -m "feat(theme): add the summary edge decoration and the summary tokens (#95)"
```

---

### Task 8: The stats foundation: formats, the scanned switch, the data hook

**Files:**
- Create: `apps/mobile/src/stats/constants/stats.constants.ts`
- Create: `apps/mobile/src/stats/utils/format.utils.ts` and `format.utils.test.ts`
- Create: `apps/mobile/src/utils/timeZone.utils.ts` and `timeZone.utils.test.ts`
- Create: `apps/mobile/src/stats/constants/scanned.constants.ts`
- Create: `apps/mobile/src/stats/utils/includeScanned.utils.ts` and `includeScanned.utils.test.ts`
- Create: `apps/mobile/src/stats/hooks/useIncludeScanned/` (`useIncludeScanned.ts`, `useIncludeScanned.test.tsx`, `index.ts`)
- Create: `apps/mobile/src/stats/hooks/useStats/` (`useStats.ts`, `useStats.test.tsx`, `index.ts`)
- Modify: `apps/mobile/AGENTS.md` (the folder list)

**Interfaces:**
- Consumes: `GameStorageContext`, `useGameStorage` (`@/storage/hooks/useGameStorage`), `createMemoryStorage`, `createMemorySettings` (`@/settings/memorySettings`), `kvSettings`, `StatsRepository`.
- Produces:
  - `StatsTab = 'all' | Level`, `TIMES_COUNT = 10`, `NONE = '–'`
  - `formatTime(ms: number | null): string`, `timeWords(ms: number): string`, `formatPercent(rate: number | null): string`, `formatAverage(value: number | null): string`
  - `deviceTimeZone(): string`
  - `useIncludeScanned(): { includeScanned: boolean; setIncludeScanned(on: boolean): void }`
  - `useStats(includeScanned: boolean): StatsState` where
    `StatsState = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; data: StatsData }` and
    `StatsData = { overall: LevelSummary; levels: Record<Level, LevelSummary>; times: Record<Level, readonly number[]>; streak: Streak }`

- [ ] **Step 1: Write the constants**

`stats/constants/stats.constants.ts`:

```ts
import type { Level } from '@sudoku/core'

/** The tab bar of the stats screen: the overview of all levels, or one level. */
export type StatsTab = 'all' | Level

/** How many wins the chart of a level shows. */
export const TIMES_COUNT = 10

/** The text for a number that does not exist, such as the best time of a level without a win. */
export const NONE = '–'
```

`stats/constants/scanned.constants.ts`:

```ts
/** The SettingsRepository key of the switch that includes scanned puzzles in the stats. The value is "on" or "off" (ADR-012). */
export const INCLUDE_SCANNED_KEY = 'app.stats.includeScanned'
```

- [ ] **Step 2: Write the failing format tests**

`stats/utils/format.utils.test.ts`:

```ts
import { NONE } from '@/stats/constants/stats.constants'
import { formatAverage, formatPercent, formatTime, timeWords } from './format.utils'

describe('formatTime', () => {
  it.each([
    [272_000, '04:32'],
    [0, '00:00'],
    [59_600, '01:00'],
    [6_000_000, '100:00'],
  ])('writes %p ms as %p', (ms, text) => {
    expect(formatTime(ms)).toBe(text)
  })

  it('writes a dash for no time', () => {
    expect(formatTime(null)).toBe(NONE)
  })
})

describe('timeWords', () => {
  it('reads a time as words for a screen reader', () => {
    expect(timeWords(272_000)).toBe('4 minutes 32 seconds')
    expect(timeWords(61_000)).toBe('1 minute 1 second')
    expect(timeWords(30_000)).toBe('30 seconds')
  })
})

describe('formatPercent', () => {
  it('rounds to a whole percent, and writes a dash for none', () => {
    expect(formatPercent(0.75)).toBe('75%')
    expect(formatPercent(19 / 25)).toBe('76%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(null)).toBe(NONE)
  })
})

describe('formatAverage', () => {
  it('writes one decimal, and a dash for none', () => {
    expect(formatAverage(1.4)).toBe('1.4')
    expect(formatAverage(0)).toBe('0.0')
    expect(formatAverage(null)).toBe(NONE)
  })
})
```

- [ ] **Step 3: Run it and see it fail**

Run: `pnpm --filter mobile exec jest src/stats/utils/format.utils.test.ts`
Expected: FAIL, cannot find `./format.utils`.

- [ ] **Step 4: Write the format code**

`stats/utils/format.utils.ts`:

```ts
import { NONE } from '@/stats/constants/stats.constants'

/** Minutes and seconds, such as "04:32". A time of 100 minutes or more keeps its third digit. */
export function formatTime(ms: number | null): string {
  if (ms === null) return NONE
  // Round first: 59.6 seconds must read 01:00, not 00:60.
  const seconds = Math.round(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function unit(count: number, name: string): string {
  return `${count} ${name}${count === 1 ? '' : 's'}`
}

/** The same time as words, for an accessibility label. */
export function timeWords(ms: number): string {
  const seconds = Math.round(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes === 0) return unit(rest, 'second')
  return `${unit(minutes, 'minute')}${rest === 0 ? '' : ` ${unit(rest, 'second')}`}`
}

export function formatPercent(rate: number | null): string {
  return rate === null ? NONE : `${Math.round(rate * 100)}%`
}

export function formatAverage(value: number | null): string {
  return value === null ? NONE : value.toFixed(1)
}
```

- [ ] **Step 5: Write the time zone helper and its test**

`apps/mobile/src/utils/timeZone.utils.test.ts`:

```ts
import { deviceTimeZone } from './timeZone.utils'

it('gives an IANA time zone that Intl accepts', () => {
  const zone = deviceTimeZone()
  expect(zone.length).toBeGreaterThan(0)
  expect(() => new Intl.DateTimeFormat('en-US', { timeZone: zone })).not.toThrow()
})
```

`apps/mobile/src/utils/timeZone.utils.ts`:

```ts
/** The time zone of the device as an IANA name. UTC when the runtime does not tell. */
export function deviceTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'
}
```

- [ ] **Step 6: Write the failing test of the switch store**

`stats/utils/includeScanned.utils.test.ts`:

```ts
import { createMemorySettings } from '@/settings/memorySettings'
import { INCLUDE_SCANNED_KEY } from '@/stats/constants/scanned.constants'
import { createIncludeScannedStore, parseIncludeScanned } from './includeScanned.utils'

describe('parseIncludeScanned', () => {
  it.each([
    [null, false],
    ['off', false],
    ['broken', false],
    ['on', true],
  ])('reads %p as %p', (value, on) => {
    expect(parseIncludeScanned(value)).toBe(on)
  })
})

describe('createIncludeScannedStore', () => {
  it('reads the saved switch once, on the first get', () => {
    const settings = createMemorySettings({ [INCLUDE_SCANNED_KEY]: 'on' })
    const getSync = jest.spyOn(settings, 'getSync')
    const store = createIncludeScannedStore(settings)
    expect(store.get()).toBe(true)
    store.get()
    expect(getSync).toHaveBeenCalledTimes(1)
  })

  it('tells the listeners, then saves', async () => {
    const settings = createMemorySettings()
    const store = createIncludeScannedStore(settings)
    const seen: boolean[] = []
    store.subscribe(() => seen.push(store.get()))
    await store.set(true)
    expect(seen).toEqual([true])
    await expect(settings.get(INCLUDE_SCANNED_KEY)).resolves.toBe('on')
  })

  it('does nothing when the value does not change', async () => {
    const settings = createMemorySettings()
    const set = jest.spyOn(settings, 'set')
    await createIncludeScannedStore(settings).set(false)
    expect(set).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 7: Run it and see it fail, then write the store**

Run: `pnpm --filter mobile exec jest src/stats/utils/includeScanned.utils.test.ts`
Expected: FAIL, cannot find `./includeScanned.utils`.

`stats/utils/includeScanned.utils.ts`:

```ts
import type { SettingsRepository } from '@/settings/SettingsRepository'
import { INCLUDE_SCANNED_KEY } from '@/stats/constants/scanned.constants'
import { devLog, errorMessage } from '@/utils/log.utils'

export type IncludeScannedStore = {
  get(): boolean
  subscribe(listener: () => void): () => void
  /** Changes the value in memory and tells the listeners first. Then it saves. A failed save rejects. */
  set(on: boolean): Promise<void>
}

/** Scanned puzzles stay out of the stats unless the player turned them on. */
export function parseIncludeScanned(value: string | null): boolean {
  return value === 'on'
}

export function createIncludeScannedStore(settings: SettingsRepository): IncludeScannedStore {
  let current: boolean | null = null
  const listeners = new Set<() => void>()
  const get = (): boolean => {
    if (current === null) {
      try {
        current = parseIncludeScanned(settings.getSync(INCLUDE_SCANNED_KEY))
      } catch (error) {
        devLog('stats', `saved scanned switch unreadable: ${errorMessage(error)}`)
        current = false
      }
    }
    return current
  }
  return {
    get,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    async set(on) {
      if (get() === on) return
      current = on
      for (const listener of listeners) listener()
      await settings.set(INCLUDE_SCANNED_KEY, on ? 'on' : 'off')
    },
  }
}
```

- [ ] **Step 8: Write the hook and its test**

`stats/hooks/useIncludeScanned/useIncludeScanned.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react-native'
import { useIncludeScanned } from './useIncludeScanned'

it('is off at first, and one switch serves every screen', async () => {
  const first = renderHook(() => useIncludeScanned())
  const second = renderHook(() => useIncludeScanned())
  expect(first.result.current.includeScanned).toBe(false)
  await act(async () => first.result.current.setIncludeScanned(true))
  expect(second.result.current.includeScanned).toBe(true)
  await act(async () => first.result.current.setIncludeScanned(false))
  expect(second.result.current.includeScanned).toBe(false)
})
```

`stats/hooks/useIncludeScanned/useIncludeScanned.ts`:

```ts
import { useSyncExternalStore } from 'react'
import { kvSettings } from '@/settings/SettingsRepository'
import { createIncludeScannedStore } from '@/stats/utils/includeScanned.utils'
import { devLog, errorMessage } from '@/utils/log.utils'

// One store for the app: the switch on the stats screen must reach the home card too.
const store = createIncludeScannedStore(kvSettings)

function setIncludeScanned(on: boolean): void {
  store.set(on).catch((error: unknown) => devLog('stats', `scanned switch not saved: ${errorMessage(error)}`))
}

/** Whether scanned puzzles count in the stats. setIncludeScanned keeps its identity. */
export function useIncludeScanned(): { includeScanned: boolean; setIncludeScanned(on: boolean): void } {
  const includeScanned = useSyncExternalStore(store.subscribe, store.get)
  return { includeScanned, setIncludeScanned }
}
```

`useIncludeScanned/index.ts`: `export { useIncludeScanned } from './useIncludeScanned'`

- [ ] **Step 9: Write the failing test of `useStats`**

`stats/hooks/useStats/useStats.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { createMemoryStorage } from '@/storage'
import { newGame, wonGame } from '@/storage/repositories.contract'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { useStats } from './useStats'

jest.mock('@/utils/timeZone.utils', () => ({ deviceTimeZone: () => 'UTC' }))

function wrapperFor(storage: ReturnType<typeof createMemoryStorage>) {
  return ({ children }: { children: ReactNode }) => <GameStorageContext value={storage}>{children}</GameStorageContext>
}

it('loads the overview, the levels, the times and the streak', async () => {
  const storage = createMemoryStorage()
  const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
  await storage.puzzles.save(id, wonGame(60_000))

  const { result } = renderHook(() => useStats(false), { wrapper: wrapperFor(storage) })
  expect(result.current).toEqual({ status: 'loading' })

  await waitFor(() => expect(result.current.status).toBe('ready'))
  if (result.current.status !== 'ready') throw new Error('not ready')
  const { data } = result.current
  expect(data.overall).toMatchObject({ played: 1, won: 1 })
  expect(data.levels.easy).toMatchObject({ played: 1 })
  expect(data.levels.expert).toMatchObject({ played: 0, winRate: null })
  expect(data.times.easy).toEqual([60_000])
  expect(data.times.hard).toEqual([])
  expect(data.streak.recent).toHaveLength(14)
})

it('fails softly when the storage fails', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  const storage = createMemoryStorage()
  jest.spyOn(storage.stats, 'summary').mockRejectedValue(new Error('locked'))
  const { result } = renderHook(() => useStats(false), { wrapper: wrapperFor(storage) })
  await waitFor(() => expect(result.current).toEqual({ status: 'failed' }))
  warn.mockRestore()
})
```

- [ ] **Step 10: Run it and see it fail, then write the hook**

Run: `pnpm --filter mobile exec jest src/stats/hooks/useStats`
Expected: FAIL, cannot find `./useStats`.

`stats/hooks/useStats/useStats.ts`:

```ts
import { useEffect, useState } from 'react'
import { LEVELS, type Streak } from '@sudoku/core'
import { TIMES_COUNT } from '@/stats/constants/stats.constants'
import type { Level, LevelSummary } from '@/storage'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { deviceTimeZone } from '@/utils/timeZone.utils'
import { devWarn, errorMessage } from '@/utils/log.utils'

export type StatsData = {
  overall: LevelSummary
  levels: Record<Level, LevelSummary>
  times: Record<Level, readonly number[]>
  streak: Streak
}

export type StatsState = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; data: StatsData }

/**
 * Reads every number of the stats screen at once, so a tab change shows no wait. It reads again when the filter changes
 * and keeps the old numbers on screen until the new ones arrive.
 */
export function useStats(includeScanned: boolean): StatsState {
  const { stats } = useGameStorage()
  const [state, setState] = useState<StatsState>({ status: 'loading' })

  useEffect(() => {
    let live = true
    const filter = { includeScanned }
    Promise.all([
      stats.summary(null, filter),
      stats.byLevel(filter),
      stats.streak(deviceTimeZone(), filter),
      Promise.all(LEVELS.map((level) => stats.recentTimes(level, TIMES_COUNT, filter))),
    ])
      .then(([overall, levels, streak, recent]) => {
        if (!live) return
        const times = Object.fromEntries(LEVELS.map((level, index) => [level, recent[index]])) as Record<
          Level,
          readonly number[]
        >
        setState({ status: 'ready', data: { overall, levels, times, streak } })
      })
      .catch((error: unknown) => {
        devWarn('storage', `The stats do not load: ${errorMessage(error)}`)
        if (live) setState({ status: 'failed' })
      })
    return () => {
      live = false
    }
  }, [stats, includeScanned])

  return state
}
```

`useStats/index.ts`: `export { useStats } from './useStats'` and `export type { StatsData, StatsState } from './useStats'`.

- [ ] **Step 11: Name the new folder in AGENTS.md**

In `apps/mobile/AGENTS.md`, add `src/stats/` (stats UI: screens, components, hooks, utils, constants) to the "Keep the folders" list and to the feature-folder sentence under "Layout inside a feature".

- [ ] **Step 12: Run the checks**

Run: `pnpm --filter mobile exec jest src/stats src/utils && just typecheck && just lint`
Expected: PASS. If lint rejects the new `src/stats/` folder through a folder list in `scripts/oxlint/` or `.dependency-cruiser.cjs`, add `stats` to that list. The rule file names it.

- [ ] **Step 13: Commit**

```bash
git add apps/mobile
git commit -m "feat(app): add the stats formats, the scanned switch and the stats data hook (#95)"
```

---

### Task 9: The card and the tab bar

**Files:**
- Create: `apps/mobile/src/stats/components/StatsCard/` (`StatsCard.tsx`, `StatsCard.styles.ts`, `StatsCard.test.tsx`, `index.ts`)
- Create: `apps/mobile/src/stats/components/LevelTabs/` (`LevelTabs.tsx`, `LevelTabs.styles.ts`, `LevelTabs.test.tsx`, `index.ts`)

**Interfaces:**
- Consumes: `formatPercent`, `StatsTab`, `LEVEL_NAMES` (`@/constants/level.constants`), `Icon`, `ThemeDecoration`, `pressedStyles`, the tokens of Task 7.
- Produces:
  - `<StatsCard winRate={number | null} streak={number} onPress?={() => void} />`. With `onPress` it is a button and shows a chevron. Without it, it is a plain labelled view.
  - `<LevelTabs value={StatsTab} onChange={(tab: StatsTab) => void} />`

- [ ] **Step 1: Write the failing test of the card**

`StatsCard.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { StatsCard } from './StatsCard'

it('shows the win rate and the streak', () => {
  render(<StatsCard winRate={0.76} streak={3} />)
  expect(screen.getByText('76%')).toBeTruthy()
  expect(screen.getByLabelText('76% won, 3 day streak')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})

it('is a button that opens the stats when it has an action', () => {
  const onPress = jest.fn()
  render(<StatsCard winRate={0.5} streak={0} onPress={onPress} />)
  fireEvent.press(screen.getByRole('button', { name: '50% won, 0 day streak. Open stats' }))
  expect(onPress).toHaveBeenCalledTimes(1)
})

it('writes a dash for a win rate that does not exist, and says so in words', () => {
  render(<StatsCard winRate={null} streak={0} />)
  expect(screen.getByText('–')).toBeTruthy()
  expect(screen.getByLabelText('No games finished, 0 day streak')).toBeTruthy()
  expect(screen.queryByText(/NaN/)).toBeNull()
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm --filter mobile exec jest src/stats/components/StatsCard`
Expected: FAIL, cannot find `./StatsCard`.

- [ ] **Step 3: Write the card**

`StatsCard.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  card: {
    overflow: 'hidden',
    borderWidth: theme.components.summary.borderWidth,
    borderColor: theme.components.summary.border,
    borderRadius: theme.components.button.radius,
    backgroundColor: theme.colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  rate: { flexDirection: 'row', alignItems: 'baseline', gap: theme.space.sm },
  value: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale * 1.6, color: theme.colors.text },
  text: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.text },
  strong: { ...roleFont(theme.type.label), fontSize: theme.type.body.scale, color: theme.colors.text },
  streak: { flexDirection: 'row', alignItems: 'center', gap: theme.space.md },
}))
```

`StatsCard.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native'
import { Icon } from '@/game/components/Icon'
import { formatPercent } from '@/stats/utils/format.utils'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './StatsCard.styles'

type StatsCardProps = {
  winRate: number | null
  streak: number
  /** The home screen gives it, to open the stats. The stats screen shows the card without it. */
  onPress?: () => void
}

/** The win rate and the day streak of all levels. */
export function StatsCard({ winRate, streak, onPress }: StatsCardProps) {
  const label =
    winRate === null ? `No games finished, ${streak} day streak` : `${formatPercent(winRate)} won, ${streak} day streak`
  const content = (
    <>
      <ThemeDecoration slot="summaryEdge" />
      <View style={styles.row}>
        <View style={styles.rate}>
          <Text style={styles.value}>{formatPercent(winRate)}</Text>
          <Text style={styles.text}>won</Text>
        </View>
        <View style={styles.streak}>
          <Text style={styles.text}>
            <Text style={styles.strong}>{streak}</Text> day streak
          </Text>
          {onPress !== undefined && <Icon name="next" tone="accent" size={16} />}
        </View>
      </View>
    </>
  )
  if (onPress === undefined) {
    return (
      <View accessible accessibilityLabel={label} style={styles.card}>
        {content}
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. Open stats`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && pressedStyles.pressed]}
    >
      {content}
    </Pressable>
  )
}
```

`index.ts`: `export { StatsCard } from './StatsCard'`

- [ ] **Step 4: Run the card tests**

Run: `pnpm --filter mobile exec jest src/stats/components/StatsCard`
Expected: PASS.

- [ ] **Step 5: Write the failing test of the tab bar**

`LevelTabs.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { LevelTabs } from './LevelTabs'

it('lists All and the four levels, and marks the chosen tab', () => {
  render(<LevelTabs value="medium" onChange={jest.fn()} />)
  for (const name of ['All', 'Easy', 'Hard', 'Expert']) {
    expect(screen.getByRole('tab', { name, selected: false })).toBeTruthy()
  }
  expect(screen.getByRole('tab', { name: 'Medium', selected: true })).toBeTruthy()
})

it('asks for the tab that the player taps', () => {
  const onChange = jest.fn()
  render(<LevelTabs value="all" onChange={onChange} />)
  fireEvent.press(screen.getByRole('tab', { name: 'Expert' }))
  expect(onChange).toHaveBeenCalledWith('expert')
  fireEvent.press(screen.getByRole('tab', { name: 'All' }))
  expect(onChange).toHaveBeenLastCalledWith('all')
})
```

- [ ] **Step 6: Run it and see it fail, then write the tab bar**

Run: `pnpm --filter mobile exec jest src/stats/components/LevelTabs`
Expected: FAIL, cannot find `./LevelTabs`.

`LevelTabs.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  track: {
    flexDirection: 'row',
    gap: theme.space.xs,
    padding: theme.space.xs,
    borderRadius: theme.shape.radius.md,
    backgroundColor: theme.components.segmented.track,
  },
  tab: {
    flex: 1,
    minHeight: theme.size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Math.max(0, theme.shape.radius.md - theme.space.xs),
  },
  selected: { backgroundColor: theme.components.segmented.selected, boxShadow: theme.elevation.key },
  label: { ...roleFont(theme.type.label), fontSize: theme.type.label.scale, color: theme.colors.textMuted },
  labelSelected: { color: theme.colors.text },
}))
```

`LevelTabs.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native'
import { LEVELS } from '@sudoku/core'
import { LEVEL_NAMES } from '@/constants/level.constants'
import type { StatsTab } from '@/stats/constants/stats.constants'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './LevelTabs.styles'

type LevelTabsProps = { value: StatsTab; onChange(tab: StatsTab): void }

const TABS: readonly { tab: StatsTab; label: string }[] = [
  { tab: 'all', label: 'All' },
  ...LEVELS.map((level) => ({ tab: level, label: LEVEL_NAMES[level] })),
]

/** One tab for the overview of all levels, and one for each level. */
export function LevelTabs({ value, onChange }: LevelTabsProps) {
  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {TABS.map(({ tab, label }) => {
        const selected = tab === value
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onChange(tab)}
            style={({ pressed }) => [styles.tab, selected && styles.selected, pressed && pressedStyles.pressed]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
```

`index.ts`: `export { LevelTabs } from './LevelTabs'`

- [ ] **Step 7: Run the tests, typecheck and lint**

Run: `pnpm --filter mobile exec jest src/stats && just typecheck && just lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/stats
git commit -m "feat(app): add the stats card and the level tab bar (#95)"
```

---

### Task 10: The ledger pieces, the table and the level detail

**Files** (each component folder has `<Name>.tsx`, `<Name>.styles.ts`, `<Name>.test.tsx`, `index.ts`):
- Create: `apps/mobile/src/stats/components/StatSection/`
- Create: `apps/mobile/src/stats/components/StatRow/`
- Create: `apps/mobile/src/stats/components/DayStrip/`
- Create: `apps/mobile/src/stats/components/TimesChart/`
- Create: `apps/mobile/src/stats/components/LevelTable/`
- Create: `apps/mobile/src/stats/components/LevelDetail/`
- Create: `apps/mobile/src/stats/constants/chart.constants.ts`

**Interfaces:**
- Consumes: `LevelSummary`, `Streak`, `formatTime`, `timeWords`, `formatPercent`, `formatAverage`, `NONE`, `LEVEL_NAMES`, the token `components.summary`.
- Produces:
  - `<StatSection title={string} note?={string}>{children}</StatSection>`: a rule, a title, then rows.
  - `<StatRow label={string} note?={string} value={string} />`
  - `<DayStrip days={readonly boolean[]} />`: the last item is today. Today without a win is dashed.
  - `<TimesChart times={readonly number[]} />`: oldest first. It renders nothing for an empty list.
  - `<LevelTable levels={Record<Level, LevelSummary>} />`
  - `<LevelDetail level={Level} summary={LevelSummary} times={readonly number[]} />`

- [ ] **Step 1: Write the chart constants**

`chart.constants.ts`:

```ts
/** The height in points of the tallest bar of the times chart. */
export const BAR_AREA = 110

/** A bar is never shorter than this, so the fastest time stays visible next to a very slow one. */
export const MIN_BAR = 8
```

- [ ] **Step 2: Write `StatRow` and `StatSection` with tests**

`StatRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { StatRow } from './StatRow'

it('shows the label, the note and the value, and reads them as one line', () => {
  render(<StatRow label="Best" note="no hints" value="04:32" />)
  expect(screen.getByText('04:32')).toBeTruthy()
  expect(screen.getByLabelText('Best, no hints: 04:32')).toBeTruthy()
})

it('reads a row without a note', () => {
  render(<StatRow label="Played" value="12" />)
  expect(screen.getByLabelText('Played: 12')).toBeTruthy()
})
```

`StatRow.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: theme.space.md,
    borderBottomWidth: theme.shape.stroke.thin,
    borderBottomColor: theme.colors.line,
  },
  label: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.text },
  note: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
  value: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale, color: theme.colors.text },
}))
```

`StatRow.tsx`:

```tsx
import { Text, View } from 'react-native'
import { styles } from './StatRow.styles'

type StatRowProps = { label: string; note?: string; value: string }

export function StatRow({ label, note, value }: StatRowProps) {
  return (
    <View accessible accessibilityLabel={`${label}${note === undefined ? '' : `, ${note}`}: ${value}`} style={styles.row}>
      <Text style={styles.label}>
        {label}
        {note !== undefined && <Text style={styles.note}> {note}</Text>}
      </Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}
```

`StatSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { StatSection } from './StatSection'

it('shows a title as a header, with its note and its content', () => {
  render(
    <StatSection title="Streak" note="all levels">
      <Text>content</Text>
    </StatSection>,
  )
  expect(screen.getByRole('header', { name: 'Streak all levels' })).toBeTruthy()
  expect(screen.getByText('content')).toBeTruthy()
})
```

`StatSection.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  section: {
    marginTop: theme.space.xl,
    paddingTop: theme.space.md,
    borderTopWidth: theme.components.summary.ruleWidth,
    borderTopColor: theme.components.summary.rule,
  },
  title: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale, color: theme.colors.text },
  note: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
}))
```

`StatSection.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { styles } from './StatSection.styles'

type StatSectionProps = { title: string; note?: string; children: ReactNode }

/** A group of rows under a title and a strong rule. */
export function StatSection({ title, note, children }: StatSectionProps) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
        {note !== undefined && <Text style={styles.note}> {note}</Text>}
      </Text>
      {children}
    </View>
  )
}
```

Add `index.ts` in both folders with the named export.

- [ ] **Step 3: Write `DayStrip` with its test**

`DayStrip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { DayStrip } from './DayStrip'

const days = [...Array.from({ length: 10 }, () => false), true, true, true, false]

it('reads the strip as one sentence', () => {
  render(<DayStrip days={days} />)
  expect(screen.getByLabelText('Last 14 days: wins on 3 days. Today has no win yet.')).toBeTruthy()
})

it('says nothing about today when today has a win', () => {
  render(<DayStrip days={[...days.slice(0, 13), true]} />)
  expect(screen.getByLabelText('Last 14 days: wins on 4 days.')).toBeTruthy()
})

it('draws one square for each day', () => {
  render(<DayStrip days={days} />)
  expect(screen.getAllByTestId('day-square')).toHaveLength(14)
})
```

`DayStrip.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  strip: { flexDirection: 'row', gap: theme.space.xs },
  square: {
    flex: 1,
    height: 24,
    borderWidth: theme.shape.stroke.dot,
    borderColor: theme.colors.accent,
    borderRadius: theme.shape.radius.sm,
  },
  won: { backgroundColor: theme.colors.accent },
  pending: { borderStyle: 'dashed' },
}))
```

`DayStrip.tsx`:

```tsx
import { View } from 'react-native'
import { styles } from './DayStrip.styles'

type DayStripProps = { days: readonly boolean[] }

/** A square for each day, oldest first. A solid square is a day with a win. Today without a win yet is dashed. */
export function DayStrip({ days }: DayStripProps) {
  const wins = days.filter(Boolean).length
  const todayOpen = days.length > 0 && days[days.length - 1] === false
  const label = `Last ${days.length} days: wins on ${wins} days.${todayOpen ? ' Today has no win yet.' : ''}`
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.strip}>
      {days.map((won, index) => (
        <View
          // oxlint-disable-next-line react/no-array-index-key -- the squares are one fixed row and never reorder.
          key={index}
          testID="day-square"
          style={[styles.square, won && styles.won, !won && index === days.length - 1 && styles.pending]}
        />
      ))}
    </View>
  )
}
```

If `just lint` reports that the suppression is unused (the rule is off), delete the comment line. Keep the `key`.

- [ ] **Step 4: Write `TimesChart` with its test**

`TimesChart.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { TimesChart } from './TimesChart'

it('draws nothing without a win', () => {
  render(<TimesChart times={[]} />)
  expect(screen.toJSON()).toBeNull()
})

it('draws a bar for each win, and names the fastest time', () => {
  render(<TimesChart times={[90_000, 60_000, 272_000]} />)
  expect(screen.getAllByTestId('time-bar')).toHaveLength(3)
  expect(screen.getByText('01:00')).toBeTruthy()
  expect(
    screen.getByLabelText(
      'Times of the last 3 wins, newest on the right. The fastest is 1 minute.',
    ),
  ).toBeTruthy()
})

it('makes the slowest bar the tallest, and no bar shorter than the minimum', () => {
  render(<TimesChart times={[1_000, 1_000_000]} />)
  const [fast = 0, slow = 0] = screen.getAllByTestId('time-bar').map((bar) => StyleSheet.flatten(bar.props.style).height)
  expect(slow).toBeGreaterThan(fast)
  expect(fast).toBeGreaterThanOrEqual(8)
})
```

Add `import { StyleSheet } from 'react-native'` at the top of this test file.

`TimesChart.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.space.sm,
    paddingTop: theme.space.xl,
    borderBottomWidth: theme.components.summary.ruleWidth,
    borderBottomColor: theme.components.summary.rule,
  },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: {
    alignSelf: 'stretch',
    borderWidth: theme.shape.stroke.dot,
    borderBottomWidth: 0,
    borderColor: theme.colors.accent,
  },
  fastest: { backgroundColor: theme.colors.accent },
  label: {
    ...roleFont(theme.type.eyebrow),
    fontSize: theme.type.eyebrow.scale,
    color: theme.colors.accent,
    marginBottom: theme.space.xs,
  },
}))
```

`TimesChart.tsx`:

```tsx
import { Text, View } from 'react-native'
import { BAR_AREA, MIN_BAR } from '@/stats/constants/chart.constants'
import { formatTime, timeWords } from '@/stats/utils/format.utils'
import { styles } from './TimesChart.styles'

type TimesChartProps = { times: readonly number[] }

/** A bar for each of the last wins, oldest first. The fastest bar is solid and shows its time. */
export function TimesChart({ times }: TimesChartProps) {
  if (times.length === 0) return null
  const slowest = Math.max(...times)
  const fastest = Math.min(...times)
  const fastestIndex = times.indexOf(fastest)
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Times of the last ${times.length} wins, newest on the right. The fastest is ${timeWords(fastest)}.`}
      style={styles.chart}
    >
      {times.map((ms, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- the bars are one fixed row, and two wins can have the same time.
        <View key={index} style={styles.slot}>
          {index === fastestIndex && <Text style={styles.label}>{formatTime(ms)}</Text>}
          <View
            testID="time-bar"
            style={[styles.bar, index === fastestIndex && styles.fastest, { height: Math.max(MIN_BAR, (ms / slowest) * BAR_AREA) }]}
          />
        </View>
      ))}
    </View>
  )
}
```

- [ ] **Step 5: Write `LevelTable` with its test**

`LevelTable.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import type { Level, LevelSummary } from '@/storage'
import { LevelTable } from './LevelTable'

const NOTHING: LevelSummary = {
  played: 0, won: 0, lost: 0, abandoned: 0, winRate: null, bestMs: null, averageMs: null,
  flawlessWins: 0, averageMistakes: null, averageHints: null,
}
const MEDIUM: LevelSummary = {
  played: 12, won: 9, lost: 3, abandoned: 2, winRate: 0.75, bestMs: 272_000, averageMs: 435_000,
  flawlessWins: 4, averageMistakes: 1.4, averageHints: 0.6,
}
const levels: Record<Level, LevelSummary> = { easy: NOTHING, medium: MEDIUM, hard: NOTHING, expert: NOTHING }

it('shows the four levels as columns', () => {
  render(<LevelTable levels={levels} />)
  for (const name of ['Easy', 'Medium', 'Hard', 'Expert']) {
    expect(screen.getByRole('columnheader', { name })).toBeTruthy()
  }
})

it('shows the numbers of a level, row by row', () => {
  render(<LevelTable levels={levels} />)
  expect(screen.getByLabelText('Medium, Played: 12')).toBeTruthy()
  expect(screen.getByLabelText('Medium, Win rate: 75%')).toBeTruthy()
  expect(screen.getByLabelText('Medium, Best time: 04:32')).toBeTruthy()
  expect(screen.getByLabelText('Medium, Average: 07:15')).toBeTruthy()
  expect(screen.getByLabelText('Medium, Flawless: 4')).toBeTruthy()
  expect(screen.getByLabelText('Medium, Mistakes: 1.4')).toBeTruthy()
  expect(screen.getByLabelText('Medium, Hints: 0.6')).toBeTruthy()
  expect(screen.getByLabelText('Medium, Abandoned: 2')).toBeTruthy()
})

it('shows a dash for a level without games, and 0 for the counts', () => {
  render(<LevelTable levels={levels} />)
  expect(screen.getByLabelText('Expert, Played: 0')).toBeTruthy()
  expect(screen.getByLabelText('Expert, Win rate: –')).toBeTruthy()
  expect(screen.getByLabelText('Expert, Flawless: –')).toBeTruthy()
  expect(screen.getByLabelText('Expert, Abandoned: 0')).toBeTruthy()
  expect(screen.queryByText(/NaN|Infinity/)).toBeNull()
})
```

`LevelTable.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  table: { marginTop: theme.space.xl },
  head: {
    flexDirection: 'row',
    borderBottomWidth: theme.components.summary.ruleWidth,
    borderBottomColor: theme.components.summary.rule,
  },
  group: { marginTop: theme.space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderBottomWidth: theme.shape.stroke.thin,
    borderBottomColor: theme.colors.line,
  },
  labelCell: { width: 96, paddingVertical: theme.space.md },
  cell: { flex: 1, alignItems: 'flex-end', paddingVertical: theme.space.md, paddingRight: theme.space.sm },
  headLabel: { ...roleFont(theme.type.label), fontSize: theme.type.label.scale, color: theme.colors.textMuted },
  rowLabel: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.text },
  value: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale * 0.8, color: theme.colors.text },
  none: { color: theme.colors.textMuted },
}))
```

`LevelTable.tsx`:

```tsx
import { Text, View } from 'react-native'
import { LEVELS } from '@sudoku/core'
import { LEVEL_NAMES } from '@/constants/level.constants'
import { NONE } from '@/stats/constants/stats.constants'
import { formatAverage, formatPercent, formatTime } from '@/stats/utils/format.utils'
import type { Level, LevelSummary } from '@/storage'
import { styles } from './LevelTable.styles'

type Row = { label: string; cell(summary: LevelSummary): string }

// Rows in the groups of the design: games, times, quality, abandoned. A level with no game shows a dash, except in the counts.
const GROUPS: readonly (readonly Row[])[] = [
  [
    { label: 'Played', cell: (s) => String(s.played) },
    { label: 'Win rate', cell: (s) => formatPercent(s.winRate) },
  ],
  [
    { label: 'Best time', cell: (s) => formatTime(s.bestMs) },
    { label: 'Average', cell: (s) => formatTime(s.averageMs) },
  ],
  [
    { label: 'Flawless', cell: (s) => (s.played === 0 ? NONE : String(s.flawlessWins)) },
    { label: 'Mistakes', cell: (s) => formatAverage(s.averageMistakes) },
    { label: 'Hints', cell: (s) => formatAverage(s.averageHints) },
  ],
  [{ label: 'Abandoned', cell: (s) => String(s.abandoned) }],
]

type LevelTableProps = { levels: Record<Level, LevelSummary> }

/** All four levels side by side, so the player compares them without a tab change. */
export function LevelTable({ levels }: LevelTableProps) {
  return (
    <View accessibilityRole="table" style={styles.table}>
      <View style={styles.head}>
        <View style={styles.labelCell} />
        {LEVELS.map((level) => (
          <View key={level} accessible accessibilityRole="columnheader" accessibilityLabel={LEVEL_NAMES[level]} style={styles.cell}>
            <Text style={styles.headLabel}>{LEVEL_NAMES[level]}</Text>
          </View>
        ))}
      </View>
      {GROUPS.map((rows) => (
        <View key={rows[0]?.label} style={styles.group}>
          {rows.map(({ label, cell }) => (
            <View key={label} style={styles.row}>
              <View style={styles.labelCell}>
                <Text style={styles.rowLabel}>{label}</Text>
              </View>
              {LEVELS.map((level) => {
                const text = cell(levels[level])
                return (
                  <View
                    key={level}
                    accessible
                    accessibilityLabel={`${LEVEL_NAMES[level]}, ${label}: ${text}`}
                    style={styles.cell}
                  >
                    <Text style={[styles.value, text === NONE && styles.none]}>{text}</Text>
                  </View>
                )
              })}
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}
```

- [ ] **Step 6: Write `LevelDetail` with its test**

`LevelDetail.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import type { LevelSummary } from '@/storage'
import { LevelDetail } from './LevelDetail'

const MEDIUM: LevelSummary = {
  played: 12, won: 9, lost: 3, abandoned: 2, winRate: 0.75, bestMs: 272_000, averageMs: 435_000,
  flawlessWins: 4, averageMistakes: 1.4, averageHints: 0.6,
}
const NOTHING: LevelSummary = {
  played: 0, won: 0, lost: 0, abandoned: 0, winRate: null, bestMs: null, averageMs: null,
  flawlessWins: 0, averageMistakes: null, averageHints: null,
}

it('shows the times and the game numbers of the level', () => {
  render(<LevelDetail level="medium" summary={MEDIUM} times={[300_000, 272_000]} />)
  expect(screen.getByLabelText('Best, no hints: 04:32')).toBeTruthy()
  expect(screen.getByLabelText('Average, won games: 07:15')).toBeTruthy()
  expect(screen.getByLabelText('Win rate: 75%')).toBeTruthy()
  expect(screen.getByLabelText('Played, 9 won, 3 lost: 12')).toBeTruthy()
  expect(screen.getByLabelText('Flawless wins, no mistakes, no hints: 4')).toBeTruthy()
  expect(screen.getByLabelText('Mistakes, per game: 1.4')).toBeTruthy()
  expect(screen.getByLabelText('Hints, per game: 0.6')).toBeTruthy()
  expect(screen.getByLabelText('Abandoned, not counted: 2')).toBeTruthy()
  expect(screen.getByLabelText(/^Times of the last 2 wins/)).toBeTruthy()
})

it('shows the empty state for a level without games', () => {
  render(<LevelDetail level="expert" summary={NOTHING} times={[]} />)
  expect(screen.getByText('No Expert games yet.')).toBeTruthy()
  expect(screen.getByText('Finish one and your win rate, best time and average time show up here.')).toBeTruthy()
  expect(screen.queryByLabelText(/^Win rate/)).toBeNull()
})

it('shows the numbers of a level that has only abandoned games', () => {
  render(<LevelDetail level="hard" summary={{ ...NOTHING, abandoned: 1 }} times={[]} />)
  expect(screen.getByLabelText('Win rate: –')).toBeTruthy()
  expect(screen.getByLabelText('Abandoned, not counted: 1')).toBeTruthy()
})
```

`LevelDetail.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: theme.space.lg },
  chartTitle: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.text },
  chartNote: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
  empty: {
    marginTop: theme.space.xl,
    gap: theme.space.sm,
    padding: theme.space.lg,
    borderWidth: theme.components.summary.borderWidth,
    borderColor: theme.components.summary.border,
    borderRadius: theme.components.button.radius,
  },
  emptyTitle: { ...roleFont(theme.type.question), fontSize: theme.type.question.scale, color: theme.colors.text },
  emptyText: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.textMuted },
}))
```

`LevelDetail.tsx`:

```tsx
import { Text, View } from 'react-native'
import { LEVEL_NAMES } from '@/constants/level.constants'
import { StatRow } from '@/stats/components/StatRow'
import { StatSection } from '@/stats/components/StatSection'
import { TimesChart } from '@/stats/components/TimesChart'
import { formatAverage, formatPercent, formatTime } from '@/stats/utils/format.utils'
import type { Level, LevelSummary } from '@/storage'
import { styles } from './LevelDetail.styles'

type LevelDetailProps = { level: Level; summary: LevelSummary; times: readonly number[] }

/** The times and the game numbers of one level, or an empty state when the level has no game. */
export function LevelDetail({ level, summary, times }: LevelDetailProps) {
  if (summary.played === 0 && summary.abandoned === 0) {
    return (
      <View style={styles.empty}>
        <Text accessibilityRole="header" style={styles.emptyTitle}>
          No {LEVEL_NAMES[level]} games yet.
        </Text>
        <Text style={styles.emptyText}>Finish one and your win rate, best time and average time show up here.</Text>
      </View>
    )
  }
  return (
    <>
      <StatSection title="Times">
        <StatRow label="Best" note="no hints" value={formatTime(summary.bestMs)} />
        <StatRow label="Average" note="won games" value={formatTime(summary.averageMs)} />
        {times.length > 0 && (
          <>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Last {times.length} wins</Text>
              <Text style={styles.chartNote}>newest on the right</Text>
            </View>
            <TimesChart times={times} />
          </>
        )}
      </StatSection>
      <StatSection title="Games">
        <StatRow label="Win rate" value={formatPercent(summary.winRate)} />
        <StatRow label="Played" note={`${summary.won} won, ${summary.lost} lost`} value={String(summary.played)} />
        <StatRow label="Flawless wins" note="no mistakes, no hints" value={String(summary.flawlessWins)} />
        <StatRow label="Mistakes" note="per game" value={formatAverage(summary.averageMistakes)} />
        <StatRow label="Hints" note="per game" value={formatAverage(summary.averageHints)} />
        <StatRow label="Abandoned" note="not counted" value={String(summary.abandoned)} />
      </StatSection>
    </>
  )
}
```

The accessible label of `StatRow` reads `Played, 9 won, 3 lost: 12`. This matches the test.

- [ ] **Step 7: Run the tests, typecheck and lint**

Run: `pnpm --filter mobile exec jest src/stats && just typecheck && just lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/stats
git commit -m "feat(app): add the stats table, the level detail and the chart (#95)"
```

---

### Task 11: The stats screen and its route

**Files:**
- Create: `apps/mobile/src/stats/screens/StatsScreen/` (`StatsScreen.tsx`, `StatsScreen.styles.ts`, `StatsScreen.test.tsx`, `index.ts`)
- Create: `apps/mobile/src/app/stats.tsx`

**Interfaces:**
- Consumes: everything of Tasks 6 to 10, `useGameStorage`, `Icon`, `ThemeStatusBar`, `AssistRow` (`@/settings/components/AssistRow`), `useHaptics`.
- Produces: `<StatsScreen onBack={() => void} />`, and the route `/stats`.

- [ ] **Step 1: Write the failing screen test**

`StatsScreen.test.tsx`:

```tsx
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native'
import { useIncludeScanned } from '@/stats/hooks/useIncludeScanned'
import { createMemoryStorage, type GameStorage } from '@/storage'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { lostGame, newGame, wonGame } from '@/storage/repositories.contract'
import type { Theme } from '@/theme/theme.types'
import { THEMES } from '@/theme/themes/registry'
import { StatsScreen } from './StatsScreen'

jest.mock('@/utils/timeZone.utils', () => ({ deviceTimeZone: () => 'UTC' }))

function inTheme(theme: Theme) {
  const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
  return jest.spyOn(unistyles, 'useUnistyles').mockReturnValue({ theme, rt: unistyles.UnistylesRuntime } as never)
}

// The switch is one store for the whole test file, so each test turns it off again.
afterEach(async () => {
  jest.restoreAllMocks()
  const { result, unmount } = renderHook(() => useIncludeScanned())
  await act(async () => result.current.setIncludeScanned(false))
  unmount()
})

async function storageWithGames() {
  const storage = createMemoryStorage()
  for (const game of [wonGame(60_000), lostGame(20_000)]) {
    const { id } = await storage.puzzles.start({ level: 'medium', source: 'generated', game: newGame() })
    await storage.puzzles.save(id, game)
  }
  return storage
}

function renderScreen(storage: GameStorage, onBack = jest.fn()) {
  render(
    <GameStorageContext value={storage}>
      <StatsScreen onBack={onBack} />
    </GameStorageContext>,
  )
  return onBack
}

it('shows the card and the table of all levels first', async () => {
  renderScreen(await storageWithGames())
  await waitFor(() => expect(screen.getByLabelText('50% won, 1 day streak')).toBeTruthy())
  expect(screen.getByRole('tab', { name: 'All', selected: true })).toBeTruthy()
  expect(screen.getByLabelText('Medium, Played: 2')).toBeTruthy()
  expect(screen.getByRole('header', { name: /^Streak/ })).toBeTruthy()
})

it('shows the detail of a level on its tab, and the streak only on All', async () => {
  renderScreen(await storageWithGames())
  await waitFor(() => screen.getByRole('tab', { name: 'Medium' }))
  fireEvent.press(screen.getByRole('tab', { name: 'Medium' }))
  expect(screen.getByLabelText('Best, no hints: 01:00')).toBeTruthy()
  expect(screen.queryByRole('header', { name: /^Streak/ })).toBeNull()
  fireEvent.press(screen.getByRole('tab', { name: 'Expert' }))
  expect(screen.getByText('No Expert games yet.')).toBeTruthy()
})

it('has a back button that calls onBack', async () => {
  const onBack = renderScreen(await storageWithGames())
  fireEvent.press(screen.getByRole('button', { name: 'Back' }))
  expect(onBack).toHaveBeenCalledTimes(1)
})

it('shows the empty numbers on a device without games', async () => {
  renderScreen(createMemoryStorage())
  await waitFor(() => expect(screen.getByLabelText('No games finished, 0 day streak')).toBeTruthy())
  expect(screen.queryByText(/NaN|Infinity/)).toBeNull()
})

it('counts a scanned game after the switch turns on', async () => {
  const storage = createMemoryStorage()
  const { id } = await storage.puzzles.start({ level: 'easy', source: 'scanned', game: newGame() })
  await storage.puzzles.save(id, wonGame(30_000))
  renderScreen(storage)
  await waitFor(() => screen.getByLabelText('Easy, Played: 0'))
  await act(async () => fireEvent(screen.getByLabelText('Include scanned puzzles'), 'valueChange', true))
  await waitFor(() => expect(screen.getByLabelText('Easy, Played: 1')).toBeTruthy())
})

it('writes 1 day, not 1 days', async () => {
  renderScreen(await storageWithGames())
  await waitFor(() => expect(screen.getByLabelText('Current: 1 day')).toBeTruthy())
})

it('says that the stats do not load when the storage fails', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  const storage = createMemoryStorage()
  jest.spyOn(storage.stats, 'summary').mockRejectedValue(new Error('locked'))
  renderScreen(storage)
  await waitFor(() => expect(screen.getByText('The stats do not load.')).toBeTruthy())
})

it('puts the title in the bar in Daylight', async () => {
  inTheme(THEMES.daylight)
  renderScreen(await storageWithGames())
  await waitFor(() => screen.getByRole('tab', { name: 'All' }))
  expect(screen.queryByTestId('title-block')).toBeNull()
  expect(screen.getByRole('header', { name: 'Stats' })).toBeTruthy()
})

it('puts the title in a title block under the bar in Op-art', async () => {
  inTheme(THEMES.opart)
  renderScreen(await storageWithGames())
  await waitFor(() => screen.getByRole('tab', { name: 'All' }))
  expect(screen.getByTestId('title-block')).toBeTruthy()
  expect(screen.getByRole('header', { name: 'Stats' })).toBeTruthy()
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm --filter mobile exec jest src/stats/screens`
Expected: FAIL, cannot find `./StatsScreen`.

- [ ] **Step 3: Write the styles**

`StatsScreen.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont, roleText } from '@/theme/typography'

// Unistyles reads the safe-area insets natively, as on the settings screen.
export const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom + theme.space.xxl,
    paddingHorizontal: theme.space.lg,
  },
  header: { height: theme.size.header, flexDirection: 'row', alignItems: 'center' },
  back: {
    width: theme.size.touch,
    height: theme.size.touch,
    // The icon, not the touch area, lines up with the screen margin.
    marginLeft: -(theme.size.touch - theme.size.icon) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTitle: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale, color: theme.colors.text },
  titleBlock: { height: theme.size.titleBlock, justifyContent: 'flex-end', marginBottom: theme.space.md },
  display: { ...roleText(theme.type.display), color: theme.colors.text },
  card: { marginBottom: theme.space.xl },
  message: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.textMuted },
  settings: { marginTop: theme.space.xl, borderTopWidth: theme.components.summary.ruleWidth, borderTopColor: theme.components.summary.rule },
}))
```

- [ ] **Step 4: Write the screen**

`StatsScreen.tsx`:

```tsx
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Icon } from '@/game/components/Icon'
import { ThemeStatusBar } from '@/game/components/ThemeStatusBar'
import { AssistRow } from '@/settings/components/AssistRow'
import { useHaptics } from '@/settings/hooks/useHaptics'
import { DayStrip } from '@/stats/components/DayStrip'
import { LevelDetail } from '@/stats/components/LevelDetail'
import { LevelTable } from '@/stats/components/LevelTable'
import { LevelTabs } from '@/stats/components/LevelTabs'
import { StatRow } from '@/stats/components/StatRow'
import { StatSection } from '@/stats/components/StatSection'
import { StatsCard } from '@/stats/components/StatsCard'
import type { StatsTab } from '@/stats/constants/stats.constants'
import { useIncludeScanned } from '@/stats/hooks/useIncludeScanned'
import { useStats, type StatsData } from '@/stats/hooks/useStats'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './StatsScreen.styles'

type StatsScreenProps = { onBack(): void }

const days = (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`

function Overview({ data }: { data: StatsData }) {
  return (
    <>
      <LevelTable levels={data.levels} />
      <StatSection title="Streak" note="all levels">
        <StatRow label="Current" value={days(data.streak.current)} />
        <StatRow label="Longest" value={days(data.streak.longest)} />
        <DayStrip days={data.streak.recent} />
      </StatSection>
    </>
  )
}

/** The card of all levels, then a tab bar: the overview of all levels, or the detail of one level. */
export function StatsScreen({ onBack }: StatsScreenProps) {
  const { theme } = useUnistyles()
  const [tab, setTab] = useState<StatsTab>('all')
  const { includeScanned, setIncludeScanned } = useIncludeScanned()
  const haptics = useHaptics()
  const state = useStats(includeScanned)
  // A theme with a title block shows a large title under the bar. The others put the title in the bar.
  const hasTitleBlock = theme.size.titleBlock > 0

  return (
    <>
      <ThemeStatusBar />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            style={({ pressed }) => [styles.back, pressed && pressedStyles.pressed]}
          >
            <Icon name="back" tone="text" />
          </Pressable>
          {!hasTitleBlock && (
            <Text accessibilityRole="header" style={styles.barTitle}>
              Stats
            </Text>
          )}
        </View>
        {hasTitleBlock && (
          <View testID="title-block" style={styles.titleBlock}>
            <Text accessibilityRole="header" style={styles.display}>
              Stats
            </Text>
          </View>
        )}
        {state.status === 'failed' && <Text style={styles.message}>The stats do not load.</Text>}
        {state.status === 'ready' && (
          <>
            <View style={styles.card}>
              <StatsCard winRate={state.data.overall.winRate} streak={state.data.streak.current} />
            </View>
            <LevelTabs
              value={tab}
              onChange={(next) => {
                haptics.play('tick')
                setTab(next)
              }}
            />
            {tab === 'all' ? (
              <Overview data={state.data} />
            ) : (
              <LevelDetail level={tab} summary={state.data.levels[tab]} times={state.data.times[tab]} />
            )}
            <View style={styles.settings}>
              <AssistRow
                label="Include scanned puzzles"
                description="A scanned level is an estimate."
                value={includeScanned}
                divider={false}
                onChange={(on) => {
                  haptics.play('tick')
                  setIncludeScanned(on)
                }}
              />
            </View>
          </>
        )}
      </ScrollView>
    </>
  )
}
```

`index.ts`: `export { StatsScreen } from './StatsScreen'`

- [ ] **Step 5: Add the route**

`apps/mobile/src/app/stats.tsx`:

```tsx
import { useRouter } from 'expo-router'
import { StatsScreen } from '@/stats/screens/StatsScreen'

export default function StatsRoute() {
  const router = useRouter()
  return <StatsScreen onBack={() => router.back()} />
}
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter mobile exec jest src/stats`
Expected: PASS.

- [ ] **Step 7: Typecheck and lint**

Run: `just typecheck && just lint`
Expected: PASS. If typecheck says `/stats` is not a known route, regenerate the route types as ADR-016 describes: start the dev server once with `just app`, wait for it to start, stop it, and run typecheck again.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src
git commit -m "feat(app): add the stats screen with an All tab and a tab per level (#95)"
```

---

### Task 12: The card on the home screen

**Files:**
- Create: `apps/mobile/src/home/utils/homeStats.utils.ts` and `homeStats.utils.test.ts`
- Modify: `apps/mobile/src/home/components/HomeMenu/HomeMenu.tsx`, `HomeMenu.styles.ts`, `HomeMenu.test.tsx`
- Modify: `apps/mobile/src/home/screens/HomeScreen/HomeScreen.tsx`

**Interfaces:**
- Consumes: `StatsRepository`, `deviceTimeZone`, `useIncludeScanned`, `StatsCard`.
- Produces:
  - `type HomeStats = { winRate: number | null; played: number; streak: number }` and `loadHomeStats(stats: StatsRepository, includeScanned: boolean): Promise<HomeStats>`
  - `HomeMenu` props: `stats: HomeStats | null | undefined` (undefined until loaded, null when the load failed) and `onStats(): void`.

- [ ] **Step 1: Write the failing test of `loadHomeStats`**

`homeStats.utils.test.ts`:

```ts
import { createMemoryStorage } from '@/storage'
import { newGame, wonGame } from '@/storage/repositories.contract'
import { loadHomeStats } from './homeStats.utils'

jest.mock('@/utils/timeZone.utils', () => ({ deviceTimeZone: () => 'UTC' }))

it('gives no win rate and no streak on a device without games', async () => {
  const { stats } = createMemoryStorage()
  await expect(loadHomeStats(stats, false)).resolves.toEqual({ winRate: null, played: 0, streak: 0 })
})

it('gives the win rate, the games played and the current streak of all levels', async () => {
  const storage = createMemoryStorage()
  const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
  await storage.puzzles.save(id, wonGame(60_000))
  await expect(loadHomeStats(storage.stats, false)).resolves.toEqual({ winRate: 1, played: 1, streak: 1 })
})
```

- [ ] **Step 2: Run it and see it fail, then write it**

Run: `pnpm --filter mobile exec jest src/home/utils`
Expected: FAIL, cannot find `./homeStats.utils`.

`homeStats.utils.ts`:

```ts
import type { StatsRepository } from '@/storage'
import { deviceTimeZone } from '@/utils/timeZone.utils'

/** What the stats card of the home screen shows. */
export type HomeStats = { winRate: number | null; played: number; streak: number }

export async function loadHomeStats(stats: StatsRepository, includeScanned: boolean): Promise<HomeStats> {
  const filter = { includeScanned }
  const [summary, streak] = await Promise.all([stats.summary(null, filter), stats.streak(deviceTimeZone(), filter)])
  return { winRate: summary.winRate, played: summary.played, streak: streak.current }
}
```

Run again: `pnpm --filter mobile exec jest src/home/utils`
Expected: PASS.

- [ ] **Step 3: Update the menu tests**

In `HomeMenu.test.tsx`, change `renderMenu` to take the stats and give the new props:

```tsx
import type { HomeStats } from '@/home/utils/homeStats.utils'

function renderMenu(continueLevel: 'medium' | null = null, stats: HomeStats | null | undefined = null) {
  const props = {
    continueLevel,
    stats,
    onNewGame: jest.fn(),
    onContinue: jest.fn(),
    onScan: jest.fn(),
    onSettings: jest.fn(),
    onStats: jest.fn(),
  }
  render(<HomeMenu {...props} />)
  return props
}
```

Add:

```tsx
it('shows the stats card, and a tap opens the stats', () => {
  const { onStats } = renderMenu(null, { winRate: 0.76, played: 25, streak: 3 })
  fireEvent.press(screen.getByRole('button', { name: '76% won, 3 day streak. Open stats' }))
  expect(onStats).toHaveBeenCalledTimes(1)
})

it('shows a line of text instead of the card when no game finished', () => {
  renderMenu(null, { winRate: null, played: 0, streak: 0 })
  expect(screen.getByText('No finished games yet. Your stats show up here.')).toBeTruthy()
  expect(screen.queryByLabelText(/day streak/)).toBeNull()
})

it('shows neither the card nor the line when the stats did not load', () => {
  renderMenu(null, null)
  expect(screen.queryByLabelText(/day streak/)).toBeNull()
  expect(screen.queryByText(/No finished games/)).toBeNull()
})
```

Run: `pnpm --filter mobile exec jest src/home`
Expected: FAIL.

- [ ] **Step 4: Change the menu**

In `HomeMenu.tsx`:

- Import `StatsCard` from `@/stats/components/StatsCard` and `type HomeStats` from `@/home/utils/homeStats.utils`.
- Add the props:

```tsx
type HomeMenuProps = {
  /** The level of the game in progress. Null when no game is in progress, undefined until the store answers. */
  continueLevel: Level | null | undefined
  /** The numbers of the stats card. Undefined until the store answers. Null when they do not load. */
  stats: HomeStats | null | undefined
  onNewGame(level: Level): void
  onContinue(): void
  onScan(): void
  onSettings(): void
  onStats(): void
}
```

- Change the signature to destructure `stats` and `onStats`.
- Wait for both answers, so the list never jumps:

```tsx
  const shown = useEased(continueLevel === undefined || stats === undefined ? 0 : 1, MENU_FADE_MS)
```

- Render, after the `LEVELS.map(...)` buttons and before `<View style={styles.links}>`:

```tsx
          {stats != null &&
            (stats.played === 0 ? (
              <Text style={styles.noStats}>No finished games yet. Your stats show up here.</Text>
            ) : (
              <StatsCard winRate={stats.winRate} streak={stats.streak} onPress={onStats} />
            ))}
```

In `HomeMenu.styles.ts`, add:

```ts
  noStats: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
```

- [ ] **Step 5: Load the stats on the home screen**

In `HomeScreen.tsx`, add imports:

```tsx
import { loadHomeStats, type HomeStats } from '@/home/utils/homeStats.utils'
import { useIncludeScanned } from '@/stats/hooks/useIncludeScanned'
```

Inside `HomeScreen`:

```tsx
  const { puzzles, stats } = useGameStorage()
  const { includeScanned } = useIncludeScanned()
  const [homeStats, setHomeStats] = useState<HomeStats | null | undefined>(undefined)
```

In the existing `useFocusEffect` callback, add this chain after the `puzzles.current()` chain and before the existing `return () => { live = false }`. Change the dependency list of the callback from `[puzzles]` to `[puzzles, stats, includeScanned]`:

```tsx
      loadHomeStats(stats, includeScanned)
        .then((loaded) => {
          if (live) setHomeStats(loaded)
        })
        .catch((error: unknown) => {
          devWarn('storage', `The stats do not load: ${errorMessage(error)}`)
          // The menu waits for an answer. Without one it shows without the card: a new game still works.
          if (live) setHomeStats(null)
        })
```

Pass the new props to `HomeMenu`:

```tsx
      stats={homeStats}
      onStats={() => router.navigate('/stats')}
```

(The `navigate` call follows the comment above it: a second tap finds the open screen and pushes no second copy.)

- [ ] **Step 6: Run the tests, typecheck and lint**

Run: `pnpm --filter mobile exec jest src/home src/stats && just typecheck && just lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src
git commit -m "feat(app): show the stats card on the home screen (#95)"
```

---

### Task 13: Check everything, on the phone, in four themes

**Files:**
- Modify: `docs/architecture/adr/adr-023-player-stats.md`, `docs/architecture/adr/adr-021-four-themes.md` (status, only if the work proves them)
- Modify: the issue #95 (tick the criteria)

**Interfaces:**
- Consumes: everything.
- Produces: a branch that is ready for review.

- [ ] **Step 1: Run every check**

Run: `just lint && just typecheck && just test-ts`
Expected: PASS. Fix any failure in the task that owns the code. Do not skip a check.

- [ ] **Step 2: Check that no comment breaks the rules**

Run: `grep -rnE "TODO|FIXME|XXX|HACK" apps/mobile/src/stats apps/mobile/src/storage packages/sudoku-core/src/stats`
Expected: no match.

- [ ] **Step 3: Run the app on the iPhone**

Use the iPhone build notes of this repository (the memory file "iPhone build environment" has the Xcode path, the Metro port and the worktree notes). Check, in this order:

1. A new install: the home screen shows "No finished games yet." and no card.
2. Play a game and win it. Go home. The card shows `100% won` and `1 day streak`. A tap opens the stats screen.
3. All tab: the table shows the played level in its column and dashes in the others. The streak shows `1 day`.
4. Medium tab (or the level you played): best time, average time, the one-bar chart, the game numbers.
5. Start a game, make a move, then start a new game from the home screen. Confirm the replace. The stats screen now shows `1 abandoned` and the win rate does not change.
6. Turn on "Include scanned puzzles". The numbers change when a scanned game exists. Kill the app and open it again. The switch keeps its position.
7. Change the time zone of the phone by 12 hours, kill the app and open the stats. The streak follows the new day. This also proves that `Intl.DateTimeFormat` with a time zone works in Hermes. If it does not, stop and report it: the streak needs another day-of-time function.
8. Switch the theme to Daylight, Midnight, Op-art and Progressive. In each: the card, the tab bar, the table and the chart are readable. Only Op-art draws the waves. Note any theme where the card or the rules look wrong and fix the values of `components.summary` for that theme.
9. Turn on Reduce Motion and Larger Text. The table stays readable at the larger sizes. If a column breaks at the largest size, give the labels `numberOfLines={1}` and `adjustsFontSizeToFit`, with a test.

- [ ] **Step 4: Update the ADRs**

If the phone check proved the decisions, change the `Status` of ADR-023 from `Proposed` to `Accepted`, and the same in its row of `09-architecture-decisions.md`. If the check changed a decision (for example the Hermes time zone), amend the ADR first, then the code.

- [ ] **Step 5: Tick the criteria in the issue**

For each acceptance criterion of #95 that is met, tick it. Use `gh issue view 95 --json body --jq .body` to read it, edit the boxes, and run `gh issue edit 95 --body-file <file>`.

- [ ] **Step 6: Commit**

```bash
git add docs/architecture
git commit -m "docs(arch): accept the player stats decisions (#95)"
```

- [ ] **Step 7: Prepare the pull request**

Do not push or open the pull request until the developer asks. When asked: push `feature/95-player-stats`, open the pull request against `develop` with `Closes #95` in the body, and ask a second agent to review it without this session's context (root `AGENTS.md`, work tracking, point 10).

---

## Out of scope

- A "New game" button in the empty state of a level (the mock has one). Starting a game from the stats screen needs the start logic of the home screen in a shared hook. It needs its own issue.
- A leaderboard, a move log and cloud sync (ADR-023).
- A chart in the All tab. Times of different levels do not share an axis.
- Dark versions of Op-art and Progressive (ADR-021).
- A tab bar with a sliding indicator like the theme picker. The selected tab changes at once.
- Stats for the other decorations: Progressive draws no `summaryEdge`.
