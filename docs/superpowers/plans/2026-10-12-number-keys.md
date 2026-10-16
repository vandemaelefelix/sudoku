# Complete Number Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disable the number key of a complete number. The key plays the `keyDone` animation of the design canvas: it grows to 1.12, shrinks back and fades to 25 %. It loses its fill and shadow. VoiceOver reads "Enter N, all nine placed". With Reduce Motion on, the key only fades. Undo or Erase enables the key again.

**Architecture:** The rule stays in the core: `completeDigits(game)` already reports the complete numbers and `place` already refuses them. `Keypad` reads `completeDigits(board)` once per board and gives each `NumberKey` a `complete` flag. `NumberKey` drives one shared value `progress` (0 to 1, linear in time) with `withTiming`. A pure worklet `keyDoneLook(progress, reduceMotion)` in `src/game/utils/keypad.utils.ts` turns the progress into opacity and scale, so the curve has unit tests. The Reanimated Jest mock cannot run an animation; it jumps to the end value.

**Tech Stack:** Expo 57, React Native 0.86, React 19, react-native-reanimated 4.5.1 (`useSharedValue`, `useAnimatedStyle`, `withTiming`, `Easing`, `useReducedMotion`, `Animated.View`), react-native-unistyles 3.5.2, Jest + @testing-library/react-native, `@sudoku/core`.

**Spec:** issue #41 (`gh issue view 41`). The design canvas `Main.dc.html` (https://claude.ai/artifact/U23JHiGA1Pq3HJX6oMiBF4): `@keyframes keyDone{0%{transform:scale(1);opacity:1}35%{transform:scale(1.12);opacity:1}100%{transform:scale(1);opacity:.25}}`, `animation: keyDone 500ms ease-out`, `background: transparent; box-shadow: none`, label `"Enter " + d + ", all nine placed"`. `docs/architecture/00-concepts/game-screen.md` (Keypad row, Pulses section). Glossary term "Complete number" (already present).


## Coordinator rulings (2026-10-12, binding; they override the tasks below where they differ)

- A complete key uses the existing `theme.opacity.disabled` token (0.3). Do not add a 0.25 constant or token. No theme file changes.
- Merge order: #51 merges first. Your last task rebases on origin/develop after #51 merges and adapts to #51's `GameStart` type and routes. Until then, work on origin/develop as it is.
## Global Constraints

- Branch `feature/41-number-keys` from `origin/develop`. PR against `develop` with `Closes #41`.
- First commit: copy this plan to `docs/superpowers/plans/2026-10-12-number-keys.md` with `docs(plan): complete number keys (#41)`. Run `just docs-check`.
- The app holds no game rule (SUD-04). "Complete" comes only from `completeDigits` of `@sudoku/core`. Do not count digits in the app.
- Edit only the files in "Files owned". No theme file, no `jest.setup.ts`, no `package.json`, no glossary.
- No colour value outside `src/theme/`. The complete key gets no fill because the fill and shadow move into a separate style key (`raised`) that a complete key does not use. No `transparent` literal.
- One style key per state, not Unistyles variants. Do not spread a Unistyles style.
- Put the worklet helpers above their use, or import them (apps/mobile/AGENTS.md, Worklets). `keyDoneLook` and its helper carry the `'worklet'` directive, as in `scan/utils/transition.utils.ts`.
- `keypad.utils.ts` and `keypad.constants.ts` import no React, React Native or Reanimated.
- The `GameScreen.renders.test.tsx` render counts must stay green: `Keypad` already renders on each board change. `NumberKey` reads no theme hook.
- Comments and prose: STE light and the comment rules of `AGENTS.md`. No issue numbers in code comments.
- Commits: Conventional Commits, each with `(#41)`.
- Checks before the PR: `just lint`, `just typecheck`, `just test-ts`, `just docs-check`.

## Review Focus

1. **Wrong placements do not count.** Eight correct 4s plus one wrong 4 must leave key 4 enabled. Test: Task 3, "does not count a wrong placement".
2. **Undo and Erase.** The key enables again, at full opacity, with the plain label. Test: Task 3, "enables the key again after Undo" and "after Erase".
3. **A resumed game.** A key that is complete on mount shows the end state and does not animate. The shared value starts at 1. Read `NumberKey.tsx`.
4. **Reduce Motion.** No scale, only the fade. Test: Task 1, "only fades with Reduce Motion", and Task 2, "keeps the scale at 1 with Reduce Motion".

## Files owned

All paths are under `apps/mobile/src/game/`.

| File | Change |
| --- | --- |
| `components/Keypad/Keypad.tsx` | Compute `completeDigits(board)`. Pass `complete` to each key |
| `components/Keypad/Keypad.test.tsx` | Integration tests: complete, wrong placement, Undo, Erase |
| `components/NumberKey/NumberKey.tsx` | `complete` prop, label, disabled state, the `keyDone` animation |
| `components/NumberKey/NumberKey.styles.ts` | Split `key` into `key` (shape) and `raised` (fill and shadow) |
| `components/NumberKey/NumberKey.test.tsx` | New. Unit tests of one key |
| `utils/keypad.utils.ts` | New. `keyDoneLook` worklet |
| `utils/keypad.utils.test.ts` | New. The curve |
| `constants/keypad.constants.ts` | New. `KEY_DONE` keyframe values |
| `docs/superpowers/plans/2026-10-12-number-keys.md` (repo root) | New. This plan |

`Keypad.styles.ts`, `Keypad.constants.ts` and both `index.ts` files stay as they are.

---

## Task 1: The keyDone curve

**Files:**
- Create: `apps/mobile/src/game/constants/keypad.constants.ts`
- Create: `apps/mobile/src/game/utils/keypad.utils.ts`
- Test: `apps/mobile/src/game/utils/keypad.utils.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { KEY_DONE } from '@/game/constants/keypad.constants'
import { keyDoneLook } from './keypad.utils'

describe('keyDoneLook', () => {
  it('starts as an open key', () => {
    expect(keyDoneLook(0, false)).toEqual({ opacity: 1, scale: 1 })
  })

  it('grows to the peak scale at full opacity', () => {
    const look = keyDoneLook(KEY_DONE.peakAt, false)
    expect(look.opacity).toBe(1)
    expect(look.scale).toBeCloseTo(KEY_DONE.scale)
  })

  it('ends at its own size and faded', () => {
    const look = keyDoneLook(1, false)
    expect(look.scale).toBeCloseTo(1)
    expect(look.opacity).toBeCloseTo(KEY_DONE.opacity)
  })

  it('only fades with Reduce Motion', () => {
    expect(keyDoneLook(KEY_DONE.peakAt, true).scale).toBe(1)
    expect(keyDoneLook(KEY_DONE.peakAt, true).opacity).toBeLessThan(1)
    expect(keyDoneLook(1, true)).toEqual({ opacity: KEY_DONE.opacity, scale: 1 })
  })

  it('clamps a progress outside 0 to 1', () => {
    expect(keyDoneLook(-1, false)).toEqual(keyDoneLook(0, false))
    expect(keyDoneLook(2, false)).toEqual(keyDoneLook(1, false))
  })
})
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm --filter mobile exec jest src/game/utils/keypad.utils.test.ts`
Expected: FAIL, the modules do not exist.

- [ ] **Step 3: Write the constants and the worklet**

`apps/mobile/src/game/constants/keypad.constants.ts`:

```ts
/** The keyDone keyframes of the design canvas. peakAt: the share of the duration at the largest scale. */
export const KEY_DONE = { durationMs: 500, peakAt: 0.35, scale: 1.12, opacity: 0.25 } as const
```

`apps/mobile/src/game/utils/keypad.utils.ts`:

```ts
import { KEY_DONE } from '@/game/constants/keypad.constants'

export type KeyLook = { opacity: number; scale: number }

// CSS applies ease-out to each keyframe segment, not to the whole animation.
function easeOut(t: number): number {
  'worklet'
  return 1 - (1 - t) * (1 - t)
}

/** progress: 0 (open key) to 1 (complete key), linear in time. Reduce Motion keeps the scale at 1. */
export function keyDoneLook(progress: number, reduceMotion: boolean): KeyLook {
  'worklet'
  const p = Math.min(1, Math.max(0, progress))
  const fade = (t: number) => 1 - (1 - KEY_DONE.opacity) * t
  if (reduceMotion) return { opacity: fade(easeOut(p)), scale: 1 }
  if (p <= KEY_DONE.peakAt) {
    return { opacity: 1, scale: 1 + (KEY_DONE.scale - 1) * easeOut(p / KEY_DONE.peakAt) }
  }
  const t = easeOut((p - KEY_DONE.peakAt) / (1 - KEY_DONE.peakAt))
  return { opacity: fade(t), scale: KEY_DONE.scale - (KEY_DONE.scale - 1) * t }
}
```

Note: the inner arrow `fade` is inside the worklet, so the worklet plugin captures it. If `just lint` or the device build objects, lift it into a named `'worklet'` function above `keyDoneLook`.

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm --filter mobile exec jest src/game/utils/keypad.utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/game/constants/keypad.constants.ts apps/mobile/src/game/utils/keypad.utils.ts apps/mobile/src/game/utils/keypad.utils.test.ts
git commit -m "feat(game): keyDone curve for a complete number key (#41)"
```

## Task 2: NumberKey shows a complete number

**Files:**
- Modify: `apps/mobile/src/game/components/NumberKey/NumberKey.tsx`
- Modify: `apps/mobile/src/game/components/NumberKey/NumberKey.styles.ts`
- Test: `apps/mobile/src/game/components/NumberKey/NumberKey.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { KEY_DONE } from '@/game/constants/keypad.constants'
import { NumberKey } from './NumberKey'

const renderKey = (props: Partial<Parameters<typeof NumberKey>[0]> = {}) => {
  const onPress = jest.fn()
  render(<NumberKey digit={4} notesMode={false} complete={false} disabled={false} onPress={onPress} {...props} />)
  return onPress
}

afterEach(() => jest.mocked(useReducedMotion).mockReturnValue(false))

it('reads "Enter 4" and is enabled while the number is open', () => {
  renderKey()
  expect(screen.getByLabelText('Enter 4')).toBeEnabled()
  expect(screen.getByTestId('number-key-4')).toHaveStyle({ opacity: 1 })
})

it('disables a complete key and reads "all nine placed"', () => {
  const onPress = renderKey({ complete: true })
  const key = screen.getByLabelText('Enter 4, all nine placed')
  expect(key).toBeDisabled()
  fireEvent.press(key)
  expect(onPress).not.toHaveBeenCalled()
})

it('reads "Note 4, all nine placed" in notes mode', () => {
  renderKey({ complete: true, notesMode: true })
  expect(screen.getByLabelText('Note 4, all nine placed')).toBeDisabled()
})

it('fades a complete key to the keyDone opacity', () => {
  renderKey({ complete: true })
  expect(screen.getByTestId('number-key-4')).toHaveStyle({ opacity: KEY_DONE.opacity })
})

it('drops the fill and the shadow of a complete key', () => {
  renderKey({ complete: true })
  const style = StyleSheet.flatten(screen.getByLabelText('Enter 4, all nine placed').props.style)
  expect(style.backgroundColor).toBeUndefined()
  expect(style.boxShadow).toBeUndefined()
})

it('keeps the scale at 1 with Reduce Motion', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  renderKey({ complete: true })
  expect(screen.getByTestId('number-key-4')).toHaveStyle({ opacity: KEY_DONE.opacity, transform: [{ scale: 1 }] })
})

it('comes back at full opacity when the number opens again', () => {
  renderKey({ complete: true })
  screen.rerender(<NumberKey digit={4} notesMode={false} complete={false} disabled={false} onPress={jest.fn()} />)
  expect(screen.getByLabelText('Enter 4')).toBeEnabled()
  expect(screen.getByTestId('number-key-4')).toHaveStyle({ opacity: 1, transform: [{ scale: 1 }] })
})
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm --filter mobile exec jest src/game/components/NumberKey`
Expected: FAIL, `complete` is not a prop and the labels do not match.

- [ ] **Step 3: Split the styles**

`NumberKey.styles.ts`: keep `digit` and `noteDigit`. Replace `key` with:

```ts
  key: {
    width: theme.size.key.width,
    height: theme.size.key.height,
    borderRadius: theme.shape.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raised: { backgroundColor: theme.components.key.fill, boxShadow: theme.elevation.key },
```

- [ ] **Step 4: Write the component**

```tsx
import { useEffect } from 'react'
import { Pressable, Text } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import type { Digit } from '@sudoku/core'
import { KEY_DONE } from '@/game/constants/keypad.constants'
import { keyDoneLook } from '@/game/utils/keypad.utils'
import { styles } from './NumberKey.styles'

type NumberKeyProps = {
  digit: Digit
  notesMode: boolean
  complete: boolean
  disabled: boolean
  onPress(digit: Digit): void
}

export function NumberKey({ digit, notesMode, complete, disabled, onPress }: NumberKeyProps) {
  const reduceMotion = useReducedMotion()
  // A key that is complete on mount (a resumed game) starts at the end state and does not animate.
  const progress = useSharedValue(complete ? 1 : 0)
  useEffect(() => {
    progress.set(complete ? withTiming(1, { duration: KEY_DONE.durationMs, easing: Easing.linear }) : 0)
  }, [complete, progress])
  const look = useAnimatedStyle(() => {
    const { opacity, scale } = keyDoneLook(progress.get(), reduceMotion)
    return { opacity, transform: [{ scale }] }
  })
  const name = `${notesMode ? 'Note' : 'Enter'} ${digit}`
  const off = disabled || complete
  return (
    <Animated.View testID={`number-key-${digit}`} style={look}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={complete ? `${name}, all nine placed` : name}
        accessibilityState={{ disabled: off }}
        disabled={off}
        onPress={() => onPress(digit)}
        style={[styles.key, !complete && styles.raised]}
      >
        <Text allowFontScaling={false} style={notesMode ? styles.noteDigit : styles.digit}>
          {digit}
        </Text>
      </Pressable>
    </Animated.View>
  )
}
```

The progress is linear in time. `keyDoneLook` adds the ease-out to each keyframe segment. Undo and Erase set the progress back to 0 at once: the key comes back without an animation, because the design canvas shows none.

Before you write this step, check `withTiming`, `Easing.linear`, `SharedValue.set` and `useReducedMotion` in the Reanimated 4.5 docs (https://docs.swmansion.com/react-native-reanimated/). The app already uses each of them in `src/scan/`.

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm --filter mobile exec jest src/game/components/NumberKey src/game/components/Keypad`
Expected: PASS. `Keypad.tsx` does not pass `complete` yet, so `just typecheck` fails until Task 3. Do not commit before Task 3 passes typecheck; commit Task 2 and Task 3 together if you prefer one green commit.

## Task 3: Keypad reports the complete numbers

**Files:**
- Modify: `apps/mobile/src/game/components/Keypad/Keypad.tsx`
- Test: `apps/mobile/src/game/components/Keypad/Keypad.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `Keypad.test.tsx`. Keep the two existing tests. Change the imports to these:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import type { NewGame } from '@sudoku/core'
import { GameProvider } from '@/game/components/GameProvider'
import { Grid } from '@/game/components/Grid'
import { Tools } from '@/game/components/Tools'
import { sampleStart } from '@/game/utils/sample.utils'
import { Keypad } from './Keypad'
```

Then add:

```tsx
const sample = sampleStart()
// Row 1, column 3 is empty in the sample puzzle and its solution is 4.
const LAST_FOUR = 2

/** Every 4 is placed except the one in LAST_FOUR. */
const oneFourOpen = (): NewGame => ({
  ...sample,
  entries: sample.solution.map((value, cell) =>
    sample.givens[cell] === 0 && value === 4 && cell !== LAST_FOUR ? 4 : 0,
  ),
})

const renderGame = (start: NewGame) =>
  render(
    <GameProvider start={start}>
      <Grid />
      <Tools />
      <Keypad />
    </GameProvider>,
  )

const placeLastFour = () => {
  fireEvent.press(screen.getByTestId(`cell-${LAST_FOUR}`))
  fireEvent.press(screen.getByLabelText('Enter 4'))
}

it('disables a key when all nine of its number are correct', () => {
  renderGame(oneFourOpen())
  expect(screen.getByLabelText('Enter 4')).toBeEnabled()
  placeLastFour()
  expect(screen.getByLabelText('Enter 4, all nine placed')).toBeDisabled()
  expect(screen.getByLabelText('Enter 5')).toBeEnabled()
})

it('does not count a wrong placement', () => {
  renderGame(oneFourOpen())
  const wrongCell = sample.givens.findIndex((given, cell) => given === 0 && sample.solution[cell] !== 4)
  fireEvent.press(screen.getByTestId(`cell-${wrongCell}`))
  fireEvent.press(screen.getByLabelText('Enter 4'))
  expect(screen.getByLabelText('Enter 4')).toBeEnabled()
})

it('enables the key again after Undo', () => {
  renderGame(oneFourOpen())
  placeLastFour()
  fireEvent.press(screen.getByLabelText('Undo'))
  expect(screen.getByLabelText('Enter 4')).toBeEnabled()
})

it('enables the key again after Erase', () => {
  renderGame(oneFourOpen())
  placeLastFour()
  fireEvent.press(screen.getByLabelText('Erase'))
  expect(screen.getByLabelText('Enter 4')).toBeEnabled()
})

it('starts a resumed game with the key of a complete number disabled', () => {
  const start = oneFourOpen()
  renderGame({ ...start, entries: start.entries?.map((value, cell) => (cell === LAST_FOUR ? 4 : value)) })
  expect(screen.getByLabelText('Enter 4, all nine placed')).toBeDisabled()
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm --filter mobile exec jest src/game/components/Keypad`
Expected: FAIL, the label "Enter 4, all nine placed" is not found.

- [ ] **Step 3: Pass the flag**

```tsx
import { useMemo } from 'react'
import { View } from 'react-native'
import { completeDigits } from '@sudoku/core'
import { NumberKey } from '@/game/components/NumberKey'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { KEY_ROWS } from './Keypad.constants'
import { styles } from './Keypad.styles'

export function Keypad() {
  const { board, notesMode } = useGameState()
  const { digit: enter } = useGameActions()
  const complete = useMemo(() => completeDigits(board), [board])
  const locked = board.status !== 'playing'
  return (
    <View style={[styles.keypad, locked && styles.locked]}>
      {KEY_ROWS.map((digits, row) => (
        <View key={digits[0]} testID={`keypad-row-${row}`} style={styles.row}>
          {digits.map((digit) => (
            <NumberKey
              key={digit}
              digit={digit}
              notesMode={notesMode}
              complete={complete.includes(digit)}
              disabled={locked}
              onPress={enter}
            />
          ))}
        </View>
      ))}
    </View>
  )
}
```

- [ ] **Step 4: Run every check**

Run: `just lint && just typecheck && just test-ts`
Expected: PASS, including `GameScreen.renders.test.tsx` and `Tools.test.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/game/components/NumberKey apps/mobile/src/game/components/Keypad
git commit -m "feat(game): disable the key of a complete number (#41)"
```

- [ ] **Step 6: Tick the acceptance criteria in issue #41 and open the PR**

PR against `develop`, title `feat(game): disable the key of a complete number (#41)`, body with `Closes #41`.

## iPhone steps for the developer

1. Start a development build with `just app` and open the game screen.
2. Place the last missing number of one digit correctly. Expect the key to grow a little, shrink back and fade to a quarter. It has no fill and no shadow.
3. Tap the faded key. Expect nothing.
4. Tap Undo. Expect the key back at full opacity with its fill. Do the same with Erase.
5. Place a wrong number as the ninth. Expect the key to stay enabled.
6. Turn on Settings > Accessibility > Motion > Reduce Motion. Complete a number. Expect only a fade.
7. Turn on VoiceOver. Focus the faded key. Expect "Enter N, all nine placed, dimmed".

## Open questions

1. **The issue says "fold animation"; the design canvas has a scale bump (`keyDone`).** Recommendation: follow the canvas, as the brief says. Change the first acceptance criterion's wording to "short animation" when you tick it.
2. **The 25 % opacity is a keyframe value, not a theme token.** It lives in `constants/keypad.constants.ts` with the other `keyDone` values, so this plan touches no theme file. Recommendation: keep it there. A theme token `opacity.done` would need `shared.tokens.ts` and `theme.types.ts`, which other plans in this wave may touch.
3. **Re-enable has no animation.** The canvas shows none. Recommendation: the key comes back at once. A short fade-in can be a later issue if the iPhone test shows a jump.
4. **No glossary row, no `jest.setup.ts` mock and no route are needed.** "Complete number" is already in the glossary. `useReducedMotion` is already mocked.
