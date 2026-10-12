# Game Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the game screen of the design canvas (header, grid, tools, keypad) on top of the game rules of `@sudoku/core`, split into components that the wave 4 issues of epic #34 can change in parallel.

**Architecture:** A pure session reducer in `src/game/utils/` wraps the core actions and records the last move. `useGameSession` holds that reducer, the clock and the haptics, and a `GameProvider` shares it through React context. Each part of the screen reads the context, so a later issue can mount a new part without new props through other files. Every themed value lives in a Unistyles styles file (ADR-015). The cells take only primitive props and read no theme hook.

**Tech Stack:** Expo 57, React Native 0.86, React 19, react-native-unistyles 3.5.2, @shopify/react-native-skia 2.6.2 (icons), expo-haptics, Jest 29 + @testing-library/react-native 13, `@sudoku/core` (solver and game rules).

**Spec:** issue #37 (`gh issue view 37`), the design canvas "Game screen" (https://claude.ai/artifact/U23JHiGA1Pq3HJX6oMiBF4, `Main.dc.html`), `docs/architecture/00-concepts/game-screen.md`, ADR-015, `apps/mobile/AGENTS.md`.


## Developer decisions (2026-10-12, binding; they override the tasks below where they differ)

- Grid cells (about 38 pt on a 390 pt screen) are the one exception to the 44 pt touch target. Every button and key meets 44 pt. Record the exception in `docs/architecture/00-concepts/game-screen.md` (Constraints section, STE light). #37 owns that file in this wave. Run `just docs-check`.

## Global Constraints

- Branch `feature/37-game-screen` from `origin/develop`, after PR #57 (game rules, #49) is merged. PR against `develop` with `Closes #37`.
- First commit: copy this plan to `docs/superpowers/plans/2026-10-12-game-screen.md` with `docs(plan): game screen (#37)`.
- The screen holds no game rule. Every rule comes from `@sudoku/core` (SUD-04, game-screen concept).
- `src/game/` never imports from `src/scanner/` (SUD-03).
- No colour value outside `src/theme/` (`just lint` refuses it). Themed styles live in `<Name>.styles.ts`: `StyleSheet.create((theme) => …)` from `react-native-unistyles`.
- One style key per state, not Unistyles variants: the Jest mock of Unistyles drops variants (see `CorrectionCell.styles.ts`).
- Do not spread a Unistyles style. Pass an array.
- The `Cell` component reads no theme hook, so a theme switch does not re-render the 81 cells (ADR-015).
- Import rules of `apps/mobile/AGENTS.md`: `@/` alias, folder `index.ts` entries, no `../`, no barrels, no `export *`, utils and constants import no React.
- Do not add a dependency. Do not add navigation (an ADR comes with #51).
- Touch targets: back button 44 pt, tool buttons 52 pt, number keys 64 × 60 pt. Notes 11 pt (`type.note.scale`).
- Comments and prose: STE light and the comment rules of `AGENTS.md`. No issue numbers in code comments.
- Commits: Conventional Commits, each with `(#37)`.
- Checks before the PR: `just lint`, `just typecheck`, `just test-ts`.

## Review Focus

1. **A theme switch during a game.** Every cell colour comes from `Cell.styles.ts`, and `Cell` never calls `useUnistyles()`. Test: Task 4, "reads no theme hook".
2. **A paused game.** The core can be paused. Every cell must then show no digit, no note and no shade. Test: Task 1, "hides every digit and note while the game is paused".
3. **Taps after the game ended.** After the third mistake, every key and tool is disabled and a tap changes nothing. Test: Task 6, "locks the tools and the keypad when the game is lost".
4. **A short screen.** On an iPhone SE the space for the grid is wider than tall. The grid must stay square and fit the smaller side. Test: Task 4, "keeps the grid square in the smaller side".
5. **The timer.** It counts only while playing, and it shows minutes past 59 without hours. Tests: Task 1 (`formatClock`) and Task 3 (`useGameClock`).

## File Structure

All paths are under `apps/mobile/` unless stated.

| File | Responsibility |
| --- | --- |
| `src/game/constants/assists.constants.ts` | `Assists` type and `DEFAULT_ASSISTS` (all on) |
| `src/game/constants/game.constants.ts` | `SAMPLE_GIVENS`, `CLOCK_INTERVAL_MS` |
| `src/game/utils/session.utils.ts` (+ test) | `Session`, `Move`, `SessionAction`, `startSession`, `reduceSession`, `canUndo`, `canErase` |
| `src/game/utils/cell.utils.ts` (+ test) | `CellView`, `cellViews(game, assists)`: digit, digit style, notes, fill and ring of each cell |
| `src/game/utils/cellLabel.utils.ts` (+ test) | `cellLabel(cell, view)`: the VoiceOver label of a cell |
| `src/game/utils/time.utils.ts` (+ test) | `formatClock(ms)` |
| `src/game/utils/sample.utils.ts` (+ test) | `sampleStart()`: the canvas puzzle with its solution from `solve()` |
| `src/game/hooks/useGameClock/` | Calls back with the elapsed milliseconds while running |
| `src/game/hooks/useMoveHaptics/` | A light haptic tap for a placed number |
| `src/game/hooks/useGameSession/` | The reducer, the views, the clock, the haptics and the actions |
| `src/game/hooks/useGame/` | `GameContext` and `useGame()` |
| `src/game/components/GameProvider/` | Runs `useGameSession` and provides the context |
| `src/game/components/Icon/` | Stroke icons drawn with Skia, from the canvas paths |
| `src/game/components/Cell/` | One cell: fill, ring, digit or notes |
| `src/game/components/Grid/` | 81 cells in nine boxes, lines as gaps (ADR-015, point 6) |
| `src/game/components/Board/` | Measures the space and keeps the grid square |
| `src/game/components/TimerPill/` | The time played |
| `src/game/components/MistakeDots/` | Three dots, one filled per mistake |
| `src/game/components/Header/` | Back button, timer pill, mistake dots |
| `src/game/components/Tools/` | Undo, Erase, Notes, Hint |
| `src/game/components/NumberKey/` | One key |
| `src/game/components/Keypad/` | Keys 1 to 5 and 6 to 9 in two centred rows |
| `src/game/screens/GameScreen/` | Composes the screen |
| `App.tsx`, `App.test.tsx`, `App.probeFailure.test.tsx` | In a development build, open on the game screen. Back opens the scan flow |
| `jest.setup.ts` | Adds the Skia `Path` component to the existing Skia mock |

No theme file changes: `Theme` already holds every token the canvas needs (`components.grid`, `components.cell`, `components.key`, `type.given/entry/note/key/keyNote/timer`, `shape.gridLine`, `elevation.key`). If a token proves missing, add it to `theme.types.ts`, both themes and the contrast test in the same commit, and say so in the PR.

### Wave 4 ownership

Each wave 4 issue changes only the files in its row, and adds new files of its own. All paths are under `apps/mobile/src/game/`. A file with no row stays as #37 leaves it.

| Issue | Owns these #37 files | Mounts its new parts in |
| --- | --- | --- |
| #38 assists and settings | `hooks/useAssists/*`, `hooks/useCellViews/*`, `constants/assists.constants.ts`, `utils/cell.utils.ts` (+ test) | `useAssists` returns the saved assists. It does not need `useGameSession` |
| #39 pause | `hooks/useGameSession/*`, `hooks/useGameClock/*`, `components/Board/*`, `components/TimerPill/*` | The pause layer in `Board`, the tap in `TimerPill`, AppState in `useGameClock` and `useGameSession` |
| #40 game over | `screens/GameScreen/*`, `components/MistakeDots/*` | The game over sheet in `GameScreen`, the warning haptic in `MistakeDots` |
| #41 complete number keys | `components/Keypad/*`, `components/NumberKey/*` | — |
| #42 pulses and haptics | `components/Grid/*`, `hooks/useMoveHaptics/*` | A pulse layer in `Grid` that reads `move` from `useGameState()` |
| #44 accessibility | `components/Cell/*`, `utils/cellLabel.utils.ts` (+ test) | Run #44 after the rest of wave 4: Dynamic Type also touches the timer pill (#39), the sheets (#40) and settings (#38) |
| #27 scanned puzzle | none | `GameScreen` takes `start: NewGame`, so the scan hands over givens and entries. Its route belongs to the navigation of #51 |

No wave 4 issue changes these files: `utils/session.utils.ts`, `utils/grid.utils.ts`, `utils/time.utils.ts`, `utils/sample.utils.ts`, `constants/game.constants.ts`, `hooks/useGameState/*`, `hooks/useGameTime/*`, `hooks/useGameActions/*`, `components/GameProvider/*`, `components/Header/*`, `components/Tools/*`, `components/Icon/*` and `components/ThemeStatusBar/*`. `session.utils.ts` already holds the `pause` and `resume` actions. The core already locks a lost or won game, and #37 already disables the tools and the keypad when the status is not `playing`, so #39 and #40 do not change `Tools` or `Keypad`.

### Render rule

A clock tick and a theme switch MUST NOT render the grid again. Three contexts carry the game: `useGameActions()` (stable for the whole game), `useGameState()` (the board, notes mode and the last move; a tick keeps it) and `useGameTime()` (the time; only the timer pill reads it). No component above the grid reads a theme hook. `GameScreen.renders.test.tsx` counts the renders.

### How the screen is reached

Navigation waits for the ADR of #51. In a development build (`__DEV__`), `App.tsx` opens on the game screen with the canvas puzzle. The back button opens the scan flow, as today. A release build opens on the scan flow only, as today.

---

### Task 1: Pure game utils

**Files:**
- Create: `src/game/constants/assists.constants.ts`
- Create: `src/game/constants/game.constants.ts`
- Create: `src/game/utils/session.utils.ts`, `src/game/utils/session.utils.test.ts`
- Create: `src/game/utils/cell.utils.ts`, `src/game/utils/cell.utils.test.ts`
- Create: `src/game/utils/cellLabel.utils.ts`, `src/game/utils/cellLabel.utils.test.ts`
- Create: `src/game/utils/time.utils.ts`, `src/game/utils/time.utils.test.ts`
- Create: `src/game/utils/sample.utils.ts`, `src/game/utils/sample.utils.test.ts`

**Interfaces:**
- Consumes (`@sudoku/core`): `createGame`, `select`, `place`, `toggleNote`, `erase`, `undo`, `hint`, `pause`, `resume`, `tick`, `valueAt`, `isWrong`, `solve`, types `Game`, `NewGame`, `Digit`, `Completion`, `MoveResult`, `Random`.
- Produces:
  - `type Assists = { rowColumn: boolean; box: boolean; selectedCell: boolean; sameNumbers: boolean }`, `DEFAULT_ASSISTS`
  - `type MoveKind = 'number' | 'clear' | 'note' | 'erase' | 'undo' | 'hint'`
  - `type Move = { id: number; kind: MoveKind; cell: number | null; completed: Completion; mistake: boolean }`
  - `type Session = { game: Game; notesMode: boolean; move: Move | null }`
  - `type SessionAction`, `startSession(start: NewGame): Session`, `reduceSession(session, action): Session`, `canUndo(game): boolean`, `canErase(game): boolean`
  - `type CellFill = 'plain' | 'peer' | 'same' | 'conflict' | 'selected'`, `type DigitStyle = 'given' | 'entry' | 'wrong'`
  - `type CellView = { digit: number; digitStyle: DigitStyle; notes: string; fill: CellFill; ring: boolean }`, `cellViews(game, assists): CellView[]`
  - `cellLabel(cell: number, view: CellView): string`, `formatClock(ms: number): string`, `sampleStart(): NewGame`

- [ ] **Step 1: Write the constants**

`src/game/constants/assists.constants.ts`:

```ts
/** The shades that help the player read the grid. The game-screen concept describes each one. */
export type Assists = {
  rowColumn: boolean
  box: boolean
  selectedCell: boolean
  sameNumbers: boolean
}

export const DEFAULT_ASSISTS: Assists = { rowColumn: true, box: true, selectedCell: true, sameNumbers: true }
```

`src/game/constants/game.constants.ts`:

```ts
/** The puzzle of the design canvas. 0 marks an empty cell. */
export const SAMPLE_GIVENS = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'

/** How often the clock reports the elapsed time, in milliseconds. */
export const CLOCK_INTERVAL_MS = 1000
```

The opacities of locked and disabled controls stay in the styles files: dependency-cruiser lets a styles file import only `react-native`, `react-native-unistyles` and `src/theme/`.

- [ ] **Step 2: Write the failing tests**

`src/game/utils/sample.utils.test.ts`:

```ts
import { solve } from '@sudoku/core'
import { sampleStart } from './sample.utils'

it('gives the canvas puzzle with its one solution', () => {
  const { givens, solution } = sampleStart()
  expect(givens.slice(0, 9)).toEqual([5, 3, 0, 0, 7, 0, 0, 0, 0])
  expect(solve(givens)).toEqual({ count: 1, solution })
})
```

`src/game/utils/time.utils.test.ts`:

```ts
import { formatClock } from './time.utils'

it.each([
  [0, '00:00'],
  [999, '00:00'],
  [65_999, '01:05'],
  [3_600_000, '60:00'],
  [6_000_000, '100:00'],
])('shows %d ms as %s', (ms, text) => {
  expect(formatClock(ms)).toBe(text)
})
```

`src/game/utils/session.utils.test.ts`:

```ts
import { canErase, canUndo, reduceSession, startSession, type Session, type SessionAction } from './session.utils'
import { sampleStart } from './sample.utils'

// Cell 2 is empty in the canvas puzzle. Its solution is 4.
const OPEN = 2
const start = () => startSession(sampleStart())
const run = (session: Session, ...actions: SessionAction[]) => actions.reduce(reduceSession, session)

it('places a number in the selected cell and records the move', () => {
  const session = run(start(), { type: 'select', cell: OPEN }, { type: 'digit', digit: 4 })
  expect(session.game.entries[OPEN]).toBe(4)
  expect(session.move).toMatchObject({ id: 1, kind: 'number', cell: OPEN, mistake: false })
})

it('marks a wrong number as a mistake', () => {
  const session = run(start(), { type: 'select', cell: OPEN }, { type: 'digit', digit: 5 })
  expect(session.game.mistakes).toBe(1)
  expect(session.move).toMatchObject({ kind: 'number', mistake: true })
})

it('records a clear when the same number is placed again', () => {
  const session = run(
    start(),
    { type: 'select', cell: OPEN },
    { type: 'digit', digit: 4 },
    { type: 'digit', digit: 4 },
  )
  expect(session.game.entries[OPEN]).toBe(0)
  expect(session.move).toMatchObject({ id: 2, kind: 'clear' })
})

it('toggles a note in notes mode', () => {
  const session = run(start(), { type: 'select', cell: OPEN }, { type: 'toggleNotesMode' }, { type: 'digit', digit: 3 })
  expect(session.notesMode).toBe(true)
  expect(session.game.notes[OPEN]).toEqual([3])
  expect(session.move).toMatchObject({ kind: 'note' })
})

it('returns the same session when an action changes nothing', () => {
  const session = start()
  expect(reduceSession(session, { type: 'undo' })).toBe(session)
  expect(reduceSession(session, { type: 'digit', digit: 4 })).toBe(session)
  expect(reduceSession(session, { type: 'erase' })).toBe(session)
})

it('fills the cell that the random source picks with a hint, and selects it', () => {
  const session = run(start(), { type: 'hint', random: () => 0 })
  expect(session.game.entries[OPEN]).toBe(4)
  expect(session.game.selected).toBe(OPEN)
  expect(session.move).toMatchObject({ kind: 'hint', cell: OPEN })
})

it('adds time only while the game is playing', () => {
  const played = run(start(), { type: 'tick', elapsedMs: 1000 })
  expect(played.game.playedMs).toBe(1000)
  const paused = run(played, { type: 'pause' })
  expect(paused.game.status).toBe('paused')
  expect(reduceSession(paused, { type: 'tick', elapsedMs: 1000 })).toBe(paused)
  expect(run(paused, { type: 'resume' }).game.status).toBe('playing')
})

it('does not change notes mode after the game is lost', () => {
  const lost = run(
    start(),
    { type: 'select', cell: OPEN },
    { type: 'digit', digit: 5 },
    { type: 'digit', digit: 6 },
    { type: 'digit', digit: 7 },
  )
  expect(lost.game.status).toBe('lost')
  expect(reduceSession(lost, { type: 'toggleNotesMode' })).toBe(lost)
})

it('knows when undo and erase can act', () => {
  const fresh = start()
  expect(canUndo(fresh.game)).toBe(false)
  expect(canErase(fresh.game)).toBe(false)
  const placed = run(fresh, { type: 'select', cell: OPEN }, { type: 'digit', digit: 4 })
  expect(canUndo(placed.game)).toBe(true)
  expect(canErase(placed.game)).toBe(true)
  // Cell 0 holds the given 5.
  expect(canErase(run(placed, { type: 'select', cell: 0 }).game)).toBe(false)
})
```

`src/game/utils/cell.utils.test.ts`:

```ts
import { DEFAULT_ASSISTS } from '@/game/constants/assists.constants'
import { cellViews } from './cell.utils'
import { reduceSession, startSession, type SessionAction } from './session.utils'
import { sampleStart } from './sample.utils'

const gameAfter = (...actions: SessionAction[]) => actions.reduce(reduceSession, startSession(sampleStart())).game

it('styles givens, entries and wrong entries apart', () => {
  const views = cellViews(gameAfter({ type: 'select', cell: 2 }, { type: 'digit', digit: 5 }), DEFAULT_ASSISTS)
  expect(views[0]).toMatchObject({ digit: 5, digitStyle: 'given' })
  expect(views[2]).toMatchObject({ digit: 5, digitStyle: 'wrong' })
  const right = cellViews(gameAfter({ type: 'select', cell: 2 }, { type: 'digit', digit: 4 }), DEFAULT_ASSISTS)
  expect(right[2]).toMatchObject({ digit: 4, digitStyle: 'entry' })
})

it('shades the row, the column and the box of the selected cell', () => {
  const views = cellViews(gameAfter({ type: 'select', cell: 40 }), DEFAULT_ASSISTS)
  expect(views[40]?.fill).toBe('selected')
  expect(views[36]?.fill).toBe('peer')
  expect(views[4]?.fill).toBe('peer')
  expect(views[30]?.fill).toBe('peer')
  expect(views[0]?.fill).toBe('plain')
})

it('shades every cell with the number of the selected cell', () => {
  // Cell 0 holds 5. Cell 14 holds 5 too, outside the row, column and box of cell 0.
  const views = cellViews(gameAfter({ type: 'select', cell: 0 }), DEFAULT_ASSISTS)
  expect(views[14]?.fill).toBe('same')
})

it('keeps the conflict fill of a wrong entry under the shades', () => {
  const views = cellViews(
    gameAfter({ type: 'select', cell: 2 }, { type: 'digit', digit: 5 }, { type: 'select', cell: 0 }),
    DEFAULT_ASSISTS,
  )
  expect(views[2]?.fill).toBe('conflict')
})

it('follows the assists', () => {
  const game = gameAfter({ type: 'select', cell: 40 })
  const views = cellViews(game, { ...DEFAULT_ASSISTS, rowColumn: false, selectedCell: false })
  expect(views[36]?.fill).toBe('plain')
  expect(views[40]).toMatchObject({ ring: true })
  expect(views[40]?.fill).not.toBe('selected')
})

it('lists the notes of an empty cell in order', () => {
  const views = cellViews(
    gameAfter({ type: 'select', cell: 2 }, { type: 'toggleNotesMode' }, { type: 'digit', digit: 3 }, { type: 'digit', digit: 2 }),
    DEFAULT_ASSISTS,
  )
  expect(views[2]?.notes).toBe('23')
})

it('hides every digit and note while the game is paused', () => {
  const views = cellViews(
    gameAfter({ type: 'select', cell: 2 }, { type: 'digit', digit: 4 }, { type: 'pause' }),
    DEFAULT_ASSISTS,
  )
  for (const view of views) expect(view).toMatchObject({ digit: 0, notes: '', fill: 'plain', ring: false })
})
```

`src/game/utils/cellLabel.utils.test.ts`:

```ts
import { cellLabel } from './cellLabel.utils'

const view = { digit: 0, digitStyle: 'entry', notes: '', fill: 'plain', ring: false } as const

it('reads the row, the column and the content of a cell', () => {
  expect(cellLabel(0, { ...view, digit: 5, digitStyle: 'given' })).toBe('Row 1, column 1, given 5')
  expect(cellLabel(40, { ...view, digit: 4 })).toBe('Row 5, column 5, 4')
  expect(cellLabel(80, { ...view, digit: 6, digitStyle: 'wrong' })).toBe('Row 9, column 9, wrong 6')
  expect(cellLabel(2, view)).toBe('Row 1, column 3, empty')
  expect(cellLabel(2, { ...view, notes: '35' })).toBe('Row 1, column 3, empty, notes 3 5')
})
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `pnpm --filter mobile exec jest src/game/utils`
Expected: FAIL, "Cannot find module './session.utils'" and the same for the other utils.

- [ ] **Step 4: Write the utils**

`src/game/utils/sample.utils.ts`:

```ts
import { solve, type NewGame } from '@sudoku/core'
import { SAMPLE_GIVENS } from '@/game/constants/game.constants'

/** The canvas puzzle. Throws when the puzzle does not have exactly one solution. */
export function sampleStart(): NewGame {
  const givens = [...SAMPLE_GIVENS].map(Number)
  const result = solve(givens)
  if (result.count !== 1) throw new Error(`The sample puzzle has ${result.count} solutions`)
  return { givens, solution: result.solution }
}
```

`src/game/utils/time.utils.ts`:

```ts
const twoDigits = (value: number) => String(value).padStart(2, '0')

/** Minutes and seconds, for example 04:12. Minutes go past 59: the timer has no hours. */
export function formatClock(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return `${twoDigits(Math.floor(seconds / 60))}:${twoDigits(seconds % 60)}`
}
```

`src/game/utils/session.utils.ts`:

```ts
import {
  createGame,
  erase,
  hint,
  pause,
  place,
  resume,
  select,
  tick,
  toggleNote,
  undo,
  type Completion,
  type Digit,
  type Game,
  type MoveResult,
  type NewGame,
  type Random,
} from '@sudoku/core'

export type MoveKind = 'number' | 'clear' | 'note' | 'erase' | 'undo' | 'hint'

/** The last action that changed the board. id grows by one per move, so an effect sees a repeat of the same move. */
export type Move = {
  id: number
  kind: MoveKind
  cell: number | null
  completed: Completion
  mistake: boolean
}

/** A game and the screen state around it. Notes mode belongs to the screen, not to the rules. */
export type Session = { game: Game; notesMode: boolean; move: Move | null }

export type SessionAction =
  | { type: 'select'; cell: number }
  | { type: 'digit'; digit: Digit }
  | { type: 'erase' }
  | { type: 'undo' }
  | { type: 'hint'; random: Random }
  | { type: 'toggleNotesMode' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'tick'; elapsedMs: number }

export function startSession(start: NewGame): Session {
  return { game: createGame(start), notesMode: false, move: null }
}

function withGame(session: Session, game: Game): Session {
  return game === session.game ? session : { ...session, game }
}

/** The core returns the same game object when an action changes nothing. Then the session stays the same too. */
function moved(session: Session, kind: MoveKind, result: MoveResult): Session {
  if (result.game === session.game) return session
  return {
    ...session,
    game: result.game,
    move: {
      id: (session.move?.id ?? 0) + 1,
      kind,
      cell: result.game.selected,
      completed: result.completed,
      mistake: result.game.mistakes > session.game.mistakes,
    },
  }
}

function placeDigit(session: Session, digit: Digit): Session {
  if (session.notesMode) return moved(session, 'note', toggleNote(session.game, digit))
  const result = place(session.game, digit)
  const cell = result.game.selected
  const cleared = cell !== null && result.game.entries[cell] === 0
  return moved(session, cleared ? 'clear' : 'number', result)
}

export function reduceSession(session: Session, action: SessionAction): Session {
  switch (action.type) {
    case 'select':
      return withGame(session, select(session.game, action.cell))
    case 'digit':
      return placeDigit(session, action.digit)
    case 'erase':
      return moved(session, 'erase', erase(session.game))
    case 'undo':
      return moved(session, 'undo', undo(session.game))
    case 'hint':
      return moved(session, 'hint', hint(session.game, action.random))
    case 'toggleNotesMode':
      return session.game.status === 'playing' ? { ...session, notesMode: !session.notesMode } : session
    case 'pause':
      return withGame(session, pause(session.game))
    case 'resume':
      return withGame(session, resume(session.game))
    case 'tick':
      return withGame(session, tick(session.game, action.elapsedMs))
  }
}

export function canUndo(game: Game): boolean {
  return game.status === 'playing' && game.undoSteps.length > 0
}

export function canErase(game: Game): boolean {
  const cell = game.selected
  if (game.status !== 'playing' || cell === null || game.givens[cell] !== 0) return false
  return game.entries[cell] !== 0 || (game.notes[cell] ?? []).length > 0
}
```

`src/game/utils/cell.utils.ts`:

```ts
import { isWrong, valueAt, type Game } from '@sudoku/core'
import type { Assists } from '@/game/constants/assists.constants'

export type CellFill = 'plain' | 'peer' | 'same' | 'conflict' | 'selected'

export type DigitStyle = 'given' | 'entry' | 'wrong'

/** What one cell shows. digit 0: no digit. notes: the note digits in order, for example "35". */
export type CellView = {
  digit: number
  digitStyle: DigitStyle
  notes: string
  fill: CellFill
  /** A thin ring marks the selected cell when the selected-cell assist is off. */
  ring: boolean
}

const rowOf = (cell: number) => Math.floor(cell / 9)
const columnOf = (cell: number) => cell % 9
const boxOf = (cell: number) => Math.floor(rowOf(cell) / 3) * 3 + Math.floor(columnOf(cell) / 3)

const HIDDEN: CellView = { digit: 0, digitStyle: 'entry', notes: '', fill: 'plain', ring: false }

/** The view of each cell, row by row. A paused game hides the whole board. */
export function cellViews(game: Game, assists: Assists): CellView[] {
  if (game.status === 'paused') return game.givens.map(() => HIDDEN)
  const selected = game.selected
  const selectedValue = selected === null ? 0 : valueAt(game, selected)
  return game.givens.map((given, cell) => {
    const digit = valueAt(game, cell)
    const wrong = isWrong(game, cell)
    let fill: CellFill = 'plain'
    if (selected !== null) {
      const sameLine = rowOf(cell) === rowOf(selected) || columnOf(cell) === columnOf(selected)
      if (assists.rowColumn && sameLine) fill = 'peer'
      if (assists.box && boxOf(cell) === boxOf(selected)) fill = 'peer'
      if (assists.sameNumbers && selectedValue !== 0 && cell !== selected && digit === selectedValue) fill = 'same'
    }
    if (wrong) fill = 'conflict'
    if (cell === selected && assists.selectedCell) fill = 'selected'
    return {
      digit,
      digitStyle: given !== 0 ? 'given' : wrong ? 'wrong' : 'entry',
      notes: digit === 0 ? (game.notes[cell] ?? []).join('') : '',
      fill,
      ring: cell === selected && !assists.selectedCell,
    }
  })
}
```

`src/game/utils/cellLabel.utils.ts`:

```ts
import type { CellView } from './cell.utils'

const CONTENT_PREFIX = { given: 'given ', entry: '', wrong: 'wrong ' } as const

/** The VoiceOver label of a cell, for example "Row 5, column 5, empty, notes 3 5". */
export function cellLabel(cell: number, view: CellView): string {
  const place = `Row ${Math.floor(cell / 9) + 1}, column ${(cell % 9) + 1}`
  if (view.digit !== 0) return `${place}, ${CONTENT_PREFIX[view.digitStyle]}${view.digit}`
  if (view.notes === '') return `${place}, empty`
  return `${place}, empty, notes ${[...view.notes].join(' ')}`
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm --filter mobile exec jest src/game/utils`
Expected: PASS, 5 suites.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/game/constants apps/mobile/src/game/utils
git commit -m "feat(game): session reducer, cell views and labels on the game rules (#37)"
```

---

### Task 2: Skia `Path` in the Jest mock, and the icons

**Files:**
- Modify: `jest.setup.ts` (the `@shopify/react-native-skia` mock)
- Create: `src/game/components/Icon/Icon.tsx`, `Icon.constants.ts`, `Icon.test.tsx`, `index.ts`

**Interfaces:**
- Produces: `type IconName = 'back' | 'pause' | 'undo' | 'erase' | 'notes' | 'hint'`, `type IconTone = 'text' | 'accent'`, `Icon({ name, tone, size? }: { name: IconName; tone: IconTone; size?: 16 | 24 })`.

- [ ] **Step 1: Add `Path` to the Skia mock**

In `jest.setup.ts`, inside the object that the `jest.mock('@shopify/react-native-skia', …)` factory returns, add after `Picture`:

```ts
    Group: ({ children }: { children?: unknown }) => children,
    Path: (props: object) => createElement(View, { testID: 'skia-path', ...props }),
```

- [ ] **Step 2: Write the failing test**

`src/game/components/Icon/Icon.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { Icon } from './Icon'
import { daylight } from '@/theme/themes/daylight'

it('strokes the path of the icon in the colour of its tone', () => {
  render(<Icon name="undo" tone="accent" />)
  const path = screen.getByTestId('skia-path')
  expect(path.props.path).toBe('M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11')
  expect(path.props.color).toBe(daylight.colors.accent)
  expect(path.props.style).toBe('stroke')
})

it('draws the small icons with a thicker line', () => {
  render(<Icon name="pause" tone="text" size={16} />)
  expect(screen.getByTestId('skia-path').props.strokeWidth).toBe(2)
})
```

- [ ] **Step 3: Run the test to see it fail**

Run: `pnpm --filter mobile exec jest src/game/components/Icon`
Expected: FAIL, "Cannot find module './Icon'".

- [ ] **Step 4: Write the icon**

`src/game/components/Icon/Icon.constants.ts` (paths of the design canvas, in a 24 × 24 box):

```ts
export const ICON_PATHS = {
  back: 'M15 18l-6-6 6-6',
  pause: 'M9 5v14M15 5v14',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  erase:
    'M20 20H9l-4.6-4.6a1.5 1.5 0 0 1 0-2.1l8.9-8.9a1.5 1.5 0 0 1 2.1 0l4.6 4.6a1.5 1.5 0 0 1 0 2.1L13 19M8 11l6 6',
  notes: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  hint: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z',
} as const

/** The canvas draws 24 pt icons with a 1.8 line and 16 pt icons with a 2 line, in a 24-unit box. */
export const STROKE_WIDTH = { 16: 2, 24: 1.8 } as const

export const VIEW_BOX = 24
```

`src/game/components/Icon/Icon.tsx`:

```tsx
import { Canvas, Group, Path } from '@shopify/react-native-skia'
import { useUnistyles } from 'react-native-unistyles'
import { ICON_PATHS, STROKE_WIDTH, VIEW_BOX } from './Icon.constants'

export type IconName = keyof typeof ICON_PATHS

export type IconTone = 'text' | 'accent'

type IconProps = { name: IconName; tone: IconTone; size?: 16 | 24 }

/** A stroke icon. Skia reads the colour as a value, so the icon reads the theme (ADR-015, point 10). */
export function Icon({ name, tone, size = 24 }: IconProps) {
  const { theme } = useUnistyles()
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group transform={[{ scale: size / VIEW_BOX }]}>
        <Path
          path={ICON_PATHS[name]}
          style="stroke"
          strokeWidth={STROKE_WIDTH[size]}
          strokeCap="round"
          strokeJoin="round"
          color={theme.colors[tone]}
        />
      </Group>
    </Canvas>
  )
}
```

`src/game/components/Icon/index.ts`:

```ts
export { Icon } from './Icon'
export type { IconName, IconTone } from './Icon'
```

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm --filter mobile exec jest src/game/components/Icon`
Expected: PASS, 2 tests. Also run `pnpm --filter mobile exec jest src/scan` and expect it to stay green, because the Skia mock changed.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/jest.setup.ts apps/mobile/src/game/components/Icon
git commit -m "feat(game): stroke icons of the design canvas, drawn with Skia (#37)"
```

---

### Task 3: The session hooks and the provider

**Files:**
- Create: `src/game/hooks/useGameClock/useGameClock.ts`, `useGameClock.test.tsx`, `index.ts`
- Create: `src/game/hooks/useMoveHaptics/useMoveHaptics.ts`, `useMoveHaptics.test.tsx`, `index.ts`
- Create: `src/game/hooks/useGameSession/useGameSession.ts`, `useGameSession.test.tsx`, `index.ts`
- Create: `src/game/hooks/useGame/useGame.ts`, `index.ts`
- Create: `src/game/components/GameProvider/GameProvider.tsx`, `GameProvider.test.tsx`, `index.ts`

**Interfaces:**
- Consumes: Task 1 (`reduceSession`, `startSession`, `cellViews`, `DEFAULT_ASSISTS`, `CLOCK_INTERVAL_MS`, `Move`, `Session`, `CellView`).
- Produces:
  - `useGameClock(running: boolean, onElapsed: (ms: number) => void): void`
  - `useMoveHaptics(move: Move | null): void`
  - `type GameActions = { select(cell: number): void; digit(digit: Digit): void; erase(): void; undo(): void; hint(): void; toggleNotesMode(): void; pause(): void; resume(): void }`
  - `type GameSession = Session & { views: CellView[]; actions: GameActions }`
  - `useGameSession(start: NewGame): GameSession`
  - `GameContext`, `useGame(): GameSession`
  - `GameProvider({ start, children }: { start: NewGame; children: ReactNode })`

- [ ] **Step 1: Write the failing tests**

`src/game/hooks/useGameClock/useGameClock.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react-native'
import { useGameClock } from './useGameClock'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('reports the elapsed time once a second while running', () => {
  const onElapsed = jest.fn()
  renderHook(() => useGameClock(true, onElapsed))
  jest.advanceTimersByTime(3000)
  expect(onElapsed).toHaveBeenCalledTimes(3)
  expect(onElapsed).toHaveBeenLastCalledWith(1000)
})

it('stops when it no longer runs', () => {
  const onElapsed = jest.fn()
  const { rerender } = renderHook(({ running }) => useGameClock(running, onElapsed), {
    initialProps: { running: true },
  })
  jest.advanceTimersByTime(1000)
  rerender({ running: false })
  jest.advanceTimersByTime(5000)
  expect(onElapsed).toHaveBeenCalledTimes(1)
})
```

`src/game/hooks/useMoveHaptics/useMoveHaptics.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { NOTHING_COMPLETED } from '@sudoku/core'
import type { Move, MoveKind } from '@/game/utils/session.utils'
import { useMoveHaptics } from './useMoveHaptics'

const move = (id: number, kind: MoveKind): Move => ({ id, kind, cell: 2, completed: NOTHING_COMPLETED, mistake: false })

beforeEach(() => jest.mocked(Haptics.impactAsync).mockClear())

it('gives a light tap for each placed number', () => {
  const { rerender } = renderHook(({ last }: { last: Move | null }) => useMoveHaptics(last), {
    initialProps: { last: null },
  })
  rerender({ last: move(1, 'number') })
  rerender({ last: move(2, 'number') })
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(2)
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
})

it('gives no tap for a note, a clear or an undo', () => {
  const { rerender } = renderHook(({ last }: { last: Move | null }) => useMoveHaptics(last), {
    initialProps: { last: move(1, 'note') },
  })
  rerender({ last: move(2, 'clear') })
  rerender({ last: move(3, 'undo') })
  expect(Haptics.impactAsync).not.toHaveBeenCalled()
})
```

`src/game/hooks/useGameSession/useGameSession.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react-native'
import { sampleStart } from '@/game/utils/sample.utils'
import { useGameSession } from './useGameSession'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('plays a number through its actions and updates the views', () => {
  const { result } = renderHook(() => useGameSession(sampleStart()))
  act(() => result.current.actions.select(2))
  act(() => result.current.actions.digit(4))
  expect(result.current.views[2]).toMatchObject({ digit: 4, digitStyle: 'entry', fill: 'selected' })
  expect(result.current.move).toMatchObject({ kind: 'number' })
})

it('counts the time played while playing, and not while paused', () => {
  const { result } = renderHook(() => useGameSession(sampleStart()))
  act(() => jest.advanceTimersByTime(2000))
  expect(result.current.game.playedMs).toBe(2000)
  act(() => result.current.actions.pause())
  act(() => jest.advanceTimersByTime(5000))
  expect(result.current.game.playedMs).toBe(2000)
})

it('keeps the same actions object between renders', () => {
  const { result, rerender } = renderHook(() => useGameSession(sampleStart()))
  const first = result.current.actions
  rerender({})
  expect(result.current.actions).toBe(first)
})
```

`src/game/components/GameProvider/GameProvider.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { useGame } from '@/game/hooks/useGame'
import { sampleStart } from '@/game/utils/sample.utils'
import { GameProvider } from './GameProvider'

function Probe() {
  const { game } = useGame()
  return <Text>{game.status}</Text>
}

it('shares one game session with the parts of the screen', () => {
  render(
    <GameProvider start={sampleStart()}>
      <Probe />
    </GameProvider>,
  )
  expect(screen.getByText('playing')).toBeTruthy()
})

it('refuses a part of the screen outside the provider', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  expect(() => render(<Probe />)).toThrow('useGame needs a GameProvider')
  error.mockRestore()
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm --filter mobile exec jest src/game/hooks src/game/components/GameProvider`
Expected: FAIL, "Cannot find module".

- [ ] **Step 3: Write the hooks and the provider**

`src/game/hooks/useGameClock/useGameClock.ts`:

```ts
import { useEffect, useRef } from 'react'
import { CLOCK_INTERVAL_MS } from '@/game/constants/game.constants'

/** Calls onElapsed with the milliseconds since its last call, about once a second, while running is true. */
export function useGameClock(running: boolean, onElapsed: (ms: number) => void): void {
  const callback = useRef(onElapsed)
  callback.current = onElapsed
  useEffect(() => {
    if (!running) return undefined
    let last = Date.now()
    const timer = setInterval(() => {
      const now = Date.now()
      callback.current(now - last)
      last = now
    }, CLOCK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [running])
}
```

`src/game/hooks/useGameClock/index.ts`:

```ts
export { useGameClock } from './useGameClock'
```

`src/game/hooks/useMoveHaptics/useMoveHaptics.ts`:

```ts
import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import type { Move } from '@/game/utils/session.utils'

/** A light tap for each placed number. */
export function useMoveHaptics(move: Move | null): void {
  useEffect(() => {
    if (move?.kind !== 'number') return
    // A phone without a haptic engine rejects the call. The game goes on without the tap.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
  }, [move])
}
```

`src/game/hooks/useMoveHaptics/index.ts`:

```ts
export { useMoveHaptics } from './useMoveHaptics'
```

`src/game/hooks/useGameSession/useGameSession.ts`:

```ts
import { useCallback, useMemo, useReducer } from 'react'
import type { Digit, NewGame } from '@sudoku/core'
import { DEFAULT_ASSISTS } from '@/game/constants/assists.constants'
import { useGameClock } from '@/game/hooks/useGameClock'
import { useMoveHaptics } from '@/game/hooks/useMoveHaptics'
import { cellViews, type CellView } from '@/game/utils/cell.utils'
import { reduceSession, startSession, type Session } from '@/game/utils/session.utils'

export type GameActions = {
  select(cell: number): void
  digit(digit: Digit): void
  erase(): void
  undo(): void
  hint(): void
  toggleNotesMode(): void
  pause(): void
  resume(): void
}

export type GameSession = Session & { views: CellView[]; actions: GameActions }

/** One game in progress. start is read once, when the hook mounts. */
export function useGameSession(start: NewGame): GameSession {
  const [session, dispatch] = useReducer(reduceSession, start, startSession)
  const views = useMemo(() => cellViews(session.game, DEFAULT_ASSISTS), [session.game])
  const onElapsed = useCallback((elapsedMs: number) => dispatch({ type: 'tick', elapsedMs }), [])
  useGameClock(session.game.status === 'playing', onElapsed)
  useMoveHaptics(session.move)
  const actions = useMemo<GameActions>(
    () => ({
      select: (cell) => dispatch({ type: 'select', cell }),
      digit: (digit) => dispatch({ type: 'digit', digit }),
      erase: () => dispatch({ type: 'erase' }),
      undo: () => dispatch({ type: 'undo' }),
      hint: () => dispatch({ type: 'hint', random: Math.random }),
      toggleNotesMode: () => dispatch({ type: 'toggleNotesMode' }),
      pause: () => dispatch({ type: 'pause' }),
      resume: () => dispatch({ type: 'resume' }),
    }),
    [],
  )
  return { ...session, views, actions }
}
```

`src/game/hooks/useGameSession/index.ts`:

```ts
export { useGameSession } from './useGameSession'
export type { GameActions, GameSession } from './useGameSession'
```

`src/game/hooks/useGame/useGame.ts`:

```ts
import { createContext, useContext } from 'react'
import type { GameSession } from '@/game/hooks/useGameSession'

export const GameContext = createContext<GameSession | null>(null)

/** The game session of the screen. Each part reads it here, so a new part needs no new props. */
export function useGame(): GameSession {
  const session = useContext(GameContext)
  if (session === null) throw new Error('useGame needs a GameProvider')
  return session
}
```

`src/game/hooks/useGame/index.ts`:

```ts
export { GameContext, useGame } from './useGame'
```

`src/game/components/GameProvider/GameProvider.tsx`:

```tsx
import type { ReactNode } from 'react'
import type { NewGame } from '@sudoku/core'
import { GameContext } from '@/game/hooks/useGame'
import { useGameSession } from '@/game/hooks/useGameSession'

type GameProviderProps = { start: NewGame; children: ReactNode }

export function GameProvider({ start, children }: GameProviderProps) {
  return <GameContext value={useGameSession(start)}>{children}</GameContext>
}
```

`src/game/components/GameProvider/index.ts`:

```ts
export { GameProvider } from './GameProvider'
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter mobile exec jest src/game/hooks src/game/components/GameProvider`
Expected: PASS, 4 suites.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/game/hooks apps/mobile/src/game/components/GameProvider
git commit -m "feat(game): game session hooks, clock, placement haptic and provider (#37)"
```

---

### Task 4: Cell, Grid and Board

**Files:**
- Create: `src/game/components/Cell/Cell.tsx`, `Cell.styles.ts`, `Cell.constants.ts`, `Cell.test.tsx`, `index.ts`
- Create: `src/game/components/Grid/Grid.tsx`, `Grid.styles.ts`, `Grid.test.tsx`, `index.ts`
- Create: `src/game/components/Board/Board.tsx`, `Board.styles.ts`, `Board.test.tsx`, `index.ts`

**Interfaces:**
- Consumes: `useGame()`, `CellView`, `CellFill`, `DigitStyle`, `cellLabel`, `BOXES` from `@sudoku/core`.
- Produces: `Cell(props: CellView & { cell: number; label: string; onSelect(cell: number): void })` (memo), `Grid()`, `Board()`.

- [ ] **Step 1: Write the failing tests**

`src/game/components/Cell/Cell.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { daylight } from '@/theme/themes/daylight'
import { Cell } from './Cell'

const base = { cell: 2, digit: 0, digitStyle: 'entry', notes: '', fill: 'plain', ring: false, label: 'cell' } as const

it('reads no theme hook, so a theme switch does not re-render the 81 cells (ADR-015)', () => {
  const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
  const theming = jest.spyOn(unistyles, 'useUnistyles')
  render(<Cell {...base} onSelect={jest.fn()} />)
  expect(theming).not.toHaveBeenCalled()
  theming.mockRestore()
})

it('draws a wrong entry in the conflict colours', () => {
  render(<Cell {...base} digit={6} digitStyle="wrong" fill="conflict" onSelect={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByTestId('cell-2').props.style)).toMatchObject({
    backgroundColor: daylight.components.cell.conflictFill,
  })
  expect(StyleSheet.flatten(screen.getByText('6').props.style)).toMatchObject({
    color: daylight.components.cell.conflict,
  })
})

it('draws the notes at 11 pt or more, each in its own place of a 3 × 3 set', () => {
  render(<Cell {...base} notes="39" onSelect={jest.fn()} />)
  const three = StyleSheet.flatten(screen.getByText('3').props.style)
  expect(three.fontSize).toBeGreaterThanOrEqual(11)
  expect(screen.getAllByTestId(/^note-slot-/)).toHaveLength(9)
})

it('selects its cell when tapped', () => {
  const onSelect = jest.fn()
  render(<Cell {...base} onSelect={onSelect} />)
  fireEvent.press(screen.getByTestId('cell-2'))
  expect(onSelect).toHaveBeenCalledWith(2)
})

it('draws a ring when the selected-cell assist is off', () => {
  render(<Cell {...base} ring onSelect={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByTestId('cell-2').props.style)).toMatchObject({
    borderColor: daylight.components.cell.ring,
  })
})
```

`src/game/components/Grid/Grid.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { GameProvider } from '@/game/components/GameProvider'
import { sampleStart } from '@/game/utils/sample.utils'
import { Grid } from './Grid'

const renderGrid = () =>
  render(
    <GameProvider start={sampleStart()}>
      <Grid />
    </GameProvider>,
  )

it('draws 81 cells in nine boxes', () => {
  renderGrid()
  expect(screen.getAllByTestId(/^cell-\d+$/)).toHaveLength(81)
  expect(screen.getAllByTestId(/^box-\d$/)).toHaveLength(9)
})

it('puts each cell in its box, row by row', () => {
  renderGrid()
  // Box 4 is the centre box. Its first cell is row 4, column 4: cell 30. Its last is cell 50.
  const box4 = within(screen.getByTestId('box-4'))
  expect(box4.getByTestId('cell-30')).toBeTruthy()
  expect(box4.getByTestId('cell-50')).toBeTruthy()
  expect(box4.queryByTestId('cell-0')).toBeNull()
})

it('selects a cell on a tap', () => {
  renderGrid()
  fireEvent.press(screen.getByTestId('cell-40'))
  expect(screen.getByLabelText('Row 5, column 5, empty')).toBeTruthy()
})
```

`src/game/components/Board/Board.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { GameProvider } from '@/game/components/GameProvider'
import { sampleStart } from '@/game/utils/sample.utils'
import { Board } from './Board'

it('keeps the grid square in the smaller side', () => {
  render(
    <GameProvider start={sampleStart()}>
      <Board />
    </GameProvider>,
  )
  fireEvent(screen.getByTestId('board'), 'layout', { nativeEvent: { layout: { width: 358, height: 300 } } })
  expect(StyleSheet.flatten(screen.getByTestId('board-square').props.style)).toMatchObject({ width: 300, height: 300 })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm --filter mobile exec jest src/game/components/Cell src/game/components/Grid src/game/components/Board`
Expected: FAIL, "Cannot find module".

- [ ] **Step 3: Write the components**

`src/game/components/Cell/Cell.constants.ts`:

```ts
/** The note places of a cell, in a 3 × 3 set: 1 2 3 on top, 7 8 9 at the bottom. */
export const NOTE_PLACES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const
```

`src/game/components/Cell/Cell.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

// One key per cell state, not Unistyles variants: the Jest mock of Unistyles drops variants.
export const styles = StyleSheet.create((theme) => ({
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  plain: { backgroundColor: theme.components.cell.fill },
  peer: { backgroundColor: theme.components.cell.peer },
  same: { backgroundColor: theme.components.cell.same },
  conflict: { backgroundColor: theme.components.cell.conflictFill },
  selected: { backgroundColor: theme.components.cell.selected },
  ring: { borderWidth: 2, borderColor: theme.components.cell.ring },
  given: { ...roleFont(theme.type.given), fontSize: theme.type.given.scale, color: theme.components.cell.given },
  entry: { ...roleFont(theme.type.entry), fontSize: theme.type.entry.scale, color: theme.components.cell.entry },
  wrong: { ...roleFont(theme.type.entry), fontSize: theme.type.entry.scale, color: theme.components.cell.conflict },
  notes: { position: 'absolute', top: 2, right: 2, bottom: 2, left: 2, flexDirection: 'row', flexWrap: 'wrap' },
  noteSlot: { width: '33.33%', height: '33.33%', alignItems: 'center', justifyContent: 'center' },
  note: { ...roleFont(theme.type.note), fontSize: theme.type.note.scale, color: theme.components.cell.note },
}))
```

Note: `roleFont` returns a plain object, not a Unistyles style, so the spread is allowed (rule 3 is about Unistyles styles).

`src/game/components/Cell/Cell.tsx`:

```tsx
import { memo } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { CellView } from '@/game/utils/cell.utils'
import { NOTE_PLACES } from './Cell.constants'
import { styles } from './Cell.styles'

type CellProps = CellView & { cell: number; label: string; onSelect(cell: number): void }

/** One cell. Only primitive props, so memo skips the cells a move does not change. */
export const Cell = memo(function Cell({ cell, digit, digitStyle, notes, fill, ring, label, onSelect }: CellProps) {
  return (
    <Pressable
      testID={`cell-${cell}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onSelect(cell)}
      style={[styles.cell, styles[fill], ring && styles.ring]}
    >
      {digit !== 0 && (
        <Text allowFontScaling={false} style={styles[digitStyle]}>
          {digit}
        </Text>
      )}
      {digit === 0 && notes !== '' && (
        <View style={styles.notes}>
          {NOTE_PLACES.map((place) => (
            <View key={place} testID={`note-slot-${place}`} style={styles.noteSlot}>
              {notes.includes(place) && (
                <Text allowFontScaling={false} style={styles.note}>
                  {place}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </Pressable>
  )
})
```

`src/game/components/Cell/index.ts`:

```ts
export { Cell } from './Cell'
```

`src/game/components/Grid/Grid.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'

// ADR-015, point 6: the lines are the gaps between boxes and cells, over the line colours.
export const styles = StyleSheet.create((theme) => ({
  frame: {
    flex: 1,
    padding: theme.shape.gridLine.outer,
    gap: theme.shape.gridLine.box,
    borderRadius: theme.shape.radius.sm,
    overflow: 'hidden',
    backgroundColor: theme.components.grid.frame,
  },
  band: { flex: 1, flexDirection: 'row', gap: theme.shape.gridLine.box },
  box: { flex: 1, gap: theme.shape.gridLine.cell, backgroundColor: theme.components.grid.cellLine },
  row: { flex: 1, flexDirection: 'row', gap: theme.shape.gridLine.cell },
}))
```

The grid frame and the box lines use the same strong line colour in both themes. If they differ in a later theme, the frame colour shows between the boxes. Use `components.grid.boxLine` for `frame` only if the developer wants the box lines there; the canvas draws both with `lineStrong`.

`src/game/components/Grid/Grid.tsx`:

```tsx
import { View } from 'react-native'
import { BOXES } from '@sudoku/core'
import { Cell } from '@/game/components/Cell'
import { useGame } from '@/game/hooks/useGame'
import { cellLabel } from '@/game/utils/cellLabel.utils'
import { styles } from './Grid.styles'

const THREE = [0, 1, 2] as const

/** 81 cells in nine boxes. BOXES lists the cells of each box row by row. */
export function Grid() {
  const { views, actions } = useGame()
  const cells = views.map((view, cell) => (
    <Cell key={cell} cell={cell} {...view} label={cellLabel(cell, view)} onSelect={actions.select} />
  ))
  return (
    <View testID="grid" style={styles.frame}>
      {THREE.map((band) => (
        <View key={band} style={styles.band}>
          {THREE.map((column) => {
            const box = band * 3 + column
            const boxCells = BOXES[box] ?? []
            return (
              <View key={box} testID={`box-${box}`} style={styles.box}>
                {THREE.map((row) => (
                  <View key={row} style={styles.row}>
                    {boxCells.slice(row * 3, row * 3 + 3).map((cell) => cells[cell])}
                  </View>
                ))}
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}
```

`src/game/components/Grid/index.ts`:

```ts
export { Grid } from './Grid'
```

`src/game/components/Board/Board.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  board: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: theme.space.sm },
}))
```

`src/game/components/Board/Board.tsx`:

```tsx
import { useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import { Grid } from '@/game/components/Grid'
import { styles } from './Board.styles'

/** The space between the header and the tools. The grid takes the largest square that fits. */
export function Board() {
  const [side, setSide] = useState(0)
  const measure = ({ nativeEvent }: LayoutChangeEvent) =>
    setSide(Math.floor(Math.min(nativeEvent.layout.width, nativeEvent.layout.height)))
  return (
    <View testID="board" style={styles.board} onLayout={measure}>
      <View testID="board-square" style={{ width: side, height: side }}>
        {side > 0 && <Grid />}
      </View>
    </View>
  )
}
```

`src/game/components/Board/index.ts`:

```ts
export { Board } from './Board'
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter mobile exec jest src/game/components/Cell src/game/components/Grid src/game/components/Board`
Expected: PASS, 3 suites.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/game/components/Cell apps/mobile/src/game/components/Grid apps/mobile/src/game/components/Board
git commit -m "feat(game): grid of nine boxes with lines as gaps, and its cells (#37)"
```

---

### Task 5: Header, Tools and Keypad

**Files:**
- Create: `src/game/components/TimerPill/TimerPill.tsx`, `TimerPill.styles.ts`, `TimerPill.test.tsx`, `index.ts`
- Create: `src/game/components/MistakeDots/MistakeDots.tsx`, `MistakeDots.styles.ts`, `MistakeDots.test.tsx`, `index.ts`
- Create: `src/game/components/Header/Header.tsx`, `Header.styles.ts`, `Header.test.tsx`, `index.ts`
- Create: `src/game/components/Tools/Tools.tsx`, `Tools.styles.ts`, `Tools.test.tsx`, `index.ts`
- Create: `src/game/components/NumberKey/NumberKey.tsx`, `NumberKey.styles.ts`, `index.ts`
- Create: `src/game/components/Keypad/Keypad.tsx`, `Keypad.styles.ts`, `Keypad.constants.ts`, `Keypad.test.tsx`, `index.ts`

**Interfaces:**
- Consumes: `useGame()`, `Icon`, `formatClock`, `canUndo`, `canErase`, `MAX_MISTAKES`.
- Produces: `TimerPill()`, `MistakeDots()`, `Header({ onBack }: { onBack(): void })`, `Tools()`, `NumberKey({ digit, notesMode, disabled, onPress })`, `Keypad()`.

- [ ] **Step 1: Write the failing tests**

All tests in this task render inside the provider. Use this helper at the top of each test file:

```tsx
import { render } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { GameProvider } from '@/game/components/GameProvider'
import { sampleStart } from '@/game/utils/sample.utils'

const renderInGame = (ui: ReactElement) => render(<GameProvider start={sampleStart()}>{ui}</GameProvider>)
```

`src/game/components/TimerPill/TimerPill.test.tsx` (with the helper):

```tsx
import { act, screen } from '@testing-library/react-native'
import { TimerPill } from './TimerPill'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('shows the time played', () => {
  renderInGame(<TimerPill />)
  expect(screen.getByText('00:00')).toBeTruthy()
  act(() => jest.advanceTimersByTime(65_000))
  expect(screen.getByText('01:05')).toBeTruthy()
})
```

`src/game/components/MistakeDots/MistakeDots.test.tsx` (with the helper):

```tsx
import { screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { daylight } from '@/theme/themes/daylight'
import { MistakeDots } from './MistakeDots'

it('draws three empty dots and reads the mistakes for VoiceOver', () => {
  renderInGame(<MistakeDots />)
  const dots = screen.getAllByTestId(/^mistake-dot-/)
  expect(dots).toHaveLength(3)
  expect(StyleSheet.flatten(dots[0]?.props.style)).toMatchObject({ borderColor: daylight.colors.textMuted })
  expect(screen.getByLabelText('0 of 3 mistakes')).toBeTruthy()
})
```

`src/game/components/Header/Header.test.tsx` (with the helper):

```tsx
import { fireEvent, screen } from '@testing-library/react-native'
import { Header } from './Header'

it('has a back button of 44 pt that calls onBack', () => {
  const onBack = jest.fn()
  renderInGame(<Header onBack={onBack} />)
  const back = screen.getByLabelText('Back to home')
  fireEvent.press(back)
  expect(onBack).toHaveBeenCalled()
  expect(back.props.style).toEqual(expect.objectContaining({ width: 44, height: 44 }))
})

it('shows the timer pill and the mistake dots', () => {
  renderInGame(<Header onBack={jest.fn()} />)
  expect(screen.getByText('00:00')).toBeTruthy()
  expect(screen.getAllByTestId(/^mistake-dot-/)).toHaveLength(3)
})
```

If `back.props.style` is an array, compare `StyleSheet.flatten(back.props.style)` instead.

`src/game/components/Tools/Tools.test.tsx` (with the helper; it also renders the `Grid` to select a cell):

```tsx
import { fireEvent, screen } from '@testing-library/react-native'
import { Grid } from '@/game/components/Grid'
import { Keypad } from '@/game/components/Keypad'
import { Tools } from './Tools'

const renderTools = () =>
  renderInGame(
    <>
      <Grid />
      <Tools />
      <Keypad />
    </>,
  )

it('has Undo, Erase, Notes and Hint, with Undo and Erase disabled at the start', () => {
  renderTools()
  expect(screen.getByLabelText('Undo')).toBeDisabled()
  expect(screen.getByLabelText('Erase')).toBeDisabled()
  expect(screen.getByLabelText('Notes')).toBeEnabled()
  expect(screen.getByLabelText('Hint')).toBeEnabled()
})

it('undoes and erases a placed number', () => {
  renderTools()
  fireEvent.press(screen.getByTestId('cell-2'))
  fireEvent.press(screen.getByLabelText('Enter 4'))
  expect(screen.getByLabelText('Row 1, column 3, 4')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Erase'))
  expect(screen.getByLabelText('Row 1, column 3, empty')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Undo'))
  expect(screen.getByLabelText('Row 1, column 3, 4')).toBeTruthy()
})

it('turns notes mode on and off', () => {
  renderTools()
  fireEvent.press(screen.getByLabelText('Notes'))
  expect(screen.getByLabelText('Notes')).toBeSelected()
  fireEvent.press(screen.getByTestId('cell-2'))
  fireEvent.press(screen.getByLabelText('Note 3'))
  expect(screen.getByLabelText('Row 1, column 3, empty, notes 3')).toBeTruthy()
})

it('reveals a cell with a hint', () => {
  jest.spyOn(Math, 'random').mockReturnValue(0)
  renderTools()
  fireEvent.press(screen.getByLabelText('Hint'))
  expect(screen.getByLabelText('Row 1, column 3, 4')).toBeTruthy()
  jest.mocked(Math.random).mockRestore()
})

it('makes every tool a touch target of 52 pt', () => {
  renderTools()
  for (const name of ['Undo', 'Erase', 'Notes', 'Hint']) {
    expect(screen.getByLabelText(name)).toHaveStyle({ width: 52, height: 52 })
  }
})
```

`src/game/components/Keypad/Keypad.test.tsx` (with the helper):

```tsx
import { screen, within } from '@testing-library/react-native'
import { Keypad } from './Keypad'

it('lays out the keys 1 to 5 and 6 to 9 in two rows', () => {
  renderInGame(<Keypad />)
  const first = within(screen.getByTestId('keypad-row-0')).getAllByRole('button')
  const second = within(screen.getByTestId('keypad-row-1')).getAllByRole('button')
  expect(first.map((key) => key.props.accessibilityLabel)).toEqual(['Enter 1', 'Enter 2', 'Enter 3', 'Enter 4', 'Enter 5'])
  expect(second).toHaveLength(4)
})

it('makes each key 64 × 60 pt', () => {
  renderInGame(<Keypad />)
  expect(screen.getByLabelText('Enter 1')).toHaveStyle({ width: 64, height: 60 })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm --filter mobile exec jest src/game/components/TimerPill src/game/components/MistakeDots src/game/components/Header src/game/components/Tools src/game/components/Keypad`
Expected: FAIL, "Cannot find module".

- [ ] **Step 3: Write the components**

`src/game/components/TimerPill/TimerPill.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  pill: {
    height: 36,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.shape.radius.pill,
  },
  time: {
    ...roleFont(theme.type.timer),
    fontSize: theme.type.timer.scale,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
}))
```

`src/game/components/TimerPill/TimerPill.tsx`:

```tsx
import { Text, View } from 'react-native'
import { Icon } from '@/game/components/Icon'
import { useGame } from '@/game/hooks/useGame'
import { formatClock } from '@/game/utils/time.utils'
import { styles } from './TimerPill.styles'

export function TimerPill() {
  const { game } = useGame()
  return (
    <View style={styles.pill} accessibilityLabel={`Time ${formatClock(game.playedMs)}`}>
      <Text style={styles.time}>{formatClock(game.playedMs)}</Text>
      <Icon name="pause" tone="text" size={16} />
    </View>
  )
}
```

`src/game/components/TimerPill/index.ts`:

```ts
export { TimerPill } from './TimerPill'
```

`src/game/components/MistakeDots/MistakeDots.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  dots: { flexDirection: 'row', gap: 6, paddingRight: theme.space.xs },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  empty: { borderColor: theme.colors.textMuted },
  filled: { borderColor: theme.colors.danger, backgroundColor: theme.colors.danger },
}))
```

`src/game/components/MistakeDots/MistakeDots.tsx`:

```tsx
import { View } from 'react-native'
import { MAX_MISTAKES } from '@sudoku/core'
import { useGame } from '@/game/hooks/useGame'
import { styles } from './MistakeDots.styles'

const DOTS = Array.from({ length: MAX_MISTAKES }, (_, dot) => dot)

/** One dot fills for each mistake. */
export function MistakeDots() {
  const { game } = useGame()
  return (
    <View style={styles.dots} accessible accessibilityLabel={`${game.mistakes} of ${MAX_MISTAKES} mistakes`}>
      {DOTS.map((dot) => (
        <View
          key={dot}
          testID={`mistake-dot-${dot}`}
          style={[styles.dot, dot < game.mistakes ? styles.filled : styles.empty]}
        />
      ))}
    </View>
  )
}
```

`src/game/components/MistakeDots/index.ts`:

```ts
export { MistakeDots } from './MistakeDots'
```

`src/game/components/Header/Header.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(() => ({
  header: { height: 48, flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, flexDirection: 'row' },
  end: { justifyContent: 'flex-end' },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
}))
```

`src/game/components/Header/Header.tsx`:

```tsx
import { Pressable, View } from 'react-native'
import { Icon } from '@/game/components/Icon'
import { MistakeDots } from '@/game/components/MistakeDots'
import { TimerPill } from '@/game/components/TimerPill'
import { styles } from './Header.styles'

type HeaderProps = { onBack(): void }

export function Header({ onBack }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to home" onPress={onBack} style={styles.back}>
          <Icon name="back" tone="text" />
        </Pressable>
      </View>
      <TimerPill />
      <View style={[styles.side, styles.end]}>
        <MistakeDots />
      </View>
    </View>
  )
}
```

`src/game/components/Header/index.ts`:

```ts
export { Header } from './Header'
```

`src/game/components/Tools/Tools.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  tools: { flexDirection: 'row', justifyContent: 'space-around' },
  // The same opacity as the locked keypad, as on the design canvas.
  locked: { opacity: 0.35 },
  tool: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  notesOn: { backgroundColor: theme.colors.accentSoft },
}))
```

`src/game/components/Tools/Tools.tsx`:

```tsx
import { Pressable, View } from 'react-native'
import { Icon, type IconName } from '@/game/components/Icon'
import { useGame } from '@/game/hooks/useGame'
import { canErase, canUndo } from '@/game/utils/session.utils'
import { styles } from './Tools.styles'

type ToolProps = { icon: IconName; label: string; enabled: boolean; selected?: boolean; onPress(): void }

function Tool({ icon, label, enabled, selected = false, onPress }: ToolProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled, selected }}
      disabled={!enabled}
      onPress={onPress}
      style={[styles.tool, !enabled && styles.disabled, selected && styles.notesOn]}
    >
      <Icon name={icon} tone={selected ? 'accent' : 'text'} />
    </Pressable>
  )
}

export function Tools() {
  const { game, notesMode, actions } = useGame()
  const playing = game.status === 'playing'
  return (
    <View style={[styles.tools, !playing && styles.locked]}>
      <Tool icon="undo" label="Undo" enabled={canUndo(game)} onPress={actions.undo} />
      <Tool icon="erase" label="Erase" enabled={canErase(game)} onPress={actions.erase} />
      <Tool icon="notes" label="Notes" enabled={playing} selected={notesMode} onPress={actions.toggleNotesMode} />
      <Tool icon="hint" label="Hint" enabled={playing} onPress={actions.hint} />
    </View>
  )
}
```

`src/game/components/Tools/index.ts`:

```ts
export { Tools } from './Tools'
```

`src/game/components/NumberKey/NumberKey.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  key: {
    width: 64,
    height: 60,
    borderRadius: theme.shape.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.components.key.fill,
    boxShadow: theme.elevation.key,
  },
  digit: { ...roleFont(theme.type.key), fontSize: theme.type.key.scale, color: theme.components.key.digit },
  noteDigit: {
    ...roleFont(theme.type.keyNote),
    fontSize: theme.type.keyNote.scale,
    color: theme.components.key.noteDigit,
  },
}))
```

`src/game/components/NumberKey/NumberKey.tsx`:

```tsx
import { Pressable, Text } from 'react-native'
import type { Digit } from '@sudoku/core'
import { styles } from './NumberKey.styles'

type NumberKeyProps = { digit: Digit; notesMode: boolean; disabled: boolean; onPress(digit: Digit): void }

export function NumberKey({ digit, notesMode, disabled, onPress }: NumberKeyProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={notesMode ? `Note ${digit}` : `Enter ${digit}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onPress(digit)}
      style={styles.key}
    >
      <Text allowFontScaling={false} style={notesMode ? styles.noteDigit : styles.digit}>
        {digit}
      </Text>
    </Pressable>
  )
}
```

`src/game/components/NumberKey/index.ts`:

```ts
export { NumberKey } from './NumberKey'
```

`src/game/components/Keypad/Keypad.constants.ts`:

```ts
import type { Digit } from '@sudoku/core'

/** Two centred rows, as on the design canvas. */
export const KEY_ROWS: readonly (readonly Digit[])[] = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9],
]
```

`src/game/components/Keypad/Keypad.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  keypad: { gap: theme.space.sm, marginTop: theme.space.md },
  locked: { opacity: 0.35 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: theme.space.sm },
}))
```

`src/game/components/Keypad/Keypad.tsx`:

```tsx
import { View } from 'react-native'
import { NumberKey } from '@/game/components/NumberKey'
import { useGame } from '@/game/hooks/useGame'
import { KEY_ROWS } from './Keypad.constants'
import { styles } from './Keypad.styles'

export function Keypad() {
  const { game, notesMode, actions } = useGame()
  const locked = game.status !== 'playing'
  return (
    <View style={[styles.keypad, locked && styles.locked]}>
      {KEY_ROWS.map((digits, row) => (
        <View key={row} testID={`keypad-row-${row}`} style={styles.row}>
          {digits.map((digit) => (
            <NumberKey key={digit} digit={digit} notesMode={notesMode} disabled={locked} onPress={actions.digit} />
          ))}
        </View>
      ))}
    </View>
  )
}
```

`src/game/components/Keypad/index.ts`:

```ts
export { Keypad } from './Keypad'
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter mobile exec jest src/game/components`
Expected: PASS, every suite in `src/game/components`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/game/components
git commit -m "feat(game): header, tools and keypad of the game screen (#37)"
```

---

### Task 6: The game screen and the development entry

**Files:**
- Create: `src/game/screens/GameScreen/GameScreen.tsx`, `GameScreen.styles.ts`, `GameScreen.test.tsx`, `index.ts`
- Modify: `App.tsx`, `App.test.tsx`, `App.probeFailure.test.tsx`

**Interfaces:**
- Consumes: `GameProvider`, `Header`, `Board`, `Tools`, `Keypad`, `sampleStart`, `ScanFlow`.
- Produces: `GameScreen({ start, onBack }: { start: NewGame; onBack(): void })`.

- [ ] **Step 1: Write the failing tests**

`src/game/screens/GameScreen/GameScreen.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { sampleStart } from '@/game/utils/sample.utils'
import { GameScreen } from './GameScreen'

const renderScreen = (onBack = jest.fn()) => {
  render(<GameScreen start={sampleStart()} onBack={onBack} />)
  // The board draws the grid after it knows its size.
  fireEvent(screen.getByTestId('board'), 'layout', { nativeEvent: { layout: { width: 358, height: 358 } } })
}

it('shows the header, the grid, the tools and the keypad', () => {
  renderScreen()
  expect(screen.getByLabelText('Back to home')).toBeTruthy()
  expect(screen.getAllByTestId(/^cell-\d+$/)).toHaveLength(81)
  expect(screen.getByLabelText('Hint')).toBeTruthy()
  expect(screen.getByLabelText('Enter 9')).toBeTruthy()
})

it('gives a light haptic tap for a placed number', () => {
  jest.mocked(Haptics.impactAsync).mockClear()
  renderScreen()
  fireEvent.press(screen.getByTestId('cell-2'))
  fireEvent.press(screen.getByLabelText('Enter 4'))
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
})

it('fills a mistake dot for a wrong number', () => {
  renderScreen()
  fireEvent.press(screen.getByTestId('cell-2'))
  fireEvent.press(screen.getByLabelText('Enter 5'))
  expect(screen.getByLabelText('1 of 3 mistakes')).toBeTruthy()
  expect(screen.getByLabelText('Row 1, column 3, wrong 5')).toBeTruthy()
})

it('locks the tools and the keypad when the game is lost', () => {
  renderScreen()
  fireEvent.press(screen.getByTestId('cell-2'))
  for (const digit of [5, 6, 7]) fireEvent.press(screen.getByLabelText(`Enter ${digit}`))
  expect(screen.getByLabelText('Enter 4')).toBeDisabled()
  expect(screen.getByLabelText('Hint')).toBeDisabled()
  fireEvent.press(screen.getByLabelText('Enter 4'))
  expect(screen.getByLabelText('Row 1, column 3, wrong 7')).toBeTruthy()
})

it('stops the timer when the game is lost', () => {
  jest.useFakeTimers()
  renderScreen()
  act(() => jest.advanceTimersByTime(2000))
  fireEvent.press(screen.getByTestId('cell-2'))
  for (const digit of [5, 6, 7]) fireEvent.press(screen.getByLabelText(`Enter ${digit}`))
  act(() => jest.advanceTimersByTime(5000))
  expect(screen.getByText('00:02')).toBeTruthy()
  jest.useRealTimers()
})

it('calls onBack from the back button', () => {
  const onBack = jest.fn()
  renderScreen(onBack)
  fireEvent.press(screen.getByLabelText('Back to home'))
  expect(onBack).toHaveBeenCalled()
})
```

Change `App.test.tsx` to:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

describe('App', () => {
  it('opens on the game screen in a development build, and goes back to the camera', async () => {
    // App logs the fast-opencv probe when it loads. Keep the test output clean.
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const App = (jest.requireActual('./App') as typeof import('./App')).default
    // The parity check logs after the model loads. Wait for it before the spy goes away.
    await waitFor(() => expect(log).toHaveBeenCalledWith(expect.stringContaining('[scanner] model parity')))
    log.mockRestore()
    render(<App />)
    expect(screen.getByLabelText('Back to home')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Back to home'))
    expect(screen.getByTestId('camera')).toBeTruthy()
  })
})
```

In `App.probeFailure.test.tsx`, rename the test to `'still opens and logs the failure'` and replace the last assertion with:

```tsx
    expect(screen.getByLabelText('Back to home')).toBeTruthy()
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm --filter mobile exec jest src/game/screens App`
Expected: FAIL. `GameScreen` does not exist, and App still opens on the camera.

- [ ] **Step 3: Write the screen and the entry**

`src/game/screens/GameScreen/GameScreen.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, paddingHorizontal: theme.space.lg, backgroundColor: theme.colors.background },
}))
```

`src/game/screens/GameScreen/GameScreen.tsx`:

```tsx
import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import type { NewGame } from '@sudoku/core'
import { Board } from '@/game/components/Board'
import { GameProvider } from '@/game/components/GameProvider'
import { Header } from '@/game/components/Header'
import { Keypad } from '@/game/components/Keypad'
import { Tools } from '@/game/components/Tools'
import { styles } from './GameScreen.styles'

type GameScreenProps = { start: NewGame; onBack(): void }

/** The game screen of the design canvas. start is read once: a new puzzle needs a new key. */
export function GameScreen({ start, onBack }: GameScreenProps) {
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()
  return (
    <GameProvider start={start}>
      <StatusBar style={theme.statusBar} />
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + theme.space.lg }]}>
        <Header onBack={onBack} />
        <Board />
        <Tools />
        <Keypad />
      </View>
    </GameProvider>
  )
}
```

`src/game/screens/GameScreen/index.ts`:

```ts
export { GameScreen } from './GameScreen'
```

In `App.tsx`, replace the `App` component and add the imports:

```tsx
import { useState } from 'react'
import { GameScreen } from '@/game/screens/GameScreen'
import { sampleStart } from '@/game/utils/sample.utils'
```

```tsx
// Navigation waits for its ADR. A development build opens on the game with the canvas puzzle.
const DEV_START = __DEV__ ? sampleStart() : null

export default function App() {
  const [playing, setPlaying] = useState(DEV_START !== null)
  return (
    <SafeAreaProvider>
      {playing && DEV_START !== null ? <GameScreen start={DEV_START} onBack={() => setPlaying(false)} /> : <ScanFlow />}
    </SafeAreaProvider>
  )
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter mobile exec jest src/game App`
Expected: PASS.

- [ ] **Step 5: Run every check**

Run: `just lint`, then `just typecheck`, then `just test-ts`.
Expected: each exits 0. If the App tests time out on a cold Jest cache, run `just test-ts` again before you debug: `develop` shows the same timeout.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/game/screens apps/mobile/App.tsx apps/mobile/App.test.tsx apps/mobile/App.probeFailure.test.tsx
git commit -m "feat(game): game screen, opened first in a development build (#37)"
```

---

### Task 7: Pull request

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin feature/37-game-screen
gh pr create --base develop --title "feat(game): game screen: grid, header, tools and keypad (#37)" --body-file <file>
```

The body holds: a summary, the wave 4 ownership table of this plan, how the screen is reached, the test evidence (the result lines of `just lint`, `just typecheck`, `just test-ts`), the iPhone steps below, and `Closes #37`.

- [ ] **Step 2: Tick the met criteria in #37**

Tick every criterion that the tests prove. Leave "Every control has a touch target of 44 pt or more" for the developer if the grid cells are under 44 pt (see the open question), and say so in the PR.

**iPhone steps (for the developer):**
1. Build the development build from the worktree (`expo run:ios --device`). Metro uses port 8081.
2. The app opens on the game screen. Place a number, a wrong number, a note, an erase, an undo and a hint.
3. Feel the light tap on each placed number.
4. Switch iOS between Light and Dark while the screen is open. The grid, the keys and the status bar change without a restart.
5. Tap Back. The camera opens.

---

## Self-Review

- Spec coverage: components split (Tasks 4–6), header with back, timer and dots (Task 5), tools (Task 5), two key rows (Task 5), styles of givens, entries, notes and wrong entries (Task 4), random hint through the core (Tasks 1, 5), disabled Undo and Erase (Task 5), touch targets of controls (Tasks 5, 6), notes at 11 pt (Task 4), light haptic (Tasks 3, 6), Daylight and Midnight through Unistyles (all styles files, Task 4 theme test).
- Placeholder scan: no TBD, no fallback left open.
- Type consistency: `CellView` fields match `Cell` props; `GameSession` = `Session & { views; actions }` in every task; `MoveKind` includes `clear`, used by `useMoveHaptics`.
- Open questions for the developer:
  1. Grid cells are about 38 pt wide on a 390 pt screen (nine cells in 358 pt). The issue asks 44 pt for every control. Nine 44 pt cells need 396 pt plus lines, wider than the screen. The plan treats the cells as an exception and meets 44 pt for every button and key.
  2. The timer pill shows the pause icon of the canvas, but tapping it does nothing until #39.
