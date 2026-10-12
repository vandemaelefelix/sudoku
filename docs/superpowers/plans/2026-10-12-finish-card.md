# Finish Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A won game ends with the finish card of the design canvas. The card shows the level, the time, a small solved grid, the mistakes, the hints, the best time, "New best", the source and the date. It tilts with the phone and has a moving shine. With Reduce Motion on, it does not tilt.

**Architecture:** The storage gets a `seed` column (migration 3), so a generated game keeps its puzzle number. The best time counts only won generated games without hints. `PlayScreen` reads the best times when it loads a game and gives `GameScreen` a `FinishInfo` (level, source, seed, best time before this game). A new `FinishCard` component shows after the solve pulse of a won game. A pure util (`finishView`) builds every text of the card. The tilt uses `useAnimatedSensor` of Reanimated, which the app already has (ADR-017). The gradient and the shine use the React Native style `experimental_backgroundImage`.

**Tech Stack:** Expo 57, React Native 0.86.3, Reanimated 4.5.1 (`useAnimatedSensor`, `useReducedMotion`), Unistyles 3.5.2, expo-sqlite behind `PuzzleRepository` and `HistoryRepository`, Jest with `@testing-library/react-native` and `expo-router/testing-library`.

**Spec:** GitHub issue #43 (`gh issue view 43`). The design canvas "Finish card" frame (https://claude.ai/artifact/U23JHiGA1Pq3HJX6oMiBF4, `project/Main.dc.html`, scenario `finished`). The game-screen concept, section "Finish card". F-09, SUD-01, ADR-011, ADR-012, ADR-015, ADR-016.

## Developer rulings (2026-10-12, binding)

- **Best time:** only won **generated** games without hints count. A scanned game never counts, because its level is an estimate (ADR-011, amendment "a level for scanned puzzles").
- **Puzzle number:** the app draws seeds from 0 to 999 999. The card shows the seed with a space between thousands: "Puzzle 412 077". `generate()` in `@sudoku/core` keeps its range of 0 to 0xffffffff.
- **First best:** the first counted win at a level shows "New best".
- **Criterion "the finish card shows 'Scanned from paper'"** of #27 moved here. #27 stores the source `scanned` already.

## Facts checked for this plan (2026-10-12, `origin/develop` at `2f02208`)

| Fact | Source |
| --- | --- |
| `SavedProgress` and `HistoryEntry` have no seed. `newGeneratedGame(level, random)` returns a `Game` and drops the seed | `src/storage/storage.types.ts`, `src/game/utils/start.utils.ts` |
| `SEED_COUNT` is `0x1_0000_0000` | `src/game/constants/start.constants.ts` |
| `bestTimes()` counts won games without hints, from every source | `src/storage/HistoryRepository.ts`, `src/storage/memoryStorage.ts` |
| `PuzzleRepository.save` moves a won game to the history in the same transaction. `start` runs in the same queue, after a pending save | `src/storage/PuzzleRepository.ts` |
| `MIGRATIONS` has 2 entries. `SqlValue` is `string \| number \| null` | `src/storage/migrations.ts`, `src/storage/sql.types.ts` |
| `GameScreen` renders `GameOverSheet` for a lost game. Nothing shows for a won game | `src/game/screens/GameScreen/GameScreen.tsx` |
| `solvePulseDuration(pulseLook(theme))` is the length of the solve pulse. No code uses it yet | `src/game/utils/pulse.utils.ts` |
| `useAnimatedSensor(SensorType.ROTATION)` gives `pitch`, `roll`, `yaw` and `qw`, `qx`, `qy`, `qz`. Before the first reading, every value is 0. The Jest mock of Reanimated has `useAnimatedSensor`. `jest.setup.ts` mocks `useAnimatedReaction` with `jest.fn()` and `useReducedMotion` with `jest.fn(() => false)` | `node_modules/react-native-reanimated`, `apps/mobile/jest.setup.ts` |
| React Native 0.86 has the style `experimental_backgroundImage` (CSS `linear-gradient`) and `mixBlendMode` | `react-native/Libraries/StyleSheet/StyleSheetTypes.d.ts` |
| `LEVEL_NAMES` ("Easy", "Medium", …) is in `src/home/components/HomeMenu/HomeMenu.constants.ts` | — |
| `MAX_MISTAKES` (3) comes from `@sudoku/core` | `packages/sudoku-core/src/index.ts` |
| The theme has `colors.scrimStrong` "over the game behind the finish card" | `src/theme/theme.types.ts` |
| `Icon` takes `tone` (a key of `theme.colors`) and has no scan icon | `src/game/components/Icon/` |
| The canvas card: 300 pt wide, radius 24, padding 22/22/16, gap 14. Gradient 150° `#151a29` 0 %, `#20306a` 58 %, `#2a4cbd` 100 %. Time 48 pt bold. Grid 256 pt. Stats: Mistakes "1/3", Hints, Best. Footer: scan icon (scanned only), "Scanned from paper" or "Puzzle 412", the date "12 Oct 2026". Below the card: "New puzzle" (accent pill, 50 pt) and "Back to home" (text button). Rotation up to 8° on X and 10° on Y | design canvas, `project/Main.dc.html` |

## Global Constraints

- Every prose rule of the root `AGENTS.md` applies (Simplified Technical English, light). Every rule of `apps/mobile/AGENTS.md` applies: folder layout, import rules, theme rules, worklet rules.
- Do not write a colour value outside `src/theme/`. Do not use the words `white`, `black` or `transparent` as colours (`just lint` refuses them).
- A styles file imports only `react-native`, `react-native-unistyles` and `src/theme/`. So card sizes live in the theme (`theme.size.card`).
- `src/game/` does not import from `src/scanner/` or `src/scan/` (SUD-03).
- No new dependency. No new native code. The development build of #51 runs this change with `just app`.
- No network (SUD-01). No analytics.
- Use `/usr/bin/git` in this worktree.
- Run `just lint`, `just typecheck`, `just test-ts` and `just docs-check` before each commit that touches their files.
- Copy rules: "Solved · <Level>", "New best", "Mistakes", "Hints", "Best", "Scanned from paper", "Puzzle <number>", "New puzzle", "Back to home". The date is `en-GB`, day, short month, year: "12 Oct 2026".

## Review Focus

1. **A game saved before migration 3.** Its seed is null. The card must say "Generated puzzle", not "Puzzle null" or "Puzzle NaN". Pinned in Task 3.
2. **The sensor before its first reading.** Every value is 0 then. A rest position taken from that reading tilts the card fully on the first real reading. The tilt must ignore a reading whose quaternion is zero. Pinned in Task 4.
3. **The best time read after New puzzle.** The new game must compare against a best time that includes the game that just finished. `PlayScreen` reads the best times after `puzzles.start`, which runs after the save of the won game. Pinned in Task 7.
4. **A time equal to the best time.** It is not a new best. Pinned in Task 3.
5. **A won game with a hint, or a scanned game.** No "New best". The Best value shows the stored best time, or "–". Pinned in Task 3.

---

## Files owned

| File | Change |
| --- | --- |
| `docs/architecture/adr/adr-017-card-motion-sensor.md` | New ADR: the tilt uses Reanimated's `useAnimatedSensor` |
| `docs/architecture/adr/adr-011-puzzle-generation-and-hints.md` | Amendment: the puzzle number and the seed range of the app |
| `docs/architecture/adr/adr-012-local-persistence.md` | Amendment: the `seed` column and the best time rule |
| `docs/architecture/00-concepts/game-screen.md` | Finish card details. The open question row of the motion sensor points to ADR-017 |
| `docs/architecture/12-glossary.md` | Best time, puzzle number, seed |
| `docs/architecture/00-DECISIONS.md`, `09-architecture-decisions.md` | ADR-017 rows. Clauses on the ADR-011 and ADR-012 rows |
| `docs/superpowers/plans/2026-10-12-finish-card.md` | This plan |
| `apps/mobile/src/storage/*` | `seed`, migration 3, the best time of generated games |
| `apps/mobile/src/game/constants/start.constants.ts`, `utils/start.utils.ts` (+ test) | Seeds below 1 000 000. `newGeneratedGame` returns the seed |
| `apps/mobile/src/home/screens/HomeScreen/HomeScreen.tsx` | Stores the seed |
| `apps/mobile/src/constants/level.constants.ts` | New: `LEVEL_NAMES`, moved from `HomeMenu.constants.ts` |
| `apps/mobile/src/game/constants/finish.constants.ts`, `utils/finish.utils.ts` (+ test) | New: `finishView`, `formatPuzzleNumber` |
| `apps/mobile/src/game/constants/tilt.constants.ts`, `utils/tilt.utils.ts` (+ test) | New: the tilt math (worklets) |
| `apps/mobile/src/game/hooks/useCardTilt/*` | New: the sensor and the animated styles |
| `apps/mobile/src/game/hooks/useSolveDelay/*` | New: shows the card after the solve pulse |
| `apps/mobile/src/theme/*` | `components.finishCard`, `size.card`, contrast pairs |
| `apps/mobile/src/game/components/Icon/*` | A `scan` icon and a `color` prop |
| `apps/mobile/src/game/components/CardGrid/*` | New: the small solved grid |
| `apps/mobile/src/game/components/FinishCard/*` | New: the card, the scrim and the two buttons |
| `apps/mobile/src/game/screens/GameScreen/GameScreen.tsx` | A `finish` prop. Renders `FinishCard` |
| `apps/mobile/src/game/screens/PlayScreen/PlayScreen.tsx` | Reads the best times. Stores the seed on a restart. Gives `finish` |
| `apps/mobile/test/routes.test.tsx` | Win a game on the router |

---

### Task 0: Plan copy, ADR-017 and the amendments

**Files:**
- Create: `docs/architecture/adr/adr-017-card-motion-sensor.md`
- Modify: `docs/architecture/adr/adr-011-puzzle-generation-and-hints.md`, `docs/architecture/adr/adr-012-local-persistence.md`, `docs/architecture/00-concepts/game-screen.md`, `docs/architecture/12-glossary.md`, `docs/architecture/00-DECISIONS.md`, `docs/architecture/09-architecture-decisions.md`
- Create: `docs/superpowers/plans/2026-10-12-finish-card.md` (this file, if it is not in the branch yet)

- [ ] **Step 1: Write ADR-017**

```markdown
---
status: DRAFT
---

# ADR-017: The finish card tilts with Reanimated's motion sensor

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-12 |
| Contact | Felix      |

## Context

The finish card (#43) tilts a little when the phone moves, and a shine moves over it. The
game-screen concept asks for an ADR before the card is built. The card needs the attitude of
the phone (pitch and roll) on the UI thread, many times a second. The app works offline
(SUD-01) and has no analytics. With Reduce Motion on, the card must not tilt.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| `useAnimatedSensor` of Reanimated 4 | Reanimated is in the app already. The values arrive on the UI thread as a shared value, so the tilt needs no JS render. No new native code | The API can change with a major Reanimated release |
| `DeviceMotion` of `expo-sensors` | An Expo package with docs per SDK | A new native dependency and a new development build. The values arrive on the JS thread, so each reading renders or needs a bridge to a shared value |
| A tilt that follows a finger | No sensor | Not the design: the card must react to the phone |
| No tilt | Nothing to build | Fails the criterion of #43 |

## Decision

The finish card reads `useAnimatedSensor(SensorType.ROTATION, { interval: 'auto' })`.

- The first real reading is the rest position. The card tilts by the change from it.
- A change of 0.35 rad tilts the card fully: 8° on X and 10° on Y, as on the design canvas.
- With Reduce Motion on, the card does not use the sensor at all.
- On iOS, the device attitude needs no permission and no `NSMotionUsageDescription`.

## Consequences

- No new dependency and no new build.
- The tilt math is a set of worklets in `src/game/utils/tilt.utils.ts`, with Jest tests.
- The sensor stops when the card unmounts.

## Reassessment Triggers

- A Reanimated major release removes or changes `useAnimatedSensor`.
- iOS starts to ask for a permission for the device attitude.
- Another screen needs the sensor on the JS thread.
```

- [ ] **Step 2: Amend ADR-011**

Add this section after the section "Amendment: a level for scanned puzzles (2026-10-12)", before "## Consequences":

```markdown
## Amendment: the puzzle number (2026-10-12)

The finish card shows the number of a generated puzzle (#43). The seed is that number.

- The app draws seeds from 0 to 999 999, so the number stays short: "Puzzle 412 077".
  `generate()` still accepts every seed from 0 to 0xffffffff.
- One million puzzles per level is enough for v1. A player meets a puzzle twice only by chance.
- The seed is stored with the game in progress and the history (ADR-012, amendment "the seed").
- A scanned puzzle has no seed. Its card says "Scanned from paper".
```

- [ ] **Step 3: Amend ADR-012**

Add this section before "## Consequences":

```markdown
## Amendment: the seed and the best time (2026-10-12)

- Migration 3 adds a nullable `seed INTEGER` column to `game_in_progress` and `game_history`.
  A generated game stores its seed (ADR-011, amendment "the puzzle number"). A scanned game
  and a game saved before migration 3 store null.
- The best time of a level is the shortest time played of a won **generated** game without
  hints. A scanned game never counts, because its level is an estimate (ADR-011).
```

- [ ] **Step 4: Update the game-screen concept**

In `docs/architecture/00-concepts/game-screen.md`, section "Finish card", replace the paragraph "The card tilts a little … before the card is built." with:

```markdown
The card shows after the solve pulse. With Reduce Motion on, it shows at once.

- "New best" shows when the game counts toward the best time and its time is shorter than the
  stored best time of the level. Only a won generated game without hints counts (ADR-012). The
  first counted win at a level is a new best.
- The puzzle number is the seed of a generated puzzle (ADR-011).
- The card tilts a little with the movement of the phone, and a shine moves over it (ADR-017).
  With Reduce Motion on, it does not tilt.
```

In the table "Open questions", replace the row of the motion sensor with:

```markdown
| The motion sensor that tilts the finish card | Decided: ADR-017 |
```

- [ ] **Step 5: Update the glossary**

In `docs/architecture/12-glossary.md`:

- Replace the row "Best time" with `| Best time | The shortest time played of a won generated game without hints, at one level (ADR-012) |`.
- Add, in alphabetical order, `| Puzzle number | The seed of a generated puzzle, shown on the finish card: "Puzzle 412 077". The app draws seeds below 1 000 000 (ADR-011) |`.
- In the row "Seed", add at the end: `. The app stores it with the game (ADR-012)`.

- [ ] **Step 6: Update the decision index**

In `docs/architecture/00-DECISIONS.md`, table "Game":

- At the end of the ADR-011 decision text, add: ` The app draws seeds below 1 000 000. The seed is the puzzle number (amendment 2026-10-12).`
- At the end of the ADR-012 decision text, add: ` The seed is stored. The best time counts only generated games (amendment 2026-10-12).`
- Add the row: `| ADR-017 | The finish card tilts with Reanimated's useAnimatedSensor. No new dependency. No tilt with Reduce Motion. | Concept | 2026-10-12 | Felix | [ADR-017](adr/adr-017-card-motion-sensor.md) |`

In `docs/architecture/09-architecture-decisions.md`:

- At the end of the ADR-011 text, add: `. Seeds below 1 000 000, the seed is the puzzle number (amendment 2026-10-12)`.
- At the end of the ADR-012 text, add: `. The seed is stored, the best time counts only generated games (amendment 2026-10-12)`.
- Add the row after ADR-016: `| ADR-017 | The finish card tilts with Reanimated's useAnimatedSensor (rotation), no new dependency, no tilt with Reduce Motion | Proposed | 2026-10-12 | [ADR-017](./adr/adr-017-card-motion-sensor.md) |`

- [ ] **Step 7: Check and commit**

```bash
just docs-check
/usr/bin/git add docs/
/usr/bin/git commit -m "docs(adr): the finish card motion sensor, the puzzle number and the seed (#43)"
```

---

### Task 1: The seed in the storage, and the best time of generated games

**Files:**
- Modify: `apps/mobile/src/storage/migrations.ts`, `storage.types.ts`, `PuzzleRepository.ts`, `HistoryRepository.ts`, `memoryStorage.ts`
- Test: `apps/mobile/src/storage/repositories.contract.ts`, `apps/mobile/src/storage/migrations.test.ts`

**Interfaces:**
- Produces: `SavedProgress.seed: number | null`, `HistoryEntry.seed: number | null`, `PuzzleRepository.start(input: { level; source; seed?: number | null; game })`. `bestTimes()` counts only `source = 'generated'`.

- [ ] **Step 1: Write the failing contract tests**

In `repositories.contract.ts`, in the test "moves a won game to the history", add `seed: null,` after `source: 'scanned',` in the expected entry. Then add these tests inside `describeGameStorage`, after "leaves a won game with a hint out of the best time":

```ts
    it('keeps the seed of a generated game in progress and in the history', async () => {
      const started = await storage.puzzles.start({
        level: 'easy',
        source: 'generated',
        seed: 412_077,
        game: nearlyWon(),
      })
      expect(started.seed).toBe(412_077)
      await expect(storage.puzzles.current()).resolves.toMatchObject({ seed: 412_077 })
      await storage.puzzles.save(started.id, wonGame(40_000))
      await expect(storage.history.list()).resolves.toMatchObject([{ id: started.id, seed: 412_077 }])
    })

    it('gives a game without a seed the seed null', async () => {
      const started = await storage.puzzles.start({ level: 'easy', source: 'scanned', game: newGame() })
      expect(started.seed).toBeNull()
      await expect(storage.puzzles.current()).resolves.toMatchObject({ seed: null })
    })

    it('leaves a scanned game out of the best time', async () => {
      const finish = async (source: 'generated' | 'scanned', game: Game) => {
        const { id } = await storage.puzzles.start({ level: 'easy', source, game: newGame() })
        await storage.puzzles.save(id, game)
      }
      await finish('scanned', wonGame(10_000))
      await expect(storage.history.bestTimes()).resolves.toEqual({})
      await finish('generated', wonGame(60_000))
      await finish('scanned', wonGame(20_000))
      await expect(storage.history.bestTimes()).resolves.toEqual({ easy: 60_000 })
    })
```

In `migrations.test.ts`, add at the end:

```ts
describe('migration 3', () => {
  const at = '2026-01-01T00:00:00.000Z'

  it('gives a game saved before the seed column the seed null', async () => {
    await migrate(db, MIGRATIONS.slice(0, 2))
    await db.runAsync(
      `INSERT INTO game_in_progress (id, level, source, saved_game, created_at, updated_at)
        VALUES ('old', 'easy', 'generated', ?, ?, ?)`,
      [JSON.stringify(toSavedGame(newGame())), at, at],
    )
    await migrate(db)
    await expect(createSqliteStorage(db, testDeps()).puzzles.current()).resolves.toMatchObject({
      id: 'old',
      seed: null,
    })
  })

  it('refuses a negative seed', async () => {
    await migrate(db)
    await expect(
      db.runAsync(
        `INSERT INTO game_in_progress (id, level, source, seed, saved_game, created_at, updated_at)
          VALUES ('bad', 'easy', 'generated', -1, '{}', ?, ?)`,
        [at, at],
      ),
    ).rejects.toThrow('CHECK constraint failed')
  })
})
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `cd apps/mobile && pnpm jest src/storage`
Expected: FAIL. TypeScript in Jest reports `seed` as an unknown property, or the values are `undefined`.

- [ ] **Step 3: Add migration 3**

Append to `MIGRATIONS` in `migrations.ts`:

```ts
  // A scanned game and a game saved before this migration have no seed (ADR-012, amendment "the seed").
  `ALTER TABLE game_in_progress ADD COLUMN seed INTEGER CHECK (seed IS NULL OR seed >= 0);
  ALTER TABLE game_history ADD COLUMN seed INTEGER CHECK (seed IS NULL OR seed >= 0);`,
```

- [ ] **Step 4: Add the seed to the types**

In `storage.types.ts`, add to `SavedProgress` after `source`, and to `HistoryEntry` after `source`:

```ts
  /** The seed of a generated puzzle (ADR-011). Null for a scanned puzzle and for a game saved before migration 3. */
  readonly seed: number | null
```

- [ ] **Step 5: Store and read the seed in SQLite**

In `PuzzleRepository.ts`:

```ts
  /** Starts a game in progress and discards the one before it. Throws a RangeError for a won or lost game. */
  start(input: { level: Level; source: PuzzleSource; seed?: number | null; game: Game }): Promise<SavedProgress>
```

```ts
type ProgressRow = { id: string; level: Level; source: PuzzleSource; seed: number | null; saved_game: string }
```

In `start`, destructure `{ level, source, seed = null, game }`. Change the insert and the return value:

```ts
          await txn.runAsync(
            `INSERT INTO game_in_progress (id, level, source, seed, saved_game, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, level, source, seed, JSON.stringify(toSavedGame(game)), now, now],
          )
        })
        return { id, level, source, seed, game }
```

In `current`, select `id, level, source, seed, saved_game` and return `{ id: row.id, level: row.level, source: row.source, seed: row.seed, game }`.

In `save`, select `level, source, seed` (type `Pick<ProgressRow, 'level' | 'source' | 'seed'>`) and add `seed: row.seed,` after `source: row.source,` in the history entry.

- [ ] **Step 6: Store the seed in the history, and count only generated games**

In `HistoryRepository.ts`:

```ts
/** The shortest time played of a won generated game without hints, per level (ADR-012). A level without such a game is missing. */
export type BestTimes = Partial<Record<Level, number>>
```

Add `seed: number | null` to `HistoryRow`. The insert:

```ts
  await txn.runAsync(
    `INSERT INTO game_history
      (id, level, source, seed, result, played_ms, mistakes, hints_used, finished_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.level,
      entry.source,
      entry.seed,
      entry.result,
      entry.playedMs,
      entry.mistakes,
      entry.hintsUsed,
      entry.finishedAt,
      entry.finishedAt,
      entry.finishedAt,
    ],
  )
```

In `list`, select `seed` after `source` and map `seed: row.seed,` after `source: row.source,`. In `bestTimes`:

```ts
        `SELECT level, MIN(played_ms) AS best FROM game_history
          WHERE result = 'won' AND hints_used = 0 AND source = 'generated' AND deleted_at IS NULL GROUP BY level`,
```

- [ ] **Step 7: Keep the in-memory fake equal**

In `memoryStorage.ts`:

```ts
type Progress = { id: string; level: Level; source: PuzzleSource; seed: number | null; saved: SavedGame }
```

```ts
    async start({ level, source, seed = null, game }) {
      if (resultOf(game) !== null) throw new RangeError(`A ${game.status} game cannot start`)
      progress = { id: deps.newId(), level, source, seed, saved: toSavedGame(game) }
      return { id: progress.id, level, source, seed, game }
    },
    async current() {
      if (progress === null) return null
      const { id, level, source, seed, saved } = progress
      return { id, level, source, seed, game: fromSavedGame(saved) }
    },
```

In `save`, add `seed: progress.seed,` after `source: progress.source,`. In `bestTimes`, the condition becomes:

```ts
        const counts = entry.result === 'won' && entry.source === 'generated' && entry.hintsUsed === 0
        if (counts && (time === undefined || entry.playedMs < time)) {
```

- [ ] **Step 8: Run the tests and see them pass**

Run: `cd apps/mobile && pnpm jest src/storage`
Expected: PASS. Then run `just typecheck`. It fails in no file outside `src/storage/`, because `seed` is optional in `start`.

- [ ] **Step 9: Commit**

```bash
/usr/bin/git add apps/mobile/src/storage
/usr/bin/git commit -m "feat(storage): store the seed and count only generated games for the best time (#43)"
```

---

### Task 2: Seeds below 1 000 000, stored on every start

**Files:**
- Modify: `apps/mobile/src/game/constants/start.constants.ts`, `apps/mobile/src/game/utils/start.utils.ts`, `apps/mobile/src/home/screens/HomeScreen/HomeScreen.tsx`, `apps/mobile/src/game/screens/PlayScreen/PlayScreen.tsx`
- Test: `apps/mobile/src/game/utils/start.utils.test.ts`, `apps/mobile/test/routes.test.tsx`

**Interfaces:**
- Consumes: `PuzzleRepository.start({ …, seed })` (Task 1).
- Produces: `type GeneratedGame = { game: Game; seed: number }` and `newGeneratedGame(level, random): GeneratedGame`.

- [ ] **Step 1: Write the failing tests**

Replace `start.utils.test.ts` with:

```ts
import { GIVENS_TARGET, generate } from '@sudoku/core'
import { SEED_COUNT } from '@/game/constants/start.constants'
import { newGeneratedGame } from './start.utils'

it('generates a game at the level, with the seed from the random number', () => {
  const { game, seed } = newGeneratedGame('hard', () => 0.5)
  expect(seed).toBe(500_000)
  expect(game.givens.filter((digit) => digit !== 0)).toHaveLength(GIVENS_TARGET.hard)
  expect(game.givens).toEqual(generate('hard', 500_000).givens)
  expect(game).toMatchObject({ status: 'playing', mistakes: 0, playedMs: 0 })
})

it('keeps the seed below SEED_COUNT for a random number just below 1', () => {
  expect(newGeneratedGame('easy', () => 0.9999999999).seed).toBe(SEED_COUNT - 1)
})
```

In `test/routes.test.tsx`, in the test "starts a new game at the tapped level and saves it", add after the existing assertions on the saved game:

```ts
  expect((await inProgress(storage)).seed).toEqual(expect.any(Number))
```

In the test "Try this puzzle again starts the same puzzle as a new saved game", add at the end:

```ts
  expect(retried.seed).toBe(lost.seed)
```

In the test "New puzzle starts a new game at the same level, and the lost game is in the history", add after `expect(next.level).toBe('medium')`:

```ts
  expect(next.seed).toEqual(expect.any(Number))
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `cd apps/mobile && pnpm jest src/game/utils/start.utils.test.ts test/routes.test.tsx`
Expected: FAIL. `seed` is undefined on the result and null in the storage.

- [ ] **Step 3: Lower the seed range and return the seed**

`start.constants.ts`:

```ts
/** The app draws seeds below one million, so the puzzle number stays short (ADR-011). generate() accepts up to 0xffffffff. */
export const SEED_COUNT = 1_000_000
```

`start.utils.ts`:

```ts
import { createGame, generate, type Game, type Level, type Random } from '@sudoku/core'
import { SEED_COUNT } from '@/game/constants/start.constants'

export type GeneratedGame = { game: Game; seed: number }

export function newGeneratedGame(level: Level, random: Random): GeneratedGame {
  const seed = Math.floor(random() * SEED_COUNT)
  const { givens, solution } = generate(level, seed)
  return { game: createGame({ givens, solution }), seed }
}
```

- [ ] **Step 4: Store the seed on every start**

`HomeScreen.tsx`, in `newGame`:

```ts
      const { game, seed } = newGeneratedGame(level, Math.random)
      await puzzles.start({ level, source: 'generated', seed, game })
```

`PlayScreen.tsx`, `restartWith` and its two callers:

```ts
  const restartWith = useCallback(
    async (source: PuzzleSource, make: (current: SavedProgress) => { game: Game; seed: number | null }) => {
      if (progress === null) return
      try {
        const { game, seed } = make(progress)
        setProgress(await puzzles.start({ level: progress.level, source, seed, game }))
      } catch (error) {
        devWarn('storage', `The game does not start: ${errorMessage(error)}`)
      }
    },
    [puzzles, progress],
  )

  const newPuzzle = useCallback(() => {
    void restartWith('generated', (current) => newGeneratedGame(current.level, Math.random))
  }, [restartWith])

  const retry = useCallback(() => {
    if (progress === null) return
    void restartWith(progress.source, ({ game, seed }) => ({
      game: createGame({ givens: game.givens, solution: game.solution, entries: game.startEntries }),
      seed,
    }))
  }, [restartWith, progress])
```

`useScannedStart` does not change: a scanned start gives no seed, so the storage stores null.

- [ ] **Step 5: Run the tests and see them pass**

Run: `cd apps/mobile && pnpm jest src/game test/routes.test.tsx src/home`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add apps/mobile/src/game/constants/start.constants.ts apps/mobile/src/game/utils/start.utils.ts apps/mobile/src/game/utils/start.utils.test.ts apps/mobile/src/home/screens/HomeScreen/HomeScreen.tsx apps/mobile/src/game/screens/PlayScreen/PlayScreen.tsx apps/mobile/test/routes.test.tsx
/usr/bin/git commit -m "feat(game): draw seeds below one million and store the seed of each game (#43)"
```

---

### Task 3: The texts of the finish card

**Files:**
- Create: `apps/mobile/src/constants/level.constants.ts`
- Modify: `apps/mobile/src/home/components/HomeMenu/HomeMenu.constants.ts` and every file that imports `LEVEL_NAMES` (find them with `grep -rn LEVEL_NAMES apps/mobile/src`)
- Create: `apps/mobile/src/game/constants/finish.constants.ts`, `apps/mobile/src/game/utils/finish.utils.ts`
- Test: `apps/mobile/src/game/utils/finish.utils.test.ts`

**Interfaces:**
- Produces:
  - `LEVEL_NAMES: Readonly<Record<Level, string>>` from `@/constants/level.constants`.
  - `type FinishInfo = { readonly level: Level; readonly source: PuzzleSource; readonly seed: number | null; readonly bestBeforeMs: number | null }`
  - `type FinishView = { title; newBest: boolean; time; mistakes; hints; best; source; fromPaper: boolean; date; label }` (every other field is a `string`)
  - `formatPuzzleNumber(seed: number): string`
  - `finishView(board: Game, playedMs: number, info: FinishInfo, finishedAt: Date): FinishView`

- [ ] **Step 1: Move LEVEL_NAMES**

Create `apps/mobile/src/constants/level.constants.ts` with the exact `LEVEL_NAMES` block of `HomeMenu.constants.ts`, and its `import type { Level } from '@sudoku/core'`. Delete the block from `HomeMenu.constants.ts`. If the file is then empty, delete it. Change each import of `LEVEL_NAMES` to `@/constants/level.constants`. Run `just lint`. The boundary rules must pass. Code that more than one feature uses lives in `src/constants/` (`apps/mobile/AGENTS.md`).

- [ ] **Step 2: Write the failing tests**

`finish.utils.test.ts`:

```ts
import { createGame, type Game } from '@sudoku/core'
import { sampleStart } from '@/game/utils/sample.utils'
import { finishView, formatPuzzleNumber, type FinishInfo } from './finish.utils'

// 09:00 UTC is 12 October in every time zone from UTC-9 to UTC+14.
const FINISHED_AT = new Date(Date.UTC(2026, 9, 12, 9, 0, 0))
const GENERATED: FinishInfo = { level: 'medium', source: 'generated', seed: 412_077, bestBeforeMs: 810_000 }

const board = (changes: Partial<Game> = {}): Game => ({ ...createGame(sampleStart()), ...changes })

describe('formatPuzzleNumber', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1_000, '1 000'],
    [412_077, '412 077'],
    [999_999, '999 999'],
  ])('%i is %s', (seed, text) => {
    expect(formatPuzzleNumber(seed)).toBe(text)
  })
})

describe('finishView', () => {
  it('shows a faster generated game as a new best', () => {
    expect(finishView(board({ mistakes: 1 }), 741_000, GENERATED, FINISHED_AT)).toEqual({
      title: 'Solved · Medium',
      newBest: true,
      time: '12:21',
      mistakes: '1/3',
      hints: '0',
      best: '12:21',
      source: 'Puzzle 412 077',
      fromPaper: false,
      date: '12 Oct 2026',
      label: 'Solved · Medium. New best. Time 12:21. 1 of 3 mistakes. 0 hints. Best 12:21. Puzzle 412 077. 12 Oct 2026',
    })
  })

  it('keeps the stored best time for a slower game', () => {
    expect(finishView(board(), 900_000, GENERATED, FINISHED_AT)).toMatchObject({ newBest: false, best: '13:30' })
  })

  it('does not count a time equal to the best time as a new best', () => {
    expect(finishView(board(), 810_000, GENERATED, FINISHED_AT)).toMatchObject({ newBest: false, best: '13:30' })
  })

  it('shows the first counted win at a level as a new best', () => {
    const info = { ...GENERATED, bestBeforeMs: null }
    expect(finishView(board(), 741_000, info, FINISHED_AT)).toMatchObject({ newBest: true, best: '12:21' })
  })

  it('never shows a game with a hint as a new best', () => {
    expect(finishView(board({ hintsUsed: 1 }), 1_000, GENERATED, FINISHED_AT)).toMatchObject({
      newBest: false,
      hints: '1',
      best: '13:30',
    })
    const first = { ...GENERATED, bestBeforeMs: null }
    expect(finishView(board({ hintsUsed: 1 }), 1_000, first, FINISHED_AT)).toMatchObject({ newBest: false, best: '–' })
  })

  it('shows a scanned game as scanned from paper, never as a new best', () => {
    const scanned: FinishInfo = { level: 'easy', source: 'scanned', seed: null, bestBeforeMs: null }
    expect(finishView(board(), 1_000, scanned, FINISHED_AT)).toMatchObject({
      title: 'Solved · Easy',
      newBest: false,
      best: '–',
      source: 'Scanned from paper',
      fromPaper: true,
    })
  })

  it('names a generated game without a seed', () => {
    const old = { ...GENERATED, seed: null }
    expect(finishView(board(), 900_000, old, FINISHED_AT).source).toBe('Generated puzzle')
  })
})
```

- [ ] **Step 3: Run the tests and see them fail**

Run: `cd apps/mobile && pnpm jest src/game/utils/finish.utils.test.ts`
Expected: FAIL with "Cannot find module './finish.utils'".

- [ ] **Step 4: Write the constants and the util**

`apps/mobile/src/game/constants/finish.constants.ts`:

```ts
/** The Best value when the level has no counted win yet. */
export const NO_BEST = '–'

/** "12 Oct 2026", as on the design canvas. */
export const DATE_LOCALE = 'en-GB'
export const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
```

`apps/mobile/src/game/utils/finish.utils.ts`:

```ts
import { MAX_MISTAKES, type Game } from '@sudoku/core'
import { LEVEL_NAMES } from '@/constants/level.constants'
import { DATE_FORMAT, DATE_LOCALE, NO_BEST } from '@/game/constants/finish.constants'
import { formatClock } from '@/game/utils/time.utils'
import type { Level, PuzzleSource } from '@/storage'

/** bestBeforeMs is the best time of the level before this game, or null when the level has none. */
export type FinishInfo = {
  readonly level: Level
  readonly source: PuzzleSource
  readonly seed: number | null
  readonly bestBeforeMs: number | null
}

export type FinishView = {
  title: string
  newBest: boolean
  time: string
  mistakes: string
  hints: string
  best: string
  source: string
  fromPaper: boolean
  date: string
  /** The VoiceOver label of the whole card. */
  label: string
}

export function formatPuzzleNumber(seed: number): string {
  return String(seed).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function sourceText(info: FinishInfo): string {
  if (info.source === 'scanned') return 'Scanned from paper'
  return info.seed === null ? 'Generated puzzle' : `Puzzle ${formatPuzzleNumber(info.seed)}`
}

/** The same rule as HistoryRepository.bestTimes (ADR-012): only a won generated game without hints counts. */
export function finishView(board: Game, playedMs: number, info: FinishInfo, finishedAt: Date): FinishView {
  const counts = info.source === 'generated' && board.hintsUsed === 0
  const newBest = counts && (info.bestBeforeMs === null || playedMs < info.bestBeforeMs)
  const bestMs = newBest ? playedMs : info.bestBeforeMs
  const title = `Solved · ${LEVEL_NAMES[info.level]}`
  const time = formatClock(playedMs)
  const best = bestMs === null ? NO_BEST : formatClock(bestMs)
  const source = sourceText(info)
  const date = finishedAt.toLocaleDateString(DATE_LOCALE, DATE_FORMAT)
  const label = [
    title,
    ...(newBest ? ['New best'] : []),
    `Time ${time}`,
    `${board.mistakes} of ${MAX_MISTAKES} mistakes`,
    `${board.hintsUsed} hints`,
    `Best ${best}`,
    source,
    date,
  ].join('. ')
  return {
    title,
    newBest,
    time,
    mistakes: `${board.mistakes}/${MAX_MISTAKES}`,
    hints: String(board.hintsUsed),
    best,
    source,
    fromPaper: info.source === 'scanned',
    date,
    label,
  }
}
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `cd apps/mobile && pnpm jest src/game/utils/finish.utils.test.ts src/home`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add apps/mobile/src/constants apps/mobile/src/home apps/mobile/src/game/constants/finish.constants.ts apps/mobile/src/game/utils/finish.utils.ts apps/mobile/src/game/utils/finish.utils.test.ts
/usr/bin/git commit -m "feat(game): the texts of the finish card and the new best rule (#43)"
```

---

### Task 4: The tilt math and the sensor hook

**Files:**
- Create: `apps/mobile/src/game/constants/tilt.constants.ts`, `apps/mobile/src/game/utils/tilt.utils.ts`, `apps/mobile/src/game/hooks/useCardTilt/useCardTilt.ts`, `apps/mobile/src/game/hooks/useCardTilt/index.ts`
- Test: `apps/mobile/src/game/utils/tilt.utils.test.ts`, `apps/mobile/src/game/hooks/useCardTilt/useCardTilt.test.tsx`

**Interfaces:**
- Produces:
  - `type Attitude = { pitch: number; roll: number }`, `type Tilt = { x: number; y: number }` (each from -1 to 1)
  - `isReading(value: { qw: number; qx: number; qy: number; qz: number }): boolean`
  - `tiltOf(now: Attitude, rest: Attitude): Tilt`
  - `cardRotation(tilt: Tilt): { rotateX: number; rotateY: number }` (degrees)
  - `useCardTilt(shineTravel: number): { cardStyle; shineStyle }` (two animated styles)

- [ ] **Step 1: Write the failing util tests**

`tilt.utils.test.ts`:

```ts
import { MAX_ROTATE_X, MAX_ROTATE_Y, TILT_RANGE } from '@/game/constants/tilt.constants'
import { cardRotation, isReading, tiltOf } from './tilt.utils'

const REST = { pitch: 0.6, roll: -0.2 }

it('gives no tilt at the rest position', () => {
  const tilt = tiltOf(REST, REST)
  expect(tilt.x).toBeCloseTo(0)
  expect(tilt.y).toBeCloseTo(0)
})

it('tilts in proportion to the turn of the phone', () => {
  const tilt = tiltOf({ pitch: REST.pitch + TILT_RANGE / 2, roll: REST.roll - TILT_RANGE / 4 }, REST)
  expect(tilt.x).toBeCloseTo(-0.25)
  expect(tilt.y).toBeCloseTo(0.5)
})

it('stops at a full tilt', () => {
  expect(tiltOf({ pitch: REST.pitch + 3, roll: REST.roll - 3 }, REST)).toEqual({ x: -1, y: 1 })
})

it('turns a full tilt into the largest rotation of the canvas', () => {
  const rotation = cardRotation({ x: 1, y: 1 })
  expect(rotation.rotateX).toBeCloseTo(-MAX_ROTATE_X)
  expect(rotation.rotateY).toBeCloseTo(MAX_ROTATE_Y)
})

it('takes only a real reading: the sensor gives zeros before its first value', () => {
  expect(isReading({ qw: 0, qx: 0, qy: 0, qz: 0 })).toBe(false)
  expect(isReading({ qw: 1, qx: 0, qy: 0, qz: 0 })).toBe(true)
  expect(isReading({ qw: 0.5, qx: 0.5, qy: 0.5, qz: 0.5 })).toBe(true)
})
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `cd apps/mobile && pnpm jest src/game/utils/tilt.utils.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write the constants and the worklets**

`tilt.constants.ts`:

```ts
/** The turn of the phone, in radians, that tilts the card fully (ADR-017). */
export const TILT_RANGE = 0.35

/** The largest card rotation in degrees, as on the design canvas. */
export const MAX_ROTATE_X = 8
export const MAX_ROTATE_Y = 10

/** The perspective of the card rotation in points, as on the design canvas. */
export const PERSPECTIVE = 900

/** The part of the card width that the shine moves at a full tilt. */
export const SHINE_TRAVEL = 0.45

export const NO_TILT = { x: 0, y: 0 } as const
```

`tilt.utils.ts`:

```ts
import { MAX_ROTATE_X, MAX_ROTATE_Y, TILT_RANGE } from '@/game/constants/tilt.constants'

export type Attitude = { pitch: number; roll: number }
/** Each axis from -1 to 1. */
export type Tilt = { x: number; y: number }

function clampUnit(value: number): number {
  'worklet'
  return Math.min(1, Math.max(-1, value))
}

/** A real attitude is a unit quaternion. Before its first value, the sensor gives zeros. */
export function isReading(value: { qw: number; qx: number; qy: number; qz: number }): boolean {
  'worklet'
  return value.qw * value.qw + value.qx * value.qx + value.qy * value.qy + value.qz * value.qz > 0.5
}

export function tiltOf(now: Attitude, rest: Attitude): Tilt {
  'worklet'
  return { x: clampUnit((now.roll - rest.roll) / TILT_RANGE), y: clampUnit((now.pitch - rest.pitch) / TILT_RANGE) }
}

/** Degrees. The top of the card turns away when the top of the phone turns away. */
export function cardRotation(tilt: Tilt): { rotateX: number; rotateY: number } {
  'worklet'
  return { rotateX: -tilt.y * MAX_ROTATE_X, rotateY: tilt.x * MAX_ROTATE_Y }
}
```

- [ ] **Step 4: Run the util tests and see them pass**

Run: `cd apps/mobile && pnpm jest src/game/utils/tilt.utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing hook test**

`useCardTilt.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react-native'
import { SensorType, useAnimatedReaction, useAnimatedSensor } from 'react-native-reanimated'
import { MAX_ROTATE_X } from '@/game/constants/tilt.constants'
import { useCardTilt } from './useCardTilt'

const reanimated = jest.requireMock<typeof import('react-native-reanimated')>('react-native-reanimated')

afterEach(() => jest.restoreAllMocks())

it('reads the rotation sensor', () => {
  const sensor = jest.spyOn(reanimated, 'useAnimatedSensor')
  renderHook(() => useCardTilt(135))
  expect(sensor).toHaveBeenCalledWith(SensorType.ROTATION, { interval: 'auto' })
})

it('does not tilt before the rest position is known', () => {
  const { result } = renderHook(() => useCardTilt(135))
  expect(result.current.cardStyle).toMatchObject({
    transform: [{ perspective: 900 }, { rotateX: '0.00deg' }, { rotateY: '0.00deg' }],
  })
})

it('tilts by the change from the first real reading', () => {
  const { result, rerender } = renderHook(() => useCardTilt(135))
  // The mock sensor stays at pitch 0. A rest position 0.35 rad higher is a full tilt down.
  const react = jest.mocked(useAnimatedReaction).mock.calls.at(-1)?.[1]
  react?.({ pitch: 0.35, roll: 0, qw: 1, qx: 0, qy: 0, qz: 0 } as never, null)
  rerender({})
  expect(result.current.cardStyle).toMatchObject({
    transform: [{ perspective: 900 }, { rotateX: `${MAX_ROTATE_X.toFixed(2)}deg` }, { rotateY: '0.00deg' }],
  })
})

it('ignores the zero reading before the first value', () => {
  const { result, rerender } = renderHook(() => useCardTilt(135))
  const react = jest.mocked(useAnimatedReaction).mock.calls.at(-1)?.[1]
  react?.({ pitch: 0.35, roll: 0, qw: 0, qx: 0, qy: 0, qz: 0 } as never, null)
  rerender({})
  expect(result.current.cardStyle).toMatchObject({
    transform: [{ perspective: 900 }, { rotateX: '0.00deg' }, { rotateY: '0.00deg' }],
  })
})
```

If the Reanimated mock of `useAnimatedStyle` or `useDerivedValue` does not compute the value on each render, read the mock in `node_modules/react-native-reanimated/lib/module/mock.js` and adjust only the reads in this test. Do not change the hook for the mock.

- [ ] **Step 6: Write the hook**

`useCardTilt.ts`:

```ts
import {
  SensorType,
  useAnimatedReaction,
  useAnimatedSensor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated'
import { NO_TILT, PERSPECTIVE } from '@/game/constants/tilt.constants'
import { cardRotation, isReading, tiltOf, type Attitude } from '@/game/utils/tilt.utils'

/**
 * The card and shine styles that follow the phone (ADR-017). The first real reading is the rest position.
 * shineTravel is the move of the shine at a full tilt, in points. Do not call it with Reduce Motion on.
 */
export function useCardTilt(shineTravel: number) {
  const { sensor } = useAnimatedSensor(SensorType.ROTATION, { interval: 'auto' })
  const rest = useSharedValue<Attitude | null>(null)

  useAnimatedReaction(
    () => sensor.value,
    (reading) => {
      if (rest.value === null && isReading(reading)) rest.value = { pitch: reading.pitch, roll: reading.roll }
    },
  )

  const tilt = useDerivedValue(() => (rest.value === null ? NO_TILT : tiltOf(sensor.value, rest.value)))

  const cardStyle = useAnimatedStyle(() => {
    const { rotateX, rotateY } = cardRotation(tilt.value)
    return {
      transform: [
        { perspective: PERSPECTIVE },
        { rotateX: `${(rotateX + 0).toFixed(2)}deg` },
        { rotateY: `${(rotateY + 0).toFixed(2)}deg` },
      ],
    }
  })

  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tilt.value.x * shineTravel }, { translateY: tilt.value.y * shineTravel }],
  }))

  return { cardStyle, shineStyle }
}
```

`+ 0` turns -0 into 0, so a still card gives "0.00deg", not "-0.00deg".

`index.ts`:

```ts
export { useCardTilt } from './useCardTilt'
```

- [ ] **Step 7: Run the tests and see them pass**

Run: `cd apps/mobile && pnpm jest src/game/utils/tilt.utils.test.ts src/game/hooks/useCardTilt`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
/usr/bin/git add apps/mobile/src/game/constants/tilt.constants.ts apps/mobile/src/game/utils/tilt.utils.ts apps/mobile/src/game/utils/tilt.utils.test.ts apps/mobile/src/game/hooks/useCardTilt
/usr/bin/git commit -m "feat(game): the card tilt follows the rotation sensor (#43)"
```

---

### Task 5: Theme tokens, the scan icon and the solve delay

**Files:**
- Modify: `apps/mobile/src/theme/theme.types.ts`, `apps/mobile/src/theme/shared.tokens.ts`, `apps/mobile/src/theme/themes/daylight/daylight.ts`, `apps/mobile/src/theme/themes/midnight/midnight.ts`
- Test: `apps/mobile/src/theme/contrast.test.ts`
- Modify: `apps/mobile/src/game/components/Icon/Icon.constants.ts`, `Icon.tsx` (+ its test)
- Create: `apps/mobile/src/game/hooks/useSolveDelay/useSolveDelay.ts`, `index.ts`, `useSolveDelay.test.tsx`

**Interfaces:**
- Produces:
  - `theme.components.finishCard: { top; middle; bottom; text; textMuted; given; entry; line; boxLine; shine; shineCool; shineWarm; shineClear; badge; badgeText }` (strings)
  - `theme.size.card: { width: number; grid: number }`
  - Icon name `scan`. `Icon` prop `color?: string`.
  - `useSolveDelay(won: boolean): boolean`

- [ ] **Step 1: Write the failing contrast pairs**

Add to `TEXT_PAIRS` in `contrast.test.ts`:

```ts
  ['finish card text on its lightest stop', (t) => t.components.finishCard.text, (t) => t.components.finishCard.bottom],
  ['finish card muted text on its lightest stop', (t) => t.components.finishCard.textMuted, (t) => t.components.finishCard.bottom],
  ['finish card given on its middle stop', (t) => t.components.finishCard.given, (t) => t.components.finishCard.middle],
  ['finish card entry on its middle stop', (t) => t.components.finishCard.entry, (t) => t.components.finishCard.middle],
  ['finish card badge text on the badge', (t) => t.components.finishCard.badgeText, (t) => t.components.finishCard.badge],
```

The grid sits in the middle of the card, and the footer at the bottom. So the grid pairs test the middle stop and the footer pairs test the lightest stop.

- [ ] **Step 2: Run the test and see it fail**

Run: `cd apps/mobile && pnpm jest src/theme/contrast.test.ts`
Expected: FAIL. `finishCard` is undefined.

- [ ] **Step 3: Add the tokens**

`theme.types.ts`, in `components`:

```ts
    /** The same in both themes, as on the design canvas. The gradient runs top, middle, bottom at 150°. */
    finishCard: {
      top: string
      middle: string
      bottom: string
      text: string
      textMuted: string
      given: string
      entry: string
      line: string
      boxLine: string
      shine: string
      shineCool: string
      shineWarm: string
      shineClear: string
      badge: string
      badgeText: string
    }
```

`theme.types.ts`, in `size`:

```ts
    /** The finish card width and the side of its grid, in points. */
    card: { width: number; grid: number }
```

`shared.tokens.ts`: add `card: { width: 300, grid: 256 },` to `SHARED_SIZE`. Add:

```ts
/** The canvas draws the finish card the same in both themes. Opaque text colours keep the contrast test exact. */
export const SHARED_FINISH_CARD: Theme['components']['finishCard'] = {
  top: '#151a29',
  middle: '#20306a',
  bottom: '#2a4cbd',
  text: '#ffffff',
  textMuted: '#c9d3f0',
  given: '#ffffff',
  entry: '#a9c2ff',
  line: 'rgba(255,255,255,0.18)',
  boxLine: 'rgba(255,255,255,0.5)',
  shine: 'rgba(255,255,255,0.34)',
  shineCool: 'rgba(170,205,255,0.28)',
  shineWarm: 'rgba(255,190,235,0.2)',
  shineClear: 'rgba(255,255,255,0)',
  badge: '#f0c25a',
  badgeText: '#2a1a00',
}
```

In `daylight.ts` and `midnight.ts`, add `finishCard: SHARED_FINISH_CARD,` to `components` and import it. If `shared.tokens.test.ts` or `just lint` refuses colours in `shared.tokens.ts`, put the same values in each theme's `palette.ts` and map them in each theme instead.

The canvas badge is a gold gradient. One opaque gold keeps the contrast test exact. This is a small, accepted change from the canvas.

- [ ] **Step 4: Run the contrast test and see it pass**

Run: `cd apps/mobile && pnpm jest src/theme`
Expected: PASS. If `textMuted` or `entry` fails, lighten it in steps of `#08` per channel until it passes, and note the value in the commit message.

- [ ] **Step 5: Add the scan icon and the color prop**

In `Icon.constants.ts`, add to `ICON_PATHS`:

```ts
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3',
```

In `Icon.tsx`, add the prop and use it before the tone:

```tsx
type IconProps = {
  name: IconName
  tone: IconTone
  size?: 16 | 24
  /** Wins over tone. For a surface with its own component tokens, such as the finish card. */
  color?: string | undefined
}
```

Replace `color={theme.colors[tone]}` with `color={color ?? theme.colors[tone]}`. Add a test to the existing Icon test file in the style of its other tests: an `Icon` with `color="#123456"` draws with that colour. In a test file, a colour literal is allowed only if `just lint` accepts it. Else read a value from `daylight.components.finishCard.entry`.

- [ ] **Step 6: Write the failing solve delay test**

`useSolveDelay.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { pulseLook, solvePulseDuration } from '@/game/utils/pulse.utils'
import { daylight } from '@/theme/themes/daylight'
import { useSolveDelay } from './useSolveDelay'

const SOLVE_MS = solvePulseDuration(pulseLook(daylight))

beforeEach(() => jest.useFakeTimers())

afterEach(() => {
  jest.useRealTimers()
  jest.mocked(useReducedMotion).mockReturnValue(false)
})

it('stays false while the game is not won', () => {
  const { result } = renderHook(() => useSolveDelay(false))
  act(() => jest.advanceTimersByTime(SOLVE_MS * 2))
  expect(result.current).toBe(false)
})

it('turns true when the solve pulse ends', () => {
  const { result } = renderHook(() => useSolveDelay(true))
  act(() => jest.advanceTimersByTime(SOLVE_MS - 1))
  expect(result.current).toBe(false)
  act(() => jest.advanceTimersByTime(1))
  expect(result.current).toBe(true)
})

it('turns true at once with Reduce Motion on', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const { result } = renderHook(() => useSolveDelay(true))
  expect(result.current).toBe(true)
})
```

The Unistyles mock resolves the first registered theme. If that theme is not Daylight, use the theme that `useUnistyles()` gives in Jest. The motion tokens are shared, so both themes give the same duration.

- [ ] **Step 7: Write the hook**

`useSolveDelay.ts`:

```ts
import { useEffect, useState } from 'react'
import { useReducedMotion } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { pulseLook, solvePulseDuration } from '@/game/utils/pulse.utils'

/** True when the game is won and its solve pulse is over. With Reduce Motion on, no pulse plays, so it is true at once. */
export function useSolveDelay(won: boolean): boolean {
  const { theme } = useUnistyles()
  const reduceMotion = useReducedMotion()
  const [pulseOver, setPulseOver] = useState(false)
  const waitMs = solvePulseDuration(pulseLook(theme))

  useEffect(() => {
    if (!won || reduceMotion) return
    const timer = setTimeout(() => setPulseOver(true), waitMs)
    return () => clearTimeout(timer)
  }, [won, reduceMotion, waitMs])

  return won && (reduceMotion || pulseOver)
}
```

`index.ts`:

```ts
export { useSolveDelay } from './useSolveDelay'
```

- [ ] **Step 8: Run the tests and see them pass**

Run: `cd apps/mobile && pnpm jest src/theme src/game/components/Icon src/game/hooks/useSolveDelay`
Expected: PASS. Then `just lint` and `just typecheck`.

- [ ] **Step 9: Commit**

```bash
/usr/bin/git add apps/mobile/src/theme apps/mobile/src/game/components/Icon apps/mobile/src/game/hooks/useSolveDelay
/usr/bin/git commit -m "feat(game): finish card tokens, the scan icon and the solve delay (#43)"
```

---

### Task 6: The small grid and the finish card

**Files:**
- Create: `apps/mobile/src/game/components/CardGrid/CardGrid.tsx`, `CardGrid.styles.ts`, `index.ts`, `CardGrid.test.tsx`
- Create: `apps/mobile/src/game/components/FinishCard/FinishCard.tsx`, `FinishCard.styles.ts`, `FinishCard.constants.ts`, `index.ts`, `FinishCard.test.tsx`

**Interfaces:**
- Consumes: `finishView`, `FinishInfo` (Task 3). `useCardTilt` (Task 4). `useSolveDelay`, `theme.components.finishCard`, `theme.size.card`, the `scan` icon (Task 5). `useGameState`, `useGameTime`.
- Produces:
  - `CardGrid({ board }: { board: Game })`
  - `FinishCard(props: { info: FinishInfo; onNewPuzzle?: (() => void) | undefined; onHome(): void; now?: () => Date })`. Test ids: `finish` (the scrim), `finish-card` (the card).

- [ ] **Step 1: Write the failing CardGrid test**

`CardGrid.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { createGame } from '@sudoku/core'
import { sampleStart } from '@/game/utils/sample.utils'
import { CardGrid } from './CardGrid'

it('draws all 81 cells with the given or the entry of each cell', () => {
  const { givens, solution } = sampleStart()
  const entries = solution.map((digit, cell) => (givens[cell] === 0 ? digit : 0))
  render(<CardGrid board={createGame({ givens, solution, entries })} />)
  const cells = screen.getAllByTestId(/^card-cell-\d+$/, { includeHiddenElements: true })
  expect(cells).toHaveLength(81)
  expect(cells.map((cell) => cell.props.children)).toEqual(solution)
})

it('hides the grid from VoiceOver: the card label says the result', () => {
  const { givens, solution } = sampleStart()
  render(<CardGrid board={createGame({ givens, solution })} />)
  expect(screen.getByTestId('card-grid', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true)
})
```

If `children` of a `Text` is not the number itself in this React Native Testing Library version, compare `cell.props.children` with `String(digit)` instead.

- [ ] **Step 2: Write CardGrid**

`CardGrid.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  grid: {
    width: theme.size.card.grid,
    height: theme.size.card.grid,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1.5,
    borderColor: theme.components.finishCard.boxLine,
    borderRadius: theme.shape.radius.sm,
    overflow: 'hidden',
  },
  cell: {
    width: `${100 / 9}%`,
    height: `${100 / 9}%`,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.components.finishCard.line,
  },
  boxRight: { borderRightWidth: 1.5, borderRightColor: theme.components.finishCard.boxLine },
  boxBottom: { borderBottomWidth: 1.5, borderBottomColor: theme.components.finishCard.boxLine },
  lastColumn: { borderRightWidth: 0 },
  lastRow: { borderBottomWidth: 0 },
  given: { ...roleFont(theme.type.given), fontSize: 15, color: theme.components.finishCard.given },
  entry: { ...roleFont(theme.type.entry), fontSize: 15, color: theme.components.finishCard.entry },
}))
```

`CardGrid.tsx`:

```tsx
import { memo } from 'react'
import { Text, View } from 'react-native'
import { GRID_CELLS, valueAt, type Game } from '@sudoku/core'
import { styles } from './CardGrid.styles'

const CELLS = Array.from({ length: GRID_CELLS }, (_, cell) => cell)

function edgeStyles(cell: number) {
  const column = cell % 9
  const row = Math.floor(cell / 9)
  return [
    column === 2 || column === 5 ? styles.boxRight : null,
    row === 2 || row === 5 ? styles.boxBottom : null,
    column === 8 ? styles.lastColumn : null,
    row === 8 ? styles.lastRow : null,
  ]
}

/** The solved grid at card size, givens and entries in two styles. VoiceOver skips it: the card label says the result. */
export const CardGrid = memo(function CardGrid({ board }: { board: Game }) {
  return (
    <View
      testID="card-grid"
      style={styles.grid}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {CELLS.map((cell) => (
        <View key={cell} style={[styles.cell, ...edgeStyles(cell)]}>
          <Text testID={`card-cell-${cell}`} style={board.givens[cell] === 0 ? styles.entry : styles.given}>
            {valueAt(board, cell)}
          </Text>
        </View>
      ))}
    </View>
  )
})
```

`index.ts`: `export { CardGrid } from './CardGrid'`

Run: `cd apps/mobile && pnpm jest src/game/components/CardGrid`
Expected: PASS.

- [ ] **Step 3: Write the failing FinishCard test**

`FinishCard.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Pressable } from 'react-native'
import { SensorType, useReducedMotion } from 'react-native-reanimated'
import type { Digit, NewGame } from '@sudoku/core'
import { GameProvider } from '@/game/components/GameProvider'
import { useGameActions } from '@/game/hooks/useGameActions'
import type { FinishInfo } from '@/game/utils/finish.utils'
import { pulseLook, solvePulseDuration } from '@/game/utils/pulse.utils'
import { sampleStart } from '@/game/utils/sample.utils'
import { daylight } from '@/theme/themes/daylight'
import { FinishCard } from './FinishCard'

const reanimated = jest.requireMock<typeof import('react-native-reanimated')>('react-native-reanimated')
const SOLVE_MS = solvePulseDuration(pulseLook(daylight))
const NOW = () => new Date(Date.UTC(2026, 9, 12, 9, 0, 0))
const GENERATED: FinishInfo = { level: 'medium', source: 'generated', seed: 412_077, bestBeforeMs: 810_000 }

// Every open cell is filled except one. Its solution wins the game.
function nearlyWon(): { start: NewGame; cell: number; digit: Digit } {
  const { givens, solution } = sampleStart()
  const cell = givens.findIndex((digit) => digit === 0)
  const entries = solution.map((digit, index) => (givens[index] === 0 && index !== cell ? digit : 0))
  return { start: { givens, solution, entries }, cell, digit: solution[cell] as Digit }
}

const game = nearlyWon()

function WinButton() {
  const { select, digit } = useGameActions()
  return (
    <Pressable
      testID="win"
      onPress={() => {
        select(game.cell)
        digit(game.digit)
      }}
    />
  )
}

type Options = { info?: FinishInfo; onNewPuzzle?: () => void; onHome?: () => void }

function renderCard({ info = GENERATED, onNewPuzzle, onHome = jest.fn() }: Options = {}) {
  render(
    <GameProvider start={game.start}>
      <WinButton />
      <FinishCard info={info} onNewPuzzle={onNewPuzzle} onHome={onHome} now={NOW} />
    </GameProvider>,
  )
}

const win = () => fireEvent.press(screen.getByTestId('win'))
const endPulse = () => act(() => jest.advanceTimersByTime(SOLVE_MS))

beforeEach(() => jest.useFakeTimers())

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
  jest.mocked(useReducedMotion).mockReturnValue(false)
})

it('renders nothing while the game is playing', () => {
  renderCard()
  expect(screen.queryByTestId('finish')).toBeNull()
})

it('shows after the solve pulse, not before', () => {
  renderCard()
  win()
  expect(screen.queryByTestId('finish')).toBeNull()
  endPulse()
  expect(screen.getByTestId('finish')).toBeTruthy()
})

it('shows the level, the time, the stats, the source and the date', () => {
  renderCard()
  win()
  endPulse()
  for (const text of ['Solved · Medium', 'New best', 'Mistakes', '0/3', 'Hints', 'Best', 'Puzzle 412 077', '12 Oct 2026']) {
    expect(screen.getByText(text)).toBeTruthy()
  }
  expect(screen.getAllByTestId(/^card-cell-\d+$/, { includeHiddenElements: true })).toHaveLength(81)
})

it('says scanned from paper and shows no new best for a scanned game', () => {
  renderCard({ info: { level: 'easy', source: 'scanned', seed: null, bestBeforeMs: null } })
  win()
  endPulse()
  expect(screen.getByText('Scanned from paper')).toBeTruthy()
  expect(screen.queryByText('New best')).toBeNull()
})

it('gives the card one VoiceOver label with the whole result', () => {
  renderCard()
  win()
  endPulse()
  expect(screen.getByTestId('finish-card').props.accessibilityLabel).toContain('Solved · Medium. New best. Time')
})

it('starts a new puzzle or goes home', () => {
  const onNewPuzzle = jest.fn()
  const onHome = jest.fn()
  renderCard({ onNewPuzzle, onHome })
  win()
  endPulse()
  fireEvent.press(screen.getByRole('button', { name: 'New puzzle' }))
  fireEvent.press(screen.getByRole('button', { name: 'Back to home' }))
  expect(onNewPuzzle).toHaveBeenCalledTimes(1)
  expect(onHome).toHaveBeenCalledTimes(1)
})

it('has no New puzzle button without onNewPuzzle', () => {
  renderCard()
  win()
  endPulse()
  expect(screen.queryByRole('button', { name: 'New puzzle' })).toBeNull()
})

it('tilts with the rotation sensor', () => {
  const sensor = jest.spyOn(reanimated, 'useAnimatedSensor')
  renderCard()
  win()
  endPulse()
  expect(sensor).toHaveBeenCalledWith(SensorType.ROTATION, { interval: 'auto' })
})

it('with Reduce Motion on, shows at once and reads no sensor', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const sensor = jest.spyOn(reanimated, 'useAnimatedSensor')
  renderCard()
  win()
  expect(screen.getByTestId('finish')).toBeTruthy()
  expect(sensor).not.toHaveBeenCalled()
})
```

Run: `cd apps/mobile && pnpm jest src/game/components/FinishCard`
Expected: FAIL with "Cannot find module './FinishCard'".

- [ ] **Step 4: Write the constants and the styles**

`FinishCard.constants.ts`:

```ts
/** The rise of the card at its start, in points, as on the design canvas. */
export const RISE_OFFSET = 24
```

`FinishCard.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme, rt) => {
  const card = theme.components.finishCard
  return {
    scrim: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space.lg,
      paddingTop: rt.insets.top,
      paddingBottom: rt.insets.bottom,
      paddingHorizontal: theme.space.lg,
      backgroundColor: theme.colors.scrimStrong,
    },
    card: {
      width: theme.size.card.width,
      gap: 14,
      paddingTop: 22,
      paddingHorizontal: 22,
      paddingBottom: 16,
      borderRadius: 24,
      overflow: 'hidden',
      experimental_backgroundImage: `linear-gradient(150deg, ${card.top} 0%, ${card.middle} 58%, ${card.bottom} 100%)`,
      boxShadow: theme.elevation.sheet,
    },
    shine: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: '-80%',
      width: '260%',
      mixBlendMode: 'screen',
      experimental_backgroundImage: `linear-gradient(115deg, ${card.shineClear} 30%, ${card.shine} 44%, ${card.shineCool} 50%, ${card.shineWarm} 56%, ${card.shineClear} 68%)`,
    },
    top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    // The canvas shows the title in capitals. The text stays "Solved · Medium" for VoiceOver and the tests.
    title: {
      ...roleFont(theme.type.section),
      fontSize: 12,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: card.textMuted,
    },
    badge: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: theme.shape.radius.pill,
      backgroundColor: card.badge,
    },
    badgeText: { ...roleFont(theme.type.label), fontSize: 12, fontWeight: '700', color: card.badgeText },
    time: {
      ...roleFont(theme.type.timer),
      fontSize: 48,
      fontWeight: '700',
      lineHeight: 48,
      fontVariant: ['tabular-nums'],
      color: card.text,
    },
    stats: { flexDirection: 'row', gap: theme.space.sm },
    stat: { flex: 1 },
    statLabel: { ...roleFont(theme.type.caption), fontSize: 11, color: card.textMuted },
    statValue: {
      ...roleFont(theme.type.label),
      fontSize: 17,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
      color: card.text,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space.sm,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: card.line,
    },
    source: { ...roleFont(theme.type.caption), flex: 1, fontSize: 13, color: card.text },
    date: { ...roleFont(theme.type.caption), fontSize: 13, color: card.textMuted },
    actions: { width: theme.size.card.width, gap: 6 },
    newPuzzle: {
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.accent,
    },
    newPuzzleText: { ...roleFont(theme.type.button), fontSize: theme.type.button.scale, color: theme.colors.onAccent },
    home: { minHeight: theme.size.touch, alignItems: 'center', justifyContent: 'center' },
    homeText: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.text },
  }
})
```

If a `theme.type` role in this file does not exist, use the nearest role that `theme.types.ts` has. Do not add a role for this card.

- [ ] **Step 5: Write FinishCard**

`FinishCard.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Pressable, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import type { Game } from '@sudoku/core'
import { CardGrid } from '@/game/components/CardGrid'
import { Icon } from '@/game/components/Icon'
import { SHINE_TRAVEL } from '@/game/constants/tilt.constants'
import { useCardTilt } from '@/game/hooks/useCardTilt'
import { useGameState } from '@/game/hooks/useGameState'
import { useGameTime } from '@/game/hooks/useGameTime'
import { useSolveDelay } from '@/game/hooks/useSolveDelay'
import { finishView, type FinishInfo, type FinishView } from '@/game/utils/finish.utils'
import { RISE_OFFSET } from './FinishCard.constants'
import { styles } from './FinishCard.styles'

type FinishCardProps = {
  info: FinishInfo
  /** Without it, the card has no New puzzle button. */
  onNewPuzzle?: (() => void) | undefined
  onHome(): void
  /** The date on the card. Tests give a fixed date. */
  now?: () => Date
}

/** Renders nothing until the game is won and its solve pulse is over. This gate reads no time, so a tick does not render it. */
export function FinishCard(props: FinishCardProps) {
  const { board } = useGameState()
  const shown = useSolveDelay(board.status === 'won')
  if (!shown) return null
  return <Finish board={board} {...props} />
}

function Finish({ board, info, onNewPuzzle, onHome, now = () => new Date() }: FinishCardProps & { board: Game }) {
  const playedMs = useGameTime()
  const [finishedAt] = useState(now)
  const view = finishView(board, playedMs, info, finishedAt)
  const { theme } = useUnistyles()
  const reduceMotion = useReducedMotion()
  const card = useRef<View>(null)
  // The scrim hides the grid, but VoiceOver focus stays on the key that won the game.
  const focusCard = useCallback(() => {
    if (card.current) AccessibilityInfo.sendAccessibilityEvent(card.current, 'focus')
  }, [])
  // 1 is the start of the rise and 0 its end. With Reduce Motion the card starts at its end.
  const rise = useSharedValue(reduceMotion ? 0 : 1)
  useEffect(() => {
    if (reduceMotion) {
      focusCard()
      return
    }
    rise.set(
      withTiming(0, { duration: theme.motion.medium, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished) scheduleOnRN(focusCard)
      }),
    )
  }, [focusCard, reduceMotion, rise, theme.motion.medium])
  const riseStyle = useAnimatedStyle(() => ({
    opacity: 1 - rise.value,
    transform: [{ translateY: rise.value * RISE_OFFSET }],
  }))
  const face = <Face view={view} board={board} iconColor={theme.components.finishCard.textMuted} />
  return (
    <View testID="finish" style={styles.scrim} accessibilityViewIsModal>
      <Animated.View style={riseStyle}>
        {reduceMotion ? (
          <View ref={card} testID="finish-card" style={styles.card} accessible accessibilityLabel={view.label}>
            <View style={styles.shine} pointerEvents="none" />
            {face}
          </View>
        ) : (
          <TiltingCard cardRef={card} label={view.label} shineTravel={theme.size.card.width * SHINE_TRAVEL}>
            {face}
          </TiltingCard>
        )}
      </Animated.View>
      <View style={styles.actions}>
        {onNewPuzzle && (
          <Pressable accessibilityRole="button" onPress={onNewPuzzle} style={styles.newPuzzle}>
            <Text style={styles.newPuzzleText}>New puzzle</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={onHome} style={styles.home}>
          <Text style={styles.homeText}>Back to home</Text>
        </Pressable>
      </View>
    </View>
  )
}

type TiltingCardProps = {
  cardRef: React.RefObject<View | null>
  label: string
  shineTravel: number
  children: ReactNode
}

/** A separate component: useCardTilt starts the sensor, and with Reduce Motion on the sensor must not start (ADR-017). */
function TiltingCard({ cardRef, label, shineTravel, children }: TiltingCardProps) {
  const { cardStyle, shineStyle } = useCardTilt(shineTravel)
  return (
    <Animated.View
      ref={cardRef}
      testID="finish-card"
      style={[styles.card, cardStyle]}
      accessible
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.shine, shineStyle]} pointerEvents="none" />
      {children}
    </Animated.View>
  )
}

function Face({ view, board, iconColor }: { view: FinishView; board: Game; iconColor: string }) {
  return (
    <>
      <View style={styles.top}>
        <Text style={styles.title}>{view.title}</Text>
        {view.newBest && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>New best</Text>
          </View>
        )}
      </View>
      <Text style={styles.time}>{view.time}</Text>
      <CardGrid board={board} />
      <View style={styles.stats}>
        <Stat label="Mistakes" value={view.mistakes} />
        <Stat label="Hints" value={view.hints} />
        <Stat label="Best" value={view.best} />
      </View>
      <View style={styles.footer}>
        {view.fromPaper && <Icon name="scan" tone="textMuted" size={16} color={iconColor} />}
        <Text style={styles.source}>{view.source}</Text>
        <Text style={styles.date}>{view.date}</Text>
      </View>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  )
}
```

If `React.RefObject` needs an import in this TypeScript setup, import `type RefObject` from `react` and use it.

`index.ts`: `export { FinishCard } from './FinishCard'`

- [ ] **Step 6: Run the tests and see them pass**

Run: `cd apps/mobile && pnpm jest src/game/components/FinishCard src/game/components/CardGrid`
Expected: PASS. Then run `just lint` and `just typecheck`.

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add apps/mobile/src/game/components/CardGrid apps/mobile/src/game/components/FinishCard
/usr/bin/git commit -m "feat(game): the finish card with the small grid, the stats and the tilt (#43)"
```

---

### Task 7: The finish card on the game screen

**Files:**
- Modify: `apps/mobile/src/game/screens/GameScreen/GameScreen.tsx`, `apps/mobile/src/game/screens/PlayScreen/PlayScreen.tsx`
- Test: `apps/mobile/test/routes.test.tsx`

**Interfaces:**
- Consumes: `FinishCard` (Task 6), `FinishInfo` (Task 3), `seed` (Tasks 1 and 2), `HistoryRepository.bestTimes()`.
- Produces: `GameScreen` prop `finish?: FinishInfo | undefined`.

- [ ] **Step 1: Write the failing route tests**

In `test/routes.test.tsx`, add the imports:

```ts
import { useReducedMotion } from 'react-native-reanimated'
import { formatPuzzleNumber } from '@/game/utils/finish.utils'
import { newGame, wonGame } from '@/storage/repositories.contract'
```

Add to the `afterEach`: `jest.mocked(useReducedMotion).mockReturnValue(false)`. Add the helper after `loseGame`:

```ts
// A key is disabled only when all nine of its digits are placed, so the key of each open cell still works.
function winGame(game: Game) {
  game.givens.forEach((given, cell) => {
    if (given !== 0) return
    fireEvent.press(screen.getByTestId(`cell-${cell}`))
    fireEvent.press(screen.getByLabelText(`Enter ${game.solution[cell]}`))
  })
}
```

Add the tests at the end. Reduce Motion is on in these tests, so the card shows without the wait of the solve pulse:

```ts
it('a won game shows the finish card, and New puzzle starts a new game at the same level', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const storage = renderApp()
  const won = await startGame(storage, 'Medium')
  winGame(won.game)
  await screen.findByTestId('finish')
  expect(screen.getByText('Solved · Medium')).toBeTruthy()
  expect(screen.getByText('New best')).toBeTruthy()
  expect(screen.getByText(`Puzzle ${formatPuzzleNumber(won.seed ?? -1)}`)).toBeTruthy()
  await waitFor(async () =>
    expect(await storage.history.list()).toMatchObject([{ id: won.id, result: 'won', seed: won.seed }]),
  )
  fireEvent.press(screen.getByRole('button', { name: 'New puzzle' }))
  await waitFor(() => expect(screen.queryByTestId('finish')).toBeNull())
  const next = await inProgress(storage)
  expect(next.id).not.toBe(won.id)
  expect(next.level).toBe('medium')
})

it('the finish card shows no New best when the stored best time is not beaten', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const storage = createMemoryStorage()
  const earlier = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
  await storage.puzzles.save(earlier.id, wonGame(0))
  renderApp(storage)
  const won = await startGame(storage)
  winGame(won.game)
  await screen.findByTestId('finish')
  expect(screen.queryByText('New best')).toBeNull()
})

it('the next game compares against the best time of the game that just finished', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const storage = renderApp()
  const first = await startGame(storage)
  winGame(first.game)
  await screen.findByText('New best')
  fireEvent.press(screen.getByRole('button', { name: 'New puzzle' }))
  await waitFor(() => expect(screen.queryByTestId('finish')).toBeNull())
  await layOutBoard()
  const second = await inProgress(storage)
  winGame(second.game)
  await screen.findByTestId('finish')
  // Both games take 0 ms of play in Jest, and an equal time is not a new best.
  expect(screen.queryByText('New best')).toBeNull()
})

it('Back to home on the finish card shows no Continue', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const storage = renderApp()
  const won = await startGame(storage)
  winGame(won.game)
  await screen.findByTestId('finish')
  fireEvent.press(within(screen.getByTestId('finish')).getByRole('button', { name: 'Back to home' }))
  await waitFor(() => expect(screen).toHavePathname('/'))
  expect(await screen.findByRole('button', { name: 'Easy' })).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('button', { name: /^Continue/ })).toBeNull())
})
```

If the game clock ticks in these Jest tests, the third test can still pass by chance with "New best". Then make it exact: after the first win, read `(await storage.history.bestTimes()).easy` and assert that the second card's "Best" value is that time or shorter.

Run: `cd apps/mobile && pnpm jest test/routes.test.tsx`
Expected: FAIL. No element has the test id `finish`.

- [ ] **Step 2: Render the card on the game screen**

`GameScreen.tsx`: import `FinishCard` and `type FinishInfo`. Add to the props:

```ts
  /** The level, source, seed and best time of the game. Without it, the screen shows no finish card. */
  finish?: FinishInfo | undefined
```

Destructure `finish`. After `<GameOverSheet … />`, add:

```tsx
        {finish && <FinishCard info={finish} onNewPuzzle={onNewPuzzle} onHome={onBack} />}
```

- [ ] **Step 3: Read the best times in PlayScreen**

Replace the `progress` state of `PlayScreen.tsx` with one loaded state. The full changed parts:

```tsx
import type { BestTimes, PuzzleSource, SavedProgress } from '@/storage'
import type { FinishInfo } from '@/game/utils/finish.utils'

type Loaded = { progress: SavedProgress; best: BestTimes }
```

```tsx
export function PlayScreen() {
  const router = useRouter()
  const { puzzles, history } = useGameStorage()
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  const home = useCallback(() => router.dismissTo('/'), [router])

  useEffect(() => {
    let live = true
    Promise.all([puzzles.current(), history.bestTimes()])
      .then(([current, best]) => {
        if (!live) return
        if (current === null) home()
        else setLoaded({ progress: current, best })
      })
      .catch((error: unknown) => {
        devWarn('storage', `The game in progress does not load: ${errorMessage(error)}`)
        home()
      })
    return () => {
      live = false
    }
  }, [puzzles, history, home])

  const progress = loaded?.progress ?? null
  const id = progress?.id
```

`save` stays as it is. `restartWith`:

```tsx
  // Each restart is a new game in progress with a new id: save() moved a finished game to the history,
  // so the store ignores later saves under the old id. A failed start keeps the old screen.
  // The best times are read after the start: start() runs after that save, so they include the finished game.
  const restartWith = useCallback(
    async (source: PuzzleSource, make: (current: SavedProgress) => { game: Game; seed: number | null }) => {
      if (progress === null) return
      try {
        const { game, seed } = make(progress)
        const started = await puzzles.start({ level: progress.level, source, seed, game })
        setLoaded({ progress: started, best: await history.bestTimes() })
      } catch (error) {
        devWarn('storage', `The game does not start: ${errorMessage(error)}`)
      }
    },
    [puzzles, history, progress],
  )
```

`newPuzzle` and `retry` stay as Task 2 wrote them. Add the finish info and the prop:

```tsx
  const finish = useMemo<FinishInfo | null>(
    () =>
      loaded === null
        ? null
        : {
            level: loaded.progress.level,
            source: loaded.progress.source,
            seed: loaded.progress.seed,
            bestBeforeMs: loaded.best[loaded.progress.level] ?? null,
          },
    [loaded],
  )

  if (progress === null || save === null || finish === null) return null
  return (
    <GameSaveContext value={save}>
      {/* A new id mounts a new game screen. A Game in start resumes as it was saved (startSession). */}
      <GameScreen
        key={progress.id}
        start={progress.game}
        finish={finish}
        onBack={home}
        onNewPuzzle={newPuzzle}
        onRetry={retry}
      />
    </GameSaveContext>
  )
```

Keep the old comment above `restartWith`, extended as shown. Keep the doc comment of `PlayScreen`, and add one sentence: "The best times load with the game, so the finish card compares against the best time before this game."

- [ ] **Step 4: Run the tests and see them pass**

Run: `cd apps/mobile && pnpm jest test src/game/screens`
Expected: PASS. Then the full checks:

```bash
just lint
just typecheck
just test-ts
just docs-check
```

Expected: all pass. Write down the result lines for the pull request.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add apps/mobile/src/game/screens apps/mobile/test/routes.test.tsx
/usr/bin/git commit -m "feat(game): a won game ends with the finish card (#43)"
```

---

### Task 8: iPhone check, criteria, pull request

- [ ] **Step 1:** The developer runs the iPhone steps below on the development build, with `just app`. No new build is needed: this plan adds no native code.
- [ ] **Step 2:** Tick the criteria of #43 that pass, with `gh issue edit 43 --body-file <file>`. "An ADR records the motion sensor dependency, if one is needed" passes with ADR-017.
- [ ] **Step 3:** Open the pull request against `develop` when the developer asks. The body has a summary, the "Files owned" table, the result lines of the four checks, the iPhone results, `Part of #34` and `Closes #43`. If #43 is the last open sub-issue of #34, use `Closes #34` instead of `Part of #34`. Link ADR-017 and the two amendments from #43. Then a second agent reviews the pull request without this session's context (root `AGENTS.md`, Work tracking 10).

## iPhone steps for the developer

Do the steps in Daylight. Repeat step 2 in Midnight.

1. Start an Easy game. Tap Hint until the grid is full. The solve pulse plays. Then the card rises over a light scrim. It shows "SOLVED · EASY", the time, the small solved grid (printed digits white, hint digits light blue), Mistakes "0/3", Hints, Best "–", "Puzzle" with a number of six digits or fewer, and today's date. No "New best": a hint game does not count.
2. Tilt the phone slowly forward, back, left and right. The card turns a little and the shine moves. No permission question shows. Hold the phone still: the card stops moving.
3. Lay the phone flat on a table, then pick it up. The card tilts at most a little: it never flips or jumps.
4. Tap New puzzle. A new Easy game opens. Tap Back, then check that the home screen shows Continue for the new game.
5. Solve an Easy game without hints. The card shows "New best" in gold, and Best equals the time.
6. Tap Back to home on the card. The home screen shows no Continue.
7. Turn on Settings › Accessibility › Motion › Reduce Motion. Finish a game with hints. The card shows at once, without the rise. It does not tilt when the phone moves. Turn Reduce Motion off again.
8. Scan a paper puzzle and tap Play this puzzle. Finish it with hints. The card shows the scan icon and "Scanned from paper". No "New best".
9. Turn on VoiceOver. Finish a game with hints. Focus moves to the card. VoiceOver reads the level, the time, the mistakes, the hints, the best time, the source and the date in one label. It does not read the 81 cells of the small grid.
10. Check the card on the smallest iPhone you have. The card, New puzzle and Back to home fit on the screen without overlap.

Report each step as passed or failed, with a screenshot of any failure.

## Open questions

1. **The gold badge.** The canvas badge is a gold gradient. The plan uses one opaque gold, so the contrast test is exact. **Recommendation:** accept. A gradient badge can come with a design pass later.
2. **Old games without a seed.** A game saved before migration 3 has no seed. Its card says "Generated puzzle". **Recommendation:** accept. Only games in progress at the update have this, and only once.
3. **The best time when the history does not load.** `PlayScreen` loads the game and the best times together. If the best times fail, the game screen does not open, as for a failed load today. **Recommendation:** accept. Both reads use the same database.
