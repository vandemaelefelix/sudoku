# Pulses and Haptics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A correct number that completes a row, column, box or number sends a **pulse** out from its cell: a wave of the accent colour with a delay of 45 ms per step of Manhattan distance, 700 ms per cell, and a digit pop to scale 1.3. The last correct number pulses the whole grid. Each move gives one haptic that fits its **completion**. With Reduce Motion on, no pulse runs. The haptics stay.

**Architecture:** The core already reports what each move completed (`Move.completed`, a `Completion`). A pure function `pulseDelays(board, move)` in `src/game/utils/pulse.utils.ts` turns a completion into one delay per cell (or `NO_PULSE`). A new hook `usePulse(board, move)` holds two shared values: `delays` (81 numbers) and `elapsed` (milliseconds since the move). On a new completing move it sets `delays` and runs `elapsed` from 0 to the end with a linear `withTiming`, on the UI thread. `Grid` gives the same stable `pulse` object to every `Cell`. Each `Cell` maps `elapsed` and its own delay to a wave opacity and a digit scale with two pure worklets (`waveOpacity`, `popScale`). No React state changes during the pulse, so neither the grid nor a cell renders again. `useMoveHaptics` picks one haptic per move: Success for the solved grid, Medium for a completed row, column, box or number, Light for a plain placed number.

**Tech Stack:** Expo 57, React Native 0.86, React 19, react-native-reanimated 4.5.1 (`useSharedValue`, `useAnimatedStyle`, `withTiming`, `cancelAnimation`, `Easing`, `useReducedMotion`, `Animated.View`, `Animated.Text`), react-native-unistyles 3.5.2, expo-haptics 57 (`impactAsync`, `notificationAsync`, `ImpactFeedbackStyle`, `NotificationFeedbackType`), Jest 29 + @testing-library/react-native 13, `@sudoku/core`.

**Spec:** issue #42 (`gh issue view 42`). Its acceptance criteria are the spec. The design canvas `Main.dc.html` (https://claude.ai/artifact/U23JHiGA1Pq3HJX6oMiBF4), scenario "lastMove", function `celebrate`:

- `delay = (|row − row0| + |column − column0|) * 45` ms, the smallest delay when a cell is in two completed units.
- Solved: all 81 cells. Else: each completed unit of the cell, plus every cell of a number with nine correct copies.
- `@keyframes wave{0%{inset accent 0}35%{inset accent .3 (Daylight) / .32 (Midnight)}100%{0}}`, `700ms ease-out <delay>ms`.
- `@keyframes pop{0%{scale(1)}40%{scale(1.3)}100%{scale(1)}}`, `450ms ease-out <delay>ms`, on the digit.
- `@media (prefers-reduced-motion: reduce){.anim{animation:none!important}}`.
- A hint also runs `celebrate`.
- The finish card waits 1400 ms after the last correct number.

Also: `docs/architecture/00-concepts/game-screen.md` (Pulses section, state Solving), glossary rows "Pulse" and "Completion" (already present), ADR-015 (a theme switch does not re-render the grid), the Expo 57 haptics docs (https://docs.expo.dev/versions/v57.0.0/sdk/haptics/).


## Coordinator rulings (2026-10-12, binding; they override the tasks below where they differ)

- Developer decision: haptics are Light for a placed number, Medium for a completion (row, column, box, number), Success when the grid is solved.
- Developer direction: Grid and Cell are the one grid component of the app. #38 (assists preview) and later #43 (finish card) reuse them. Keep Grid and Cell free of game-screen-only assumptions where that costs nothing, and do not add a second grid.

- #42 owns `Cell/*` this wave.
- Do not edit jest.setup.ts (#40 adds the shared haptics mock). Mock expo-haptics locally in your tests until #40 merges, then remove the local mocks in your rebase task if they duplicate it.
- Merge order: #51 merges first. Your last task rebases on origin/develop after #51 merges and adapts to #51's `GameStart` type and routes. Until then, work on origin/develop as it is.
## Global Constraints

- Branch `feature/42-pulses-haptics` from `origin/develop`. Use `/usr/bin/git`. PR against `develop` with `Closes #42`.
- First commit: copy this plan to `docs/superpowers/plans/2026-10-12-pulses-haptics.md` with `docs(plan): pulses and haptics (#42)`. Run `just docs-check`.
- The app holds no game rule (SUD-04). What a move completed comes only from `Move.completed` (the core's `completedBetween`). Do not count units or digits in the app.
- Edit only the files in "Files owned". No theme file, no `jest.setup.ts`, no `package.json`, no glossary, no `GameScreen`, no `useGameSession`.
- The render rule (game screen plan): a pulse, a clock tick and a theme switch MUST NOT render the grid or a cell again. The `pulse` prop of `Cell` keeps one identity for the whole game. `Cell` reads no theme hook.
- The pulse runs on the UI thread: shared values and `useAnimatedStyle` only. No `setState`, no `setTimeout`, no `Animated` of React Native core.
- Reduce Motion: `useReducedMotion()` reads the setting at app start. Then `usePulse` starts no pulse. `withTiming` keeps its default `ReduceMotion.System`, so a setting changed while the app runs makes the animation jump to its end (opacity 0, scale 1). The haptics do not read Reduce Motion.
- No colour value outside `src/theme/`. The wave uses the semantic token `theme.colors.accent` in `Cell.styles.ts` and an animated opacity with a peak of 0.3 in both themes. No new theme token.
- The motion values are the same in every theme. `pulse.constants.ts` holds them as numbers, and a test checks them against `SHARED_MOTION.pulseStep` and `SHARED_MOTION.long`. A theme hook in `Grid` would render the grid on a theme switch (ADR-015).
- Worklets (apps/mobile/AGENTS.md): every helper of a worklet is above it and has the `'worklet'` directive, as in `src/scan/utils/transition.utils.ts`.
- `pulse.utils.ts` and `pulse.constants.ts` import no React, React Native or Reanimated (dependency-cruiser `utils-and-constants-have-no-ui`). Only `usePulse` and `Cell` import Reanimated.
- Comments and prose: STE light and the comment rules of `AGENTS.md`. No issue numbers in code comments.
- Commits: Conventional Commits, each with `(#42)`.
- Checks before the PR: `just lint`, `just typecheck`, `just test-ts`, `just docs-check`.

## Review Focus

1. **No render for the animation.** A completing move renders `Grid` once and only the changed cells. The pulse renders nothing. Every cell gets the same `pulse` object. Test: Task 4, `Grid.renders.test.tsx`. The existing `GameScreen.renders.test.tsx` must stay green.
2. **No replay.** A tap on a cell after a completing move changes `board` but not `move`. The pulse must not run again. A grid that mounts after a move (for example after a pause layer) must not replay that move. Test: Task 2, "does not run the pulse again on a select" and "does not replay the last move on mount".
3. **A complete number counts only correct copies.** The digit pulse uses `board.solution`, not the shown values, so a wrong copy of the number does not pulse. Test: Task 1, "pulses the nine copies of a complete number and not a wrong copy".
4. **Reduce Motion.** No pulse starts. The haptics stay. Tests: Task 2, "starts no pulse with Reduce Motion", Task 5, "keeps the haptics with Reduce Motion".
5. **Unistyles and Animated.** `Cell` passes `[styles.wave, waveStyle]` to `Animated.View` and `[styles[digitStyle], popStyle]` to `Animated.Text`. `CorrectionCell` already mixes Unistyles and animated styles this way. On the iPhone, check that the wave colour follows a theme switch.
6. **One haptic per move.** A move that completes a row never also gives the Light placement tap. Test: Task 5.

## Files owned

All paths are under `apps/mobile/src/game/` unless they start with `docs/`.

| File | Change |
| --- | --- |
| `docs/superpowers/plans/2026-10-12-pulses-haptics.md` | New. This plan |
| `constants/pulse.constants.ts` | New. `NO_PULSE`, `PULSE_STEP_MS`, `WAVE_MS`, `WAVE_PEAK_AT`, `WAVE_PEAK_OPACITY`, `POP_MS`, `POP_PEAK_AT`, `POP_SCALE`, `SOLVE_PULSE_MS` |
| `utils/pulse.utils.ts`, `utils/pulse.utils.test.ts` | New. `pulseDelays`, `pulseDuration`, worklets `waveOpacity`, `popScale` |
| `hooks/usePulse/usePulse.ts`, `usePulse.test.tsx`, `index.ts` | New. `usePulse(board, move): Pulse`, type `Pulse` |
| `components/Grid/Grid.tsx` | Calls `usePulse` and gives `pulse` to each `Cell` |
| `components/Grid/Grid.renders.test.tsx` | New. Render counts of a completing move |
| `components/Cell/Cell.tsx`, `Cell.styles.ts`, `Cell.test.tsx` | **Requested, see Open question 1.** The wave layer and the digit pop |
| `hooks/useMoveHaptics/useMoveHaptics.ts`, `useMoveHaptics.test.tsx` | One haptic per move, by completion |

Theme files touched: none. Routes: none. Dependencies: none.

---

## Task 0: Branch and plan

- [ ] **Step 1: Create the branch**

```bash
cd /Users/felix/projects/sudoku-18-dot-field
/usr/bin/git fetch origin
/usr/bin/git switch -c feature/42-pulses-haptics origin/develop
```

- [ ] **Step 2: Copy the plan and commit**

Copy this file to `docs/superpowers/plans/2026-10-12-pulses-haptics.md`.

```bash
just docs-check
/usr/bin/git add docs/superpowers/plans/2026-10-12-pulses-haptics.md
/usr/bin/git commit -m "docs(plan): pulses and haptics (#42)"
```

---

## Task 1: Pulse constants, delays and curves

**Files:**
- Create: `src/game/constants/pulse.constants.ts`
- Create: `src/game/utils/pulse.utils.ts`, `src/game/utils/pulse.utils.test.ts`

**Interfaces:**
- Consumes: `BOXES`, `COLUMNS`, `ROWS`, `Completion`, `Game` (`@sudoku/core`), `rowOf`, `columnOf` (`grid.utils`), `Move` (`session.utils`, type only).
- Produces:
  - `pulseDelays(board: Game, move: Move | null): number[] | null`: 81 delays in ms, row by row, `NO_PULSE` for a cell outside the pulse. `null` when the move completed nothing.
  - `pulseDuration(delays: readonly number[]): number`: ms from the move to the end of the last wave.
  - worklet `waveOpacity(elapsed: number, delay: number): number`, 0 to `WAVE_PEAK_OPACITY`.
  - worklet `popScale(elapsed: number, delay: number): number`, 1 to `POP_SCALE`.

- [ ] **Step 1: Write the failing tests**

`src/game/utils/pulse.utils.test.ts`:

```ts
import type { Digit } from '@sudoku/core'
import {
  NO_PULSE,
  POP_MS,
  POP_PEAK_AT,
  POP_SCALE,
  PULSE_STEP_MS,
  SOLVE_PULSE_MS,
  WAVE_MS,
  WAVE_PEAK_AT,
  WAVE_PEAK_OPACITY,
} from '@/game/constants/pulse.constants'
import { SHARED_MOTION } from '@/theme/shared.tokens'
import { popScale, pulseDelays, pulseDuration, waveOpacity } from './pulse.utils'
import { sampleStart } from './sample.utils'
import { reduceSession, startSession, type Session } from './session.utils'

// Cell 2 (row 0, column 2) is empty in the canvas puzzle. Its solution is 4.
const LAST = 2
const sample = sampleStart()

/** A session whose entries are the solution on the cells that keep(cell) accepts. */
function startWith(keep: (cell: number) => boolean): Session {
  const entries = sample.solution.map((value, cell) => (sample.givens[cell] === 0 && keep(cell) ? value : 0))
  return startSession({ ...sample, entries })
}

function play(session: Session, cell: number, digit: Digit): Session {
  return [
    { type: 'select', cell } as const,
    { type: 'digit', digit } as const,
  ].reduce(reduceSession, session)
}

const pulsed = (delays: readonly number[] | null) =>
  (delays ?? []).flatMap((delay, cell) => (delay === NO_PULSE ? [] : [cell]))

it('keeps the motion values of the theme', () => {
  expect(PULSE_STEP_MS).toBe(SHARED_MOTION.pulseStep)
  expect(WAVE_MS).toBe(SHARED_MOTION.long)
})

it('pulses the completed row out from the cell, one step per cell', () => {
  const after = play(startWith((cell) => cell < 9 && cell !== LAST), LAST, 4)
  const delays = pulseDelays(after.board, after.move)
  expect(pulsed(delays)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  expect(delays?.slice(0, 9)).toEqual([2, 1, 0, 1, 2, 3, 4, 5, 6].map((steps) => steps * PULSE_STEP_MS))
})

it('pulses the nine copies of a complete number and not a wrong copy', () => {
  const fours = (cell: number) => sample.solution[cell] === 4 && cell !== LAST
  const wrongCell = sample.givens.findIndex((given, cell) => given === 0 && sample.solution[cell] !== 4)
  const entries = sample.solution.map((value, cell) => {
    if (cell === wrongCell) return 4
    return sample.givens[cell] === 0 && fours(cell) ? value : 0
  })
  const after = play(startSession({ ...sample, entries }), LAST, 4)
  const delays = pulseDelays(after.board, after.move)
  const fourCells = sample.solution.flatMap((value, cell) => (value === 4 ? [cell] : []))
  expect(pulsed(delays)).toEqual(fourCells)
  expect(delays?.[wrongCell]).toBe(NO_PULSE)
})

it('pulses every cell when the last correct number solves the grid', () => {
  const after = play(startWith((cell) => cell !== LAST), LAST, 4)
  const delays = pulseDelays(after.board, after.move)
  expect(pulsed(delays)).toHaveLength(81)
  // Row 8, column 8 is the farthest cell from row 0, column 2: 8 + 6 steps.
  expect(Math.max(...(delays ?? []))).toBe(14 * PULSE_STEP_MS)
})

it('gives no pulse to a move that completes nothing, and to no move', () => {
  const after = play(startWith(() => false), LAST, 4)
  expect(pulseDelays(after.board, after.move)).toBeNull()
  expect(pulseDelays(after.board, null)).toBeNull()
})

it('ends the pulse when the last wave ends', () => {
  expect(pulseDuration([NO_PULSE, 0, 3 * PULSE_STEP_MS])).toBe(3 * PULSE_STEP_MS + WAVE_MS)
})

it('waits long enough for a solve pulse from any cell', () => {
  // A corner is 16 steps from the opposite corner.
  expect(SOLVE_PULSE_MS).toBe(16 * PULSE_STEP_MS + WAVE_MS)
})

it('raises the wave to its peak, then lets it fade, after the delay of the cell', () => {
  const delay = 90
  expect(waveOpacity(delay, delay)).toBe(0)
  expect(waveOpacity(delay + WAVE_MS * WAVE_PEAK_AT, delay)).toBeCloseTo(WAVE_PEAK_OPACITY)
  expect(waveOpacity(delay + WAVE_MS * 0.7, delay)).toBeGreaterThan(0)
  expect(waveOpacity(delay + WAVE_MS * 0.7, delay)).toBeLessThan(WAVE_PEAK_OPACITY)
  expect(waveOpacity(delay + WAVE_MS, delay)).toBe(0)
  expect(waveOpacity(0, delay)).toBe(0)
})

it('pops the digit to its peak scale and back', () => {
  expect(popScale(0, 0)).toBe(1)
  expect(popScale(POP_MS * POP_PEAK_AT, 0)).toBeCloseTo(POP_SCALE)
  expect(popScale(POP_MS, 0)).toBe(1)
})

it('leaves a cell outside the pulse still', () => {
  expect(waveOpacity(WAVE_MS * WAVE_PEAK_AT, NO_PULSE)).toBe(0)
  expect(popScale(POP_MS * POP_PEAK_AT, NO_PULSE)).toBe(1)
})
```

- [ ] **Step 2: Run the tests. They fail**

```bash
just test-ts -- pulse.utils
```

Expected: FAIL, `Cannot find module '@/game/constants/pulse.constants'`. If `just test-ts` takes no filter, run `pnpm --filter mobile exec jest pulse.utils`.

- [ ] **Step 3: Write the constants**

`src/game/constants/pulse.constants.ts`:

```ts
// The pulse of the design canvas (Main.dc.html, celebrate). Times in milliseconds.

/** The delay of a cell outside the pulse. */
export const NO_PULSE = -1

/** The delay per step of Manhattan distance from the cell of the move. Equals SHARED_MOTION.pulseStep. */
export const PULSE_STEP_MS = 45

/** The wave of one cell. Equals SHARED_MOTION.long. */
export const WAVE_MS = 700

/** The part of WAVE_MS at which the wave is strongest. */
export const WAVE_PEAK_AT = 0.35

/** The opacity of the accent colour at the peak of the wave. */
export const WAVE_PEAK_OPACITY = 0.3

/** The pop of one digit. */
export const POP_MS = 450

/** The part of POP_MS at which the digit is largest. */
export const POP_PEAK_AT = 0.4

export const POP_SCALE = 1.3

/** The longest solve pulse: from a corner to the opposite corner is 16 steps. The finish card waits this long. */
export const SOLVE_PULSE_MS = 16 * PULSE_STEP_MS + WAVE_MS
```

- [ ] **Step 4: Write the utils**

`src/game/utils/pulse.utils.ts`:

```ts
import { BOXES, COLUMNS, ROWS, type Completion, type Game } from '@sudoku/core'
import {
  NO_PULSE,
  POP_MS,
  POP_PEAK_AT,
  POP_SCALE,
  PULSE_STEP_MS,
  WAVE_MS,
  WAVE_PEAK_AT,
  WAVE_PEAK_OPACITY,
} from '@/game/constants/pulse.constants'
import { columnOf, rowOf } from './grid.utils'
import type { Move } from './session.utils'

/** The cells that a completion pulses, in any order. */
function pulsedCells(board: Game, completed: Completion): number[] {
  if (completed.grid) return board.solution.map((_, cell) => cell)
  const cells = new Set<number>()
  const units = [
    ...completed.rows.map((row) => ROWS[row] ?? []),
    ...completed.columns.map((column) => COLUMNS[column] ?? []),
    ...completed.boxes.map((box) => BOXES[box] ?? []),
  ]
  for (const unit of units) for (const cell of unit) cells.add(cell)
  // The solution, not the shown value: a wrong copy of a complete number must not pulse.
  board.solution.forEach((value, cell) => {
    if (completed.digits.some((digit) => digit === value)) cells.add(cell)
  })
  return [...cells]
}

/** One delay per cell, row by row, in ms after the move. null when the move completed nothing. */
export function pulseDelays(board: Game, move: Move | null): number[] | null {
  if (move === null || move.cell === null) return null
  const cells = pulsedCells(board, move.completed)
  if (cells.length === 0) return null
  const origin = move.cell
  const delays = board.solution.map(() => NO_PULSE)
  for (const cell of cells) {
    const steps = Math.abs(rowOf(cell) - rowOf(origin)) + Math.abs(columnOf(cell) - columnOf(origin))
    delays[cell] = steps * PULSE_STEP_MS
  }
  return delays
}

/** The wave lasts longer than the pop, so the last wave ends the pulse. */
export function pulseDuration(delays: readonly number[]): number {
  return Math.max(...delays) + WAVE_MS
}

function easeOut(x: number): number {
  'worklet'
  return 1 - (1 - x) * (1 - x)
}

/** 0, up to 1 at peakAt, down to 0 at the end. t is the part of the animation, 0 to 1. Each half eases out, as a CSS keyframe does. */
function keyframe(t: number, peakAt: number): number {
  'worklet'
  if (t <= 0 || t >= 1) return 0
  return t < peakAt ? easeOut(t / peakAt) : 1 - easeOut((t - peakAt) / (1 - peakAt))
}

export function waveOpacity(elapsed: number, delay: number): number {
  'worklet'
  if (delay === NO_PULSE) return 0
  return WAVE_PEAK_OPACITY * keyframe((elapsed - delay) / WAVE_MS, WAVE_PEAK_AT)
}

export function popScale(elapsed: number, delay: number): number {
  'worklet'
  if (delay === NO_PULSE) return 1
  return 1 + (POP_SCALE - 1) * keyframe((elapsed - delay) / POP_MS, POP_PEAK_AT)
}
```

- [ ] **Step 5: Run the tests. They pass**

```bash
just test-ts -- pulse.utils
```

Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add apps/mobile/src/game/constants/pulse.constants.ts apps/mobile/src/game/utils/pulse.utils.ts apps/mobile/src/game/utils/pulse.utils.test.ts
/usr/bin/git commit -m "feat(game): pulse delays and pulse curves from the move completion (#42)"
```

---

## Task 2: The pulse hook

**Files:**
- Create: `src/game/hooks/usePulse/usePulse.ts`, `usePulse.test.tsx`, `index.ts`

**Interfaces:**
- Consumes: Task 1 (`pulseDelays`, `pulseDuration`, `NO_PULSE`), `Game`, `GRID_CELLS` (`@sudoku/core`), `Move`.
- Produces: `type Pulse = { delays: SharedValue<readonly number[]>; elapsed: SharedValue<number> }`, `usePulse(board: Game, move: Move | null): Pulse`. The returned object keeps its identity for the life of the component.

- [ ] **Step 1: Write the failing tests**

`src/game/hooks/usePulse/usePulse.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react-native'
import { useReducedMotion } from 'react-native-reanimated'
import type { Digit } from '@sudoku/core'
import { NO_PULSE, PULSE_STEP_MS, WAVE_MS } from '@/game/constants/pulse.constants'
import { sampleStart } from '@/game/utils/sample.utils'
import { reduceSession, startSession, type Session } from '@/game/utils/session.utils'
import { usePulse } from './usePulse'

// Row 0 of the canvas puzzle lacks only cell 2. Its solution is 4.
function rowAlmostDone(): Session {
  const sample = sampleStart()
  const entries = sample.solution.map((value, cell) =>
    cell < 9 && cell !== 2 && sample.givens[cell] === 0 ? value : 0,
  )
  return startSession({ ...sample, entries })
}

function play(session: Session, cell: number, digit: Digit): Session {
  return [
    { type: 'select', cell } as const,
    { type: 'digit', digit } as const,
  ].reduce(reduceSession, session)
}

const renderPulse = (session: Session) =>
  renderHook(({ s }: { s: Session }) => usePulse(s.board, s.move), { initialProps: { s: session } })

afterEach(() => jest.mocked(useReducedMotion).mockReturnValue(false))

it('pulses the completed row out from the cell, and runs the time to the end', () => {
  const before = rowAlmostDone()
  const { result, rerender } = renderPulse(before)
  rerender({ s: play(before, 2, 4) })
  const delays = result.current.delays.get()
  expect(delays.slice(0, 9)).toEqual([2, 1, 0, 1, 2, 3, 4, 5, 6].map((steps) => steps * PULSE_STEP_MS))
  expect(delays.slice(9).every((delay) => delay === NO_PULSE)).toBe(true)
  // The Reanimated mock of withTiming returns the end value at once.
  expect(result.current.elapsed.get()).toBe(6 * PULSE_STEP_MS + WAVE_MS)
})

it('does not run the pulse again on a select', () => {
  const before = rowAlmostDone()
  const after = play(before, 2, 4)
  const { result, rerender } = renderPulse(before)
  rerender({ s: after })
  result.current.elapsed.set(0)
  rerender({ s: reduceSession(after, { type: 'select', cell: 40 }) })
  expect(result.current.elapsed.get()).toBe(0)
})

it('does not replay the last move on mount', () => {
  const { result } = renderPulse(play(rowAlmostDone(), 2, 4))
  expect(result.current.delays.get().every((delay) => delay === NO_PULSE)).toBe(true)
  expect(result.current.elapsed.get()).toBe(0)
})

it('starts no pulse for a move that completes nothing', () => {
  const before = startSession(sampleStart())
  const { result, rerender } = renderPulse(before)
  rerender({ s: play(before, 2, 4) })
  expect(result.current.elapsed.get()).toBe(0)
})

it('starts no pulse with Reduce Motion', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const before = rowAlmostDone()
  const { result, rerender } = renderPulse(before)
  rerender({ s: play(before, 2, 4) })
  expect(result.current.delays.get().every((delay) => delay === NO_PULSE)).toBe(true)
  expect(result.current.elapsed.get()).toBe(0)
})

it('keeps the same pulse object between renders', () => {
  const before = rowAlmostDone()
  const { result, rerender } = renderPulse(before)
  const first = result.current
  rerender({ s: play(before, 2, 4) })
  expect(result.current).toBe(first)
})
```

- [ ] **Step 2: Run the tests. They fail**

```bash
just test-ts -- usePulse
```

Expected: FAIL, `Cannot find module './usePulse'`.

- [ ] **Step 3: Write the hook**

`src/game/hooks/usePulse/usePulse.ts`:

```ts
import { useEffect, useMemo, useRef } from 'react'
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { GRID_CELLS, type Game } from '@sudoku/core'
import { NO_PULSE } from '@/game/constants/pulse.constants'
import { pulseDelays, pulseDuration } from '@/game/utils/pulse.utils'
import type { Move } from '@/game/utils/session.utils'

/** delays: one per cell in ms, or NO_PULSE. elapsed: ms since the move of the last pulse. */
export type Pulse = { delays: SharedValue<readonly number[]>; elapsed: SharedValue<number> }

const STILL: readonly number[] = Array.from({ length: GRID_CELLS }, () => NO_PULSE)

/**
 * Starts a pulse for each move that completes something. The pulse runs on the UI thread and renders nothing.
 * Reduce Motion is read when the app starts. withTiming also skips to the end when the setting changes later.
 */
export function usePulse(board: Game, move: Move | null): Pulse {
  const reduceMotion = useReducedMotion()
  const delays = useSharedValue<readonly number[]>(STILL)
  const elapsed = useSharedValue(0)
  // A select changes the board but keeps the move. A grid that mounts late must not replay the move before it.
  const pulsedMove = useRef(move?.id ?? 0)
  useEffect(() => {
    if (move === null || move.id === pulsedMove.current) return
    pulsedMove.current = move.id
    if (reduceMotion) return
    const next = pulseDelays(board, move)
    if (next === null) return
    const end = pulseDuration(next)
    cancelAnimation(elapsed)
    elapsed.set(0)
    delays.set(next)
    // Linear time: each cell applies its own delay and curve.
    elapsed.set(withTiming(end, { duration: end, easing: Easing.linear }))
  }, [board, move, reduceMotion, delays, elapsed])
  return useMemo(() => ({ delays, elapsed }), [delays, elapsed])
}
```

`src/game/hooks/usePulse/index.ts`:

```ts
export { usePulse, type Pulse } from './usePulse'
```

- [ ] **Step 4: Run the tests. They pass**

```bash
just test-ts -- usePulse
```

Expected: PASS, 6 tests. If `Easing.linear` is undefined in the Reanimated mock, check `react-native-reanimated/lib/module/mock.js`: the mock spreads an `Easing` object. Do not change `jest.setup.ts`; write that need under Open questions.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add apps/mobile/src/game/hooks/usePulse
/usr/bin/git commit -m "feat(game): pulse hook that runs the wave on the UI thread (#42)"
```

---

## Task 3: The wave and the pop in the cell

This task needs Open question 1 answered "yes". If the answer is "no", skip this task and follow the fallback in Open question 1.

**Files:**
- Modify: `src/game/components/Cell/Cell.tsx`, `Cell.styles.ts`, `Cell.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`waveOpacity`, `popScale`, `NO_PULSE`), Task 2 (`Pulse`).
- Produces: `Cell` takes a new prop `pulse: Pulse`. TestIDs `cell-<n>-wave`.

- [ ] **Step 1: Write the failing tests**

In `src/game/components/Cell/Cell.test.tsx`, replace the imports and `base` with:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { NO_PULSE, POP_MS, POP_PEAK_AT, POP_SCALE, WAVE_MS, WAVE_PEAK_AT, WAVE_PEAK_OPACITY } from '@/game/constants/pulse.constants'
import type { Pulse } from '@/game/hooks/usePulse'
import { daylight } from '@/theme/themes/daylight'
import { Cell } from './Cell'

// A fixed stand-in for a shared value. The Reanimated mock runs each animated style once, at render.
const fixed = <T,>(value: T) => ({ value, get: () => value, set: jest.fn() }) as unknown as SharedValue<T>
const pulseAt = (elapsed: number, delays: readonly number[] = Array(81).fill(NO_PULSE)): Pulse => ({
  delays: fixed(delays),
  elapsed: fixed(elapsed),
})
const inPulse = Array.from({ length: 81 }, (_, cell) => (cell === 2 ? 0 : NO_PULSE))

const base = {
  cell: 2,
  digit: 0,
  digitStyle: 'entry',
  notes: '',
  fill: 'plain',
  ring: false,
  label: 'cell',
  pulse: pulseAt(0),
} as const
```

Keep the five existing tests. Add:

```tsx
it('draws the wave in the accent colour at its peak opacity', () => {
  render(<Cell {...base} digit={4} pulse={pulseAt(WAVE_MS * WAVE_PEAK_AT, inPulse)} onSelect={jest.fn()} />)
  const wave = StyleSheet.flatten(screen.getByTestId('cell-2-wave').props.style)
  expect(wave.backgroundColor).toBe(daylight.colors.accent)
  expect(wave.opacity).toBeCloseTo(WAVE_PEAK_OPACITY)
})

it('pops the digit to its peak scale', () => {
  render(<Cell {...base} digit={4} pulse={pulseAt(POP_MS * POP_PEAK_AT, inPulse)} onSelect={jest.fn()} />)
  const digit = StyleSheet.flatten(screen.getByText('4').props.style)
  expect(digit.transform).toEqual([{ scale: expect.closeTo(POP_SCALE) }])
})

it('shows no wave and no pop outside a pulse', () => {
  render(<Cell {...base} digit={4} pulse={pulseAt(WAVE_MS * WAVE_PEAK_AT)} onSelect={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByTestId('cell-2-wave').props.style).opacity).toBe(0)
  expect(StyleSheet.flatten(screen.getByText('4').props.style).transform).toEqual([{ scale: 1 }])
})

it('lets a tap through the wave', () => {
  const onSelect = jest.fn()
  render(<Cell {...base} pulse={pulseAt(WAVE_MS * WAVE_PEAK_AT, inPulse)} onSelect={onSelect} />)
  expect(StyleSheet.flatten(screen.getByTestId('cell-2-wave').props.style).pointerEvents).toBe('none')
  fireEvent.press(screen.getByTestId('cell-2'))
  expect(onSelect).toHaveBeenCalledWith(2)
})
```

- [ ] **Step 2: Run the tests. They fail**

```bash
just test-ts -- Cell.test
```

Expected: FAIL, `Unable to find an element with testID: cell-2-wave`. `just typecheck` also fails on the unknown prop `pulse`.

- [ ] **Step 3: Add the wave style**

In `src/game/components/Cell/Cell.styles.ts`, add this key after `ring`:

```ts
  wave: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
    backgroundColor: theme.colors.accent,
  },
```

- [ ] **Step 4: Draw the wave and the pop**

`src/game/components/Cell/Cell.tsx`:

```tsx
import { memo } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { NO_PULSE } from '@/game/constants/pulse.constants'
import type { Pulse } from '@/game/hooks/usePulse'
import { popScale, waveOpacity } from '@/game/utils/pulse.utils'
import type { CellView } from '@/game/utils/cell.utils'
import { NOTE_PLACES } from './Cell.constants'
import { styles } from './Cell.styles'

type CellProps = CellView & { cell: number; label: string; pulse: Pulse; onSelect(cell: number): void }

/**
 * One cell. The props are primitives, plus onSelect and pulse, which keep their identity for the whole game.
 * So memo skips the cells a move does not change, and a pulse renders no cell.
 */
export const Cell = memo(function Cell({ cell, digit, digitStyle, notes, fill, ring, label, pulse, onSelect }: CellProps) {
  const { delays, elapsed } = pulse
  const waveStyle = useAnimatedStyle(() => ({
    opacity: waveOpacity(elapsed.get(), delays.get()[cell] ?? NO_PULSE),
  }))
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: popScale(elapsed.get(), delays.get()[cell] ?? NO_PULSE) }],
  }))
  return (
    <Pressable
      testID={`cell-${cell}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onSelect(cell)}
      style={[styles.cell, styles[fill], ring && styles.ring]}
    >
      <Animated.View testID={`cell-${cell}-wave`} style={[styles.wave, waveStyle]} />
      {digit !== 0 && (
        <Animated.Text allowFontScaling={false} style={[styles[digitStyle], popStyle]}>
          {digit}
        </Animated.Text>
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

Only the digit needs `Animated.Text`. The notes keep `Text`: a cell with notes holds no digit, so it never pops.

The wave lies under the digit and the notes, because it is the first child. This matches the canvas, where the inset shadow lies under the text.

- [ ] **Step 5: Run the tests. They pass**

```bash
just test-ts -- Cell.test
```

Expected: PASS, 9 tests. `just typecheck` still fails in `Grid.tsx` (no `pulse` prop yet). Task 4 fixes it. Do not commit a red typecheck: go on to Task 4 and commit both together.

---

## Task 4: The grid gives the pulse to each cell

**Files:**
- Modify: `src/game/components/Grid/Grid.tsx`
- Create: `src/game/components/Grid/Grid.renders.test.tsx`

**Interfaces:**
- Consumes: Task 2 (`usePulse`), `useGameState` (board, move), Task 3 (`Cell` prop `pulse`).
- Produces: no new export.

- [ ] **Step 1: Write the failing test**

`src/game/components/Grid/Grid.renders.test.tsx`:

```tsx
import { act, render } from '@testing-library/react-native'
import type { NewGame } from '@sudoku/core'
import { GameProvider } from '@/game/components/GameProvider'
import { useGameActions, type GameActions } from '@/game/hooks/useGameActions'
import { sampleStart } from '@/game/utils/sample.utils'
import { Grid } from './Grid'

const mockSeen = { renders: 0, pulses: new Set<unknown>() }

jest.mock('@/game/components/Cell', () => {
  const { createElement, memo } = jest.requireActual<typeof import('react')>('react')
  const actual = jest.requireActual<typeof import('@/game/components/Cell')>('@/game/components/Cell')
  return {
    Cell: memo((props: Parameters<typeof actual.Cell>[0]) => {
      mockSeen.renders += 1
      mockSeen.pulses.add(props.pulse)
      return createElement(actual.Cell, props)
    }),
  }
})

// Row 0 of the canvas puzzle lacks only cell 2. Its solution is 4.
function rowAlmostDone(): NewGame {
  const sample = sampleStart()
  const entries = sample.solution.map((value, cell) =>
    cell < 9 && cell !== 2 && sample.givens[cell] === 0 ? value : 0,
  )
  return { ...sample, entries }
}

const remote: { actions: GameActions | null } = { actions: null }

function Remote() {
  remote.actions = useGameActions()
  return null
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('renders only the changed cells on a move that completes a row, and nothing while the pulse runs', () => {
  render(
    <GameProvider start={rowAlmostDone()}>
      <Grid />
      <Remote />
    </GameProvider>,
  )
  act(() => remote.actions?.select(2))
  mockSeen.renders = 0
  act(() => remote.actions?.digit(4))
  expect(mockSeen.renders).toBeGreaterThan(0)
  expect(mockSeen.renders).toBeLessThan(81)
  const afterMove = mockSeen.renders
  act(() => jest.advanceTimersByTime(2000))
  expect(mockSeen.renders).toBe(afterMove)
  expect(mockSeen.pulses.size).toBe(1)
})
```

- [ ] **Step 2: Run the test. It fails**

```bash
just test-ts -- Grid.renders
```

Expected: FAIL. `pulses.size` is 1 with `undefined` in it, or the run fails on `pulse` of undefined in `Cell`. `just typecheck` fails in `Grid.tsx`.

- [ ] **Step 3: Give the pulse to the cells**

In `src/game/components/Grid/Grid.tsx`, add the imports:

```tsx
import { useGameState } from '@/game/hooks/useGameState'
import { usePulse } from '@/game/hooks/usePulse'
```

Replace the top of `Grid` with:

```tsx
/** 81 cells in nine boxes. BOXES lists the cells of each box row by row. A pulse runs in the cells, not here. */
export function Grid() {
  const views = useCellViews()
  const { select } = useGameActions()
  const { board, move } = useGameState()
  const pulse = usePulse(board, move)
  const drawCell = (cell: number) => {
    const view = views[cell]
    if (!view) return null
    return (
      <Cell key={cell} cell={cell} {...view} label={cellLabel(cell, view)} pulse={pulse} onSelect={select} />
    )
  }
```

`useGameState` is the context that `useCellViews` already reads, so `Grid` renders no more often than before.

- [ ] **Step 4: Run all checks. They pass**

```bash
just test-ts
just typecheck
just lint
```

Expected: PASS. `Grid.test.tsx`, `Cell.test.tsx`, `Grid.renders.test.tsx` and `GameScreen.renders.test.tsx` are green.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add apps/mobile/src/game/components/Cell apps/mobile/src/game/components/Grid
/usr/bin/git commit -m "feat(game): pulse wave and digit pop in the cells, without a render (#42)"
```

---

## Task 5: One haptic per move, by completion

**Files:**
- Modify: `src/game/hooks/useMoveHaptics/useMoveHaptics.ts`, `useMoveHaptics.test.tsx`

**Interfaces:**
- Consumes: `Move`, `Completion`.
- Produces: `useMoveHaptics(move: Move | null): void`. The signature does not change, so `useGameSession` (#39) needs no change.

- [ ] **Step 1: Write the failing tests**

`src/game/hooks/useMoveHaptics/useMoveHaptics.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { useReducedMotion } from 'react-native-reanimated'
import { NOTHING_COMPLETED, type Completion } from '@sudoku/core'
import type { Move, MoveKind } from '@/game/utils/session.utils'
import { useMoveHaptics } from './useMoveHaptics'

// The shared mock in jest.setup.ts has only impactAsync and the Light style.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}))

const move = (id: number, kind: MoveKind, completed: Partial<Completion> = {}): Move => ({
  id,
  kind,
  cell: 2,
  completed: { ...NOTHING_COMPLETED, ...completed },
  mistake: false,
})

function play(...moves: Move[]) {
  const { rerender } = renderHook(({ last }: { last: Move | null }) => useMoveHaptics(last), {
    initialProps: { last: null },
  })
  for (const last of moves) rerender({ last })
}

beforeEach(() => jest.clearAllMocks())
afterEach(() => jest.mocked(useReducedMotion).mockReturnValue(false))

it('gives a light tap for each placed number', () => {
  play(move(1, 'number'), move(2, 'number'))
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(2)
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
})

it('gives no tap for a note, a clear, an undo or a hint that completes nothing', () => {
  play(move(1, 'note'), move(2, 'clear'), move(3, 'undo'), move(4, 'hint'))
  expect(Haptics.impactAsync).not.toHaveBeenCalled()
  expect(Haptics.notificationAsync).not.toHaveBeenCalled()
})

it('gives one medium tap, not the light one, for a completed row, column, box or number', () => {
  play(move(1, 'number', { rows: [0] }), move(2, 'number', { columns: [2], boxes: [0] }), move(3, 'number', { digits: [4] }))
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(3)
  expect(jest.mocked(Haptics.impactAsync).mock.calls).toEqual([['medium'], ['medium'], ['medium']])
})

it('gives the completion tap for a hint that completes a box', () => {
  play(move(1, 'hint', { boxes: [4] }))
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium)
})

it('gives only the success haptic for the solved grid', () => {
  play(move(1, 'number', { rows: [0], columns: [2], boxes: [0], digits: [4], grid: true }))
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success)
  expect(Haptics.impactAsync).not.toHaveBeenCalled()
})

it('keeps the haptics with Reduce Motion', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  play(move(1, 'number', { rows: [0] }))
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium)
})
```

- [ ] **Step 2: Run the tests. They fail**

```bash
just test-ts -- useMoveHaptics
```

Expected: FAIL on "one medium tap" (called with `light`), "completion tap for a hint" and "only the success haptic".

- [ ] **Step 3: Write the hook**

`src/game/hooks/useMoveHaptics/useMoveHaptics.ts`:

```ts
import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import type { Completion } from '@sudoku/core'
import type { Move } from '@/game/utils/session.utils'

function completesAUnitOrNumber({ rows, columns, boxes, digits }: Completion): boolean {
  return rows.length + columns.length + boxes.length + digits.length > 0
}

/** The strongest haptic that fits the move, or null. One move gives one haptic, so two taps never blur together. */
function hapticOf(move: Move | null): (() => Promise<void>) | null {
  if (move === null) return null
  if (move.completed.grid) return () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  if (completesAUnitOrNumber(move.completed)) return () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  if (move.kind === 'number') return () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  return null
}

/** A haptic for each move: a light tap for a placed number, more for a completion. Reduce Motion does not stop it. */
export function useMoveHaptics(move: Move | null): void {
  useEffect(() => {
    // A phone without a haptic engine rejects the call. The game goes on without the tap.
    hapticOf(move)?.().catch(() => undefined)
  }, [move])
}
```

- [ ] **Step 4: Run all checks. They pass**

```bash
just test-ts
just typecheck
just lint
```

Expected: PASS. `GameScreen.test.tsx` "gives a light haptic tap for a placed number" stays green: 4 in cell 2 of the canvas puzzle completes nothing.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add apps/mobile/src/game/hooks/useMoveHaptics
/usr/bin/git commit -m "feat(game): one haptic per move, by what the move completed (#42)"
```

---

## Task 6: Checks and pull request

- [ ] **Step 1: Run every check**

```bash
just lint
just typecheck
just test-ts
just docs-check
```

Expected: all PASS.

- [ ] **Step 2: Tick the acceptance criteria that the tests prove**

Tick these in issue #42 only after the iPhone steps pass: pulse through a unit (Tasks 1, 3, 4), nine copies (Task 1), haptics (Task 5), whole-grid wave and success haptic (Tasks 1, 5), UI thread (Tasks 2, 4), Reduce Motion (Tasks 2, 5).

- [ ] **Step 3: Push and open the PR**

Push and open the PR only when the developer asks.

```bash
/usr/bin/git push -u origin feature/42-pulses-haptics
gh pr create --base develop --title "feat(game): pulses and haptics when a row, column, box or number is complete (#42)" --body-file <body>
```

The body holds: a summary, the "Files owned" table, the haptic choice (Open question 2), the hand-off of `SOLVE_PULSE_MS` to the finish card, the result lines of the four checks, the iPhone steps below, and `Closes #42`. A second agent reviews the PR without this session's context before the merge.

---

## iPhone steps for the developer

Use a development build (`pnpm exec expo run:ios`). `App.tsx` opens the game screen with the canvas puzzle.

1. Fill a row, a column and a box. Each last correct number sends a wave of the accent colour out from its cell. Its digits grow for a moment. You feel one medium tap, not two.
2. Place the ninth correct copy of a number. All nine copies pulse, and only those.
3. Place a wrong copy of a complete number somewhere, then complete a row with it in view. The wrong cell does not pulse.
4. Use Hint until the grid is solved. The last hint sends a wave across the whole grid. You feel the success haptic.
5. During a pulse, tap other cells. The pulse runs on. The taps act at once. A tap does not start the pulse again.
6. Switch the theme (Daylight, Midnight) and complete a unit. The wave uses the accent colour of the theme.
7. Turn on Settings > Accessibility > Motion > Reduce Motion. Close the app fully and open it again. Complete a unit: no wave, no pop, the medium tap stays.
8. Optional: turn on Low Power Mode. iOS gives no haptic then (Expo 57 docs). The game goes on.
9. Watch for dropped frames during the solve wave (162 animated styles). If the wave stutters, say so in the PR.

## Open questions

1. **`components/Cell/*` belongs to #44 in the game screen plan, but #44 is not in this wave.** The wave lies under the digit and the pop scales only the digit, so both must be inside `Cell`. **Recommended:** #42 takes `Cell.tsx`, `Cell.styles.ts` and `Cell.test.tsx` in this wave. No other wave issue edits them. #44 starts from them after this wave. **Fallback if not:** skip Task 3. `Grid` wraps each `Cell` in a `View` with an absolute `Animated.View` wave above it (`pointerEvents: 'none'`), styled in `Grid.styles.ts`. The wave then tints the digit, and the digit pop is dropped until #44.
2. **Haptic strength.** The issue says "a light haptic" for a completed row, column, box or number. A placed number already gives a light tap, so a completion would feel the same. **Recommended:** Light for a plain placed number, Medium for a completed row, column, box or number, Success (`notificationAsync`) for the solved grid. One haptic per move. If you want "light" literally, change one line in `hapticOf`.
3. **`jest.setup.ts` mock of `expo-haptics`.** It has only `impactAsync` and `ImpactFeedbackStyle.Light`. A test elsewhere that solves a grid would call the missing `notificationAsync` and fail. #40 needs `NotificationFeedbackType.Warning` for `MistakeDots` too. My tests use a local mock, so this plan does not depend on it. **Recommended:** one issue (#40, or #42 if you prefer) adds `notificationAsync`, `NotificationFeedbackType: { Success, Warning, Error }` and `ImpactFeedbackStyle: { Light, Medium, Heavy, Soft, Rigid }` to the shared mock. Then this plan drops its local mock in a follow-up commit.
4. **The finish card waits for the solve pulse.** `SOLVE_PULSE_MS` (1420 ms) in `constants/pulse.constants.ts` is the wait. The canvas uses 1400 ms. **Recommended:** #43 (finish card, a later wave) imports `SOLVE_PULSE_MS`, and shows the card at once when `useReducedMotion()` is true. Nothing in this wave shows the finish card. The core already locks a won game, so the controls do not act during the wave.
5. **Midnight peak opacity.** The canvas uses 0.30 in Daylight and 0.32 in Midnight. **Recommended:** one value, 0.3, on `colors.accent`. This needs no theme token and no theme file. If the difference matters, add `components.cell.pulse` in both themes in a later issue.
6. **No glossary row, no route and no dependency are needed.** "Pulse" and "Completion" are in the glossary. `useReducedMotion` is already mocked in `jest.setup.ts`. The completed-key animation belongs to #41.
