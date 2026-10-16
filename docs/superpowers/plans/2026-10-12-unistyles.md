# Unistyles with Daylight and Midnight Implementation Plan (#50)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `useColors()` with Unistyles 3 and a three-tier, fully typed theme (Daylight and Midnight) that follows the system setting or a saved choice.

**Architecture:** `apps/mobile/src/theme/` holds every raw colour. Each theme is one folder with private primitive tokens and one exported `Theme` object (semantic tokens plus component tokens). `src/theme/unistyles.ts` registers the themes with Unistyles before any `StyleSheet.create`. The saved choice is read synchronously at start, so the first frame has the right theme. A local oxlint JS plugin refuses colour literals outside `src/theme/`.

**Tech Stack:** Expo 57, React Native 0.86.3, Reanimated 4.5.1, react-native-nitro-modules 0.37.1, react-native-unistyles 3.5.2, Jest (jest-expo), oxlint 1.87 JS plugins, dependency-cruiser.

**Spec:** GitHub issue #50 (`gh issue view 50`), `docs/architecture/adr/adr-015-theming.md`, the design canvas https://claude.ai/artifact/U23JHiGA1Pq3HJX6oMiBF4 (artboards `Main.dc.html` and `Settings.dc.html`, the `THEMES` constant), `apps/mobile/AGENTS.md`.

## Setup

- Worktree: `git worktree add ../sudoku-50-unistyles -b feature/50-unistyles origin/develop`. Work only there. Use `/usr/bin/git` if the `git` wrapper refuses a command in a worktree.
- Run `pnpm install` in the worktree. The cell classifier is not in git: run `just install-model <run>` only if `just bundle` is needed (it is not needed for this plan's checks).
- Commands run from the worktree root: `just lint`, `just typecheck`, `just test-ts`. A single Jest file: `pnpm --filter mobile exec jest src/theme/contrast.test.ts`.

## Research results (verified 2026-10-12, do not re-decide)

- **Version:** `react-native-unistyles@3.5.2` (latest, 2026-10-09). Its README table: Unistyles `>= 3.4.0` needs nitro-modules `>= 0.37.1`. The app has 0.37.1, and 3.5.2 was built against nitro 0.37.1 and Reanimated 4.7. Peers: `react-native >= 0.81`, `react-native-nitro-modules`, `@react-native/normalize-colors`, optional `react-native-reanimated` and `react-native-edge-to-edge`. Expo SDK 54+ needs no edge-to-edge package. Expo Go is not supported; the app already uses a development build.
- **pnpm is isolated** (`.npmrc`), so add the peer `@react-native/normalize-colors@0.86.3` (the version React Native 0.86.3 uses) to the app explicitly.
- **Babel:** the app has no `babel.config.js`. Create one with `babel-preset-expo` and `['react-native-unistyles/plugin', { root: 'src' }]`. `root` is relative to `apps/mobile`. The plugin is a no-op when `NODE_ENV === 'test'`, so Jest sees plain code.
- **Adaptive themes need the theme names `light` and `dark`.** The C++ core checks for exactly these two names (`UnistylesState.cpp`). So the registry is `{ light: daylight, dark: midnight }`. The player-facing names stay Daylight and Midnight.
- **`adaptiveThemes: true` and `initialTheme` are mutually exclusive.** `initialTheme` may be a synchronous function. `UnistylesRuntime.setTheme()` throws while adaptive themes are on: call `setAdaptiveThemes(false)` first.
- **`StyleSheet.configure` must run before any `StyleSheet.create`.** Import the config file first in `index.ts`.
- **Jest:** the package ships `react-native-unistyles/mocks`. It calls `jest.mock('react-native-unistyles')` and `jest.mock('react-native-nitro-modules')`. In the mock, `StyleSheet.create(fn)` and `useUnistyles().theme` use the FIRST registered theme, so tests see Daylight. `UnistylesRuntime.setTheme` and `setAdaptiveThemes` are no-ops. Variants are stripped: do not use Unistyles variants; use separate style keys.
- **Unistyles styles must not be spread** (`{ ...styles.a }` loses the binding). Pass arrays: `[styles.a, { left }]`.
- **Expo:** `userInterfaceStyle: "automatic"` follows the system. iOS needs nothing more. Android also needs `expo-system-ui`, which is out of scope (iOS app).
- **oxlint 1.87 supports `jsPlugins`** (alpha) in the root config and in `overrides`. A prototype plugin with a `Literal` and `TemplateLiteral` visitor reported `'#ffffff'`, `'rgba(0,0,0,0.6)'`, `'white'` and a template `#fff`, and an override turned it off under `src/theme/**`.
- **Canvas contrast check (computed):** three canvas pairs fail WCAG AA 4.5 : 1. This plan changes three token values (see Task 1). Notes never sit on a `same` fill, because only an empty cell holds notes.

| Theme | Pair | Canvas value | Ratio | Fix | New ratio |
| --- | --- | --- | --- | --- | --- |
| Daylight | entry `#2f5bd3` on same `#c7d5f8` | | 4.02 | entry `#2952c6` | 4.59 |
| Midnight | entry `#84a0ff` on same `#2e3d6a` | | 4.24 | entry `#90abff` | 4.75 |
| Midnight | note `#8a91a3` on selected `#28355a` | | 3.81 | note `#9aa1b2` | 4.64 |

## Global Constraints

- Pin native packages exactly: `pnpm add <pkg>@<version> --save-exact` in `apps/mobile` (apps/mobile/AGENTS.md).
- Do not create, edit or commit `ios/` or `android/` (ADR-002).
- ADR-015 point 7: only `src/theme/` holds raw colour values. A theme folder does not export its primitive tokens.
- ADR-015 point 9: build NO theme decoration slot and no decoration registry.
- ADR-015 point 10: a Skia surface reads its tokens through `useUnistyles()` and remakes paints when the theme changes.
- SUD-01: the app works offline. The fonts are the system font in v1 (see Open questions), so no font asset is added.
- Import rules of `apps/mobile/AGENTS.md`: `@/` alias, a folder through its `index.ts`, no `../`, no `export *`, no barrel.
- Comments follow AGENTS.md: reason only, STE light, no TODO, name the rule in each lint suppression.
- Every commit message is Conventional Commits and ends with `(#50)`.
- Do not edit `docs/architecture/12-glossary.md` or the root `AGENTS.md`. The epic docs pull request owns them.

## Review Focus

1. **Theme switch at run time.** A style built with `StyleSheet.create(theme => …)` must change when the system goes dark, without a reload. Inline objects with theme values do not change. Task 5 and Task 6 move every theme value into a styles file or into `useUnistyles()`.
2. **A saved Daylight or Midnight choice at a cold start.** The first frame must already use the saved theme, with no flash of the system theme. Task 3 tests `startupSettings()` for each saved value and for a broken value.
3. **A broken saved value** (`'sepia'`, empty string, null). It must fall back to System, not throw. Task 3 tests it.
4. **Skia paints after a theme change.** The correction board, the transition canvas and the gathering-dots ink must remake their paints. Task 6 makes the kit take the ink as an argument and memoises on it; a test checks a new ink gives a new kit.
5. **The colour lint on every literal form.** Hex with 3, 4, 6 and 8 digits, `rgb()`, `rgba()`, `hsl()`, `hsla()`, `'white'`, `'black'`, and template literals. Not a false positive on `'#1'`-style ids or on words. Task 4 tests each form.

---

### Task 1: The `Theme` type, the two themes and the contrast test

**Files:**
- Create: `apps/mobile/src/theme/theme.types.ts`
- Create: `apps/mobile/src/theme/themes/daylight/palette.ts` (primitives, not exported by `index.ts`)
- Create: `apps/mobile/src/theme/themes/daylight/daylight.ts`
- Create: `apps/mobile/src/theme/themes/daylight/index.ts`
- Create: `apps/mobile/src/theme/themes/midnight/palette.ts`
- Create: `apps/mobile/src/theme/themes/midnight/midnight.ts`
- Create: `apps/mobile/src/theme/themes/midnight/index.ts`
- Create: `apps/mobile/src/theme/shared.tokens.ts` (space, shape, motion and type roles that both themes share)
- Create: `apps/mobile/src/theme/contrast.utils.ts`, `apps/mobile/src/theme/contrast.utils.test.ts`
- Create: `apps/mobile/src/theme/contrast.test.ts`

**Interfaces:**
- Produces: `type Theme`, `type ThemeName = 'daylight' | 'midnight'`, `type TypeRole`, `daylight: Theme`, `midnight: Theme`, `contrastRatio(foreground: string, background: string): number`, `TEXT_PAIRS`.

- [ ] **Step 1: Write the failing contrast-ratio test**

`apps/mobile/src/theme/contrast.utils.test.ts`:

```ts
import { contrastRatio } from './contrast.utils'

describe('contrastRatio', () => {
  it('gives 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#2f5bd3', '#2f5bd3')).toBeCloseTo(1, 5)
  })

  it('is symmetric', () => {
    expect(contrastRatio('#5c6475', '#f4f5f8')).toBeCloseTo(contrastRatio('#f4f5f8', '#5c6475'), 10)
  })

  it('matches the WCAG value of a known pair', () => {
    // WebAIM gives 4.54 for #767676 on white.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })

  it('refuses a colour that is not #rrggbb', () => {
    expect(() => contrastRatio('rgba(0,0,0,1)', '#ffffff')).toThrow('#rrggbb')
  })
})
```

- [ ] **Step 2: Run it, expect FAIL** — `pnpm --filter mobile exec jest src/theme/contrast.utils.test.ts` → "Cannot find module './contrast.utils'".

- [ ] **Step 3: Implement `contrast.utils.ts`**

```ts
const HEX = /^#[0-9a-f]{6}$/i

function luminance(hex: string): number {
  if (!HEX.test(hex)) throw new Error(`Expected a #rrggbb colour, got ${hex}`)
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The WCAG 2.2 contrast ratio, 1 to 21. Both colours are opaque #rrggbb. */
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
```

- [ ] **Step 4: Run it, expect PASS.**

- [ ] **Step 5: Write `theme.types.ts`** (the type is the spec of every theme; no test of its own, TypeScript checks it)

```ts
import type { TextStyle } from 'react-native'

export type ThemeName = 'daylight' | 'midnight'

/** A text role. scale: the font size in points at the default Dynamic Type size. */
export type TypeRole = {
  family: string
  weight: NonNullable<TextStyle['fontWeight']>
  scale: number
  textShadow: { color: string; offset: { width: number; height: number }; radius: number } | null
}

export type Theme = {
  name: ThemeName
  colors: {
    background: string
    surface: string
    text: string
    textMuted: string
    accent: string
    onAccent: string
    accentSoft: string
    line: string
    lineStrong: string
    danger: string
    dangerSurface: string
    warning: string
    warningText: string
    warningSurface: string
    shadow: string
    /** Over the game when it ends in a loss. Has alpha. */
    scrim: string
    /** Over the game behind the finish card. Has alpha. */
    scrimStrong: string
  }
  type: {
    title: TypeRole
    body: TypeRole
    label: TypeRole
    caption: TypeRole
    button: TypeRole
    timer: TypeRole
    given: TypeRole
    entry: TypeRole
    note: TypeRole
    key: TypeRole
    keyNote: TypeRole
  }
  space: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number }
  shape: {
    radius: { sm: number; md: number; lg: number; xl: number; pill: number }
    /** The grid draws its lines as gaps (ADR-015, point 6). Widths in points. */
    gridLine: { outer: number; box: number; cell: number }
  }
  elevation: {
    /** React Native boxShadow strings, or 'none'. */
    key: string
    sheet: string
    panel: string
  }
  motion: {
    /** Durations in milliseconds. */
    short: number
    medium: number
    long: number
    /** The delay per cell of a pulse, in milliseconds. */
    pulseStep: number
  }
  components: {
    grid: { frame: string; boxLine: string; cellLine: string }
    cell: {
      fill: string
      peer: string
      same: string
      selected: string
      conflictFill: string
      ring: string
      given: string
      entry: string
      conflict: string
      note: string
    }
    key: { fill: string; digit: string; noteDigit: string }
    switch: { on: string; off: string; knob: string }
    segmented: { track: string; selected: string }
  }
}
```

- [ ] **Step 6: Write `shared.tokens.ts`** (values both themes use; a theme may replace any of them)

```ts
import type { Theme } from './theme.types'

/** The system font (San Francisco) until the app bundles a font. */
const SYSTEM = 'System'

export const SHARED_TYPE: Theme['type'] = {
  title: { family: SYSTEM, weight: '700', scale: 22, textShadow: null },
  body: { family: SYSTEM, weight: '400', scale: 15, textShadow: null },
  label: { family: SYSTEM, weight: '600', scale: 13, textShadow: null },
  caption: { family: SYSTEM, weight: '400', scale: 13, textShadow: null },
  button: { family: SYSTEM, weight: '600', scale: 16, textShadow: null },
  timer: { family: SYSTEM, weight: '600', scale: 15, textShadow: null },
  given: { family: SYSTEM, weight: '600', scale: 23, textShadow: null },
  entry: { family: SYSTEM, weight: '500', scale: 23, textShadow: null },
  note: { family: SYSTEM, weight: '500', scale: 11, textShadow: null },
  key: { family: SYSTEM, weight: '500', scale: 28, textShadow: null },
  keyNote: { family: SYSTEM, weight: '600', scale: 20, textShadow: null },
}

export const SHARED_SPACE: Theme['space'] = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }

export const SHARED_SHAPE: Theme['shape'] = {
  radius: { sm: 6, md: 14, lg: 16, xl: 26, pill: 999 },
  gridLine: { outer: 2, box: 2, cell: 1 },
}

export const SHARED_MOTION: Theme['motion'] = { short: 150, medium: 350, long: 700, pulseStep: 45 }
```

- [ ] **Step 7: Write the palettes and the themes.** Values come from the canvas `THEMES` (Main.dc.html, Settings.dc.html) and the warning colours of `src/theme/colors.ts`, with the three AA fixes above.

`themes/daylight/palette.ts`:

```ts
/** Daylight primitive tokens. Only this folder reads them (ADR-015, point 3). */
export const palette = {
  paper050: '#f4f5f8',
  white: '#ffffff',
  ink950: '#141821',
  ink900: '#1d2330',
  slate600: '#5c6475',
  slate300: '#c4c9d4',
  slate250: '#cfd4de',
  slate150: '#e7eaf0',
  slate100: '#eef0f5',
  blue600: '#2f5bd3',
  blue650: '#2952c6',
  blue200: '#c7d5f8',
  blue150: '#d8e2fb',
  blue100: '#e3eafc',
  red700: '#b8321b',
  red100: '#fbe3dc',
  amber500: '#d98a1c',
  amber800: '#9a5c0a',
  amber100: '#fbefd9',
  black: '#000000',
  paperScrim: 'rgba(244,245,248,0.55)',
  paperScrimStrong: 'rgba(244,245,248,0.94)',
} as const
```

`themes/daylight/daylight.ts`:

```ts
import { SHARED_MOTION, SHARED_SHAPE, SHARED_SPACE, SHARED_TYPE } from '@/theme/shared.tokens'
import type { Theme } from '@/theme/theme.types'
import { palette as p } from './palette'

const colors: Theme['colors'] = {
  background: p.paper050,
  surface: p.white,
  text: p.ink950,
  textMuted: p.slate600,
  accent: p.blue600,
  onAccent: p.white,
  accentSoft: p.blue100,
  line: p.slate250,
  lineStrong: p.ink900,
  danger: p.red700,
  dangerSurface: p.red100,
  warning: p.amber500,
  warningText: p.amber800,
  warningSurface: p.amber100,
  shadow: p.black,
  scrim: p.paperScrim,
  scrimStrong: p.paperScrimStrong,
}

export const daylight: Theme = {
  name: 'daylight',
  colors,
  type: SHARED_TYPE,
  space: SHARED_SPACE,
  shape: SHARED_SHAPE,
  elevation: {
    key: '0 1px 2px rgba(20,24,33,0.10)',
    sheet: '0 24px 60px -20px rgba(0,0,0,0.35)',
    panel: '0 -6px 12px rgba(0,0,0,0.12)',
  },
  motion: SHARED_MOTION,
  components: {
    grid: { frame: colors.lineStrong, boxLine: colors.lineStrong, cellLine: colors.line },
    cell: {
      fill: colors.surface,
      peer: p.slate100,
      same: p.blue200,
      selected: p.blue150,
      conflictFill: colors.dangerSurface,
      ring: colors.accent,
      given: colors.text,
      // Darker than the accent: the accent on the same-number fill is below 4.5 : 1.
      entry: p.blue650,
      conflict: colors.danger,
      note: colors.textMuted,
    },
    key: { fill: p.white, digit: colors.text, noteDigit: colors.accent },
    switch: { on: colors.accent, off: p.slate300, knob: p.white },
    segmented: { track: p.slate150, selected: colors.surface },
  },
}
```

`themes/daylight/index.ts`: `export { daylight } from './daylight'`

`themes/midnight/palette.ts`:

```ts
/** Midnight primitive tokens. Only this folder reads them (ADR-015, point 3). */
export const palette = {
  night950: '#0f1116',
  night900: '#171a22',
  night850: '#1d2029',
  night800: '#272b35',
  night700: '#3a3f4c',
  night600: '#4a5163',
  mist100: '#e7e9ef',
  mist400: '#9aa1b2',
  periwinkle400: '#84a0ff',
  periwinkle350: '#90abff',
  indigo900: '#232c47',
  indigo800: '#28355a',
  indigo750: '#2e3d6a',
  coral400: '#ff7a6b',
  maroon900: '#3a1f1f',
  amber400: '#f0aa4a',
  umber900: '#3a2a12',
  white: '#ffffff',
  black: '#000000',
  nightScrim: 'rgba(15,17,22,0.6)',
  nightScrimStrong: 'rgba(15,17,22,0.93)',
} as const
```

`themes/midnight/midnight.ts`:

```ts
import { SHARED_MOTION, SHARED_SHAPE, SHARED_SPACE, SHARED_TYPE } from '@/theme/shared.tokens'
import type { Theme } from '@/theme/theme.types'
import { palette as p } from './palette'

const colors: Theme['colors'] = {
  background: p.night950,
  surface: p.night900,
  text: p.mist100,
  textMuted: p.mist400,
  accent: p.periwinkle400,
  onAccent: p.night950,
  accentSoft: p.indigo900,
  line: p.night800,
  lineStrong: p.night600,
  danger: p.coral400,
  dangerSurface: p.maroon900,
  warning: p.amber400,
  warningText: p.amber400,
  warningSurface: p.umber900,
  shadow: p.black,
  scrim: p.nightScrim,
  scrimStrong: p.nightScrimStrong,
}

export const midnight: Theme = {
  name: 'midnight',
  colors,
  type: SHARED_TYPE,
  space: SHARED_SPACE,
  shape: SHARED_SHAPE,
  elevation: { key: 'none', sheet: '0 24px 60px -20px rgba(0,0,0,0.6)', panel: '0 -6px 12px rgba(0,0,0,0.4)' },
  motion: SHARED_MOTION,
  components: {
    grid: { frame: colors.lineStrong, boxLine: colors.lineStrong, cellLine: colors.line },
    cell: {
      fill: colors.surface,
      peer: p.night850,
      same: p.indigo750,
      selected: p.indigo800,
      conflictFill: colors.dangerSurface,
      ring: colors.accent,
      given: colors.text,
      // Lighter than the accent: the accent on the same-number fill is below 4.5 : 1.
      entry: p.periwinkle350,
      conflict: colors.danger,
      // The muted text, not the canvas note grey: that grey is below 4.5 : 1 on the selected fill.
      note: colors.textMuted,
    },
    key: { fill: p.night850, digit: colors.text, noteDigit: colors.accent },
    switch: { on: colors.accent, off: p.night700, knob: p.white },
    segmented: { track: p.night850, selected: colors.surface },
  },
}
```

`themes/midnight/index.ts`: `export { midnight } from './midnight'`

- [ ] **Step 8: Write the failing WCAG test of both themes**

`apps/mobile/src/theme/contrast.test.ts`:

```ts
import { contrastRatio } from './contrast.utils'
import type { Theme } from './theme.types'
import { daylight } from '@/theme/themes/daylight'
import { midnight } from '@/theme/themes/midnight'

type Pair = [label: string, foreground: (t: Theme) => string, background: (t: Theme) => string]

/** Every text colour on every fill it is drawn on. Notes never sit on the same-number fill: only empty cells hold notes. */
const TEXT_PAIRS: Pair[] = [
  ['text on background', (t) => t.colors.text, (t) => t.colors.background],
  ['text on surface', (t) => t.colors.text, (t) => t.colors.surface],
  ['muted on background', (t) => t.colors.textMuted, (t) => t.colors.background],
  ['muted on surface', (t) => t.colors.textMuted, (t) => t.colors.surface],
  ['accent on background', (t) => t.colors.accent, (t) => t.colors.background],
  ['accent on surface', (t) => t.colors.accent, (t) => t.colors.surface],
  ['accent on accent soft', (t) => t.colors.accent, (t) => t.colors.accentSoft],
  ['on-accent on accent', (t) => t.colors.onAccent, (t) => t.colors.accent],
  ['warning text on warning surface', (t) => t.colors.warningText, (t) => t.colors.warningSurface],
  ['danger on surface', (t) => t.colors.danger, (t) => t.colors.surface],
  ['conflict on conflict fill', (t) => t.components.cell.conflict, (t) => t.components.cell.conflictFill],
  ...(['fill', 'peer', 'same', 'selected'] as const).flatMap((fill): Pair[] => [
    [`given on ${fill}`, (t) => t.components.cell.given, (t) => t.components.cell[fill]],
    [`entry on ${fill}`, (t) => t.components.cell.entry, (t) => t.components.cell[fill]],
  ]),
  ...(['fill', 'peer', 'selected'] as const).map(
    (fill): Pair => [`note on ${fill}`, (t) => t.components.cell.note, (t) => t.components.cell[fill]],
  ),
  ['key digit on key', (t) => t.components.key.digit, (t) => t.components.key.fill],
  ['key note digit on key', (t) => t.components.key.noteDigit, (t) => t.components.key.fill],
  ['text on segmented track', (t) => t.colors.text, (t) => t.components.segmented.track],
  ['muted on segmented track', (t) => t.colors.textMuted, (t) => t.components.segmented.track],
  ['text on segmented selection', (t) => t.colors.text, (t) => t.components.segmented.selected],
]

describe.each([daylight, midnight])('$name', (theme) => {
  it.each(TEXT_PAIRS)('%s meets WCAG AA (4.5 : 1)', (_label, foreground, background) => {
    expect(contrastRatio(foreground(theme), background(theme))).toBeGreaterThanOrEqual(4.5)
  })
})
```

- [ ] **Step 9: Run it, expect PASS for every pair** (the fixes are already in the palettes). Temporarily set Daylight `cell.entry` to `colors.accent`, run, and see `entry on same` FAIL. Revert.

- [ ] **Step 10: Run `just typecheck`.** Expected: pass. Remove one key from `midnight.components.key` and confirm `tsc` names it; revert.

- [ ] **Step 11: Commit** — `feat(app): typed Daylight and Midnight themes with three token tiers (#50)`.

---

### Task 2: Install Unistyles and register the themes

**Files:**
- Modify: `apps/mobile/package.json`, `pnpm-lock.yaml`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/src/theme/unistyles.ts`, `apps/mobile/src/theme/unistyles.test.ts`
- Modify: `apps/mobile/index.ts`
- Modify: `apps/mobile/jest.setup.ts`, the `jest` block of `apps/mobile/package.json`

**Interfaces:**
- Consumes: `daylight`, `midnight`, `Theme`.
- Produces: `APP_THEMES = { light: daylight, dark: midnight }`, `type AppThemes`, `configureUnistyles(settings: StartupSettings): void` (Task 3 fills `StartupSettings`; this task uses `{ adaptiveThemes: true }`).

- [ ] **Step 1: Install**

```bash
cd apps/mobile
pnpm add react-native-unistyles@3.5.2 @react-native/normalize-colors@0.86.3 --save-exact
```

- [ ] **Step 2: Create `apps/mobile/babel.config.js`**

```js
// Unistyles rewrites the React Native imports under src/ so that a theme change updates styles without a render (ADR-015).
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [['react-native-unistyles/plugin', { root: 'src' }]],
  }
}
```

`babel-preset-expo` adds the worklets plugin itself in SDK 57. Check with `pnpm --filter mobile exec expo export --platform ios --output-dir /tmp/x` only if the developer installed the model; otherwise rely on Jest and the iPhone run.

- [ ] **Step 3: Write the failing registration test** — `src/theme/unistyles.test.ts`:

```ts
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles'
import { APP_THEMES } from './unistyles'
import { daylight } from '@/theme/themes/daylight'
import { midnight } from '@/theme/themes/midnight'

it('registers Daylight as light and Midnight as dark, the names adaptive themes need', () => {
  expect(APP_THEMES).toEqual({ light: daylight, dark: midnight })
})

it('gives styles the Daylight theme in Jest, because it is registered first', () => {
  const styles = StyleSheet.create((theme) => ({ box: { backgroundColor: theme.colors.background } }))
  expect(styles.box.backgroundColor).toBe(daylight.colors.background)
  expect(UnistylesRuntime.getTheme()).toBe(daylight)
})
```

- [ ] **Step 4: Wire the Jest mock.** In the `jest` block of `apps/mobile/package.json`, change `setupFiles` to:

```json
"setupFiles": ["react-native-unistyles/mocks", "<rootDir>/jest.setup.ts"]
```

At the end of `jest.setup.ts` add:

```ts
// The Unistyles mock resolves every StyleSheet.create with the first registered theme, so configure must run before a styles file loads.
require('@/theme/unistyles')
```

If Jest cannot transform `react-native-unistyles/src/mocks.ts`, add `react-native-unistyles` to `transformIgnorePatterns` by extending the jest-expo value, or point `setupFiles` to `react-native-unistyles/lib/commonjs/mocks.js`. Pick the first that works and note it in the PR.

- [ ] **Step 5: Run the test, expect FAIL** ("Cannot find module './unistyles'").

- [ ] **Step 6: Implement `src/theme/unistyles.ts`**

```ts
import { StyleSheet } from 'react-native-unistyles'
import { daylight } from '@/theme/themes/daylight'
import { midnight } from '@/theme/themes/midnight'

/** Unistyles follows the system only with themes named light and dark. */
export const APP_THEMES = { light: daylight, dark: midnight }

export type AppThemes = typeof APP_THEMES

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({ themes: APP_THEMES, settings: { adaptiveThemes: true } })
```

Task 3 replaces the fixed `settings` with the saved choice.

- [ ] **Step 7: Import it first in `apps/mobile/index.ts`**

```ts
// StyleSheet.configure must run before any StyleSheet.create (ADR-015).
import '@/theme/unistyles'
import { registerRootComponent } from 'expo'

import App from './App'

registerRootComponent(App)
```

If `index.ts` cannot use the `@/` alias under Metro, use `./src/theme/unistyles`.

- [ ] **Step 8: Run `pnpm --filter mobile exec jest src/theme` → PASS. Run `just test-ts` → every suite still passes.** If an existing suite breaks because the mock replaces `react-native-nitro-modules`, mock that module's used part in that test file.

- [ ] **Step 9: Commit** — `feat(app): install Unistyles 3.5.2 and register Daylight and Midnight (#50)`.

---

### Task 3: The saved theme choice

**Files:**
- Modify: `apps/mobile/src/settings/SettingsRepository.ts`, `SettingsRepository.test.ts`, `memorySettings.ts`, `memorySettings.test.ts`
- Modify: `apps/mobile/jest.setup.ts` (the `expo-sqlite/kv-store` mock gains `getItemSync`)
- Create: `apps/mobile/src/theme/preference.ts`, `apps/mobile/src/theme/preference.test.ts`
- Modify: `apps/mobile/src/theme/unistyles.ts`
- Modify: `apps/mobile/app.json`

**Interfaces:**
- Produces:
  - `SettingsRepository.getSync(key: string): string | null`
  - `type ThemePreference = 'system' | 'daylight' | 'midnight'`
  - `THEME_PREFERENCE_KEY = 'theme.preference'`
  - `parseThemePreference(value: string | null): ThemePreference`
  - `type StartupSettings = { adaptiveThemes: true } | { initialTheme: 'light' | 'dark' }`
  - `startupSettings(preference: ThemePreference): StartupSettings`
  - `type ThemeRuntime = { setAdaptiveThemes(on: boolean): void; setTheme(name: 'light' | 'dark'): void }`
  - `applyThemePreference(preference: ThemePreference, runtime: ThemeRuntime): void`
  - `saveThemePreference(settings: SettingsRepository, preference: ThemePreference, runtime?: ThemeRuntime): Promise<void>` (runtime defaults to `UnistylesRuntime`)
  - `readThemePreference(settings: SettingsRepository): ThemePreference` (synchronous)
  
  #38 (settings screen) builds the System / Daylight / Midnight control on these functions.

- [ ] **Step 1: Failing tests for `getSync`.** In `SettingsRepository.test.ts` add `getItemSync: jest.fn((_key: string): string | null => 'ripples')` to `fakeStore()` and:

```ts
it('reads a key synchronously, for the theme before the first frame', () => {
  const store = fakeStore()
  expect(createSettingsRepository(store).getSync('theme.preference')).toBe('ripples')
  expect(store.getItemSync).toHaveBeenCalledWith('theme.preference')
})
```

In `kvSettings` tests: `it('reads a value it set, synchronously', async () => { await kvSettings.set('k', 'v'); expect(kvSettings.getSync('k')).toBe('v') })`. In `memorySettings.test.ts`: `expect(createMemorySettings({ a: '1' }).getSync('a')).toBe('1')` and `getSync('missing')` is `null`.

- [ ] **Step 2: Run, expect FAIL. Implement:** add `getSync(key: string): string | null` to `SettingsRepository`, `getItemSync(key: string): string | null` to `KeyValueStore`, `getSync: (key) => store.getItemSync(key)` in `createSettingsRepository`, `getSync: (key) => items.get(key) ?? null` in the memory fake, and `getItemSync: jest.fn((key: string) => mockItems.get(key) ?? null)` in the `expo-sqlite/kv-store` mock of `jest.setup.ts`. Run → PASS.

- [ ] **Step 3: Failing tests for the preference** — `src/theme/preference.test.ts`:

```ts
import { createMemorySettings } from '@/settings/memorySettings'
import {
  applyThemePreference,
  parseThemePreference,
  readThemePreference,
  saveThemePreference,
  startupSettings,
  THEME_PREFERENCE_KEY,
} from './preference'

const runtime = () => ({ setAdaptiveThemes: jest.fn(), setTheme: jest.fn() })

describe('parseThemePreference', () => {
  it.each(['system', 'daylight', 'midnight'] as const)('keeps %s', (value) => {
    expect(parseThemePreference(value)).toBe(value)
  })
  it.each([null, '', 'sepia', 'Daylight'])('falls back to system for %p', (value) => {
    expect(parseThemePreference(value)).toBe('system')
  })
})

describe('startupSettings', () => {
  it('follows the system for system', () => {
    expect(startupSettings('system')).toEqual({ adaptiveThemes: true })
  })
  it('starts in the saved theme, without adaptive themes', () => {
    expect(startupSettings('daylight')).toEqual({ initialTheme: 'light' })
    expect(startupSettings('midnight')).toEqual({ initialTheme: 'dark' })
  })
})

describe('applyThemePreference', () => {
  it('turns adaptive themes on for system and sets no theme', () => {
    const rt = runtime()
    applyThemePreference('system', rt)
    expect(rt.setAdaptiveThemes).toHaveBeenCalledWith(true)
    expect(rt.setTheme).not.toHaveBeenCalled()
  })
  it('turns adaptive themes off before it sets a theme, because setTheme throws while they are on', () => {
    const rt = runtime()
    const calls: string[] = []
    rt.setAdaptiveThemes.mockImplementation((on: boolean) => calls.push(`adaptive:${on}`))
    rt.setTheme.mockImplementation((name: string) => calls.push(`theme:${name}`))
    applyThemePreference('midnight', rt)
    expect(calls).toEqual(['adaptive:false', 'theme:dark'])
  })
})

describe('save and read', () => {
  it('saves the choice and applies it', async () => {
    const settings = createMemorySettings()
    const rt = runtime()
    await saveThemePreference(settings, 'daylight', rt)
    expect(await settings.get(THEME_PREFERENCE_KEY)).toBe('daylight')
    expect(rt.setTheme).toHaveBeenCalledWith('light')
    expect(readThemePreference(settings)).toBe('daylight')
  })
  it('reads system when nothing is saved', () => {
    expect(readThemePreference(createMemorySettings())).toBe('system')
  })
})
```

- [ ] **Step 4: Run, expect FAIL. Implement `src/theme/preference.ts`**

```ts
import { UnistylesRuntime } from 'react-native-unistyles'
import type { SettingsRepository } from '@/settings/SettingsRepository'

export type ThemePreference = 'system' | 'daylight' | 'midnight'

export const THEME_PREFERENCE_KEY = 'theme.preference'

/** The Unistyles name of each theme. Adaptive themes need the names light and dark. */
const UNISTYLES_NAME = { daylight: 'light', midnight: 'dark' } as const

export type StartupSettings = { adaptiveThemes: true } | { initialTheme: 'light' | 'dark' }

export type ThemeRuntime = { setAdaptiveThemes(on: boolean): void; setTheme(name: 'light' | 'dark'): void }

export function parseThemePreference(value: string | null): ThemePreference {
  return value === 'daylight' || value === 'midnight' ? value : 'system'
}

/** Unistyles refuses adaptiveThemes together with initialTheme, so a saved theme turns adaptive themes off. */
export function startupSettings(preference: ThemePreference): StartupSettings {
  return preference === 'system' ? { adaptiveThemes: true } : { initialTheme: UNISTYLES_NAME[preference] }
}

export function applyThemePreference(preference: ThemePreference, runtime: ThemeRuntime): void {
  if (preference === 'system') {
    runtime.setAdaptiveThemes(true)
    return
  }
  runtime.setAdaptiveThemes(false)
  runtime.setTheme(UNISTYLES_NAME[preference])
}

/** Synchronous, so the first frame already has the saved theme. */
export function readThemePreference(settings: SettingsRepository): ThemePreference {
  return parseThemePreference(settings.getSync(THEME_PREFERENCE_KEY))
}

export async function saveThemePreference(
  settings: SettingsRepository,
  preference: ThemePreference,
  runtime: ThemeRuntime = UnistylesRuntime,
): Promise<void> {
  applyThemePreference(preference, runtime)
  await settings.set(THEME_PREFERENCE_KEY, preference)
}
```

If the dependency-cruiser rule `utils-and-constants-have-no-ui` or another rule refuses an import, keep the file name `preference.ts` (it is not a utils file). Run → PASS.

- [ ] **Step 5: Use the saved choice at start.** In `src/theme/unistyles.ts` replace the `configure` call:

```ts
StyleSheet.configure({
  themes: APP_THEMES,
  settings: startupSettings(readThemePreference(kvSettings)),
})
```

with imports of `startupSettings`, `readThemePreference` from `@/theme/preference` and `kvSettings` from `@/settings/SettingsRepository`. Run `pnpm --filter mobile exec jest src/theme` → PASS (the kv mock is empty, so System).

- [ ] **Step 6: `app.json`** — set `"userInterfaceStyle": "automatic"`.

- [ ] **Step 7: Commit** — `feat(app): follow the system theme or the saved choice from the first frame (#50)`.

---

### Task 4: The colour-literal lint rule (written, not yet on)

**Files:**
- Create: `scripts/oxlint/sudoku-plugin.mjs`
- Create: `scripts/oxlint/sudoku-plugin.test.mjs`
- Modify: `justfile` (`test-ts` runs the plugin test)

**Interfaces:**
- Produces: the oxlint rule `sudoku/no-colour-literal`.

- [ ] **Step 1: Write the failing test** (Node's test runner, no new dependency) — `scripts/oxlint/sudoku-plugin.test.mjs`:

```js
import assert from 'node:assert/strict'
import { test } from 'node:test'
import plugin from './sudoku-plugin.mjs'

function reports(node) {
  const found = []
  const visitors = plugin.rules['no-colour-literal'].create({ report: (r) => found.push(r) })
  visitors[node.type](node)
  return found.length
}
const literal = (value) => ({ type: 'Literal', value })
const template = (...cooked) => ({ type: 'TemplateLiteral', quasis: cooked.map((c) => ({ value: { cooked: c } })) })

test('refuses every colour form', () => {
  for (const value of ['#fff', '#ffff', '#ffffff', '#ffffff80', 'rgb(0,0,0)', 'rgba(0, 0, 0, 0.6)', 'hsl(0 0% 0%)', 'hsla(0,0%,0%,1)', 'white', 'Black']) {
    assert.equal(reports(literal(value)), 1, value)
  }
  assert.equal(reports(template('#fff')), 1)
})

test('keeps strings that are not colours', () => {
  for (const value of ['#1', '#12', '#12345', 'whiteboard', 'red', 'row', '', 42, null]) {
    assert.equal(reports(literal(value)), 0, String(value))
  }
  assert.equal(reports(template('cell-', '')), 0)
})
```

`'red'` stays allowed on purpose: the named-colour check covers only `white` and `black`, the two the code used. Hex and functions cover the rest.

- [ ] **Step 2: Run** `node --test scripts/oxlint/` → FAIL (module missing).

- [ ] **Step 3: Implement `scripts/oxlint/sudoku-plugin.mjs`**

```js
// ADR-015, point 7: only apps/mobile/src/theme/ holds raw colour values.
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const FUNCTION = /^(?:rgba?|hsla?)\(/i
const NAMED = new Set(['white', 'black'])
const MESSAGE = 'A colour literal belongs in src/theme/ (ADR-015). Use a theme token.'

function isColour(value) {
  if (typeof value !== 'string') return false
  const text = value.trim()
  return HEX.test(text) || FUNCTION.test(text) || NAMED.has(text.toLowerCase())
}

export default {
  meta: { name: 'sudoku' },
  rules: {
    'no-colour-literal': {
      create(context) {
        return {
          Literal(node) {
            if (isColour(node.value)) context.report({ node, message: MESSAGE })
          },
          TemplateLiteral(node) {
            if (node.quasis.some((quasi) => isColour(quasi.value.cooked))) context.report({ node, message: MESSAGE })
          },
        }
      },
    },
  },
}
```

- [ ] **Step 4: Run** `node --test scripts/oxlint/` → PASS.

- [ ] **Step 5: Run the plugin test with the TypeScript tests.** In `justfile`, `test-ts`:

```make
# Vitest (core), Jest (app) and the lint plugin test
test-ts:
    pnpm -r test
    node --test scripts/oxlint/
```

- [ ] **Step 6: Commit** — `feat(lint): oxlint rule that finds colour literals (#50)`.

---

### Task 5: Migrate the correction screen

**Files:**
- Modify: `apps/mobile/src/scan/screens/CorrectionScreen/CorrectionScreen.tsx`, `CorrectionScreen.styles.ts`, `CorrectionScreen.test.tsx`
- Modify: `apps/mobile/src/scan/components/CorrectionCell/CorrectionCell.tsx`, `CorrectionCell.styles.ts`

**Interfaces:**
- Consumes: `Theme` tokens through `StyleSheet.create(theme => …)` and `useUnistyles()`.
- Produces: `CorrectionCell` without a `colors` prop.

- [ ] **Step 1: Update the tests first.** In `CorrectionScreen.test.tsx` replace `import { LIGHT } from '@/theme/colors'` with `import { daylight } from '@/theme/themes/daylight'`, and:
  - `LIGHT.text` → `daylight.colors.text`
  - `LIGHT.accent` → `daylight.colors.accent`
  - `LIGHT.warning` → `daylight.colors.warning`
  - `LIGHT.background` → `daylight.colors.background`
  
  These tests pass before and after the migration, because the Daylight values equal the old light values. They guard the migration: the screen must render the same tokens through Unistyles. Add one test that fails before the migration:

```ts
it('takes the panel colour from the theme styles, not from an inline object', () => {
  render(<CorrectionScreen result={okResult()} layout={layout} onRetake={jest.fn()} />)
  const own = screen.getByTestId('correction-panel').props.style.flat(Infinity)
  expect(own).toContainEqual(expect.objectContaining({ backgroundColor: daylight.colors.surface, shadowColor: daylight.colors.shadow, borderRadius: 24 }))
})
```

  It fails now, because the colour sits in a separate inline object without `borderRadius`. Run → FAIL.

- [ ] **Step 2: Move the themed styles into `CorrectionScreen.styles.ts`**

```ts
import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  screen: { ...StyleSheet.absoluteFillObject },
  screenFilled: { backgroundColor: theme.colors.background },
  title: { position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 2 },
  titleText: { fontSize: 17, fontWeight: '600', color: theme.colors.text },
  subtitle: { fontSize: 13, color: theme.colors.textMuted },
  waiting: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  panel: {
    position: 'absolute',
    borderRadius: 24,
    padding: 12,
    gap: 9,
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  chip: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: theme.shape.radius.pill,
    backgroundColor: theme.colors.warningSurface,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.colors.warningText },
  sure: { fontSize: 13, fontWeight: '500', color: theme.colors.textMuted },
  play: { alignItems: 'center', paddingVertical: 12, borderRadius: 14, opacity: 0.5, backgroundColor: theme.colors.accent },
  playText: { fontSize: 16, fontWeight: '600', color: theme.colors.onAccent },
  retake: { fontSize: 15, fontWeight: '500', textAlign: 'center', color: theme.colors.accent },
  failure: { gap: 4 },
  failureTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  failureReason: { fontSize: 13, color: theme.colors.textMuted },
}))
```

Keep the existing font sizes: the correction screen is not part of the type roles yet. Do not spread a Unistyles style; `StyleSheet.absoluteFillObject` is a plain object, so the spread is fine.

- [ ] **Step 3: Update `CorrectionScreen.tsx`.**
  - Remove `useColors`. Import `StyleSheet` for `absoluteFill` from `react-native-unistyles` only if needed; prefer `styles.screen`.
  - Read Skia colours: `const { theme } = useUnistyles()` (ADR-015, point 10). In the `board` picture use `theme.colors.surface`, `theme.components.grid.boxLine` (was `ink`) and `theme.components.grid.cellLine` (was `line`). Memo deps: `[grid.width, theme]`.
  - Replace each `[styles.x, { color: colors.y }]` with `styles.x`. Keep layout-only inline objects in arrays: `[styles.title, { left: title.x, … }, titleStyle]`.
  - `<View testID="correction-screen" style={[styles.screen, !clock && styles.screenFilled]}>`.
  - `<ActivityIndicator color={theme.colors.textMuted} />`.
  - Drop the `colors` prop from `<CorrectionCell>`.

- [ ] **Step 4: `CorrectionCell`.** Styles file:

```ts
import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  digit: { position: 'absolute', textAlign: 'center', fontVariant: ['tabular-nums'] },
  given: { color: theme.colors.text, fontWeight: '600' },
  entry: { color: theme.colors.accent, fontWeight: '500' },
}))
```

Component: remove the `colors` prop and its type import. Style array: `[styles.digit, entry ? styles.entry : styles.given, { left, top, width: size, height: size, lineHeight: size, fontSize: size * 0.6 }, digitStyle]`. Ring colour: `const { theme } = useUnistyles()` and `color={theme.colors.warning}` (a prop, not a style).

- [ ] **Step 5: Run** `pnpm --filter mobile exec jest src/scan/screens/CorrectionScreen src/scan/components` → PASS. `just typecheck` → PASS.

- [ ] **Step 6: Commit** — `refactor(scan): correction screen styles from the Unistyles theme (#50)`.

---

### Task 6: Migrate the camera screen, the Skia layers and the effects; delete `colors.ts`

**Files:**
- Create: `apps/mobile/src/theme/fixed.colors.ts`
- Modify: `apps/mobile/src/scan/screens/CameraScreen/CameraScreen.tsx`, `CameraScreen.styles.ts`, `CameraScreen.test.tsx` if it asserts colours
- Modify: `apps/mobile/src/scan/components/TransitionCanvas/TransitionCanvas.tsx`, `TransitionCanvas.test.tsx`
- Modify: `apps/mobile/src/scan/effects/kit.ts`, `kit.test.ts`, `types.ts` (comment of `ink`)
- Modify: `apps/mobile/src/scan/effects/components/EffectCanvas/EffectCanvas.tsx`, `EffectCanvas.test.tsx`
- Modify: `apps/mobile/src/scan/effects/components/EffectPicker/EffectPicker.styles.ts`
- Modify: `apps/mobile/src/scan/effects/common/sprite.ts`, `common/dim.ts`, `spotlight-brackets/spotlight-brackets.effect.ts`
- Modify: `apps/mobile/src/scan/utils/correction.utils.test.ts` (literals → tokens)
- Delete: `apps/mobile/src/theme/colors.ts`, `apps/mobile/src/theme/colors.test.ts`

**Interfaces:**
- Produces: `FIXED_COLORS` (colours that do not change with the theme), `makeDrawKit(effects: readonly AnyEffect[], ink: string): DrawKit`, `TransitionCanvas` without a `colors` prop.

- [ ] **Step 1: `src/theme/fixed.colors.ts`** — the scan overlay keeps its own look in both themes (ADR-015, Consequences). The camera feed is dark in both themes.

```ts
/** Colours over the live camera and in the effect lab. They stay the same in every theme (ADR-015, Consequences). */
export const FIXED_COLORS = {
  flash: '#ffffff',
  shutterRing: '#ffffff',
  shutterFill: 'rgba(255,255,255,0.3)',
  dim: '#000000',
  bracket: '#ffffff',
  starCore: 'rgba(255,255,255,1)',
  starHalo: 'rgba(255,255,255,0.3)',
  starEdge: 'rgba(255,255,255,0)',
  labPill: 'rgba(0,0,0,0.6)',
  labList: 'rgba(0,0,0,0.8)',
  labText: '#ffffff',
  labFamily: 'rgba(255,255,255,0.6)',
  labActive: '#ffd60a',
} as const
```

- [ ] **Step 2: Failing kit test.** In `kit.test.ts` replace the light-ink test. Tests under `src/` also may not hold colour literals, so take the ink from the Daylight theme:

```ts
import { daylight } from '@/theme/themes/daylight'

it('gives the ink it is given as RGB from 0 to 1', () => {
  const ink = daylight.components.grid.boxLine
  const value = Number.parseInt(ink.slice(1), 16)
  expect(makeDrawKit([], ink).ink).toEqual([(value >> 16) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255])
})
```

Run → FAIL (makeDrawKit takes one argument, ink is light).

- [ ] **Step 3: `kit.ts`** — signature `makeDrawKit(effects: readonly AnyEffect[], ink: string): DrawKit`, `ink: rgb(ink)`, delete the `LIGHT` import and the "light only" comment. `types.ts`: the `ink` comment becomes "the box-line colour of the correction grid in the current theme, as RGB, each 0..1."

- [ ] **Step 4: `EffectCanvas.tsx`** — `const { theme } = useUnistyles()`; `const ink = theme.components.grid.boxLine`; `const kit = useMemo(() => makeDrawKit(__DEV__ ? EFFECTS : [DEFAULT_EFFECT], ink), [ink])`. A new theme makes a new kit, so the frame worklet captures the new ink. Add to `EffectCanvas.test.tsx` a test that `makeDrawKit` is called with `daylight.components.grid.boxLine` (spy on `@/scan/effects/kit`, the path the code imports). Run the kit and EffectCanvas tests → PASS.

- [ ] **Step 5: `TransitionCanvas`** — drop the `colors` prop and type import. Inside: `const { theme } = useUnistyles()`; `makePaints(theme)` reads `theme.colors.background` and `theme.components.cell.fill`; memo deps `[theme]`. Grid lines: `theme.components.grid.boxLine`, `theme.components.grid.cellLine`. Capture them in local constants before the worklet (worklet rule in apps/mobile/AGENTS.md). In `TransitionCanvas.test.tsx` delete `colors={LIGHT}` and its import. In `CameraScreen.tsx` delete `colors={colors}`, `useColors` and its import. Run both tests → PASS.

- [ ] **Step 6: Fixed colours in the camera and the effects.**
  - `CameraScreen.styles.ts`: `import { StyleSheet } from 'react-native-unistyles'` and `import { FIXED_COLORS } from '@/theme/fixed.colors'`; `backgroundColor: FIXED_COLORS.flash`, `borderColor: FIXED_COLORS.shutterRing`, `backgroundColor: FIXED_COLORS.shutterFill`.
  - `EffectPicker.styles.ts`: same imports; `labPill`, `labList`, `labText`, `labFamily`, `labActive`.
  - `sprite.ts`: `Skia.Color(FIXED_COLORS.starCore)` twice, `starHalo`, `starEdge`. An imported value is safe in a worklet.
  - `dim.ts`: `Skia.Color(FIXED_COLORS.dim)`.
  - `spotlight-brackets.effect.ts`: `Skia.Color(FIXED_COLORS.bracket)`.
  - `correction.utils.test.ts`: replace `'#111'` and `'#ccc'` with `const INK = daylight.components.grid.boxLine` and `const LINE = daylight.components.grid.cellLine`.

- [ ] **Step 7: Delete `src/theme/colors.ts` and `src/theme/colors.test.ts`.** Search: `rg -n "theme/colors|useColors|LIGHT\b|DARK\b" apps/mobile` → no match.

- [ ] **Step 8: Run** `just typecheck` and `just test-ts` → PASS.

- [ ] **Step 9: Commit** — `refactor(scan): camera, Skia layers and effects read the theme; remove useColors (#50)`.

---

### Task 7: Turn the lint rules on and update the style rules

**Files:**
- Modify: `.oxlintrc.json`
- Modify: `.dependency-cruiser.cjs`
- Modify: `apps/mobile/AGENTS.md`

- [ ] **Step 1: Turn the rule on.** In `.oxlintrc.json`, add `"jsPlugins": ["./scripts/oxlint/sudoku-plugin.mjs"]` at the top level, and two overrides after the existing one:

```json
{
  "files": ["apps/mobile/**/*.ts", "apps/mobile/**/*.tsx", "apps/mobile/**/*.js"],
  "rules": { "sudoku/no-colour-literal": "error" }
},
{
  "files": ["apps/mobile/src/theme/**"],
  "rules": { "sudoku/no-colour-literal": "off" }
}
```

`app.json` is not linted by oxlint; its Android icon colour stays. If oxlint reads the path relative to the config file differently, adjust and keep the test below.

- [ ] **Step 2: Prove it.** Add `export const probe = '#ffffff'` to `apps/mobile/src/utils/log.utils.ts`, run `just lint` → FAIL with `sudoku(no-colour-literal)`. Remove the line. Add the same line to `apps/mobile/src/theme/shared.tokens.ts`, run → no colour error. Remove it. Run `just lint` → PASS on the clean tree.

- [ ] **Step 3: dependency-cruiser.** Replace the rule `styles-import-only-react-native`:

```js
{
  name: 'styles-import-only-react-native-and-the-theme',
  comment:
    'A styles file holds StyleSheet.create from react-native-unistyles. It may read React Native and the fixed colours of src/theme/, nothing else (ADR-015).',
  severity: 'error',
  from: { path: '^apps/mobile/src/.+\\.styles\\.ts$' },
  to: {
    pathNot: ['/node_modules/react-native/', '/node_modules/react-native-unistyles/', '^apps/mobile/src/theme/'],
  },
},
```

Run `just boundaries` → PASS. Then check that `react-native-unistyles` resolves under pnpm to a path that contains `/node_modules/react-native-unistyles/`; if not, widen the pattern to `react-native-unistyles`.

- [ ] **Step 4: `apps/mobile/AGENTS.md`.** Change:
  - Layout table, `<Name>.styles.ts` row: "The `StyleSheet` from `react-native-unistyles`. Themed styles live here: `StyleSheet.create(theme => …)` (ADR-015)."
  - Import rule 6: "A styles file imports only `react-native`, `react-native-unistyles` and `src/theme/`."
  - Add a section "Theme" with these rules:
    1. Do not write a colour value outside `src/theme/`. `just lint` refuses it.
    2. Read a token from the theme in a styles file. In a Skia surface, read it with `useUnistyles()` and remake the paints when the theme changes.
    3. Do not spread a Unistyles style. Pass an array: `[styles.cell, { left }]`.
    4. Use a semantic token in most components. Use a component token only in its own component. Never import a theme's `palette.ts`.
    5. To add a theme, add a folder in `src/theme/themes/` and register it in `src/theme/unistyles.ts`.
  - Write in STE light.

- [ ] **Step 5: Run** `just lint`, `just typecheck`, `just test-ts`, `just docs-check` → PASS.

- [ ] **Step 6: Commit** — `chore(lint): refuse colour literals outside src/theme and describe the Unistyles style rules (#50)`.

---

### Task 8: Pull request, then ADR-015 after the iPhone run

**Files:**
- Modify (after the developer's iPhone run only): `docs/architecture/adr/adr-015-theming.md`, `docs/architecture/00-DECISIONS.md`, `docs/architecture/09-architecture-decisions.md`

- [ ] **Step 1: Push and open the pull request against `develop`.** Body: summary, the three changed token values with their contrast ratios, the lint approach, `Closes #50`, and an "On the iPhone" checklist:
  1. `cd apps/mobile && pnpm exec expo prebuild --clean` (new native module, new Babel plugin).
  2. `pnpm exec expo run:ios --device` (see the memory note on `DEVELOPER_DIR` and Metro port 8081).
  3. The scan flow works: camera, capture, transition, correction screen.
  4. Set iOS to Dark: the correction screen turns Midnight without a restart. Set it back: Daylight.
  5. In a development build, run once in the Metro console or a temporary dev menu: no saved value means System. (The setting UI comes with #38.)
  6. Reanimated animations of the correction screen still run (the digit sweep, the panel slide).

- [ ] **Step 2: Tick the acceptance criteria of #50 that are met** (all except "runs on the iPhone" and "ADR-015 changes to Accepted"). Use `gh issue edit 50 --body-file …` after you change `- [ ]` to `- [x]` for each met item.

- [ ] **Step 3: Prepare the ADR change, but commit it only after the developer reports a passing iPhone run.**
  - `adr-015-theming.md`: front matter `status: ACCEPTED`; metadata `Status | Accepted`; in Decision point 1 delete "**Pending a run in the development build on the iPhone** (#50)." and add "It runs with Expo 57, React Native 0.86 and Reanimated 4.5 in the development build on the iPhone." Under Consequences, add one line for the three token values that changed for WCAG AA, and one line that adaptive themes need the Unistyles theme names `light` and `dark`.
  - `00-DECISIONS.md` and `09-architecture-decisions.md`: change the ADR-015 row status to Accepted.
  - Commit `docs(adr): accept ADR-015 after the iPhone run (#50)`.
  - If the iPhone run fails: do not change ADR-015. Report the failure. ADR-015 needs a new decision (the developer decides).

## Self-review notes

- Spec coverage: Unistyles installed (T2), ADR-015 to Accepted gated (T8), canvas tokens in three tiers (T1), `type.given/entry/note` and `shape.gridLine` (T1), complete `Theme` type (T1 step 10), `automatic` (T3), saved choice through `SettingsRepository` (T3), AGENTS.md style rules (T7), `colors.ts` and `useColors()` gone, scan screens themed (T5, T6), WCAG test (T1), lint refuses colour literals (T4, T7), no decoration slot (Global Constraints).
- Type names used across tasks: `Theme`, `ThemeName`, `daylight`, `midnight`, `APP_THEMES`, `ThemePreference`, `startupSettings`, `applyThemePreference`, `saveThemePreference`, `readThemePreference`, `FIXED_COLORS`, `makeDrawKit(effects, ink)`.
