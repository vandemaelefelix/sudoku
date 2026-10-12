# Assists and the Settings screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The player turns each of the four assists on or off on a new Settings screen, sees the effect at once on a small preview grid and on the game grid, and picks the theme (System, Daylight or Midnight). Both choices survive a restart.

**Architecture:** A small assists store (`createAssistsStore`, plain TypeScript in `src/game/utils/assists.utils.ts`) reads the saved assists once through `SettingsRepository`, keeps them in memory, tells its listeners about a change and saves the change. `useAssists()` reads the store with React `useSyncExternalStore`, so every mounted reader (the game grid through `useCellViews`, the Settings screen) changes at once. The Settings screen is a new feature folder under `src/settings/` beside the existing `SettingsRepository`. It composes `AssistPreview`, four `AssistRow`s (native `Switch` themed with `withUnistyles`) and a `ThemePicker` (a segmented control). The theme reuses `readThemePreference` and `saveThemePreference` from `src/theme/preference.ts` (#50) through a `useThemePreference` hook.

**Preview through the real grid:** `AssistPreview` renders the real game `Grid` and `Cell` (no copy of the grid). It wraps them in a new `DisplayGameProvider`: a read-only game context with a fixed preview board, no-op actions, no clock and no haptics. `Grid` reads the live assists through `useCellViews`, so the preview follows each switch with no extra prop. `Grid` and `Cell` get two optional props, `interactive` and `digitSize`, so a grid can show a board without taps, focus or VoiceOver stops. The finish card of #43 can reuse the same mode. This work is Task 6. It runs after #42 (pulses) merges, because #42 owns `Grid/*` and `Cell/*` until then.

**Tech Stack:** Expo 57, React Native 0.86.3 (`Switch`, `ScrollView`, `Pressable`), React 19 (`useSyncExternalStore`), react-native-unistyles 3.5.2 (`StyleSheet.create`, `withUnistyles`), expo-sqlite key-value store behind `SettingsRepository` (ADR-012), Jest with jest-expo and Testing Library 13.

**Spec:** Issue #38 (assists and the settings screen). Design: "Settings" and "Settings · Midnight" on https://claude.ai/artifact/U23JHiGA1Pq3HJX6oMiBF4 (`Settings.dc.html`). Concept: `docs/architecture/00-concepts/game-screen.md`, sections Assists and Settings. ADR-012 (settings through `SettingsRepository`), ADR-015 (themes, token tiers, theme preference).

---


## Coordinator rulings (2026-10-12, binding; they override the tasks below where they differ)

- #38 does not edit the theme files. #42 (pulses) owns them this wave. If #38 needs a token, ask the coordinator.
- The Settings route: #51 adds a one-line route. If #38 merges after #51, #38's last task wires its screen into that route.
- Merge order: #51 merges first. Your last task rebases on origin/develop after #51 merges and adapts to #51's `GameStart` type and routes. Until then, work on origin/develop as it is.
## Global Constraints

- Branch `feature/38-assists-settings` from `origin/develop`. PR against `develop`, body with `Closes #38`.
- Conventional Commits, each with `(#38)`.
- Edit only the files in "Files owned". Use `/usr/bin/git` if the rtk hook refuses `git`.
- Obey root `AGENTS.md` and `apps/mobile/AGENTS.md`: STE light prose and comments, the comment rules (no issue numbers in code comments, no TODO), the folder layout, the import rules (`@/` alias, folders through `index.ts`, no `../`), the style rules (themed styles only in `<Name>.styles.ts`, no colour literal outside `src/theme/`, no spread of a Unistyles style in a component).
- A component token is read only by its own component: `components.switch` by `AssistRow`, `components.segmented` by `ThemePicker`. The preview adds no token: the real `Cell` and `Grid` read their own tokens. So this plan changes no theme file.
- Task 6 starts only after #42 is on `origin/develop`. Rebase first. Until then, Tasks 1 to 5 do not touch `Grid/*` or `Cell/*`.
- Every control meets the 44 pt touch target: the back button, each switch row, each theme segment. The canvas draws the segments 40 pt high; this plan uses 44 pt.
- No new dependency. No change to `jest.setup.ts`, `package.json`, the glossary, `00-DECISIONS.md` or `09-architecture-decisions.md`. `App.tsx` and the route file of #51 change only in Task 8, by the one Settings route.
- Settings keys: `game.assists` (JSON object of four booleans), `theme.preference` (exists, #50).
- Work test-first. Run one test file with `pnpm --filter mobile exec jest <path>`. Before the PR, run `just lint`, `just typecheck`, `just test-ts`.

## Review Focus

1. **The game follows a switch at once.** A switch change must reach a mounted game grid without a new game and without a restart. Test: Task 2, `useCellViews.test.tsx`, "follows a switch at once, without a new game".
2. **A broken or unreadable saved value.** Bad JSON, a wrong shape or a store that throws gives every assist on, and the app still starts. Tests: Task 1, `parseAssists` "falls back to the defaults" and `createAssistsStore` "gives the defaults when the store throws".
3. **A failed save.** The choice stays for this session and the failure goes to the dev log. Tests: Task 2 "keeps the choice for this session when the save fails", Task 4 the same for the theme.
4. **The render rule of the game screen.** A theme switch must not render the grid again. `useAssists` reads no theme, and `useSyncExternalStore` returns the same object until a switch changes. Check: `GameScreen.renders.test.tsx` still passes unchanged; Task 1 "keeps the same object until a change".
5. **The preview tells the truth.** It is the real `Grid` and `Cell`, fed by the same `useCellViews`, so it cannot drift from the game. Test: Task 6, `AssistPreview.test.tsx`.
6. **A display grid cannot act.** With `interactive={false}`, no cell is a button, a tap changes nothing, VoiceOver skips the grid, and the default (`interactive` true) keeps the game grid exactly as #42 left it. Tests: Task 6, `Cell.test.tsx` and `Grid.test.tsx` additions; all #37 and #42 tests pass unchanged.

## Files owned

All paths are under `apps/mobile/` unless stated.

| File | Change | Responsibility |
| --- | --- | --- |
| `src/game/constants/assists.constants.ts` | Modify | `Assists`, `AssistName`, `DEFAULT_ASSISTS`, `ASSISTS_KEY` |
| `src/game/utils/assists.utils.ts` (+ `.test.ts`) | Create | `parseAssists`, `readAssists`, `createAssistsStore` |
| `src/game/hooks/useAssists/useAssists.ts`, `index.ts`, `useAssists.test.tsx` | Modify, create test | The live assists and `setAssist` |
| `src/game/hooks/useCellViews/useCellViews.ts`, `useCellViews.test.tsx` | Modify, create test | Reads `assists` from the new `useAssists` shape |
| `src/game/utils/cell.utils.ts` | Modify (Task 6) | Adds the type `DigitSize = 'full' \| 'small'` |
| `src/game/components/Grid/Grid.tsx`, `Grid.test.tsx` | Modify (Task 6, after #42) | Optional props `interactive` and `digitSize` |
| `src/game/components/Cell/Cell.tsx`, `Cell.styles.ts`, `Cell.test.tsx` | Modify (Task 6, after #42) | Optional props `interactive` and `digitSize`, small digit styles |
| `src/game/components/DisplayGameProvider/*` | Create (Task 6) | A read-only game context for a grid that only shows a board |
| `src/settings/constants/assistPreview.constants.ts` | Create (Task 6) | `PREVIEW_ENTRIES`, `PREVIEW_SELECTED` |
| `src/settings/utils/assistPreview.utils.ts` (+ `.test.ts`) | Create (Task 6) | `previewBoard()` |
| `src/settings/components/AssistPreview/*` | Create (Task 6) | The real grid at 180 pt in a `DisplayGameProvider` |
| `src/settings/components/AssistRow/*` | Create | Label, description and themed switch |
| `src/settings/components/ThemePicker/*` | Create | System, Daylight, Midnight segmented control |
| `src/settings/hooks/useThemePreference/*` | Create | The saved theme preference and `choose` |
| `src/settings/screens/SettingsScreen/*` | Create | Composes the screen |

Not touched, read only: `src/settings/SettingsRepository.ts`, `src/settings/memorySettings.ts`, `src/theme/preference.ts`, every theme file, `src/game/components/GameProvider`, `src/game/components/Icon`, `src/game/components/ThemeStatusBar`. `Grid/*` and `Cell/*` belong to #42 until it merges; #38 changes them only in Task 6. #44 (accessibility) takes `Cell/*` after this wave and keeps the two new props.

---

## Task 1: Saved assists and the assists store

**Files:**
- Modify: `src/game/constants/assists.constants.ts`
- Create: `src/game/utils/assists.utils.ts`, `src/game/utils/assists.utils.test.ts`

- [ ] **Step 1: Extend the constants**

`src/game/constants/assists.constants.ts`:

```ts
/** The shades that help the player read the grid. The game-screen concept describes each one. */
export type Assists = {
  rowColumn: boolean
  box: boolean
  selectedCell: boolean
  sameNumbers: boolean
}

export type AssistName = keyof Assists

export const DEFAULT_ASSISTS: Assists = { rowColumn: true, box: true, selectedCell: true, sameNumbers: true }

/** The SettingsRepository key of the assists. The value is the Assists object as JSON (ADR-012). */
export const ASSISTS_KEY = 'game.assists'
```

- [ ] **Step 2: Write the failing test**

`src/game/utils/assists.utils.test.ts`:

```ts
import { ASSISTS_KEY, DEFAULT_ASSISTS } from '@/game/constants/assists.constants'
import { createMemorySettings } from '@/settings/memorySettings'
import { createAssistsStore, parseAssists } from './assists.utils'

const saved = (value: object) => createMemorySettings({ [ASSISTS_KEY]: JSON.stringify(value) })

describe('parseAssists', () => {
  it('gives every assist on when nothing is saved', () => {
    expect(parseAssists(null)).toEqual(DEFAULT_ASSISTS)
  })

  it('keeps the saved switches', () => {
    const value = { rowColumn: false, box: true, selectedCell: false, sameNumbers: true }
    expect(parseAssists(JSON.stringify(value))).toEqual(value)
  })

  it('turns on an assist that the saved value does not hold', () => {
    expect(parseAssists(JSON.stringify({ box: false }))).toEqual({ ...DEFAULT_ASSISTS, box: false })
  })

  it.each(['', 'not json', '[]', 'null', '42', JSON.stringify({ box: 'no' })])(
    'falls back to the defaults for %p',
    (value) => {
      expect(parseAssists(value)).toEqual(DEFAULT_ASSISTS)
    },
  )
})

describe('createAssistsStore', () => {
  it('reads the saved assists on the first get, and only once', () => {
    const settings = saved({ ...DEFAULT_ASSISTS, box: false })
    const getSync = jest.spyOn(settings, 'getSync')
    const store = createAssistsStore(settings)
    expect(getSync).not.toHaveBeenCalled()
    expect(store.get().box).toBe(false)
    store.get()
    expect(getSync).toHaveBeenCalledTimes(1)
  })

  it('keeps the same object until a change, so React sees a stable snapshot', () => {
    const store = createAssistsStore(createMemorySettings())
    expect(store.get()).toBe(store.get())
  })

  it('changes one assist, tells every listener and saves the result', async () => {
    const settings = createMemorySettings()
    const store = createAssistsStore(settings)
    const first = jest.fn()
    const second = jest.fn()
    store.subscribe(first)
    store.subscribe(second)
    await store.set('sameNumbers', false)
    expect(store.get()).toEqual({ ...DEFAULT_ASSISTS, sameNumbers: false })
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(await settings.get(ASSISTS_KEY)).toBe(JSON.stringify({ ...DEFAULT_ASSISTS, sameNumbers: false }))
  })

  it('does nothing when the assist already has the value', async () => {
    const settings = createMemorySettings()
    const save = jest.spyOn(settings, 'set')
    const store = createAssistsStore(settings)
    const before = store.get()
    const listener = jest.fn()
    store.subscribe(listener)
    await store.set('box', true)
    expect(store.get()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it('stops telling a listener after it unsubscribes', async () => {
    const store = createAssistsStore(createMemorySettings())
    const listener = jest.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    await store.set('box', false)
    expect(listener).not.toHaveBeenCalled()
  })

  it('gives the defaults when the store throws, so the game still starts', () => {
    const settings = createMemorySettings()
    settings.getSync = () => {
      throw new Error('disk')
    }
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    expect(createAssistsStore(settings).get()).toEqual(DEFAULT_ASSISTS)
    expect(log).toHaveBeenCalledWith('[assists] saved assists unreadable: disk')
    log.mockRestore()
  })
})
```

- [ ] **Step 3: Run it and see it fail**

Run: `pnpm --filter mobile exec jest src/game/utils/assists.utils.test.ts`
Expected: FAIL, `Cannot find module './assists.utils'`.

- [ ] **Step 4: Write the store**

`src/game/utils/assists.utils.ts`:

```ts
import { ASSISTS_KEY, DEFAULT_ASSISTS, type AssistName, type Assists } from '@/game/constants/assists.constants'
import type { SettingsRepository } from '@/settings/SettingsRepository'
import { devLog, errorMessage } from '@/utils/log.utils'

export type AssistsStore = {
  /** The same object until a change: useSyncExternalStore compares snapshots by identity. */
  get(): Assists
  subscribe(listener: () => void): () => void
  /** Changes the value in memory and tells the listeners first. Then it saves. A failed save rejects. */
  set(name: AssistName, on: boolean): Promise<void>
}

/** A missing or broken assist is on: an assist added in a later version starts on. */
export function parseAssists(value: string | null): Assists {
  if (value === null) return DEFAULT_ASSISTS
  let saved: unknown
  try {
    saved = JSON.parse(value)
  } catch {
    return DEFAULT_ASSISTS
  }
  if (typeof saved !== 'object' || saved === null) return DEFAULT_ASSISTS
  const record = saved as Record<string, unknown>
  const pick = (name: AssistName): boolean => {
    const on = record[name]
    return typeof on === 'boolean' ? on : DEFAULT_ASSISTS[name]
  }
  return { rowColumn: pick('rowColumn'), box: pick('box'), selectedCell: pick('selectedCell'), sameNumbers: pick('sameNumbers') }
}

/** Synchronous, so the first frame of the grid already has the saved shades. A store that throws gives the defaults. */
export function readAssists(settings: SettingsRepository): Assists {
  try {
    return parseAssists(settings.getSync(ASSISTS_KEY))
  } catch (error) {
    devLog('assists', `saved assists unreadable: ${errorMessage(error)}`)
    return DEFAULT_ASSISTS
  }
}

export function createAssistsStore(settings: SettingsRepository): AssistsStore {
  let current: Assists | null = null
  const listeners = new Set<() => void>()
  const get = (): Assists => {
    current ??= readAssists(settings)
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
    async set(name, on) {
      const before = get()
      if (before[name] === on) return
      const next = { ...before, [name]: on }
      current = next
      for (const listener of listeners) listener()
      await settings.set(ASSISTS_KEY, JSON.stringify(next))
    },
  }
}
```

- [ ] **Step 5: Run the test and see it pass**

Run: `pnpm --filter mobile exec jest src/game/utils/assists.utils.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add apps/mobile/src/game/constants/assists.constants.ts apps/mobile/src/game/utils/assists.utils.ts apps/mobile/src/game/utils/assists.utils.test.ts
/usr/bin/git commit -m "feat(game): save the assists through SettingsRepository (#38)"
```

---

## Task 2: Live assists in the game

**Files:**
- Modify: `src/game/hooks/useAssists/useAssists.ts`, `src/game/hooks/useCellViews/useCellViews.ts`
- Create: `src/game/hooks/useAssists/useAssists.test.tsx`, `src/game/hooks/useCellViews/useCellViews.test.tsx`

`useAssists` changes its return shape from `Assists` to `{ assists, setAssist }`. The only caller on develop is `useCellViews`, which this plan owns. `index.ts` stays `export { useAssists } from './useAssists'`.

- [ ] **Step 1: Write the failing hook tests**

`src/game/hooks/useAssists/useAssists.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react-native'
import Storage from 'expo-sqlite/kv-store'
import { ASSISTS_KEY, DEFAULT_ASSISTS, type AssistName } from '@/game/constants/assists.constants'
import { useAssists } from './useAssists'

// The store is one module value for the whole test file, so each test turns every assist on again.
afterEach(async () => {
  const { result, unmount } = renderHook(() => useAssists())
  for (const name of Object.keys(DEFAULT_ASSISTS) as AssistName[]) {
    await act(async () => result.current.setAssist(name, true))
  }
  unmount()
})

it('gives every assist on when nothing is saved', () => {
  const { result } = renderHook(() => useAssists())
  expect(result.current.assists).toEqual(DEFAULT_ASSISTS)
})

it('tells every reader at once', async () => {
  const settings = renderHook(() => useAssists())
  const game = renderHook(() => useAssists())
  await act(async () => settings.result.current.setAssist('box', false))
  expect(settings.result.current.assists.box).toBe(false)
  expect(game.result.current.assists.box).toBe(false)
})

it('saves the assists through the settings', async () => {
  const { result } = renderHook(() => useAssists())
  await act(async () => result.current.setAssist('sameNumbers', false))
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(
    ASSISTS_KEY,
    JSON.stringify({ ...DEFAULT_ASSISTS, sameNumbers: false }),
  )
})

it('keeps the choice for this session when the save fails', async () => {
  jest.mocked(Storage.setItemAsync).mockRejectedValueOnce(new Error('disk full'))
  const log = jest.spyOn(console, 'log').mockImplementation(() => {})
  const { result } = renderHook(() => useAssists())
  await act(async () => result.current.setAssist('rowColumn', false))
  expect(result.current.assists.rowColumn).toBe(false)
  expect(log).toHaveBeenCalledWith('[assists] assists not saved: disk full')
  log.mockRestore()
})
```

`src/game/hooks/useCellViews/useCellViews.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { DEFAULT_ASSISTS, type AssistName } from '@/game/constants/assists.constants'
import { GameProvider } from '@/game/components/GameProvider'
import { useAssists } from '@/game/hooks/useAssists'
import { useGameActions } from '@/game/hooks/useGameActions'
import { sampleStart } from '@/game/utils/sample.utils'
import { useCellViews } from './useCellViews'

const wrapper = ({ children }: { children: ReactNode }) => <GameProvider start={sampleStart()}>{children}</GameProvider>

const useGameAndAssists = () => ({ views: useCellViews(), actions: useGameActions(), ...useAssists() })

afterEach(async () => {
  const { result, unmount } = renderHook(() => useAssists())
  for (const name of Object.keys(DEFAULT_ASSISTS) as AssistName[]) {
    await act(async () => result.current.setAssist(name, true))
  }
  unmount()
})

it('follows a switch at once, without a new game', async () => {
  const { result } = renderHook(useGameAndAssists, { wrapper })
  act(() => result.current.actions.select(40))
  expect(result.current.views[36]?.fill).toBe('peer')

  await act(async () => result.current.setAssist('rowColumn', false))
  expect(result.current.views[36]?.fill).toBe('plain')

  await act(async () => result.current.setAssist('selectedCell', false))
  expect(result.current.views[40]).toMatchObject({ fill: 'peer', ring: true })
})
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter mobile exec jest src/game/hooks/useAssists src/game/hooks/useCellViews`
Expected: FAIL. `result.current.assists` is undefined and `setAssist` is not a function.

- [ ] **Step 3: Write the hook**

`src/game/hooks/useAssists/useAssists.ts`:

```ts
import { useSyncExternalStore } from 'react'
import type { AssistName, Assists } from '@/game/constants/assists.constants'
import { createAssistsStore } from '@/game/utils/assists.utils'
import { kvSettings } from '@/settings/SettingsRepository'
import { devLog, errorMessage } from '@/utils/log.utils'

// One store for the app: the Settings screen and the game grid must read the same assists.
const assistsStore = createAssistsStore(kvSettings)

function setAssist(name: AssistName, on: boolean): void {
  assistsStore.set(name, on).catch((error: unknown) => devLog('assists', `assists not saved: ${errorMessage(error)}`))
}

/** The saved assists. A change reaches every reader at once. setAssist keeps its identity. */
export function useAssists(): { assists: Assists; setAssist(name: AssistName, on: boolean): void } {
  const assists = useSyncExternalStore(assistsStore.subscribe, assistsStore.get)
  return { assists, setAssist }
}
```

`src/game/hooks/useCellViews/useCellViews.ts`: change one line.

```ts
  const { assists } = useAssists()
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `pnpm --filter mobile exec jest src/game`
Expected: PASS, including `GameScreen.renders.test.tsx` without a change.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add apps/mobile/src/game/hooks/useAssists apps/mobile/src/game/hooks/useCellViews
/usr/bin/git commit -m "feat(game): the grid follows the saved assists at once (#38)"
```

---

## Task 3: `AssistRow`

**Files:**
- Create: `src/settings/components/AssistRow/AssistRow.tsx`, `AssistRow.styles.ts`, `AssistRow.test.tsx`, `index.ts`

The canvas switch is the iOS switch (51 × 31 pt), so the row uses the React Native `Switch`. `Switch` takes its colours as props, not as a style. `withUnistyles` maps theme values to props and updates them on a theme switch (Unistyles 3 docs, "withUnistyles"). The row does not set `thumbColor`: on iOS a thumb colour removes the shadow of the thumb (React Native docs, Switch). So `components.switch.knob` stays unused. See Open question 5.

- [ ] **Step 1: Write the failing test**

`src/settings/components/AssistRow/AssistRow.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet, Switch } from 'react-native'
import { daylight } from '@/theme/themes/daylight'
import { AssistRow } from './AssistRow'

const props = { label: 'Box', description: 'Shade the 3×3 box of the selected cell.', value: true, divider: false }

it('shows the label and the description', () => {
  render(<AssistRow {...props} onChange={jest.fn()} />)
  expect(screen.getByText('Box')).toBeTruthy()
  expect(screen.getByText('Shade the 3×3 box of the selected cell.')).toBeTruthy()
})

it('gives the switch the label and the value, so VoiceOver reads both', () => {
  render(<AssistRow {...props} onChange={jest.fn()} />)
  expect(screen.getByLabelText('Box').props.value).toBe(true)
})

it('reports the new value', () => {
  const onChange = jest.fn()
  render(<AssistRow {...props} onChange={onChange} />)
  fireEvent(screen.getByLabelText('Box'), 'valueChange', false)
  expect(onChange).toHaveBeenCalledWith(false)
})

it('colours the track from the theme and keeps the native thumb', () => {
  render(<AssistRow {...props} onChange={jest.fn()} />)
  const native = screen.UNSAFE_getByType(Switch)
  expect(native.props).toMatchObject({
    trackColor: { false: daylight.components.switch.off, true: daylight.components.switch.on },
    ios_backgroundColor: daylight.components.switch.off,
  })
  expect(native.props.thumbColor).toBeUndefined()
})

it('is at least 44 pt high', () => {
  render(<AssistRow {...props} onChange={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByTestId('assist-row-Box').props.style).minHeight).toBeGreaterThanOrEqual(44)
})
```

Run: `pnpm --filter mobile exec jest src/settings/components/AssistRow`
Expected: FAIL, `Cannot find module './AssistRow'`.

- [ ] **Step 2: Write the component**

`src/settings/components/AssistRow/AssistRow.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: theme.size.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
  divider: { borderTopWidth: theme.shape.stroke.thin, borderTopColor: theme.colors.line },
  text: { flex: 1, minWidth: 0 },
  label: { ...roleFont(theme.type.button), fontSize: theme.type.button.scale, color: theme.colors.text },
  description: {
    ...roleFont(theme.type.caption),
    fontSize: theme.type.caption.scale,
    marginTop: theme.space.xs / 2,
    color: theme.colors.textMuted,
  },
}))
```

`src/settings/components/AssistRow/AssistRow.tsx`:

```tsx
import { Switch, Text, View } from 'react-native'
import { withUnistyles } from 'react-native-unistyles'
import { styles } from './AssistRow.styles'

// No thumbColor: on iOS a thumb colour removes the shadow of the thumb.
const ThemedSwitch = withUnistyles(Switch, (theme) => ({
  trackColor: { false: theme.components.switch.off, true: theme.components.switch.on },
  ios_backgroundColor: theme.components.switch.off,
}))

type AssistRowProps = {
  label: string
  description: string
  value: boolean
  /** A line above the row. The first row of the card has none. */
  divider: boolean
  onChange(on: boolean): void
}

export function AssistRow({ label, description, value, divider, onChange }: AssistRowProps) {
  return (
    <View testID={`assist-row-${label}`} style={[styles.row, divider && styles.divider]}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <ThemedSwitch accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  )
}
```

`index.ts`: `export { AssistRow } from './AssistRow'`

- [ ] **Step 3: Run the test and see it pass**

Run: `pnpm --filter mobile exec jest src/settings/components/AssistRow`
Expected: PASS. If `screen.getByLabelText('Box').props.value` is undefined, the host element of `Switch` lost the prop: read it from `screen.UNSAFE_getByType(Switch).props.value` instead, and say so in the PR.

- [ ] **Step 4: Commit**

```bash
/usr/bin/git add apps/mobile/src/settings/components/AssistRow
/usr/bin/git commit -m "feat(settings): a switch row for each assist (#38)"
```

---

## Task 4: `ThemePicker` and `useThemePreference`

**Files:**
- Create: `src/settings/components/ThemePicker/ThemePicker.tsx`, `ThemePicker.styles.ts`, `ThemePicker.constants.ts`, `ThemePicker.test.tsx`, `index.ts`
- Create: `src/settings/hooks/useThemePreference/useThemePreference.ts`, `useThemePreference.test.tsx`, `index.ts`

- [ ] **Step 1: Write the failing tests**

`src/settings/components/ThemePicker/ThemePicker.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { ThemePicker } from './ThemePicker'

it('offers System, Daylight and Midnight, and marks the current choice', () => {
  render(<ThemePicker value="daylight" onChange={jest.fn()} />)
  expect(screen.getByRole('button', { name: 'System', selected: false })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Daylight', selected: true })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Midnight', selected: false })).toBeTruthy()
})

it('reports a tap', () => {
  const onChange = jest.fn()
  render(<ThemePicker value="system" onChange={onChange} />)
  fireEvent.press(screen.getByRole('button', { name: 'Midnight' }))
  expect(onChange).toHaveBeenCalledWith('midnight')
})

it('gives each choice a 44 pt touch target', () => {
  render(<ThemePicker value="system" onChange={jest.fn()} />)
  for (const name of ['System', 'Daylight', 'Midnight']) {
    const segment = screen.getByRole('button', { name })
    expect(StyleSheet.flatten(segment.props.style).minHeight).toBeGreaterThanOrEqual(44)
  }
})
```

`src/settings/hooks/useThemePreference/useThemePreference.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react-native'
import Storage from 'expo-sqlite/kv-store'
import { UnistylesRuntime } from 'react-native-unistyles'
import { THEME_PREFERENCE_KEY } from '@/theme/preference'
import { useThemePreference } from './useThemePreference'

afterEach(async () => {
  await Storage.setItemAsync(THEME_PREFERENCE_KEY, 'system')
})

it('starts with system when nothing is saved', () => {
  const { result } = renderHook(() => useThemePreference())
  expect(result.current.preference).toBe('system')
})

it('reads the saved choice', async () => {
  await Storage.setItemAsync(THEME_PREFERENCE_KEY, 'daylight')
  const { result } = renderHook(() => useThemePreference())
  expect(result.current.preference).toBe('daylight')
})

it('applies the choice at once and saves it', async () => {
  const setTheme = jest.spyOn(UnistylesRuntime, 'setTheme')
  const { result } = renderHook(() => useThemePreference())
  await act(async () => result.current.choose('midnight'))
  expect(result.current.preference).toBe('midnight')
  expect(setTheme).toHaveBeenCalledWith('dark')
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(THEME_PREFERENCE_KEY, 'midnight')
  setTheme.mockRestore()
})

it('keeps the choice for this session when the save fails', async () => {
  jest.mocked(Storage.setItemAsync).mockRejectedValueOnce(new Error('disk full'))
  const log = jest.spyOn(console, 'log').mockImplementation(() => {})
  const { result } = renderHook(() => useThemePreference())
  await act(async () => result.current.choose('daylight'))
  expect(result.current.preference).toBe('daylight')
  expect(log).toHaveBeenCalledWith('[theme] theme not saved: disk full')
  log.mockRestore()
})
```

Run: `pnpm --filter mobile exec jest src/settings/components/ThemePicker src/settings/hooks`
Expected: FAIL, modules not found.

- [ ] **Step 2: Write the hook**

`src/settings/hooks/useThemePreference/useThemePreference.ts`:

```ts
import { useCallback, useState } from 'react'
import { kvSettings } from '@/settings/SettingsRepository'
import { readThemePreference, saveThemePreference, type ThemePreference } from '@/theme/preference'
import { devLog, errorMessage } from '@/utils/log.utils'

/** The theme preference of the player. choose applies the theme at once, then saves it (ADR-015). */
export function useThemePreference(): { preference: ThemePreference; choose(next: ThemePreference): void } {
  const [preference, setPreference] = useState(() => readThemePreference(kvSettings))
  const choose = useCallback((next: ThemePreference) => {
    setPreference(next)
    saveThemePreference(kvSettings, next).catch((error: unknown) =>
      devLog('theme', `theme not saved: ${errorMessage(error)}`),
    )
  }, [])
  return { preference, choose }
}
```

`index.ts`: `export { useThemePreference } from './useThemePreference'`

- [ ] **Step 3: Write the picker**

`src/settings/components/ThemePicker/ThemePicker.constants.ts`:

```ts
import type { ThemePreference } from '@/theme/preference'

export const THEME_OPTIONS: ReadonlyArray<{ preference: ThemePreference; label: string }> = [
  { preference: 'system', label: 'System' },
  { preference: 'daylight', label: 'Daylight' },
  { preference: 'midnight', label: 'Midnight' },
]
```

`src/settings/components/ThemePicker/ThemePicker.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  track: {
    flexDirection: 'row',
    gap: theme.space.xs,
    padding: theme.space.xs,
    borderRadius: theme.shape.radius.md,
    borderWidth: theme.shape.stroke.thin,
    borderColor: theme.colors.line,
    backgroundColor: theme.components.segmented.track,
  },
  segment: {
    flex: 1,
    minHeight: theme.size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.shape.radius.md - theme.space.xs,
  },
  selected: { backgroundColor: theme.components.segmented.selected, boxShadow: theme.elevation.key },
  label: { ...roleFont(theme.type.label), fontSize: theme.type.label.scale, color: theme.colors.textMuted },
  labelSelected: { color: theme.colors.text },
}))
```

`src/settings/components/ThemePicker/ThemePicker.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native'
import type { ThemePreference } from '@/theme/preference'
import { THEME_OPTIONS } from './ThemePicker.constants'
import { styles } from './ThemePicker.styles'

type ThemePickerProps = { value: ThemePreference; onChange(preference: ThemePreference): void }

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <View style={styles.track}>
      {THEME_OPTIONS.map(({ preference, label }) => {
        const selected = preference === value
        return (
          <Pressable
            key={preference}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onChange(preference)}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
```

`index.ts`: `export { ThemePicker } from './ThemePicker'`

- [ ] **Step 4: Run the tests and see them pass**

Run: `pnpm --filter mobile exec jest src/settings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add apps/mobile/src/settings/components/ThemePicker apps/mobile/src/settings/hooks
/usr/bin/git commit -m "feat(settings): the theme picker, saved through SettingsRepository (#38)"
```

---

## Task 5: `SettingsScreen`

**Files:**
- Create: `src/settings/screens/SettingsScreen/SettingsScreen.tsx`, `SettingsScreen.styles.ts`, `SettingsScreen.constants.ts`, `SettingsScreen.test.tsx`, `index.ts`

The screen takes `onBack`. The route that opens it belongs to #51 (see the Coordinator rulings and Task 8). It reuses `Icon` and `ThemeStatusBar` from `src/game/components/` without a change. The card has no preview yet: Task 6 adds it after #42 merges.

- [ ] **Step 1: Write the failing test**

`src/settings/screens/SettingsScreen/SettingsScreen.test.tsx`:

```tsx
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native'
import Storage from 'expo-sqlite/kv-store'
import { StyleSheet } from 'react-native'
import { ASSISTS_KEY, DEFAULT_ASSISTS, type AssistName } from '@/game/constants/assists.constants'
import { useAssists } from '@/game/hooks/useAssists'
import { THEME_PREFERENCE_KEY } from '@/theme/preference'
import { SettingsScreen } from './SettingsScreen'

const LABELS = ['Row and column', 'Box', 'Selected cell', 'Same numbers']

afterEach(async () => {
  const { result, unmount } = renderHook(() => useAssists())
  for (const name of Object.keys(DEFAULT_ASSISTS) as AssistName[]) {
    await act(async () => result.current.setAssist(name, true))
  }
  unmount()
  await Storage.setItemAsync(THEME_PREFERENCE_KEY, 'system')
})

it('lists the four assists in the canvas order, all on by default', () => {
  render(<SettingsScreen onBack={jest.fn()} />)
  const labels = screen.getAllByText(/^(Row and column|Box|Selected cell|Same numbers)$/)
  expect(labels.map((label) => label.props.children)).toEqual(LABELS)
  for (const label of LABELS) expect(screen.getByLabelText(label).props.value).toBe(true)
})

it('turns an assist off and saves it', async () => {
  render(<SettingsScreen onBack={jest.fn()} />)
  await act(async () => fireEvent(screen.getByLabelText('Box'), 'valueChange', false))
  expect(screen.getByLabelText('Box').props.value).toBe(false)
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(ASSISTS_KEY, JSON.stringify({ ...DEFAULT_ASSISTS, box: false }))
})

it('saves the theme choice', async () => {
  render(<SettingsScreen onBack={jest.fn()} />)
  expect(screen.getByRole('button', { name: 'System', selected: true })).toBeTruthy()
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Midnight' })))
  expect(screen.getByRole('button', { name: 'Midnight', selected: true })).toBeTruthy()
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(THEME_PREFERENCE_KEY, 'midnight')
})

it('has a back button of 44 pt that calls onBack', () => {
  const onBack = jest.fn()
  render(<SettingsScreen onBack={onBack} />)
  const back = screen.getByRole('button', { name: 'Back' })
  fireEvent.press(back)
  expect(onBack).toHaveBeenCalled()
  expect(StyleSheet.flatten(back.props.style)).toMatchObject({ width: 44, height: 44 })
})

it('shows the headings and the hint of the canvas', () => {
  render(<SettingsScreen onBack={jest.fn()} />)
  expect(screen.getByText('Settings')).toBeTruthy()
  expect(screen.getByText('Assists')).toBeTruthy()
  expect(screen.getByText('Turn these off for a raw game.')).toBeTruthy()
  expect(screen.getByText('Theme')).toBeTruthy()
})
```

Run: `pnpm --filter mobile exec jest src/settings/screens`
Expected: FAIL, `Cannot find module './SettingsScreen'`.

- [ ] **Step 2: Write the screen**

`src/settings/screens/SettingsScreen/SettingsScreen.constants.ts`:

```ts
import type { AssistName } from '@/game/constants/assists.constants'

/** The switch rows in the canvas order, with the canvas text. */
export const ASSIST_ROWS: ReadonlyArray<{ name: AssistName; label: string; description: string }> = [
  { name: 'rowColumn', label: 'Row and column', description: 'Shade the row and column of the selected cell.' },
  { name: 'box', label: 'Box', description: 'Shade the 3×3 box of the selected cell.' },
  {
    name: 'selectedCell',
    label: 'Selected cell',
    description: 'Fill the selected cell. When off, a thin ring still marks it.',
  },
  { name: 'sameNumbers', label: 'Same numbers', description: 'Shade every cell that holds the selected number.' },
]
```

`src/settings/screens/SettingsScreen/SettingsScreen.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

// Unistyles reads the safe-area insets natively, as on the game screen.
export const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    gap: theme.space.md,
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom + theme.space.lg,
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
  title: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale, color: theme.colors.text },
  section: { gap: theme.space.sm, marginTop: theme.space.xs },
  sectionTitle: {
    ...roleFont(theme.type.label),
    fontSize: theme.type.label.scale,
    // The canvas spaces the uppercase heading by 0.06 em.
    letterSpacing: theme.type.label.scale * 0.06,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  hint: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
  card: {
    overflow: 'hidden',
    borderRadius: theme.shape.radius.lg,
    borderWidth: theme.shape.stroke.thin,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
}))
```

`src/settings/screens/SettingsScreen/SettingsScreen.tsx`:

```tsx
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Icon } from '@/game/components/Icon'
import { ThemeStatusBar } from '@/game/components/ThemeStatusBar'
import { useAssists } from '@/game/hooks/useAssists'
import { AssistRow } from '@/settings/components/AssistRow'
import { ThemePicker } from '@/settings/components/ThemePicker'
import { useThemePreference } from '@/settings/hooks/useThemePreference'
import { ASSIST_ROWS } from './SettingsScreen.constants'
import { styles } from './SettingsScreen.styles'

type SettingsScreenProps = { onBack(): void }

/** The assists with their preview, and the theme preference. Each change applies at once and is saved. */
export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { assists, setAssist } = useAssists()
  const { preference, choose } = useThemePreference()
  return (
    <>
      <ThemeStatusBar />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
            <Icon name="back" tone="text" />
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            Settings
          </Text>
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Assists
          </Text>
          <Text style={styles.hint}>Turn these off for a raw game.</Text>
        </View>
        <View style={styles.card}>
          {ASSIST_ROWS.map(({ name, label, description }, index) => (
            <AssistRow
              key={name}
              label={label}
              description={description}
              value={assists[name]}
              divider={index > 0}
              onChange={(on) => setAssist(name, on)}
            />
          ))}
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Theme
          </Text>
          <ThemePicker value={preference} onChange={choose} />
        </View>
      </ScrollView>
    </>
  )
}
```

`index.ts`: `export { SettingsScreen } from './SettingsScreen'`

- [ ] **Step 3: Run the tests and see them pass**

Run: `pnpm --filter mobile exec jest src/settings src/game`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
/usr/bin/git add apps/mobile/src/settings/screens
/usr/bin/git commit -m "feat(settings): the Settings screen with assists and theme (#38)"
```

---

## Task 6: The preview through the real grid (after #42 merges)

Start this task only when #42 (pulses) is on `origin/develop`. Rebase on `origin/develop` first. The code below shows `Cell` and `Grid` as #42 leaves them, with the `pulse` prop. If #42 changed them in another way, keep its code and add only the parts that this task names.

**Files:**
- Modify: `src/game/utils/cell.utils.ts` (one type)
- Modify: `src/game/components/Cell/Cell.tsx`, `Cell.styles.ts`, `Cell.test.tsx`
- Modify: `src/game/components/Grid/Grid.tsx`, `Grid.test.tsx`
- Create: `src/game/components/DisplayGameProvider/DisplayGameProvider.tsx`, `DisplayGameProvider.test.tsx`, `index.ts`
- Create: `src/settings/constants/assistPreview.constants.ts`
- Create: `src/settings/utils/assistPreview.utils.ts`, `assistPreview.utils.test.ts`
- Create: `src/settings/components/AssistPreview/AssistPreview.tsx`, `AssistPreview.styles.ts`, `AssistPreview.test.tsx`, `index.ts`
- Modify: `src/settings/screens/SettingsScreen/SettingsScreen.tsx`, `SettingsScreen.test.tsx`

**Interfaces:**
- Produces: `Grid({ interactive?: boolean; digitSize?: DigitSize })`. The defaults (`true`, `'full'`) keep the game grid as it is.
- Produces: `Cell` takes `interactive?: boolean` (default `true`) and `digitSize?: DigitSize` (default `'full'`). Both are primitives, so `memo` still skips the cells that do not change.
- Produces: `DisplayGameProvider({ board: Game; children })`: a read-only game context. The finish card of #43 can use `<DisplayGameProvider board={…}><Grid interactive={false} /></DisplayGameProvider>`.
- Produces: `type DigitSize = 'full' | 'small'` in `cell.utils.ts`.

The display mode means:

| `interactive={false}` | Effect |
| --- | --- |
| Taps | A cell is a `View`, not a `Pressable`. `onSelect` is never called |
| Focus and VoiceOver | The grid frame has `accessibilityElementsHidden` and `importantForAccessibility="no-hide-descendants"`. No cell is a button |
| Haptics, clock, pulse | `DisplayGameProvider` has no clock and makes no move, so `move` stays `null`: no haptic and no pulse |

| `digitSize="small"` | Effect |
| --- | --- |
| Digits | The note size (`type.note.scale`, 11 pt), as in the canvas preview |
| Notes | Not drawn: a cell of about 20 pt has no room for nine 11 pt notes |

- [ ] **Step 1: The preview board (test first)**


`src/settings/constants/assistPreview.constants.ts`:

```ts
import type { Digit } from '@sudoku/core'

/** The entries of the canvas preview, as [cell, digit]. The 6 in cell 54 is wrong, so the preview shows a conflict. */
export const PREVIEW_ENTRIES: ReadonlyArray<readonly [cell: number, digit: Digit]> = [
  [2, 4],
  [3, 6],
  [5, 8],
  [10, 7],
  [18, 1],
  [28, 5],
  [37, 2],
  [54, 6],
]

/** Cell 39 holds a given 8, so the same-numbers assist has cells to shade. */
export const PREVIEW_SELECTED = 39
```


`src/settings/utils/assistPreview.utils.test.ts`:

```ts
import { DEFAULT_ASSISTS } from '@/game/constants/assists.constants'
import { cellViews } from '@/game/utils/cell.utils'
import { previewBoard } from './assistPreview.utils'

it('selects cell 39 of a game in play', () => {
  const board = previewBoard()
  expect(board.selected).toBe(39)
  expect(board.status).toBe('playing')
})

it('shows every shade of the canvas with all assists on', () => {
  const views = cellViews(previewBoard(), DEFAULT_ASSISTS)
  expect(views[39]?.fill).toBe('selected')
  expect(views[36]?.fill).toBe('peer')
  expect(views[5]).toMatchObject({ digit: 8, fill: 'same' })
  expect(views[54]).toMatchObject({ digit: 6, digitStyle: 'wrong', fill: 'conflict' })
  expect(views[0]?.fill).toBe('plain')
})
```

Run: `pnpm --filter mobile exec jest src/settings/utils`
Expected: FAIL, `Cannot find module './assistPreview.utils'`.


`src/settings/utils/assistPreview.utils.ts`:

```ts
import type { Game } from '@sudoku/core'
import { sampleStart } from '@/game/utils/sample.utils'
import { reduceSession, startSession, type SessionAction } from '@/game/utils/session.utils'
import { PREVIEW_ENTRIES, PREVIEW_SELECTED } from '@/settings/constants/assistPreview.constants'

/** The board of the preview. It plays the entries through the game rules, so a wrong entry is a real mistake. */
export function previewBoard(): Game {
  const actions: SessionAction[] = [
    ...PREVIEW_ENTRIES.flatMap(([cell, digit]): SessionAction[] => [
      { type: 'select', cell },
      { type: 'digit', digit },
    ]),
    { type: 'select', cell: PREVIEW_SELECTED },
  ]
  return actions.reduce(reduceSession, startSession(sampleStart())).game
}
```

Run the test again. Expected: PASS.


- [ ] **Step 2: Write the failing tests of the display mode**

Add to `src/game/components/Cell/Cell.test.tsx`. `base` is the props fixture of that file after #42, with its `pulse`:

```tsx
it('shows the board without a button when it is not interactive', () => {
  const onSelect = jest.fn()
  render(<Cell {...base} digit={5} digitStyle="given" interactive={false} onSelect={onSelect} />)
  expect(screen.queryByRole('button', { includeHiddenElements: true })).toBeNull()
  fireEvent.press(screen.getByTestId('cell-2'))
  expect(onSelect).not.toHaveBeenCalled()
  expect(screen.getByText('5')).toBeTruthy()
})

it('draws small digits at the note size', () => {
  render(<Cell {...base} digit={5} digitStyle="given" digitSize="small" onSelect={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByText('5').props.style).fontSize).toBe(daylight.type.note.scale)
})

it('draws no notes in a small cell', () => {
  render(<Cell {...base} notes="39" digitSize="small" onSelect={jest.fn()} />)
  expect(screen.queryAllByTestId(/^note-slot-/)).toHaveLength(0)
})

it('stays a button with full-size digits by default', () => {
  render(<Cell {...base} digit={5} digitStyle="given" onSelect={jest.fn()} />)
  expect(screen.getByRole('button')).toBeTruthy()
  expect(StyleSheet.flatten(screen.getByText('5').props.style).fontSize).toBe(daylight.type.given.scale)
})
```

`src/game/components/DisplayGameProvider/DisplayGameProvider.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { reduceSession, startSession } from '@/game/utils/session.utils'
import { sampleStart } from '@/game/utils/sample.utils'
import { DisplayGameProvider } from './DisplayGameProvider'

const board = reduceSession(startSession(sampleStart()), { type: 'select', cell: 40 }).game
const wrapper = ({ children }: { children: ReactNode }) => (
  <DisplayGameProvider board={board}>{children}</DisplayGameProvider>
)

it('gives the board with no move and no notes mode', () => {
  const { result } = renderHook(() => useGameState(), { wrapper })
  expect(result.current).toEqual({ board, notesMode: false, move: null })
})

it('ignores every action, so the board never changes', () => {
  const { result } = renderHook(() => ({ state: useGameState(), actions: useGameActions() }), { wrapper })
  act(() => {
    result.current.actions.select(0)
    result.current.actions.digit(5)
    result.current.actions.hint()
  })
  expect(result.current.state.board).toBe(board)
})
```

Add to `src/game/components/Grid/Grid.test.tsx`:

```tsx
it('shows a board that cannot be tapped and that VoiceOver skips', () => {
  const board = reduceSession(startSession(sampleStart()), { type: 'select', cell: 40 }).game
  render(
    <DisplayGameProvider board={board}>
      <Grid interactive={false} digitSize="small" />
    </DisplayGameProvider>,
  )
  const hidden = { includeHiddenElements: true }
  expect(screen.getAllByTestId(/^cell-\d+$/, hidden)).toHaveLength(81)
  expect(screen.queryAllByRole('button', hidden)).toHaveLength(0)
  expect(screen.getByTestId('grid', hidden).props.accessibilityElementsHidden).toBe(true)
})

it('keeps the game grid open to VoiceOver by default', () => {
  render(
    <GameProvider start={sampleStart()}>
      <Grid />
    </GameProvider>,
  )
  expect(screen.getByTestId('grid').props.accessibilityElementsHidden).toBe(false)
  expect(screen.getAllByRole('button')).toHaveLength(81)
})
```

Add the imports that the file does not have yet: `DisplayGameProvider` from `@/game/components/DisplayGameProvider`, `GameProvider` from `@/game/components/GameProvider`, `reduceSession` and `startSession` from `@/game/utils/session.utils`, `sampleStart` from `@/game/utils/sample.utils`.

Run: `pnpm --filter mobile exec jest src/game/components`
Expected: FAIL. The props `interactive` and `digitSize` are unknown, and `DisplayGameProvider` does not exist.

- [ ] **Step 3: Write the display mode**

`src/game/utils/cell.utils.ts`: add under `DigitStyle`:

```ts
/** small: digits at the note size and no notes, for a grid of about 20 pt cells. */
export type DigitSize = 'full' | 'small'
```

`src/game/components/Cell/Cell.styles.ts`: add three keys beside `given`, `entry` and `wrong`:

```ts
  // A small cell uses the note size for its digits, as in the canvas preview.
  givenSmall: { ...roleFont(theme.type.given), fontSize: theme.type.note.scale, color: theme.components.cell.given },
  entrySmall: { ...roleFont(theme.type.entry), fontSize: theme.type.note.scale, color: theme.components.cell.entry },
  wrongSmall: { ...roleFont(theme.type.entry), fontSize: theme.type.note.scale, color: theme.components.cell.conflict },
```

`src/game/components/Cell/Cell.tsx`: keep the pulse code of #42. Change the props, the digit style and the outer element:

```tsx
import type { CellView, DigitSize } from '@/game/utils/cell.utils'

type CellProps = CellView & {
  cell: number
  label: string
  pulse: Pulse
  onSelect(cell: number): void
  /** false: the cell only shows the board. No tap, no focus, no VoiceOver stop. */
  interactive?: boolean
  digitSize?: DigitSize
}

export const Cell = memo(function Cell({
  cell,
  digit,
  digitStyle,
  notes,
  fill,
  ring,
  label,
  pulse,
  onSelect,
  interactive = true,
  digitSize = 'full',
}: CellProps) {
  // Plan note, not code: waveStyle and popStyle stay as #42 wrote them.
  const digitKey = digitSize === 'small' ? (`${digitStyle}Small` as const) : digitStyle
  const content = (
    <>
      <Animated.View testID={`cell-${cell}-wave`} style={[styles.wave, waveStyle]} />
      {digit !== 0 && (
        <Animated.Text allowFontScaling={false} style={[styles[digitKey], popStyle]}>
          {digit}
        </Animated.Text>
      )}
      {digit === 0 && notes !== '' && digitSize === 'full' && (
        <View style={styles.notes}>{/* Plan note: the NOTE_PLACES slots, unchanged */}</View>
      )}
    </>
  )
  if (!interactive) {
    return (
      <View testID={`cell-${cell}`} style={[styles.cell, styles[fill], ring && styles.ring]}>
        {content}
      </View>
    )
  }
  return (
    <Pressable
      testID={`cell-${cell}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onSelect(cell)}
      style={[styles.cell, styles[fill], ring && styles.ring]}
    >
      {content}
    </Pressable>
  )
})
```

The two "Plan note" comments only mark a place in this plan. In the real file, keep the code of #42 there in full, and do not commit the notes.

`src/game/components/Grid/Grid.tsx`: keep the `usePulse` code of #42. Add the props and pass them on:

```tsx
import type { DigitSize } from '@/game/utils/cell.utils'

type GridProps = {
  /** false: a board to look at, for example a preview. VoiceOver skips it and no cell takes a tap. */
  interactive?: boolean
  digitSize?: DigitSize
}

export function Grid({ interactive = true, digitSize = 'full' }: GridProps) {
  // Plan note, not code: views, select, board, move and pulse stay as #42 wrote them.
  const drawCell = (cell: number) => {
    const view = views[cell]
    if (!view) return null
    return (
      <Cell
        key={cell}
        cell={cell}
        {...view}
        label={cellLabel(cell, view)}
        pulse={pulse}
        onSelect={select}
        interactive={interactive}
        digitSize={digitSize}
      />
    )
  }
  return (
    <View
      testID="grid"
      style={styles.frame}
      accessibilityElementsHidden={!interactive}
      importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'}
    >
      {/* Plan note: the bands, boxes and rows, unchanged */}
    </View>
  )
}
```

`src/game/components/DisplayGameProvider/DisplayGameProvider.tsx`:

```tsx
import { useMemo, type ReactNode } from 'react'
import type { Game } from '@sudoku/core'
import { GameActionsContext, type GameActions } from '@/game/hooks/useGameActions'
import { GameStateContext, type GameState } from '@/game/hooks/useGameState'

const ignore = () => undefined

// A new action in GameActions fails the typecheck here, so a display grid cannot act by mistake.
const NO_ACTIONS: GameActions = {
  select: ignore,
  digit: ignore,
  erase: ignore,
  undo: ignore,
  hint: ignore,
  toggleNotesMode: ignore,
  pause: ignore,
  resume: ignore,
}

type DisplayGameProviderProps = { board: Game; children: ReactNode }

/**
 * A game context that only shows a board, for a Grid with interactive false.
 * No clock and no moves: move stays null, so no pulse and no haptic. No time context: a TimerPill throws here.
 */
export function DisplayGameProvider({ board, children }: DisplayGameProviderProps) {
  const state = useMemo<GameState>(() => ({ board, notesMode: false, move: null }), [board])
  return (
    <GameActionsContext value={NO_ACTIONS}>
      <GameStateContext value={state}>{children}</GameStateContext>
    </GameActionsContext>
  )
}
```

`index.ts`: `export { DisplayGameProvider } from './DisplayGameProvider'`

Run: `pnpm --filter mobile exec jest src/game`
Expected: PASS. Every #37 and #42 test passes unchanged, `Grid.renders.test.tsx` and `GameScreen.renders.test.tsx` included.

- [ ] **Step 4: Write the failing preview test**

`src/settings/components/AssistPreview/AssistPreview.test.tsx`:

```tsx
import { act, render, renderHook, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { DEFAULT_ASSISTS, type AssistName } from '@/game/constants/assists.constants'
import { useAssists } from '@/game/hooks/useAssists'
import { daylight } from '@/theme/themes/daylight'
import { AssistPreview } from './AssistPreview'

// VoiceOver skips the preview, so every query must include hidden elements.
const hidden = { includeHiddenElements: true }
const styleOf = (cell: number) => StyleSheet.flatten(screen.getByTestId(`cell-${cell}`, hidden).props.style)
const colours = daylight.components.cell

afterEach(async () => {
  const { result, unmount } = renderHook(() => useAssists())
  for (const name of Object.keys(DEFAULT_ASSISTS) as AssistName[]) {
    await act(async () => result.current.setAssist(name, true))
  }
  unmount()
})

it('draws the real grid with the shades of the canvas', () => {
  render(<AssistPreview />)
  expect(screen.getAllByTestId(/^cell-\d+$/, hidden)).toHaveLength(81)
  expect(styleOf(39).backgroundColor).toBe(colours.selected)
  expect(styleOf(36).backgroundColor).toBe(colours.peer)
  expect(styleOf(5).backgroundColor).toBe(colours.same)
  expect(styleOf(54).backgroundColor).toBe(colours.conflictFill)
})

it('follows a switch at once', async () => {
  render(<AssistPreview />)
  const { result } = renderHook(() => useAssists())
  // Cell 31 is in the box of cell 39, not in its row or column, and holds no 8.
  await act(async () => result.current.setAssist('box', false))
  expect(styleOf(31).backgroundColor).toBe(colours.fill)
  await act(async () => result.current.setAssist('selectedCell', false))
  expect(styleOf(39)).toMatchObject({ borderColor: colours.ring })
})

it('cannot be tapped and VoiceOver skips it', () => {
  render(<AssistPreview />)
  expect(screen.queryAllByRole('button', hidden)).toHaveLength(0)
  expect(screen.getByTestId('grid', hidden).props.accessibilityElementsHidden).toBe(true)
})

it('has the 180 pt size of the canvas', () => {
  render(<AssistPreview />)
  expect(StyleSheet.flatten(screen.getByTestId('assist-preview', hidden).props.style)).toMatchObject({
    width: 180,
    height: 180,
  })
})
```

Run: `pnpm --filter mobile exec jest src/settings/components/AssistPreview`
Expected: FAIL, `Cannot find module './AssistPreview'`.

- [ ] **Step 5: Write the preview**

`src/settings/components/AssistPreview/AssistPreview.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  well: {
    alignItems: 'center',
    paddingVertical: theme.space.lg,
    borderBottomWidth: theme.shape.stroke.thin,
    borderBottomColor: theme.colors.line,
    backgroundColor: theme.colors.background,
  },
  // The canvas draws the preview 180 pt wide: cells of about 20 pt.
  frame: { width: 180, height: 180 },
}))
```

`src/settings/components/AssistPreview/AssistPreview.tsx`:

```tsx
import { View } from 'react-native'
import { DisplayGameProvider } from '@/game/components/DisplayGameProvider'
import { Grid } from '@/game/components/Grid'
import { previewBoard } from '@/settings/utils/assistPreview.utils'
import { styles } from './AssistPreview.styles'

const PREVIEW_BOARD = previewBoard()

/** The real game grid at preview size. Grid reads the live assists itself, so the preview follows each switch. */
export function AssistPreview() {
  return (
    <View style={styles.well}>
      <DisplayGameProvider board={PREVIEW_BOARD}>
        <View testID="assist-preview" style={styles.frame}>
          <Grid interactive={false} digitSize="small" />
        </View>
      </DisplayGameProvider>
    </View>
  )
}
```

`index.ts`: `export { AssistPreview } from './AssistPreview'`

- [ ] **Step 6: Mount the preview in the Settings screen**

In `SettingsScreen.tsx`, add `import { AssistPreview } from '@/settings/components/AssistPreview'`. Make `<AssistPreview />` the first child of the card, above the switch rows.

Add to `SettingsScreen.test.tsx`, with `import { daylight } from '@/theme/themes/daylight'`:

```tsx
it('shows a switch in the preview at once', async () => {
  render(<SettingsScreen onBack={jest.fn()} />)
  await act(async () => fireEvent(screen.getByLabelText('Box'), 'valueChange', false))
  // Cell 31 is in the box of cell 39, not in its row or column, and holds no 8.
  const cell31 = screen.getByTestId('cell-31', { includeHiddenElements: true })
  expect(StyleSheet.flatten(cell31.props.style).backgroundColor).toBe(daylight.components.cell.fill)
})
```

- [ ] **Step 7: Run the tests and see them pass**

Run: `pnpm --filter mobile exec jest src/game src/settings`
Expected: PASS.

- [ ] **Step 8: Commit, in two commits**

Commit 1: stage `src/game/utils/cell.utils.ts`, `src/game/components/Cell`, `src/game/components/Grid` and `src/game/components/DisplayGameProvider`. Message: `feat(game): a display mode for the grid, without taps or focus (#38)`.

Commit 2: stage `src/settings`. Message: `feat(settings): the assist preview through the real game grid (#38)`.

---

## Task 7: Checks and the pull request

- [ ] **Step 1: Run every check from the repository root**

```bash
just lint
just typecheck
just test-ts
```

Expected: all pass. `just lint` includes the boundary rules: the new utils and constants files import no React, the styles files import only React Native, Unistyles and `src/theme/`, and no cycle exists between `src/game/` and `src/settings/`.

- [ ] **Step 2: Push the branch and open the PR against `develop`**, after Task 8: `gh pr create --base develop --title "feat(settings): assists and the Settings screen (#38)"`.

The body holds: a summary, the files owned, the new `Grid` and `Cell` props (`interactive`, `digitSize`) and `DisplayGameProvider` for the finish card of #43, the statement that no theme file changed, the result lines of the three checks, the iPhone steps below, and `Closes #38`.

- [ ] **Step 3: Tick the acceptance criteria in #38** that the tests prove: four switches on by default, the game follows the switches, the ring, the preview, the theme picker, the saving. The iPhone run proves the rest.

---

## Task 8: The Settings route (after #51 merges)

The Coordinator rulings put #51 first. #51 adds a one-line Settings route.

- [ ] Rebase on `origin/develop`. Adapt to the `GameStart` type and the routes of #51 where this branch uses them. This plan uses neither, so expect no change outside the route.
- [ ] In the route file of #51, point the Settings route at `SettingsScreen` from `@/settings/screens/SettingsScreen`, with `onBack` going back to home. Change nothing else in that file.
- [ ] Extend the navigation test of #51 by one case: "Settings on the home screen opens the Settings screen".
- [ ] Run `just lint`, `just typecheck` and `just test-ts`.
- [ ] Commit: `feat(app): open the Settings screen from home (#38)`.

---

## iPhone steps for the developer

Run after #42 and #51 are on `develop` and this branch has Tasks 6 and 8, in a development build (`just app`, then open the app on the iPhone).

1. On the home screen, tap Settings. The Settings screen shows the preview, four switches (all on) and the theme picker on System.
2. The preview is the game grid in small: same colours, lines and digits. A tap on it does nothing, and VoiceOver skips it. Turn each switch off and on. The preview changes at once: row and column, box, the selected cell fill (a thin accent ring stays when off), the cells with an 8.
3. Turn off Row and column and Selected cell. Go back. Start or continue a game. Tap a cell: only the box shades, and a ring marks the cell.
4. Close the app from the app switcher. Open it again. The two switches are still off.
5. Pick Midnight, then Daylight. The whole app changes at once, with the status bar.
6. Pick System. Switch the iPhone between Light and Dark in Control Center. The app follows.
7. Pick Midnight, close the app and open it again. It starts in Midnight with no flash of Daylight.
8. On an iPhone SE or the smallest simulator, the screen scrolls and nothing is cut off.
9. In a game, a completed row still pulses and gives a haptic: the default grid did not change.

---

## Open questions

1. **Theme files.** The preview is now the real `Grid` and `Cell`, which read their own tokens. So this plan changes no theme file, although the Coordinator rulings let #38 own them. **Recommendation:** no theme change. If the iPhone run shows the 2 pt ring too thick in 20 pt cells, propose a follow-up issue. Do not add a token in this PR.
2. **The Grid and Cell props.** #38 adds `interactive?: boolean` and `digitSize?: 'full' | 'small'` to both, and the new `DisplayGameProvider`, in Task 6 after #42 merges. #44 (accessibility) takes `Cell/*` next. **Recommendation:** #44 keeps both props. Its Dynamic Type work applies only when `interactive` is true, because a display grid has no VoiceOver stop and a fixed size. The finish card of #43 uses `DisplayGameProvider` with `<Grid interactive={false} />`, with `digitSize` as its size needs.
3. **The Settings route.** Ruled: #51 merges first with a one-line route. Task 8 of this plan wires `SettingsScreen` into it.
4. **`src/settings/` becomes a feature folder.** It gets `screens/`, `components/`, `hooks/`, `utils/` and `constants/` beside the flat `SettingsRepository.ts` and `memorySettings.ts`. `apps/mobile/AGENTS.md` "Keep the folders" names only `src/game/`, `src/scan/` and `src/scanner/`. **Recommendation:** #51 changes that rule for navigation anyway, so #51 adds "`src/settings/` (Settings UI and `SettingsRepository`)". If #51 does not touch the file, #38 adds the line in Task 8.
5. **`components.switch.knob` stays unused.** A `thumbColor` on iOS removes the thumb shadow that the canvas draws. Both themes set the knob to white, which is the native thumb. **Recommendation:** keep the token for now. Remove it in a later theme issue if no theme needs it.
6. **Glossary.** "Assist", "Selected cell" and "Theme preference" already exist. **Recommendation:** #51 adds two rows: "Assist preview | The small, read-only copy of the game grid on the Settings screen. It shows the effect of each assist" and "Display grid | A game grid with `interactive` off: it shows a board and takes no tap, focus or VoiceOver stop".
7. **Shared game components.** The Settings screen imports `Icon`, `ThemeStatusBar`, `Grid` and `DisplayGameProvider` from `src/game/components/`. **Recommendation:** keep them there. The grid is a game part by nature.
8. **Small design changes.** The theme segments are 44 pt high, not 40 pt (touch target). The type roles round the canvas sizes: the row label uses `type.button` (16, 600), the segment label `type.label` (13, 600, canvas 14), the hint `type.caption` (13, canvas 14). The selected segment uses `elevation.key`, which is almost the canvas shadow. The preview ring is the game ring (`shape.stroke.ring`, 2 pt; canvas 1.5 pt). **Recommendation:** accept them. No new token.
9. **`jest.setup.ts`.** No mock is needed. The Unistyles mock applies a static `withUnistyles` mapping with the first theme, and the expo-sqlite key-value mock keeps values per test file.
