---
status: ACCEPTED
---

# ADR-015: Unistyles 3 with a three-tier token theme, two themes first

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Accepted   |
| Date    | 2026-10-12 |
| Contact | Felix      |

Amended by [ADR-021](adr-021-four-themes.md): point 2 (four themes, not two) and point 9 (the
first theme decorations).

## Context

The app styles its components with React Native `StyleSheet`. `src/theme/colors.ts` has a light
and a dark palette. `useColors()` always returns the light palette. The game UI (M1, epic #34)
does not exist yet, so this is the last cheap moment to choose a styling engine.

The app ships two themes first: Daylight and Midnight. They start from the two palettes of
`colors.ts`. The [design canvas](https://claude.ai/artifact/U23JHiGA1Pq3HJX6oMiBF4) holds their
final values. Later the developer may add themes that change more than the colours: typography,
shapes, shadows, textures. A theme lab explored 17 such directions, for example a skeuomorphic
and a "goth" theme ([theme lab](https://claude.ai/artifact/YNDgnqsVgn8rbpL3iZAXXm)). The
developer chose none of them. This ADR decides the mechanism, so a later theme needs no rework
of the components.

A theme changes three kinds of thing:

1. **Values:** colours, fonts, sizes, radii, shadows and durations. Tokens cover these.
2. **Variants:** the same component with other values per state, for example a selected cell.
3. **Structure:** extra drawn elements, for example a texture behind the grid. Tokens cannot
   describe these.

Every styling library handles values and variants. None of them handles structure.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| `StyleSheet` + own theme context | No dependency | A theme switch re-renders every themed component. We build variants and adaptive light/dark ourselves |
| **Unistyles 3** | Same API as `StyleSheet`, so the migration is small. Typed themes, variants and adaptive light/dark. A theme switch updates styles in C++ without React re-renders. Uses Nitro, which the app already has | One more native dependency. Must work with Expo 57, React Native 0.86 and Reanimated 4 |
| NativeWind or Uniwind | Large community. Theming through CSS variables | Class strings, not typed objects. TypeScript cannot check that a theme is complete |
| Tamagui | Strong nested themes. A component kit | Heavy. Owns the components and the build. The app has custom UI, so the kit gives little |

## Decision

1. **Unistyles 3 styles the app.** Components use `StyleSheet.create(theme => …)` from
   `react-native-unistyles`. It runs with Expo 57, React Native 0.86 and Reanimated 4.5 in the
   development build on the iPhone. The run on 2026-10-12 gave these results:
   - The scan flow works. The camera runs at 30 fps, detection takes about 10 ms and the overlay
     runs at about 120 fps.
   - Two captures were recognised, and both moved into the correction screen.
   - The iOS Dark and Light setting changes the theme and the status bar without a restart.
   - The Midnight contrast on the correction screen is readable.
2. **The app ships two themes: Daylight and Midnight.** They follow the system setting. The
   player can override it with System, Daylight or Midnight in Settings. The choice is saved
   through `SettingsRepository` (ADR-012).
3. **A theme is one typed object with three token tiers:**

   | Tier | Example | Who reads it |
   | --- | --- | --- |
   | Primitive token | `ink900 = '#1d2330'` | Only the folder of its own theme |
   | Semantic token | `colors.text`, `type.given`, `shape.radius.md` | Most components |
   | Component token | `components.cell.selected`, `components.key.fill` | One component only |

4. **Semantic tokens cover more than colours.** The groups are `colors`, `type`, `space`,
   `shape`, `elevation` and `motion`. A group gets a new token only when a component needs it.
5. **The digits have their own type roles:** `type.given`, `type.entry` and `type.note`. Each
   role has a family, a weight, a scale and an optional text shadow.
6. **The grid draws its lines as gaps.** The grid is boxes of cells with a gap over a
   background colour. The line widths are `shape` tokens, so a later theme can turn lines into
   spaced tiles without a new component.
7. **Components never use a primitive token or a colour literal.** Only `src/theme/` holds raw
   values. A theme folder does not export its primitive tokens. A lint rule refuses colour
   literals outside `src/theme/` (#50).
8. **Every theme has the same shape.** The `Theme` type requires every token, so TypeScript
   refuses an incomplete theme. A unit test checks every text pair of every theme for a WCAG AA
   contrast of 4.5 : 1 or more.
9. **Theme decorations are the mechanism for structure, but v1 builds none.** A theme
   decoration is a named slot that a component renders, and that a theme can fill with its own
   component. Theme decorations live in a registry per theme, outside the Unistyles theme
   object. Daylight and Midnight need no theme decoration, so none exists until a theme needs
   one.
10. **Skia reads the theme as values.** A Skia surface reads its tokens through
    `useUnistyles()`. It makes new paints when the theme changes.
11. **The tokens are TypeScript in `src/theme/`.** Each theme is one folder. Figma does not
    generate them.

## Consequences

- To add a theme, add a folder in `src/theme/themes/` and register it. TypeScript names every
  missing token. A theme that changes structure also adds the theme decorations it needs.
- The migration from `StyleSheet` changes the import and moves colours from `useColors()` into
  `StyleSheet.create(theme => …)`. `useColors()` goes away (#50).
- The style file rules in `apps/mobile/AGENTS.md` change: a styles file imports
  `react-native-unistyles`, and themed styles move into it. #50 updates the rules.
- `app.json` changes `userInterfaceStyle` from `light` to `automatic`, so the app can follow
  the system setting (#50).
- A theme switch does not re-render the grid.
- Three canvas values changed for WCAG AA: the Daylight entry is `#2952c6`, the Midnight entry
  is `#90abff` and the Midnight note is `#9aa1b2`.
- Unistyles follows the system only with themes named `light` and `dark`. So Unistyles
  registers Daylight as `light` and Midnight as `dark`. The player sees the names Daylight and
  Midnight.
- Fonts and assets of every theme ship inside the app, because the app works offline (SUD-01).
- The scan overlay effects keep their own look for now. If an effect must follow the theme, the
  ADR-014 draw kit must remake its paints on a theme change.
- The theme lab showed more token shapes that later themes may need: a colour per digit, a fill
  per box, a conflict mark for palettes that cannot show a conflict in colour. They are not
  built now.

## Reassessment Triggers

- Unistyles 3 does not run on Expo 57, React Native 0.86 or Reanimated 4 (#50).
- A theme needs a structural change that a decoration slot cannot express, for example another
  layout of the grid.
- A designer owns the themes in Figma. Then a script generates the tokens from Figma variables.
- The developer picks a third theme. Its fonts and assets add to the app size.
