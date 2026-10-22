# AGENTS.md: the Expo app

These instructions add to the root `AGENTS.md`. They apply to work in `mobile/`.

## Do not trust remembered Expo APIs

Expo changes its APIs in every SDK release. Before you write code that uses an Expo, EAS or
React Native API:

1. Read the major version of `expo` in `package.json`.
2. Read the docs for that version: `https://docs.expo.dev/versions/v<major>.0.0/`.
3. For other topics, start at `https://docs.expo.dev/llms.txt`. Do not answer from memory.

## Commands

| Task | Command |
| --- | --- |
| Add a dependency | For a package in Expo's bundled list, run `pnpm exec expo install <package>`. It picks the version that fits the SDK. For any other native package, run `pnpm add <package>@<version> --save-exact`. Pin the version, because a native module can break with an SDK upgrade |
| Start the dev server | `just app` |
| Build the development variant on a device | `just ios-dev <UDID>`. The app is "Sudoku Dev" with a DEV ribbon (ADR-022) |
| Build the production variant on a device | `just ios-release <UDID>`. The app is "Sudoku", a Release build (ADR-022) |
| Build the development variant in Release on a device, to measure the quality scenarios | `just ios-measure <UDID>`. It logs `[measure]` lines. See `docs/operations/measure-quality.md` |
| Build for the iOS Simulator | `just ios-simulator`. A Release build of the development variant, without code signing and without Metro (ADR-010). CI runs the same build |
| Check the native build in CI | `gh workflow run ios-simulator.yml --ref <branch>`. Start it before a pull request with a native change merges. A push to an open pull request starts no build (ADR-010) |
| Render the app icons | `just icons`. Change the design in `tools/icons/geometry.mjs`, not in the PNGs |
| Check the Expo setup | `pnpm dlx expo-doctor` |
| Lint, typecheck, test | `just lint`, `just typecheck`, `just test-ts` from the repository root |

Run lint, typecheck and tests before you say a task is done.

## Rules

- `ios/` and `android/` are generated (Continuous Native Generation, ADR-002). Do not create,
  edit or commit them. Configure native behaviour in `app.json` and config plugins.
- Native modules need a development build, not Expo Go. Build locally with
  `pnpm exec expo run:ios`. Cloud builds (EAS) are not used yet (ADR-010).
- Keep the folders: `src/app/` (routes), `src/home/` (home UI), `src/game/` (game UI),
  `src/settings/` (settings UI and `SettingsRepository`: screens, components, hooks, utils,
  constants), `src/stats/` (stats UI: screens, components, hooks, utils, constants), `src/techniques/` (the techniques screen and the technique pages: screens, components, utils, constants), `src/scan/` (scan UI), `src/components/` (UI that more than one feature uses, for example `PanelButton`), `src/scanner/` (scanner, entered only through
  `src/scanner/index.ts`), `src/storage/` (game storage), `src/splash/` (the animated splash) and `src/account/` (the
  Clerk account: the provider, the sign-in screens and the Settings section) and `src/sync/` (the history sync:
  the service, the API client and the provider) and `src/scanShare/` (the scan upload, ADR-030: the record, the crop, the queue, the uploader
  and the sharing switch; it does not import `src/scan/`, and the scan UI hands it a `FinalGrid` from `src/utils/finalGrid.utils.ts`). The uploader sends the photo length in `x-jpeg-bytes` and sets the same `Content-Length` on the `PUT`: the presigned URL signs it. `expo-network` and `expo-image-picker` are native modules, so a change to
  them needs a new development build. `expo-image-picker` asks for no photo library permission: `app.json` sets
  `photosPermission` and `microphonePermission` to `false`.
- Navigation follows ADR-016: Expo Router 57. A route file in `src/app/` only renders one screen
  from a feature folder. `_layout.tsx` holds the `Stack` and app-wide providers. Do not put logic,
  state, styles or tests in `src/app/`. A route param is a URL string. Load data from a
  repository, not from a param.

## Layout inside a feature

A feature folder (`src/home/`, `src/game/`, `src/settings/`, `src/stats/`, `src/techniques/`, `src/scan/`, `src/storage/`, `src/splash/`, `src/account/`, `src/sync/`, `src/scanShare/`) has these folders. Create a folder only when it
has a file.

| Folder | Holds |
| --- | --- |
| `screens/<Name>/` | A screen. It composes components and hooks |
| `components/<Name>/` | A component |
| `hooks/<name>/` | A hook |
| `utils/` | One `<domain>.utils.ts` file per domain, with its `<domain>.utils.test.ts` |
| `constants/` | One `<domain>.constants.ts` file per domain, for the values of the utils of that domain |

A screen, component or hook folder holds these files. Only `<Name>.tsx` and `index.ts` are always
there.

| File | Holds |
| --- | --- |
| `<Name>.tsx` | The component, screen or hook (`<name>.ts` for a hook) |
| `<Name>.styles.ts` | The `StyleSheet` from `react-native-unistyles`. Themed styles live here: `StyleSheet.create(theme => …)` (ADR-015) |
| `<Name>.constants.ts` | The constants that only this module uses |
| `<Name>.test.tsx` | The tests |
| `index.ts` | Named re-exports of the folder's public items. Nothing else |

Code that more than one feature uses lives in `src/utils/` and `src/constants/`. The scanner keeps
its own files behind `src/scanner/index.ts` (SUD-05). `src/scan/effects/` keeps one folder per
effect: `<name>.effect.ts`, `<name>.constants.ts` and an `index.ts`. The effect list is
`effects/registry.ts`.

### Import rules

`just lint` checks every rule in this list.

1. Import with the `@/` alias (`src/`) or `@assets/` (`assets/`). Use `./` only for a file in the
   same folder. Do not use `../`.
2. Import a folder through its `index.ts`, for example `@/scan/components/TransitionCanvas`. Inside
   the folder, import the sibling file directly.
3. Do not write a barrel that collects other folders, and do not use `export *`. The one module
   entry is `src/scanner/index.ts`.
4. Do not create a circular import. Two checks catch it: oxlint `import/no-cycle` and
   dependency-cruiser `no-circular`.
5. A utils or constants file does not import React, React Native, components, screens or hooks.
   A constants file imports only other constants files and types.
6. A styles file imports only `react-native`, `react-native-unistyles` and `src/theme/`.
7. A component or hook does not import a screen.
8. A test mocks the path that the code imports, which is the folder path.

### Theme

The theme follows ADR-015. `src/theme/` holds every colour value.

1. Do not write a colour value outside `src/theme/`. `just lint` refuses hex values, `rgb()`, `hsl()` and
   the names `white`, `black` and `transparent`. It cannot see other colour names, such as `red`.
2. Read a token from the theme in a styles file. In a Skia surface, read it with `useUnistyles()`. Make the
   paints again when the theme changes. To give a theme value to a native prop that is not a style,
   such as the track colour of a `Switch`, wrap the component with `withUnistyles` from
   `react-native-unistyles`.
3. Do not spread a Unistyles style. It loses the theme binding. Pass an array: `[styles.cell, { left }]`.
4. Use a semantic token in most components. Use a component token only in its own component.
5. Do not import the `palette.ts` file of a theme. Only the folder of that theme reads it. `just lint`
   checks this rule.
6. To add a colourway of the Op-art style (ADR-021, ADR-025, ADR-026):
   - Add its name to `ThemeName` in `src/theme/theme.types.ts`.
   - Add a folder in `src/theme/themes/` with `palette.ts`, `<name>.ts` and `index.ts`. The palette is an
     `OpartPalette`, with `colourEntry` for the Colour look. `<name>.ts` calls `buildOpartTheme` from
     `src/theme/opart/` twice: once for Light and once for Colour. It exports both themes.
   - Add one line to `THEMES` and one line to `COLOUR_THEMES` in `src/theme/themes/registry.ts`, and the two names to
     `APP_THEMES` in `src/theme/unistyles.ts`. The picker, the saved preference, the Unistyles registration and the
     contrast test read these lists.
   - Do not write the Colour values by hand. `src/theme/opart/opart.colour.ts` derives them from the accent.
   - The first frame of the splash overlay is white and equals the native splash. After it, the overlay uses the colours of the saved look.
   - Add one line to `DECORATIONS` in `src/theme/decorations/registry.ts`.
   - Put a new font, only when a colourway needs one, in `assets/fonts/` with its PostScript name as the file name, with its licence.
     List it in the `expo-font` plugin in `app.json`. A font needs a new development build.

### Worklets

Put a helper or a constant above the worklet that uses it. A worklet captures its outside values
when it is defined, so a helper declared further down the file is `undefined` inside the worklet.
An imported value is always safe.
