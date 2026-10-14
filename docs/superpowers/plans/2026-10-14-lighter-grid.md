# Lighter Play Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the play grid cheaper to draw and to animate, and make a tap feel faster. All animations stay and look the same.

**Architecture:** Four changes in `apps/mobile`. A Reanimated static feature flag sends `opacity` and `transform` updates straight to the native views. A cell with notes mounts only the notes it holds. The digit moves into a `CellDigit` component, so an empty cell runs no intro or pop animation. A cell selects on touch-down, and VoiceOver selects through the `activate` action.

**Tech Stack:** Expo SDK 57, React Native 0.86, Reanimated 4.5.1, Unistyles 3.5, Jest with `@testing-library/react-native` 13.3.

**Spec:** GitHub issue [#91](https://github.com/vandemaelefelix/sudoku/issues/91) (lighter play grid). Concept: `docs/architecture/00-concepts/game-screen.md`.

## Global Constraints

- Rules in `AGENTS.md` and `apps/mobile/AGENTS.md` apply: folder layout, `@/` imports, `index.ts` re-exports only, no `../`.
- Do not edit `ios/` or `android/` (ADR-002). Native config goes in `package.json` or `app.json`.
- A cell reads no theme hook (ADR-015). Themed styles live in `<Name>.styles.ts` with `StyleSheet.create(theme => …)`.
- `tsconfig.base.json` sets `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. An optional prop that can receive `undefined` is typed `x?: T | undefined`.
- Comments and commit messages follow the Simplified Technical English rules in `AGENTS.md`.
- Commits: Conventional Commits with `(#91)`. Do not push or open the pull request until the developer asks.
- Before done: `just lint`, `just typecheck` and `just test-ts` pass.

## Review Focus

1. **Layout animations after the flag.** The Reanimated docs say: with `IOS_SYNCHRONOUSLY_UPDATE_UI_PROPS`, "an animation that starts later starts with stale values if one of those props was animated before". The app uses `entering`/`exiting` in `HomeMenu`, `Cell` (display grid), `PauseLayer`, `FinishCard`, `MistakeDots`, `CameraScreen`, `ScanFlow` and `CorrectionCell`. Each must still start and end at the correct opacity and place. Task 5 checks each on the iPhone.
2. **VoiceOver double-tap selects once.** With an `activate` action, iOS does not simulate a touch. Task 4 has a unit test for the action. Task 5 checks on the iPhone that a double-tap selects the cell and does not select twice.
3. **A digit or a note that appears after the entrance is fully visible.** A `CellDigit` or `CellNotes` that mounts after the intro reads the final `elapsed` and must show opacity 1. Task 2 tests this in `useIntroStyle`.
4. **A mistake still shakes its digit.** `MistakeShake` now wraps `CellDigit`. Task 3 tests that a cell with `markKind="mistake"` still shows its digit.
5. **A small (display) grid shows no notes and keeps its small digits.** The tests `draws no notes in a small cell` and `draws small digits at the note size` stay in `Cell.test.tsx` and must pass after Tasks 2 and 3.

---

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `apps/mobile/package.json` | Modify | Add `reanimated.staticFeatureFlags` |
| `apps/mobile/src/game/hooks/useIntroStyle/useIntroStyle.ts` | Create | The intro style of one cell's content, from `Cell` |
| `apps/mobile/src/game/hooks/useIntroStyle/useIntroStyle.test.tsx` | Create | Tests |
| `apps/mobile/src/game/hooks/useIntroStyle/index.ts` | Create | Re-export |
| `apps/mobile/src/game/components/CellNotes/CellNotes.tsx` | Create | Only the held notes, each at its fixed place |
| `apps/mobile/src/game/components/CellNotes/CellNotes.styles.ts` | Create | Note styles, from `Cell.styles.ts` |
| `apps/mobile/src/game/components/CellNotes/CellNotes.constants.ts` | Create | `NOTE_PLACES` with offsets |
| `apps/mobile/src/game/components/CellNotes/CellNotes.test.tsx` | Create | Tests |
| `apps/mobile/src/game/components/CellNotes/index.ts` | Create | Re-export |
| `apps/mobile/src/game/components/CellDigit/CellDigit.tsx` | Create | The digit with its intro and pop |
| `apps/mobile/src/game/components/CellDigit/CellDigit.styles.ts` | Create | Digit styles, from `Cell.styles.ts` |
| `apps/mobile/src/game/components/CellDigit/CellDigit.test.tsx` | Create | Tests |
| `apps/mobile/src/game/components/CellDigit/index.ts` | Create | Re-export |
| `apps/mobile/src/game/components/Cell/Cell.tsx` | Modify | Use `CellDigit` and `CellNotes`; select on press-in |
| `apps/mobile/src/game/components/Cell/Cell.styles.ts` | Modify | Remove digit and note styles |
| `apps/mobile/src/game/components/Cell/Cell.constants.ts` | Modify | Replace `NOTE_PLACES` with `ACTIVATE` |
| `apps/mobile/src/game/components/Cell/Cell.test.tsx` | Modify | Tests |
| Tests that tap a cell (9 files, see Task 4) | Modify | `press` → `pressIn` |

---

### Task 0: Branch

- [ ] **Step 1: Create the branch from develop**

```bash
cd /Users/felix/projects/sudoku
git fetch origin
git switch -c chore/91-lighter-grid origin/develop
```

---

### Task 1: Turn on synchronous UI props on iOS

**Files:**
- Modify: `apps/mobile/package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing in code. Reanimated's podspec reads `reanimated.staticFeatureFlags` from `apps/mobile/package.json` at `pod install` (`node_modules/react-native-reanimated/scripts/reanimated_utils.rb`).

- [ ] **Step 1: Add the flag**

In `apps/mobile/package.json`, add a top-level key after the `"jest"` block:

```json
  "reanimated": {
    "staticFeatureFlags": {
      "IOS_SYNCHRONOUSLY_UPDATE_UI_PROPS": true
    }
  }
```

Do not turn on `ENABLE_SHARED_ELEMENT_TRANSITIONS`. The podspec refuses both flags together.

- [ ] **Step 2: Check the format and the JS tests**

Run: `just format-check && just test-ts`
Expected: PASS. The JS side reads static flags from the native module, so no Jest test changes.

- [ ] **Step 3: Check that the pods pick up the flag**

Run:

```bash
cd apps/mobile && pnpm exec expo prebuild --platform ios --no-install && (cd ios && pod install) && grep -o "IOS_SYNCHRONOUSLY_UPDATE_UI_PROPS:true" ios/Pods/Target\ Support\ Files/RNReanimated/*.xcconfig | head -1
```

Expected: `IOS_SYNCHRONOUSLY_UPDATE_UI_PROPS:true`. `ios/` is generated and is not committed.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json
git commit -m "perf(app): send Reanimated UI props straight to the views on iOS (#91)"
```

---

### Task 2: `useIntroStyle` and `CellNotes`

**Files:**
- Create: `apps/mobile/src/game/hooks/useIntroStyle/useIntroStyle.ts`, `useIntroStyle.test.tsx`, `index.ts`
- Create: `apps/mobile/src/game/components/CellNotes/CellNotes.tsx`, `CellNotes.styles.ts`, `CellNotes.constants.ts`, `CellNotes.test.tsx`, `index.ts`
- Modify: `apps/mobile/src/game/components/Cell/Cell.tsx`, `Cell.styles.ts`, `Cell.constants.ts`, `Cell.test.tsx`

**Interfaces:**
- Consumes: `Intro` from `@/game/hooks/useGridIntro`; `introCellAlpha`, `introDuration`, `introLook` from `@/game/utils/intro.utils`; `INTRO_RISE` from `@/game/constants/intro.constants`.
- Produces:
  - `useIntroStyle(cell: number, intro: Intro | undefined)`: an animated style `{ opacity: number; transform: [{ translateY: number }] }`.
  - `CellNotes({ cell: number; notes: string; intro?: Intro | undefined })`.

- [ ] **Step 1: Write the failing `useIntroStyle` tests**

`apps/mobile/src/game/hooks/useIntroStyle/useIntroStyle.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react-native'
import type { SharedValue } from 'react-native-reanimated'
import { INTRO_RISE } from '@/game/constants/intro.constants'
import type { Intro } from '@/game/hooks/useGridIntro'
import { introDuration, introLook } from '@/game/utils/intro.utils'
import { daylight } from '@/theme/themes/daylight'
import { useIntroStyle } from './useIntroStyle'

// A fixed stand-in for a shared value. The Reanimated mock runs each animated style once, at render.
const fixed = <T,>(value: T) => ({ value, get: () => value, set: jest.fn() }) as unknown as SharedValue<T>
const introAt = (elapsed: number, reduced = false): Intro => ({
  elapsed: fixed(elapsed),
  look: introLook(daylight, reduced),
})

it('keeps the content still without an intro', () => {
  const { result } = renderHook(() => useIntroStyle(40, undefined))
  expect(result.current).toEqual({ opacity: 1, transform: [{ translateY: 0 }] })
})

it('hides and lowers the content when the intro starts', () => {
  const { result } = renderHook(() => useIntroStyle(40, introAt(0)))
  expect(result.current).toEqual({ opacity: 0, transform: [{ translateY: INTRO_RISE }] })
})

it('shows content that mounts after the intro at full opacity', () => {
  const end = introDuration(introLook(daylight, false))
  const { result } = renderHook(() => useIntroStyle(80, introAt(end)))
  expect(result.current).toEqual({ opacity: 1, transform: [{ translateY: 0 }] })
})

it('only fades with Reduce Motion', () => {
  const { result } = renderHook(() => useIntroStyle(40, introAt(0, true)))
  expect(result.current).toEqual({ opacity: 0, transform: [{ translateY: 0 }] })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd apps/mobile && pnpm jest src/game/hooks/useIntroStyle`
Expected: FAIL with "Cannot find module './useIntroStyle'".

- [ ] **Step 3: Write `useIntroStyle`**

`apps/mobile/src/game/hooks/useIntroStyle/useIntroStyle.ts` (the body moves from `Cell.tsx`):

```ts
import { useAnimatedStyle } from 'react-native-reanimated'
import { INTRO_RISE } from '@/game/constants/intro.constants'
import type { Intro } from '@/game/hooks/useGridIntro'
import { columnOf, rowOf } from '@/game/utils/grid.utils'
import { introCellAlpha } from '@/game/utils/intro.utils'

/** The entrance of the content of one cell. Without an intro the content stays still. */
export function useIntroStyle(cell: number, intro: Intro | undefined) {
  const diagonal = rowOf(cell) + columnOf(cell)
  return useAnimatedStyle(() => {
    const alpha = intro ? introCellAlpha(intro.elapsed.get(), diagonal, intro.look) : 1
    // With Reduce Motion the digits only fade in.
    const rise = intro?.look.reduced ? 0 : (1 - alpha) * INTRO_RISE
    return { opacity: alpha, transform: [{ translateY: rise }] }
  })
}
```

`apps/mobile/src/game/hooks/useIntroStyle/index.ts`:

```ts
export { useIntroStyle } from './useIntroStyle'
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd apps/mobile && pnpm jest src/game/hooks/useIntroStyle`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing `CellNotes` tests**

`apps/mobile/src/game/components/CellNotes/CellNotes.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { CellNotes } from './CellNotes'

it('draws only the notes the cell holds', () => {
  render(<CellNotes cell={2} notes="39" />)
  expect(screen.getAllByTestId(/^note-slot-/).map((slot) => slot.props.testID)).toEqual(['note-slot-3', 'note-slot-9'])
})

it('keeps each note at its place in a 3 × 3 set', () => {
  render(<CellNotes cell={2} notes="159" />)
  const placeOf = (digit: string) => StyleSheet.flatten(screen.getByTestId(`note-slot-${digit}`).props.style)
  expect(placeOf('1')).toMatchObject({ position: 'absolute', top: '0%', left: '0%', width: '33.33%' })
  expect(placeOf('5')).toMatchObject({ top: '33.33%', left: '33.33%' })
  expect(placeOf('9')).toMatchObject({ top: '66.67%', left: '66.67%', height: '33.33%' })
})

it('draws the notes at 11 pt or more', () => {
  render(<CellNotes cell={2} notes="3" />)
  expect(StyleSheet.flatten(screen.getByText('3').props.style).fontSize).toBeGreaterThanOrEqual(11)
})
```

- [ ] **Step 6: Run the tests to see them fail**

Run: `cd apps/mobile && pnpm jest src/game/components/CellNotes`
Expected: FAIL with "Cannot find module './CellNotes'".

- [ ] **Step 7: Write `CellNotes`**

`apps/mobile/src/game/components/CellNotes/CellNotes.constants.ts`:

```ts
/** The note digits with the place of each in a 3 × 3 set: 1 2 3 on top, 7 8 9 at the bottom. */
export const NOTE_PLACES = [
  { digit: '1', top: '0%', left: '0%' },
  { digit: '2', top: '0%', left: '33.33%' },
  { digit: '3', top: '0%', left: '66.67%' },
  { digit: '4', top: '33.33%', left: '0%' },
  { digit: '5', top: '33.33%', left: '33.33%' },
  { digit: '6', top: '33.33%', left: '66.67%' },
  { digit: '7', top: '66.67%', left: '0%' },
  { digit: '8', top: '66.67%', left: '33.33%' },
  { digit: '9', top: '66.67%', left: '66.67%' },
] as const
```

`apps/mobile/src/game/components/CellNotes/CellNotes.styles.ts` (the `notes` and `note` styles move from `Cell.styles.ts`; `noteSlot` becomes absolute):

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  notes: {
    position: 'absolute',
    top: theme.size.noteInset,
    right: theme.size.noteInset,
    bottom: theme.size.noteInset,
    left: theme.size.noteInset,
  },
  noteSlot: { position: 'absolute', width: '33.33%', height: '33.33%', alignItems: 'center', justifyContent: 'center' },
  note: { ...roleFont(theme.type.note), fontSize: theme.type.note.scale, color: theme.components.cell.note },
}))
```

`apps/mobile/src/game/components/CellNotes/CellNotes.tsx`:

```tsx
import { Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import type { Intro } from '@/game/hooks/useGridIntro'
import { useIntroStyle } from '@/game/hooks/useIntroStyle'
import { NOTE_PLACES } from './CellNotes.constants'
import { styles } from './CellNotes.styles'

type CellNotesProps = {
  cell: number
  /** The note digits in order, for example "35". */
  notes: string
  intro?: Intro | undefined
}

/** Each note sits at a fixed place, so an absent note needs no empty view to keep the others in place. */
export function CellNotes({ cell, notes, intro }: CellNotesProps) {
  const introStyle = useIntroStyle(cell, intro)
  return (
    <Animated.View style={[styles.notes, introStyle]}>
      {NOTE_PLACES.filter(({ digit }) => notes.includes(digit)).map(({ digit, top, left }) => (
        <View key={digit} testID={`note-slot-${digit}`} style={[styles.noteSlot, { top, left }]}>
          <Text allowFontScaling={false} style={styles.note}>
            {digit}
          </Text>
        </View>
      ))}
    </Animated.View>
  )
}
```

`apps/mobile/src/game/components/CellNotes/index.ts`:

```ts
export { CellNotes } from './CellNotes'
```

- [ ] **Step 8: Run the `CellNotes` tests to see them pass**

Run: `cd apps/mobile && pnpm jest src/game/components/CellNotes`
Expected: PASS, 3 tests.

- [ ] **Step 9: Use `CellNotes` and `useIntroStyle` in `Cell`**

In `apps/mobile/src/game/components/Cell/Cell.tsx`:

1. Replace the block that computes `diagonal` and `introStyle` with one line:

```tsx
  const introStyle = useIntroStyle(cell, intro)
```

2. Replace the notes block in `content` with:

```tsx
      {digit === 0 && notes !== '' && digitSize === 'full' && <CellNotes cell={cell} notes={notes} intro={intro} />}
```

3. Fix the imports. Remove `Text`, `View` stays (the display cell uses it). Remove `INTRO_RISE`, `columnOf`, `rowOf`, `introCellAlpha` and `NOTE_PLACES`. Add:

```tsx
import { CellNotes } from '@/game/components/CellNotes'
import { useIntroStyle } from '@/game/hooks/useIntroStyle'
```

In `Cell.styles.ts`, delete `notes`, `noteSlot` and `note`.

`Cell.constants.ts` now has no user. Delete the file; Task 4 creates it again with `ACTIVATE`.

- [ ] **Step 10: Update the `Cell` note test**

In `Cell.test.tsx`, replace the test `draws the notes at 11 pt or more, each in its own place of a 3 × 3 set` with:

```tsx
it('draws only the notes the cell holds', () => {
  render(<Cell {...base} notes="39" onSelect={jest.fn()} />)
  expect(screen.getAllByTestId(/^note-slot-/)).toHaveLength(2)
})
```

- [ ] **Step 11: Run the game tests**

Run: `cd apps/mobile && pnpm jest src/game`
Expected: PASS. `draws no notes in a small cell` still passes.

- [ ] **Step 12: Commit**

```bash
git add apps/mobile/src/game
git commit -m "perf(app): draw only the notes a cell holds (#91)"
```

---

### Task 3: `CellDigit`

**Files:**
- Create: `apps/mobile/src/game/components/CellDigit/CellDigit.tsx`, `CellDigit.styles.ts`, `CellDigit.test.tsx`, `index.ts`
- Modify: `apps/mobile/src/game/components/Cell/Cell.tsx`, `Cell.styles.ts`, `Cell.test.tsx`

**Interfaces:**
- Consumes: `useIntroStyle(cell, intro)` from Task 2; `Pulse` from `@/game/hooks/usePulse`; `popScale` from `@/game/utils/pulse.utils`; `DigitStyle`, `DigitSize` from `@/game/utils/cell.utils`.
- Produces: `CellDigit({ cell: number; digit: number; digitStyle: DigitStyle; digitSize: DigitSize; pulse?: Pulse | undefined; intro?: Intro | undefined })`.

- [ ] **Step 1: Write the failing `CellDigit` tests**

`apps/mobile/src/game/components/CellDigit/CellDigit.test.tsx` (the pop tests move here from `Cell.test.tsx`; `Cell.test.tsx` keeps its own copies, which now go through `CellDigit`):

```tsx
import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { NO_PULSE, POP_PEAK_AT } from '@/game/constants/pulse.constants'
import type { Pulse } from '@/game/hooks/usePulse'
import { pulseLook } from '@/game/utils/pulse.utils'
import { daylight } from '@/theme/themes/daylight'
import { midnight } from '@/theme/themes/midnight'
import { CellDigit } from './CellDigit'

// Midnight, not the Daylight of the Unistyles mock: the strengths must come from the pulse, not from the styles.
const look = pulseLook(midnight)
const fixed = <T,>(value: T) => ({ value, get: () => value, set: jest.fn() }) as unknown as SharedValue<T>
const inPulse = Array.from({ length: 81 }, (_, cell) => (cell === 2 ? 0 : NO_PULSE))
const pulseAt = (elapsed: number): Pulse => ({ delays: fixed(inPulse), elapsed: fixed(elapsed), look: fixed(look) })

it('pops the digit to the peak scale of the theme', () => {
  render(<CellDigit cell={2} digit={4} digitStyle="entry" digitSize="full" pulse={pulseAt(look.popMs * POP_PEAK_AT)} />)
  expect(StyleSheet.flatten(screen.getByText('4').props.style).transform).toEqual([
    { scale: expect.closeTo(midnight.components.pulse.popScale) },
  ])
})

it('stays at scale 1 without a pulse', () => {
  render(<CellDigit cell={2} digit={4} digitStyle="entry" digitSize="full" />)
  expect(StyleSheet.flatten(screen.getByText('4').props.style).transform).toEqual([{ scale: 1 }])
})

it('draws a given in the given style, and a small digit at the note size', () => {
  render(<CellDigit cell={2} digit={5} digitStyle="given" digitSize="small" />)
  expect(StyleSheet.flatten(screen.getByText('5').props.style)).toMatchObject({
    fontSize: daylight.type.note.scale,
    color: daylight.components.cell.given,
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd apps/mobile && pnpm jest src/game/components/CellDigit`
Expected: FAIL with "Cannot find module './CellDigit'".

- [ ] **Step 3: Write `CellDigit`**

`apps/mobile/src/game/components/CellDigit/CellDigit.styles.ts` (the six digit styles move from `Cell.styles.ts`):

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

// One key per digit state, not Unistyles variants: the Jest mock of Unistyles drops variants.
export const styles = StyleSheet.create((theme) => ({
  given: { ...roleFont(theme.type.given), fontSize: theme.type.given.scale, color: theme.components.cell.given },
  entry: { ...roleFont(theme.type.entry), fontSize: theme.type.entry.scale, color: theme.components.cell.entry },
  wrong: { ...roleFont(theme.type.entry), fontSize: theme.type.entry.scale, color: theme.components.cell.conflict },
  // A small cell uses the note size for its digits, as in the canvas preview.
  givenSmall: { ...roleFont(theme.type.given), fontSize: theme.type.note.scale, color: theme.components.cell.given },
  entrySmall: { ...roleFont(theme.type.entry), fontSize: theme.type.note.scale, color: theme.components.cell.entry },
  wrongSmall: { ...roleFont(theme.type.entry), fontSize: theme.type.note.scale, color: theme.components.cell.conflict },
}))
```

`apps/mobile/src/game/components/CellDigit/CellDigit.tsx`:

```tsx
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { NO_PULSE } from '@/game/constants/pulse.constants'
import type { Intro } from '@/game/hooks/useGridIntro'
import { useIntroStyle } from '@/game/hooks/useIntroStyle'
import type { Pulse } from '@/game/hooks/usePulse'
import type { DigitSize, DigitStyle } from '@/game/utils/cell.utils'
import { popScale } from '@/game/utils/pulse.utils'
import { styles } from './CellDigit.styles'

type CellDigitProps = {
  cell: number
  /** 1 to 9. */
  digit: number
  digitStyle: DigitStyle
  digitSize: DigitSize
  pulse?: Pulse | undefined
  intro?: Intro | undefined
}

/** Its own component, so that an empty cell mounts no intro and no pop animation. */
export function CellDigit({ cell, digit, digitStyle, digitSize, pulse, intro }: CellDigitProps) {
  const introStyle = useIntroStyle(cell, intro)
  const { delays, elapsed, look } = pulse ?? {}
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: look ? popScale(elapsed?.get() ?? 0, delays?.get()[cell] ?? NO_PULSE, look.get()) : 1 }],
  }))
  const digitKey = digitSize === 'small' ? (`${digitStyle}Small` as const) : digitStyle
  return (
    <Animated.View style={introStyle}>
      <Animated.Text allowFontScaling={false} style={[styles[digitKey], popStyle]}>
        {digit}
      </Animated.Text>
    </Animated.View>
  )
}
```

`apps/mobile/src/game/components/CellDigit/index.ts`:

```ts
export { CellDigit } from './CellDigit'
```

- [ ] **Step 4: Run the `CellDigit` tests to see them pass**

Run: `cd apps/mobile && pnpm jest src/game/components/CellDigit`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the failing `Cell` tests for the animation count and the shake**

Add to `Cell.test.tsx`. Add `afterEach(() => jest.restoreAllMocks())` after the `base` constant, and this import and constant at the top:

```tsx
const reanimated = jest.requireMock<typeof import('react-native-reanimated')>('react-native-reanimated')
```

```tsx
it('runs only the wave in an empty cell', () => {
  const animated = jest.spyOn(reanimated, 'useAnimatedStyle')
  render(<Cell {...base} onSelect={jest.fn()} />)
  expect(animated).toHaveBeenCalledTimes(1)
})

it('runs the wave, the intro and the pop in a cell with a digit', () => {
  const animated = jest.spyOn(reanimated, 'useAnimatedStyle')
  render(<Cell {...base} digit={4} onSelect={jest.fn()} />)
  expect(animated).toHaveBeenCalledTimes(3)
})

it('still shows the digit of a mistake while it shakes', () => {
  render(<Cell {...base} digit={6} digitStyle="wrong" markKind="mistake" markId={1} onSelect={jest.fn()} />)
  expect(screen.getByText('6')).toBeTruthy()
})
```

- [ ] **Step 6: Run the tests to see the count test fail**

Run: `cd apps/mobile && pnpm jest src/game/components/Cell/Cell.test.tsx -t "runs only the wave"`
Expected: FAIL: expected 1 call, received 3.

- [ ] **Step 7: Use `CellDigit` in `Cell`**

In `apps/mobile/src/game/components/Cell/Cell.tsx`:

1. Delete `introStyle`, `popStyle` and `digitKey`.
2. Replace `digitView` with:

```tsx
  const digitView = digit !== 0 && (
    <CellDigit cell={cell} digit={digit} digitStyle={digitStyle} digitSize={digitSize} pulse={pulse} intro={intro} />
  )
```

3. Fix the imports. Remove `popScale`, `useIntroStyle` and `Animated.Text` usage. Keep `waveOpacity`, `NO_PULSE`, `useAnimatedStyle`. Add:

```tsx
import { CellDigit } from '@/game/components/CellDigit'
```

4. Update the doc comment of `Cell`: replace "So memo skips the cells a move does not change, and a pulse or the entrance renders no cell." with "So memo skips the cells a move does not change, and a pulse or the entrance renders no cell. The digit and the notes run their own entrance."

In `Cell.styles.ts`, delete `given`, `entry`, `wrong`, `givenSmall`, `entrySmall`, `wrongSmall` and the comment above the `*Small` keys. Keep the top comment "One key per cell state…": the fill keys still use it.

- [ ] **Step 8: Run the game tests**

Run: `cd apps/mobile && pnpm jest src/game test`
Expected: PASS, including `Grid.renders.test.tsx` and `GameScreen.renders.test.tsx`.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/game
git commit -m "perf(app): give the digit its own component so an empty cell runs no intro or pop (#91)"
```

---

### Task 4: Select on touch-down

**Files:**
- Create: `apps/mobile/src/game/components/Cell/Cell.constants.ts`
- Modify: `apps/mobile/src/game/components/Cell/Cell.tsx`, `Cell.test.tsx`
- Modify (tap `press` → `pressIn`): `src/game/screens/GameScreen/GameScreen.renders.test.tsx`, `src/game/screens/GameScreen/GameScreen.test.tsx`, `src/game/components/Tools/Tools.test.tsx`, `src/game/components/Keypad/Keypad.test.tsx`, `src/game/components/Grid/Grid.test.tsx`, `test/routes.test.tsx`, `test/scannedGame.test.tsx` (all under `apps/mobile/`)

**Interfaces:**
- Consumes: `Cell` from Task 3.
- Produces: `ACTIVATE: readonly AccessibilityActionInfo[]` in `Cell.constants.ts`. A cell calls `onSelect(cell)` on `pressIn` and on the `activate` accessibility action. It no longer calls it on `press`.

- [ ] **Step 1: Write the failing `Cell` tests**

In `Cell.test.tsx`, replace `selects its cell when tapped` with:

```tsx
it('selects its cell when the finger touches down', () => {
  const onSelect = jest.fn()
  render(<Cell {...base} onSelect={onSelect} />)
  fireEvent(screen.getByTestId('cell-2'), 'pressIn')
  expect(onSelect).toHaveBeenCalledWith(2)
})

it('selects its cell once when VoiceOver activates it', () => {
  const onSelect = jest.fn()
  render(<Cell {...base} onSelect={onSelect} />)
  fireEvent(screen.getByTestId('cell-2'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } })
  expect(onSelect).toHaveBeenCalledTimes(1)
  expect(onSelect).toHaveBeenCalledWith(2)
})
```

In `lets a tap through the wave` and `shows the board without a button when it is not interactive`, replace `fireEvent.press(screen.getByTestId('cell-2'))` with `fireEvent(screen.getByTestId('cell-2'), 'pressIn')`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd apps/mobile && pnpm jest src/game/components/Cell`
Expected: FAIL in `selects its cell when the finger touches down` and `selects its cell once when VoiceOver activates it`.

- [ ] **Step 3: Write the press-in and the activate action**

`apps/mobile/src/game/components/Cell/Cell.constants.ts`:

```ts
import type { AccessibilityActionInfo } from 'react-native'

export const ACTIVATE: readonly AccessibilityActionInfo[] = [{ name: 'activate' }]
```

In `Cell.tsx`, import it with `import { ACTIVATE } from './Cell.constants'`. Replace the `onPress` line of the `Pressable` with:

```tsx
      // Select on touch-down: the highlight follows the finger at once. With an activate action,
      // VoiceOver sends that action instead of a simulated touch, so a double-tap selects once.
      accessibilityActions={ACTIVATE}
      onAccessibilityAction={() => onSelect(cell)}
      onPressIn={() => onSelect(cell)}
```

- [ ] **Step 4: Run the `Cell` tests to see them pass**

Run: `cd apps/mobile && pnpm jest src/game/components/Cell`
Expected: PASS.

- [ ] **Step 5: Change the cell taps in the other tests**

Run from `apps/mobile/`:

```bash
sed -i '' -E "s/fireEvent\.press\((screen\.getByTestId\([\`']cell-[^)]*\))\)/fireEvent(\1, 'pressIn')/g" \
  src/game/screens/GameScreen/GameScreen.renders.test.tsx \
  src/game/screens/GameScreen/GameScreen.test.tsx \
  src/game/components/Tools/Tools.test.tsx \
  src/game/components/Keypad/Keypad.test.tsx \
  src/game/components/Grid/Grid.test.tsx \
  test/routes.test.tsx \
  test/scannedGame.test.tsx
grep -rnE "fireEvent\.press\(screen\.getByTestId\([\`']cell-" src test
```

Expected: the `grep` prints nothing.

- [ ] **Step 6: Run every app test, the lint and the typecheck**

Run: `cd /Users/felix/projects/sudoku && just test-ts && just lint && just typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src apps/mobile/test
git commit -m "perf(app): select a cell on touch-down (#91)"
```

---

### Task 5: Check on the iPhone in a Release build

**Files:** none. This task ticks the acceptance criteria of #91.

- [ ] **Step 1: Build and install a Release build**

Run: `cd apps/mobile && pnpm exec expo run:ios --configuration Release --device`
Expected: the app starts on the iPhone without Metro.

- [ ] **Step 2: Check the grid**

On the iPhone, check each line. Note the result of each for the pull request.

1. Tap cells quickly across the grid. The highlight follows each touch at once, with no stutter.
2. Complete a row. The wave and the pop look as before, with no stutter.
3. Open a game. The digits sweep in from the top left during the route slide, with no stutter.
4. Use a hint, an undo and a wrong digit. The flash and the shake look as before.
5. Add notes 1, 5 and 9 to a cell. They sit at top left, centre and bottom right.
6. Turn on VoiceOver. Double-tap a cell. It selects the cell once. Turn off VoiceOver.

- [ ] **Step 3: Check the layout animations (Review Focus 1)**

Check each screen once. Each fade or slide starts and ends at the correct opacity and place:

1. Home menu.
2. Settings: change an assist. The preview grid crossfades its fills.
3. Pause and resume a game.
4. Finish a game: the finish card. Make mistakes: the mistake dots.
5. Scan a puzzle: the camera screen, the scan flow and the correction cells.

If a check fails, stop. Report it to the developer before any further change. The flag can go back off in one line.

- [ ] **Step 4: Tick the acceptance criteria**

Tick each met criterion in the body of [#91](https://github.com/vandemaelefelix/sudoku/issues/91) with `gh issue edit 91 --body-file <file>`.

- [ ] **Step 5: Request the review**

Per `AGENTS.md`, a second agent reviews the branch without this session's context before the merge. Open the pull request against `develop` only when the developer asks. Its body says `Closes #91` and `Part of #34`.
