# Start a Game from a Minimal Home Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app opens on a minimal home screen. The player starts a new game at one of four levels, continues the game in progress, or opens Scan or Settings. A new game while a game is in progress asks first. The game screen saves the game after every move without delay to the UI, and a killed app resumes at the last move with its time played (QR-11).

**Architecture:** ADR-016 (new, task 1) picks Expo Router 57. Routes are files in `src/app/`. The root layout holds the `Stack`, which is the React Navigation native stack that Expo Router 57 ships inside itself, on `react-native-screens`. Each route file only renders one screen from `src/home/`, `src/game/`, `src/scan/` or `src/settings/`. Params are URL strings, so no game goes into a route: `PlayScreen` reads the game in progress from `PuzzleRepository`. The storage opens once in a provider in the root layout. The game screen saves through a new `GameSaveContext`. A new hook `useGameSaver` sends a save only when the game data changes (never for a cell selection), and a save queue keeps one write in flight and only the newest waiting game. `startSession` accepts a `Game` as well as a `NewGame`, so a saved game resumes with its notes, mistakes, undo steps and time played. A won or lost game reaches the history inside `PuzzleRepository.save` (ADR-012, built by #36).

**Tech Stack:** Expo SDK 57, `expo-router` ~57.0.25 (with `expo-router/testing-library`), `react-native-screens` ~4.26.0, `expo-linking` ~57.0.12, `expo-constants` ~57.0.21, React Native 0.86, React 19.2, Unistyles 3.5, `@sudoku/core`, `src/storage/`, Jest with jest-expo and Testing Library 13.3.

**Spec:** GitHub issue #51 (`gh issue view 51`). The unticked criterion of #36: "After the app is killed, the puzzle resumes at the last move, timer included" (QR-11). `docs/architecture/00-concepts/game-screen.md`. ADR-012, ADR-015.

## Coordinator rulings (2026-10-12, binding; they override the tasks below where they differ)

From the coordinator, out of the other plans of this wave:

- Glossary rows to add: "Pause layer", "Correction pad", "Given conflict", "Assist preview". Amend "Correction screen": the player can fix digits and their kind there (task 11).
- `apps/mobile/AGENTS.md` lists `src/settings/` in the folder rule. #38 builds the settings screen there (task 1).
- #38 builds a Settings screen in `src/settings/`. #40 gives `GameScreen` an `onNewPuzzle` prop and uses `onBack` for "Back to home". #51 routes to Settings and provides both callbacks. If #38 merges after #51, #38's last task adds its own route, so the Settings route stays one file of its own (`src/app/settings.tsx`).

From the developer's review of the first version of this plan:

1. **Navigation is Expo Router**, not React Navigation directly. Expo's default, React Navigation underneath, the native stack and the swipe back stay. Route files stay thin.
2. **A new game while a game is in progress asks first:** "Start a new game? Your current game ends." Only on confirm does the old game go. It is discarded, not recorded in the history. The home screen shows Continue and the level picker together.
3. **Save per move must be cheap and visible:** selecting a cell never saves. The UI never awaits a save. Saves go fire-and-forget through an ordered queue, and the newest game wins when moves come fast. A development build logs the duration of each save. An iPhone step checks that cell taps stay instant and reads the logged save times. The plan states the expected size of a saved game.

## Facts checked for this plan (2026-10-12)

| Fact | Source |
| --- | --- |
| Install: `expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar`. `main` becomes `expo-router/entry`, or a custom entry that imports `expo-router/entry` last | https://docs.expo.dev/router/installation.md |
| `src/app/` is supported. "The src/app directory takes higher precedence than the root app directory." `app.json`, `package.json`, `metro.config.js` and `tsconfig.json` stay at the root. Do not change the `root` option of the plugin | https://docs.expo.dev/router/reference/src-directory.md |
| Plugin: `"plugins": ["expo-router"]`. `useRouter()` gives `push`, `replace`, `back`, `dismissTo`, `dismissAll`. `useFocusEffect` comes from `expo-router` | https://docs.expo.dev/versions/v57.0.0/sdk/router/ |
| `<Stack screenOptions={{ headerShown: false }}>` in `src/app/_layout.tsx`. `gestureEnabled` (the swipe back) defaults to `true` on iOS. `router.dismissTo('/')` goes back to the first screen | https://docs.expo.dev/router/advanced/stack.md |
| Typed routes: `experiments.typedRoutes` in `app.json`. Expo CLI writes a git-ignored `expo-env.d.ts` on `expo start`. On CI, `npx expo customize tsconfig.json` adds the includes. `apps/mobile/.gitignore` already ignores `expo-env.d.ts` | https://docs.expo.dev/router/reference/typed-routes.md |
| Testing: `renderRouter(mock, options)` from `expo-router/testing-library`, with `screen.getPathname()` and `expect(screen).toHavePathname()`. Do not put test files inside the app directory | https://docs.expo.dev/router/reference/testing.md, `expo-router@57.0.25/build/testing-library/index.d.ts` |
| `expo-router@57.0.25` peers: `@testing-library/react-native >= 13.2.0` (optional), `react-native-screens ^4.26.0`, `expo-linking ^57.0.12`, `expo-constants ^57.0.21`, `react-native-safe-area-context >= 5.4.0`. Web and gesture-handler peers are optional. The repo has Testing Library 13.3.3. The "version 14" note on the latest docs page is for a later SDK | `npm view expo-router@57.0.25 peerDependencies peerDependenciesMeta` |
| Expo Router 57 carries React Navigation inside itself (`build/react-navigation/native-stack`, `core`, `native`). No `@react-navigation/*` package is a dependency | the `expo-router@57.0.25` tarball |
| `ExpoRoot` wraps the app in a `SafeAreaProvider` | `expo-router@57.0.25/build/ExpoRoot.js` |
| SDK 58 changes Expo Router: hrefs replace nested navigation, `initialRouteName`, `initialParams` and `freezeOnBlur` go | https://docs.expo.dev/router/migrate/sdk-57-to-58.md |

**Expected size of a saved game** (JSON of `toSavedGame`, measured with a script on 81-cell grids, 20 cells with three notes): about 1 KB with no undo steps, about 6 KB after 10 moves, about 27 KB after 50 moves, about 54 KB at the undo limit of 100 steps. The undo steps are almost all of it. The expected save time on the iPhone (JSON plus one SQLite `UPDATE` in WAL mode inside a transaction) is under 10 ms, and under 50 ms at the undo limit.

## Global Constraints

- Branch `feature/51-start-a-game` from `origin/develop`. The PR goes against `develop` with `Closes #51`.
- Do task 1 (the ADR) before any code. The ADR stays `Proposed` until the iPhone check in task 12 passes. Then it becomes `Accepted` in the same PR.
- A route file in `src/app/` holds only a default export that renders one screen. `_layout.tsx` holds the `Stack` and the storage provider. No logic, state or styles in a route file. No test file in `src/app/`.
- A route param is a URL string. A `Game` never goes into a route or a URL.
- The UI never awaits a save. A save failure never reaches the player's screen. A development build logs it.
- Do not log, send or upload any game data (SUD-02). `devLog` and `devWarn` in a development build are the only output. The save log holds a duration and a byte count, not the game.
- SUD-03: `src/game/**` does not import `src/scanner/**`.
- Theme: the new styles use semantic tokens only. This plan adds no component token and touches no theme file. No colour literal (`just lint` checks it).
- Import rules, folder layout and comment rules follow root `AGENTS.md` and `apps/mobile/AGENTS.md`. Prose, comments and commit messages follow STE light. No issue number in a code comment.
- Add the dependencies only with `expo install` (task 2). All four are in the Expo 57 bundled list.
- The new native modules need a new development build on the iPhone (`pnpm exec expo run:ios`).
- Every commit message ends with `(#51)`. Do not push until the developer asks.

## Review Focus

1. **The time played after a kill (QR-11).** A clock tick does not change `board`, so a save on board changes alone loses the time since the last move. `useGameSaver` also saves the latest time when AppState leaves `active` and when the game screen closes. Tests: task 5, "saves the time played when the app leaves the foreground" and "saves the time played when the game screen closes". iPhone step 4.
2. **Save cost per move.** A cell selection never saves (task 4, "a selection alone does not need a save"; task 5, "selecting a cell never saves"). While a write runs, only the newest waiting game is kept (task 4, "keeps only the newest game while a write runs"). The UI does not wait for a write (task 9, "the moves show at once while a save hangs"). iPhone step 5.
3. **A resumed game keeps everything.** `startSession(game)` uses the saved `Game` as it is. Tests: task 3; task 9, "Continue resumes the move and the time played".
4. **A new game over a game in progress asks first.** Cancel keeps the old game. Confirm discards it without a history entry. The question uses `current()` at the tap, not the state of the last focus refresh. Tests: task 9, "asks before a new game replaces the game in progress" and "keeps the game in progress when the player cancels".
5. **A double tap on a level starts one game.** `start()` discards the game before it, so a second start would silently replace the first. Test: task 9, "a double tap on a level starts one game".
6. **Storage that does not open.** A database from a newer app version makes `migrate()` throw. The app must still open and play, with games in memory. Test: task 6.
7. **The seam into files of other issues.** This plan changes `session.utils.ts` and `GameProvider.tsx`, which no wave 4 issue owns. It does not change `useGameSession` (#39) or `GameScreen` (#40). A `Game` passes where `NewGame` is typed, because `Game` has every field of `NewGame`. Open question 1.

## Files owned

All app paths are under `apps/mobile/`.

| File | Change |
| --- | --- |
| `docs/architecture/adr/adr-016-navigation.md` | New |
| `docs/architecture/00-DECISIONS.md`, `09-architecture-decisions.md` | One row each for ADR-016 |
| `docs/architecture/12-glossary.md` | Rows of this plan and of the coordinator (task 11) |
| `docs/architecture/05-building-block-view.md` | The `apps/mobile` part of the layout tree in 5.1 |
| `docs/architecture/00-concepts/game-screen.md` | The row "Navigation between home, game and settings" in Open questions, one sentence under the state diagram |
| `docs/superpowers/plans/2026-10-12-start-a-game.md` | New: the copy of this plan |
| `apps/mobile/AGENTS.md` | The folder rule and the navigation rule |
| `package.json` (root) | The `boundaries` script: `apps/mobile/App.tsx` becomes `apps/mobile/index.ts apps/mobile/devChecks.ts` |
| `apps/mobile/package.json`, `pnpm-lock.yaml` | The four dependencies of task 2. `main` stays `index.ts` |
| `apps/mobile/app.json` | `"expo-router"` plugin, `scheme`, `experiments.typedRoutes` |
| `apps/mobile/tsconfig.json` | `include` for the typed routes |
| `apps/mobile/index.ts` | The custom entry: theme, dev checks, `expo-router/entry` last |
| `apps/mobile/devChecks.ts`, `devChecks.test.ts` (new); `App.tsx`, `App.test.tsx`, `App.release.test.tsx`, `App.probeFailure.test.tsx` (deleted) | The dev checks move out of `App.tsx` |
| `src/app/_layout.tsx`, `index.tsx`, `game.tsx`, `scan.tsx`, `settings.tsx` | New route files |
| `src/game/utils/session.utils.ts` (+ test) | `GameStart`, `startSession` resumes a `Game` |
| `src/game/utils/save.utils.ts` (+ test), `src/game/constants/save.constants.ts` | New: `needsSave`, `createSaveQueue` |
| `src/game/utils/start.utils.ts` (+ test), `src/game/constants/start.constants.ts` | New: `newGeneratedGame` |
| `src/game/components/GameProvider/GameProvider.tsx` (+ test) | Calls `useGameSaver`, `start: GameStart` |
| `src/game/hooks/useGameSaver/*` | New |
| `src/game/screens/PlayScreen/*` | New: the game in progress, bound to the storage and the router |
| `src/home/**` | New: `screens/HomeScreen/*`, `components/HomeMenu/*` |
| `src/storage/components/GameStorageProvider/*`, `src/storage/hooks/useGameStorage/*` | New. The existing files of `src/storage/` do not change |
| `src/settings/screens/SettingsPlaceholderScreen/*` | New. #38 deletes it when its settings screen takes the route |
| `test/routes.test.tsx` | New: the route tests, outside `src/app/` |

Not touched: `useGameSession`, `useGameClock`, `Board`, `TimerPill` (#39); `GameScreen`, `MistakeDots` (#40); `Keypad`, `NumberKey` (#41); `Grid`, `useMoveHaptics` (#42); `useAssists`, `assists.constants`, `cell.utils` and the settings screen of `src/settings/` (#38); `jest.setup.ts`; every theme file; the existing files of `src/storage/`, `src/settings/` and `src/scan/`.

---

### Task 0: Branch, install and plan copy

- [ ] **Step 1: Branch from develop**

```bash
/usr/bin/git fetch origin
/usr/bin/git switch -c feature/51-start-a-game origin/develop
/usr/bin/git log --oneline -3
```

Expected: the log shows `feat(game): game screen: grid, header, tools and keypad (#37) (#61)` or a later commit. If it does not, stop and report.

- [ ] **Step 2: Install**

```bash
pnpm install
```

If `node_modules` in the worktree is a symlink to another checkout, remove the symlink first (`rm node_modules`), then run `pnpm install`.

- [ ] **Step 3: Copy the plan and commit it**

```bash
cp /private/tmp/claude-501/-Users-felix-projects-sudoku-18-dot-field/489359f5-5a5b-4cae-a8b8-46b66f55691d/scratchpad/plans/51-start-a-game.md docs/superpowers/plans/2026-10-12-start-a-game.md
/usr/bin/git add docs/superpowers/plans/2026-10-12-start-a-game.md
/usr/bin/git commit -m "docs(plan): start a game from a minimal home screen (#51)"
```

---

### Task 1: ADR-016, navigation with Expo Router

**Files:**
- Create: `docs/architecture/adr/adr-016-navigation.md`
- Modify: `docs/architecture/00-DECISIONS.md`, `09-architecture-decisions.md`, `05-building-block-view.md`, `00-concepts/game-screen.md`, `apps/mobile/AGENTS.md`

- [ ] **Step 1: Write the ADR**

Create `docs/architecture/adr/adr-016-navigation.md`:

````markdown
---
status: DRAFT
---

# ADR-016: Expo Router with a native stack, thin route files

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-12 |
| Contact | Felix      |

## Context

Until now, `App.tsx` chooses between two screens with a `useState`. A development build opens
the game screen with the canvas puzzle. Back opens the scan flow. Epic #34 needs more screens:

- the home screen, with the levels, Continue, Scan and Settings,
- the game screen,
- the scan flow (camera and correction screen),
- the settings screen.

The game over sheet and the finish card go home or start a new game. A later issue adds a
history or stats screen. The app is iOS only and works offline (SUD-01). No feature needs a link
from outside the app yet. The player expects the iOS push animation and the swipe from the left
edge to go back. The scan flow has no back button, so it needs that swipe.

The project is for learning and a portfolio first. The default of the platform is worth more
than a small saving in packages. `apps/mobile/AGENTS.md` forbids Expo Router without an ADR. This
ADR decides the navigation.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| **Expo Router 57** | The default of Expo for new apps, and what Expo documents and tests first. The `Stack` is the React Navigation native stack on `react-native-screens`: native push animation and swipe back. Typed routes. A route for every screen without a hand-written list. Links from outside (a shared puzzle, a widget) come for free later. React Navigation ships inside it, so no `@react-navigation/*` package to keep in step | Routes are files in `src/app/`, a second folder convention next to the feature folders. Params are URL strings, so a screen loads its data, for example the game from storage. A custom entry file must import `expo-router/entry` last. Typed routes need a generated file (`expo start`, or `expo customize tsconfig.json` on CI). SDK 58 changes nested navigation and removes props, so the next upgrade costs some work. Two more native packages (`expo-linking`, `expo-constants`) |
| React Navigation 7, native stack, used directly | The same native stack. Routes in code with a typed param list. A param can be plain data, such as a whole game. No entry file change, no `app.json` change. Fewer packages | Not the Expo default, so fewer Expo guides fit. The param list and the links are written by hand. The `@react-navigation/*` versions must follow each SDK by hand, because they are not in the Expo bundled list |
| Own screen switch (a `useState` or reducer, as `ScanFlow` has now) | No dependency. Full control | No native push animation, no swipe back, no focus events. We build and test each of them. The cost grows with every screen |

## Decision

1. **Expo Router 57 moves the app between screens.** The routes are files in `src/app/`. The
   root layout `src/app/_layout.tsx` renders one `Stack`: Home (`index`), `game`, `scan` and
   `settings`. Home is the first route.
2. **A route file is thin.** Its default export renders one screen from `src/home/`,
   `src/game/`, `src/scan/` or `src/settings/`, and nothing else. A layout file holds the
   `Stack` and app-wide providers only. Tests live outside `src/app/`.
3. **Params are URL strings. Data comes from the repositories.** No game goes into a route.
   The game screen reads the game in progress from `PuzzleRepository` (ADR-012).
4. **The stack shows no native header.** Each screen draws its own themed header and
   background (ADR-015). The swipe back stays on.
5. **The entry is `index.ts`.** It registers the themes first (ADR-015), then runs the
   development checks, then imports `expo-router/entry` last.
6. **Typed routes are on.** Expo CLI writes the types on `expo start`. The file stays out of
   git.

## Consequences

- The app opens on the home screen in development and release builds. The development start
  on the canvas puzzle goes away. `App.tsx` goes away.
- The scan flow is the `scan` route. It keeps its own phases inside one screen, because the
  capture transition needs the camera and the correction screen together.
- The new native modules need a new development build.
- Jest renders the real routes with `renderRouter` from `expo-router/testing-library`.
- A feature screen may use `useRouter`. A component or a hook below a screen takes callbacks.
- A screen that needs data reads a repository, so a reopened route shows the stored state, not
  a stale copy.

## Reassessment Triggers

- An Expo SDK upgrade (SDK 58 first) breaks the routes or the stack.
- Expo Router stops shipping the native stack, or the native stack does not run with
  Unistyles 3, Reanimated 4 or VisionCamera 5 on the iPhone.
- The thin route files become a second home for logic.
- The app needs tabs, a modal flow or more than about eight routes.
````

- [ ] **Step 2: Add the index rows**

In `docs/architecture/00-DECISIONS.md`, add at the end of the "Platform and repository" table:

```markdown
| ADR-016 | Expo Router 57 with a native stack. Route files in `src/app/` only render a feature screen. Params are URL strings, data comes from the repositories. **Pending the iPhone check of #51.** | Cross-concept | 2026-10-12 | Felix | [ADR-016](adr/adr-016-navigation.md) |
```

In `docs/architecture/09-architecture-decisions.md`, add at the end of the table:

```markdown
| ADR-016 | Expo Router 57: routes in `src/app/` (Home, game, scan, settings) on a native stack. Thin route files, URL-string params, typed routes | Proposed, pending the iPhone check | 2026-10-12 | [ADR-016](./adr/adr-016-navigation.md) |
```

- [ ] **Step 3: Change the rules in `apps/mobile/AGENTS.md`**

Replace this bullet in "Rules":

```markdown
- Keep the folders: `src/game/` (game UI), `src/scan/` (scan UI), `src/scanner/` (scanner, entered
  only through `src/scanner/index.ts`). Navigation is not decided yet. Do not add Expo Router
  without an ADR.
```

with:

```markdown
- Keep the folders: `src/app/` (routes), `src/home/` (home UI), `src/game/` (game UI),
  `src/settings/` (settings UI and `SettingsRepository`: screens, components, hooks, utils,
  constants), `src/scan/` (scan UI), `src/scanner/` (scanner, entered only through
  `src/scanner/index.ts`) and `src/storage/` (game storage).
- Navigation follows ADR-016: Expo Router 57. A route file in `src/app/` only renders one screen
  from a feature folder. `_layout.tsx` holds the `Stack` and app-wide providers. Do not put logic,
  state, styles or tests in `src/app/`. A route param is a URL string. Load data from a
  repository, not from a param.
```

In the paragraph above the "Layout inside a feature" table, change "A feature folder (`src/scan/`, later `src/game/`)" to "A feature folder (`src/home/`, `src/game/`, `src/settings/`, `src/scan/`, `src/storage/`)".

- [ ] **Step 4: Update the layout tree in `05-building-block-view.md`**

In section 5.1, replace the three `src/` lines under `apps/mobile/` with:

```
│       ├── src/app/             # routes (Expo Router, ADR-016): each file renders one screen
│       ├── src/home/            # home UI: the levels, Continue, Scan and Settings
│       ├── src/game/            # game UI: screens/, components/, hooks/, utils/, constants/
│       ├── src/settings/        # settings UI and SettingsRepository: assists, theme
│       ├── src/scan/            # scan UI: screens/, components/, hooks/, utils/, constants/, effects/
│       ├── src/scanner/         # scanner module, entered only through src/scanner/index.ts
│       ├── src/storage/         # game storage: PuzzleRepository, HistoryRepository (ADR-012)
│       ├── src/utils/           # code that more than one feature uses: geometry, homography, logs
```

- [ ] **Step 5: Close the open question in the game screen concept**

In `docs/architecture/00-concepts/game-screen.md`, Open questions, delete the row `| Navigation between home, game and settings | An ADR in issue #51 |`. After "Back returns to the home screen. The game stays saved, so the player can resume it.", add: "ADR-016 decides how the app moves between the home, game, scan and settings screens."

- [ ] **Step 6: Check the links and commit**

```bash
just docs-check
/usr/bin/git add docs apps/mobile/AGENTS.md
/usr/bin/git commit -m "docs(adr): ADR-016, Expo Router with a native stack (#51)"
```

---

### Task 2: Expo Router setup

**Files:**
- Modify: `apps/mobile/package.json`, `pnpm-lock.yaml`, `apps/mobile/app.json`, `apps/mobile/tsconfig.json`

- [ ] **Step 1: Add the packages**

`react-native-safe-area-context` and `expo-status-bar` are in the app already.

```bash
pnpm --filter mobile exec expo install expo-router react-native-screens expo-linking expo-constants
```

Expected: `package.json` has `expo-router` ~57.0.25, `react-native-screens` ~4.26.0, `expo-linking` ~57.0.12 and `expo-constants` ~57.0.21. `main` stays `"index.ts"`: the docs allow a custom entry that imports `expo-router/entry` last (task 8). pnpm may warn about the optional web peers (`react-dom`, `react-native-web`, `react-server-dom-webpack`) and `react-native-gesture-handler`. Do not add them: they are optional, and the app has no web build.

- [ ] **Step 2: Configure `app.json`**

In `apps/mobile/app.json`, under `expo`:

- add `"scheme": "sudoku"` after `"slug"`,
- change `"plugins": ["expo-sqlite"]` to `"plugins": ["expo-router", "expo-sqlite"]`,
- add `"experiments": { "typedRoutes": true }`.

Do not set the `root` option of the plugin. `src/app/` is found without it.

- [ ] **Step 3: Include the typed routes in `tsconfig.json`**

Add to `apps/mobile/tsconfig.json`, next to `compilerOptions`:

```json
"include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
```

The two generated paths do not exist on CI, and `tsc` accepts a missing include. Then `Href` is a plain string there, and the local typecheck after `just app` checks the routes.

- [ ] **Step 4: Check the Expo setup**

```bash
cd apps/mobile && pnpm dlx expo-doctor; cd -
```

Expected: no check fails for the four packages.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add apps/mobile/package.json pnpm-lock.yaml apps/mobile/app.json apps/mobile/tsconfig.json
/usr/bin/git commit -m "chore(app): add Expo Router 57 (#51)"
```

---

### Task 3: A session resumes a saved game

**Files:**
- Modify: `apps/mobile/src/game/utils/session.utils.ts`, `session.utils.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the end of `session.utils.test.ts`:

```ts
it('resumes a game as it was saved', () => {
  const played = run(
    start(),
    { type: 'select', cell: OPEN },
    { type: 'toggleNotesMode' },
    { type: 'digit', digit: 3 },
    { type: 'toggleNotesMode' },
    { type: 'digit', digit: 5 },
    { type: 'tick', elapsedMs: 65_000 },
  ).game
  const session = startSession(played)
  expect(session.game).toBe(played)
  expect(session.board).toBe(played)
  expect(session.game).toMatchObject({ mistakes: 1, playedMs: 65_000 })
  expect(session.game.undoSteps).toHaveLength(2)
  expect(session).toMatchObject({ notesMode: false, move: null })
})

it('starts a new game from the givens', () => {
  const session = startSession(sampleStart())
  expect(session.game).toMatchObject({ mistakes: 0, playedMs: 0, status: 'playing' })
  expect(session.move).toBeNull()
})
```

- [ ] **Step 2: Run it and see it fail**

```bash
pnpm --filter mobile exec jest src/game/utils/session.utils.test.ts
```

Expected: "resumes a game as it was saved" fails: `createGame` makes a new game.

- [ ] **Step 3: Implement**

In `session.utils.ts`, add after the `Session` type:

```ts
/** A new game from its givens, or a saved game to resume as it is. */
export type GameStart = NewGame | Game

function isGame(start: GameStart): start is Game {
  return 'status' in start
}
```

Replace `startSession` with:

```ts
export function startSession(start: GameStart): Session {
  const game = isGame(start) ? start : createGame(start)
  return { game, board: game, notesMode: false, move: null }
}
```

- [ ] **Step 4: Run the tests and commit**

```bash
pnpm --filter mobile exec jest src/game/utils/session.utils.test.ts
/usr/bin/git add apps/mobile/src/game/utils/session.utils.ts apps/mobile/src/game/utils/session.utils.test.ts
/usr/bin/git commit -m "feat(game): a session resumes a saved game (#51)"
```

---

### Task 4: When to save, and the save queue

**Files:**
- Create: `apps/mobile/src/game/utils/save.utils.ts`, `save.utils.test.ts`, `apps/mobile/src/game/constants/save.constants.ts`
- Create: `apps/mobile/src/game/utils/start.utils.ts`, `start.utils.test.ts`, `apps/mobile/src/game/constants/start.constants.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/utils/save.utils.test.ts`:

```ts
import { createGame, pause, place, select, tick, toggleNote, type Game } from '@sudoku/core'
import { createSaveQueue, needsSave } from './save.utils'
import { sampleStart } from './sample.utils'

// Cell 2 is empty in the canvas puzzle. Its solution is 4.
const OPEN = 2
const fresh = () => createGame(sampleStart())

describe('needsSave', () => {
  it('a selection alone does not need a save', () => {
    const game = fresh()
    expect(needsSave(game, select(game, OPEN))).toBe(false)
  })

  it('a clock tick alone does not need a save', () => {
    const game = fresh()
    expect(needsSave(game, tick(game, 1000))).toBe(false)
  })

  it.each([
    ['a number', (game: Game) => place(select(game, OPEN), 4).game],
    ['a wrong number', (game: Game) => place(select(game, OPEN), 5).game],
    ['a note', (game: Game) => toggleNote(select(game, OPEN), 3).game],
    ['a pause', (game: Game) => pause(game)],
  ])('%s needs a save', (_name, act) => {
    const game = fresh()
    expect(needsSave(game, act(game))).toBe(true)
  })
})

describe('createSaveQueue', () => {
  function deferredWrites() {
    const writes: { game: Game; finish: () => void; fail: (error: Error) => void }[] = []
    const write = jest.fn(
      (game: Game) =>
        new Promise<void>((resolve, reject) => {
          writes.push({ game, finish: resolve, fail: reject })
        }),
    )
    return { writes, write }
  }
  const flush = () => new Promise((resolve) => setImmediate(resolve))
  const report = () => ({ saved: jest.fn(), failed: jest.fn() })

  it('writes a game at once when no write runs', () => {
    const { write } = deferredWrites()
    const save = createSaveQueue(write, report())
    const game = fresh()
    save(game)
    expect(write).toHaveBeenCalledWith(game)
  })

  it('keeps only the newest game while a write runs', async () => {
    const { writes, write } = deferredWrites()
    const save = createSaveQueue(write, report())
    const [first, second, third] = [fresh(), fresh(), fresh()]
    save(first)
    save(second)
    save(third)
    expect(write).toHaveBeenCalledTimes(1)
    writes[0]?.finish()
    await flush()
    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenLastCalledWith(third)
  })

  it('returns before the write ends', () => {
    const save = createSaveQueue(() => new Promise<void>(() => undefined), report())
    expect(save(fresh())).toBeUndefined()
  })

  it('reports the duration of each write', async () => {
    const { writes, write } = deferredWrites()
    const times = [10, 13.5]
    const reporter = report()
    const save = createSaveQueue(write, reporter, () => times.shift() ?? 0)
    const game = fresh()
    save(game)
    writes[0]?.finish()
    await flush()
    expect(reporter.saved).toHaveBeenCalledWith(game, 3.5)
  })

  it('reports a failed write and goes on with the next game', async () => {
    const { writes, write } = deferredWrites()
    const reporter = report()
    const save = createSaveQueue(write, reporter)
    const next = fresh()
    save(fresh())
    save(next)
    writes[0]?.fail(new Error('disk full'))
    await flush()
    expect(reporter.failed).toHaveBeenCalledWith(new Error('disk full'))
    expect(write).toHaveBeenLastCalledWith(next)
  })
})
```

- [ ] **Step 2: Run it and see it fail**

```bash
pnpm --filter mobile exec jest src/game/utils/save.utils.test.ts
```

Expected: FAIL, `Cannot find module './save.utils'`.

- [ ] **Step 3: Implement**

Create `src/game/constants/save.constants.ts`:

```ts
/** A save slower than this, in milliseconds, is worth a look on the iPhone. */
export const SLOW_SAVE_MS = 50
```

Create `src/game/utils/save.utils.ts`:

```ts
import type { Game } from '@sudoku/core'

/**
 * True when next differs from previous in data that a resume needs. The selected cell and the time
 * do not count: a selection must stay free, and the time is saved when the app leaves (QR-11).
 */
export function needsSave(previous: Game, next: Game): boolean {
  return (
    previous.entries !== next.entries ||
    previous.notes !== next.notes ||
    previous.undoSteps !== next.undoSteps ||
    previous.mistakes !== next.mistakes ||
    previous.hintsUsed !== next.hintsUsed ||
    previous.status !== next.status
  )
}

export type SaveReport = {
  /** ms: the duration of the write, from the clock of the queue. */
  saved(game: Game, ms: number): void
  failed(error: unknown): void
}

/**
 * One write runs at a time. While it runs, only the newest game waits: a fast run of moves gives
 * at most two writes, and the last move always lands. The returned function never waits and never throws.
 */
export function createSaveQueue(
  write: (game: Game) => Promise<void>,
  report: SaveReport,
  now: () => number = () => performance.now(),
): (game: Game) => void {
  let running = false
  let waiting: Game | null = null

  const run = (game: Game) => {
    running = true
    const started = now()
    write(game)
      .then(
        () => report.saved(game, now() - started),
        (error: unknown) => report.failed(error),
      )
      .finally(() => {
        running = false
        const next = waiting
        waiting = null
        if (next !== null) run(next)
      })
  }

  return (game) => {
    if (running) waiting = game
    else run(game)
  }
}
```

- [ ] **Step 4: A new generated game, for the home screen and New puzzle**

Create `src/game/utils/start.utils.test.ts`:

```ts
import { GIVENS_TARGET, generate } from '@sudoku/core'
import { newGeneratedGame } from './start.utils'

it('generates a game at the level, with the seed from the random number', () => {
  const game = newGeneratedGame('hard', () => 0.5)
  expect(game.givens.filter((digit) => digit !== 0)).toHaveLength(GIVENS_TARGET.hard)
  expect(game.givens).toEqual(generate('hard', 0x80000000).givens)
  expect(game).toMatchObject({ status: 'playing', mistakes: 0, playedMs: 0 })
})

it('keeps the seed inside the range of generate for a random number just below 1', () => {
  expect(() => newGeneratedGame('easy', () => 0.9999999999)).not.toThrow()
})
```

Create `src/game/constants/start.constants.ts`:

```ts
/** generate() takes a seed from 0 to 0xffffffff. */
export const SEED_COUNT = 0x1_0000_0000
```

Create `src/game/utils/start.utils.ts`:

```ts
import { createGame, generate, type Game, type Level, type Random } from '@sudoku/core'
import { SEED_COUNT } from '@/game/constants/start.constants'

export function newGeneratedGame(level: Level, random: Random): Game {
  const { givens, solution } = generate(level, Math.floor(random() * SEED_COUNT))
  return createGame({ givens, solution })
}
```

- [ ] **Step 5: Run the tests and the lint, then commit**

```bash
pnpm --filter mobile exec jest src/game/utils/save.utils.test.ts src/game/utils/start.utils.test.ts
just lint
/usr/bin/git add apps/mobile/src/game/utils apps/mobile/src/game/constants
/usr/bin/git commit -m "feat(game): save only changed game data, one write at a time (#51)"
```

Expected: all pass. The core keeps the same `entries`, `notes` and `undoSteps` arrays when an action does not change them (`select` returns `{ ...game, selected }`). If a `needsSave` test for a selection fails, the core makes new arrays there: report it, and do not change the core.

---

### Task 5: The game saves itself through a context

**Files:**
- Create: `apps/mobile/src/game/hooks/useGameSaver/useGameSaver.ts`, `useGameSaver.test.tsx`, `index.ts`
- Modify: `apps/mobile/src/game/components/GameProvider/GameProvider.tsx`, `GameProvider.test.tsx`

- [ ] **Step 1: Write the failing hook test**

Create `src/game/hooks/useGameSaver/useGameSaver.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native'
import { createGame, place, select, type Game } from '@sudoku/core'
import { sampleStart } from '@/game/utils/sample.utils'
import { GameSaveContext, useGameSaver } from './useGameSaver'

type Props = { board: Game; playedMs: number }

let listeners: ((state: AppStateStatus) => void)[] = []

beforeEach(() => {
  listeners = []
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener)
    return { remove: jest.fn() } as NativeEventSubscription
  })
})

afterEach(() => jest.restoreAllMocks())

function setup() {
  const save = jest.fn<void, [Game]>()
  const board = createGame(sampleStart())
  const wrapper = ({ children }: { children: ReactNode }) => <GameSaveContext value={save}>{children}</GameSaveContext>
  const hook = renderHook(({ board: current, playedMs }: Props) => useGameSaver(current, playedMs), {
    wrapper,
    initialProps: { board, playedMs: 0 },
  })
  return { save, board, hook }
}

const sendAppState = (state: AppStateStatus) => act(() => listeners.forEach((listener) => listener(state)))

it('does not save the board it starts with', () => {
  const { save } = setup()
  expect(save).not.toHaveBeenCalled()
})

it('saves the board after a move', () => {
  const { save, board, hook } = setup()
  // Cell 2 is empty in the canvas puzzle. Its solution is 4.
  const next = place(select(board, 2), 4).game
  hook.rerender({ board: next, playedMs: 0 })
  expect(save).toHaveBeenCalledTimes(1)
  expect(save).toHaveBeenLastCalledWith(next)
})

it('selecting a cell never saves', () => {
  const { save, board, hook } = setup()
  hook.rerender({ board: select(board, 2), playedMs: 0 })
  hook.rerender({ board: select(select(board, 2), 40), playedMs: 0 })
  expect(save).not.toHaveBeenCalled()
})

it('does not save on a clock tick', () => {
  const { save, board, hook } = setup()
  hook.rerender({ board, playedMs: 1000 })
  expect(save).not.toHaveBeenCalled()
})

it('saves the time played and the selection when the app leaves the foreground', () => {
  const { save, board, hook } = setup()
  const selected = select(board, 2)
  hook.rerender({ board: selected, playedMs: 5000 })
  sendAppState('background')
  expect(save).toHaveBeenLastCalledWith({ ...selected, playedMs: 5000 })
})

it('saves nothing when the app comes back to the foreground', () => {
  const { save } = setup()
  sendAppState('active')
  expect(save).not.toHaveBeenCalled()
})

it('saves the time played when the game screen closes', () => {
  const { save, board, hook } = setup()
  hook.rerender({ board, playedMs: 7000 })
  hook.unmount()
  expect(save).toHaveBeenLastCalledWith({ ...board, playedMs: 7000 })
})

it('saves nothing without a save context', () => {
  const board = createGame(sampleStart())
  const hook = renderHook(({ board: current, playedMs }: Props) => useGameSaver(current, playedMs), {
    initialProps: { board, playedMs: 0 },
  })
  expect(() => hook.unmount()).not.toThrow()
  expect(listeners).toHaveLength(0)
})
```

- [ ] **Step 2: Run it and see it fail**

```bash
pnpm --filter mobile exec jest src/game/hooks/useGameSaver
```

Expected: FAIL, `Cannot find module './useGameSaver'`.

- [ ] **Step 3: Implement the hook**

Create `src/game/hooks/useGameSaver/useGameSaver.ts`:

```ts
import { createContext, useContext, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import type { Game } from '@sudoku/core'
import { needsSave } from '@/game/utils/save.utils'

/** Stores the game in progress. It returns at once and never throws: the UI never waits for a save. */
export type SaveGame = (game: Game) => void

/** The play screen gives the save. Without it, the game screen saves nothing. */
export const GameSaveContext = createContext<SaveGame | null>(null)

/**
 * Saves the board after each move. A clock tick and a selection do not save, so the hook also saves
 * the latest board and time played when the app leaves the foreground and when the screen closes (QR-11).
 */
export function useGameSaver(board: Game, playedMs: number): void {
  const save = useContext(GameSaveContext)
  const lastSaved = useRef(board)
  const latest = useRef({ board, playedMs })
  useEffect(() => {
    latest.current = { board, playedMs }
  })
  useEffect(() => {
    if (save === null || !needsSave(lastSaved.current, board)) return
    lastSaved.current = board
    save(board)
  }, [save, board])
  useEffect(() => {
    if (save === null) return undefined
    const saveLatest = () => save({ ...latest.current.board, playedMs: latest.current.playedMs })
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') saveLatest()
    })
    return () => {
      subscription.remove()
      saveLatest()
    }
  }, [save])
}
```

Create `src/game/hooks/useGameSaver/index.ts`:

```ts
export { GameSaveContext, useGameSaver } from './useGameSaver'
export type { SaveGame } from './useGameSaver'
```

- [ ] **Step 4: Run the hook tests**

```bash
pnpm --filter mobile exec jest src/game/hooks/useGameSaver
```

Expected: all pass.

- [ ] **Step 5: Write the failing provider tests**

Add to `GameProvider.test.tsx`. Add `fireEvent` to the Testing Library import, `Pressable` to the `react-native` import, and these imports:

```tsx
import { createGame, place, select, tick } from '@sudoku/core'
import { GameSaveContext } from '@/game/hooks/useGameSaver'
```

Then:

```tsx
function Mover() {
  const actions = useGameActions()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Place 4 in cell 2"
      onPress={() => {
        actions.select(2)
        actions.digit(4)
      }}
    />
  )
}

it('saves the game after a move', () => {
  const save = jest.fn()
  render(
    <GameSaveContext value={save}>
      <GameProvider start={sampleStart()}>
        <Mover />
      </GameProvider>
    </GameSaveContext>,
  )
  fireEvent.press(screen.getByLabelText('Place 4 in cell 2'))
  expect(save).toHaveBeenCalledTimes(1)
  expect(save.mock.lastCall?.[0].entries[2]).toBe(4)
})

it('resumes a saved game with its time played', () => {
  const saved = tick(place(select(createGame(sampleStart()), 2), 4).game, 65_000)
  render(
    <GameProvider start={saved}>
      <Probe />
    </GameProvider>,
  )
  expect(screen.getByText('playing 65000 function')).toBeTruthy()
})
```

- [ ] **Step 6: Run them and see the first fail**

```bash
pnpm --filter mobile exec jest src/game/components/GameProvider
```

Expected: "saves the game after a move" fails: `save` is never called.

- [ ] **Step 7: Wire the hook into the provider**

Replace `GameProvider.tsx` with:

```tsx
import type { ReactNode } from 'react'
import { GameActionsContext } from '@/game/hooks/useGameActions'
import { useGameSaver } from '@/game/hooks/useGameSaver'
import { useGameSession } from '@/game/hooks/useGameSession'
import { GameStateContext } from '@/game/hooks/useGameState'
import { GameTimeContext } from '@/game/hooks/useGameTime'
import type { GameStart } from '@/game/utils/session.utils'

type GameProviderProps = { start: GameStart; children: ReactNode }

/** Three contexts. A clock tick renders only the readers of the time. The actions never change. */
export function GameProvider({ start, children }: GameProviderProps) {
  const { state, playedMs, actions } = useGameSession(start)
  useGameSaver(state.board, playedMs)
  return (
    <GameActionsContext value={actions}>
      <GameStateContext value={state}>
        <GameTimeContext value={playedMs}>{children}</GameTimeContext>
      </GameStateContext>
    </GameActionsContext>
  )
}
```

`useGameSession(start)` keeps its type `NewGame` (#39 owns it). A `Game` has every field of `NewGame`, so TypeScript accepts it, and `startSession` takes a `GameStart` (open question 1).

- [ ] **Step 8: Run the game tests and the typecheck, then commit**

```bash
pnpm --filter mobile exec jest src/game
just typecheck
/usr/bin/git add apps/mobile/src/game
/usr/bin/git commit -m "feat(game): save the game after every move and when the app leaves (#51)"
```

Expected: all pass. If `just typecheck` refuses `useGameSession(start)` with a `GameStart`, stop and report it under open question 1. Do not edit `useGameSession`.

---

### Task 6: The game storage for the screens

**Files:**
- Create: `apps/mobile/src/storage/hooks/useGameStorage/useGameStorage.ts`, `index.ts`
- Create: `apps/mobile/src/storage/components/GameStorageProvider/GameStorageProvider.tsx`, `GameStorageProvider.test.tsx`, `index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/storage/components/GameStorageProvider/GameStorageProvider.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { createMemoryStorage, type GameStorage } from '@/storage'
import { GameStorageProvider } from './GameStorageProvider'

function Probe({ expected }: { expected?: GameStorage }) {
  const storage = useGameStorage()
  return <Text>{expected === undefined || storage === expected ? 'storage ready' : 'other storage'}</Text>
}

it('renders nothing while the storage opens, then shares it', async () => {
  const storage = createMemoryStorage()
  render(
    <GameStorageProvider open={async () => storage}>
      <Probe expected={storage} />
    </GameStorageProvider>,
  )
  expect(screen.queryByText('storage ready')).toBeNull()
  expect(await screen.findByText('storage ready')).toBeTruthy()
})

it('falls back to the in-memory storage when the database does not open', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  render(
    <GameStorageProvider open={async () => Promise.reject(new RangeError('newer schema'))}>
      <Probe />
    </GameStorageProvider>,
  )
  expect(await screen.findByText('storage ready')).toBeTruthy()
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('[storage] The game storage does not open'))
  warn.mockRestore()
})

it('refuses useGameStorage outside the provider', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  expect(() => render(<Probe />)).toThrow('useGameStorage needs a GameStorageProvider')
  error.mockRestore()
})
```

- [ ] **Step 2: Run it and see it fail**

```bash
pnpm --filter mobile exec jest src/storage/components
```

Expected: FAIL, `Cannot find module './GameStorageProvider'`.

- [ ] **Step 3: Implement**

Create `src/storage/hooks/useGameStorage/useGameStorage.ts`:

```ts
import { createContext, useContext } from 'react'
import type { GameStorage } from '@/storage'

export const GameStorageContext = createContext<GameStorage | null>(null)

export function useGameStorage(): GameStorage {
  const storage = useContext(GameStorageContext)
  if (storage === null) throw new Error('useGameStorage needs a GameStorageProvider')
  return storage
}
```

Create `src/storage/hooks/useGameStorage/index.ts`:

```ts
export { GameStorageContext, useGameStorage } from './useGameStorage'
```

Create `src/storage/components/GameStorageProvider/GameStorageProvider.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from 'react'
import { createMemoryStorage, openStorage, type GameStorage } from '@/storage'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { devWarn, errorMessage } from '@/utils/log.utils'

type GameStorageProviderProps = { open?: () => Promise<GameStorage>; children: ReactNode }

/**
 * Renders the children after the storage opens, a few milliseconds after start. When the database does
 * not open, for example a file from a newer app version, the games live in memory and do not survive a kill.
 */
export function GameStorageProvider({ open = openStorage, children }: GameStorageProviderProps) {
  const [storage, setStorage] = useState<GameStorage | null>(null)
  useEffect(() => {
    let live = true
    open()
      .catch((error: unknown) => {
        devWarn('storage', `The game storage does not open, so games are not saved: ${errorMessage(error)}`)
        return createMemoryStorage()
      })
      .then((opened) => {
        if (live) setStorage(opened)
      })
    return () => {
      live = false
    }
  }, [open])
  if (storage === null) return null
  return <GameStorageContext value={storage}>{children}</GameStorageContext>
}
```

Create `src/storage/components/GameStorageProvider/index.ts`:

```ts
export { GameStorageProvider } from './GameStorageProvider'
```

- [ ] **Step 4: Run the tests and the lint, then commit**

```bash
pnpm --filter mobile exec jest src/storage
just lint
/usr/bin/git add apps/mobile/src/storage/components apps/mobile/src/storage/hooks
/usr/bin/git commit -m "feat(storage): open the game storage once and share it with the screens (#51)"
```

---

### Task 7: The home screen

**Files:**
- Create: `apps/mobile/src/home/components/HomeMenu/HomeMenu.tsx`, `HomeMenu.styles.ts`, `HomeMenu.constants.ts`, `HomeMenu.test.tsx`, `index.ts`
- Create: `apps/mobile/src/home/screens/HomeScreen/HomeScreen.tsx`, `HomeScreen.constants.ts`, `index.ts`

`HomeMenu` draws the menu and takes callbacks. `HomeScreen` binds it to the storage and the router. The route tests in task 9 test `HomeScreen`. The issue asks for no design work. The menu uses semantic tokens only, so it follows Daylight and Midnight.

- [ ] **Step 1: Write the failing menu test**

Create `src/home/components/HomeMenu/HomeMenu.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { HomeMenu } from './HomeMenu'

function renderMenu(continueLevel: 'medium' | null = null) {
  const props = { continueLevel, onNewGame: jest.fn(), onContinue: jest.fn(), onScan: jest.fn(), onSettings: jest.fn() }
  render(<HomeMenu {...props} />)
  return props
}

it('lists the four levels, and a tap asks for a game at that level', () => {
  const { onNewGame } = renderMenu()
  for (const name of ['Easy', 'Medium', 'Hard', 'Expert']) {
    expect(screen.getByRole('button', { name })).toBeTruthy()
  }
  fireEvent.press(screen.getByRole('button', { name: 'Expert' }))
  expect(onNewGame).toHaveBeenCalledWith('expert')
})

it('shows Continue only when a game is in progress', () => {
  renderMenu(null)
  expect(screen.queryByRole('button', { name: /^Continue/ })).toBeNull()
})

it('shows Continue and the levels together when a game is in progress', () => {
  const { onContinue } = renderMenu('medium')
  fireEvent.press(screen.getByRole('button', { name: 'Continue, Medium' }))
  expect(onContinue).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Easy' })).toBeTruthy()
})

it('links to Scan and to Settings', () => {
  const { onScan, onSettings } = renderMenu()
  fireEvent.press(screen.getByRole('button', { name: 'Scan a puzzle' }))
  fireEvent.press(screen.getByRole('button', { name: 'Settings' }))
  expect(onScan).toHaveBeenCalledTimes(1)
  expect(onSettings).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run it and see it fail**

```bash
pnpm --filter mobile exec jest src/home
```

Expected: FAIL, `Cannot find module './HomeMenu'`.

- [ ] **Step 3: Implement the menu**

Create `src/home/components/HomeMenu/HomeMenu.constants.ts`:

```ts
import type { Level } from '@sudoku/core'

export const LEVEL_NAMES: Readonly<Record<Level, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
}
```

Create `src/home/components/HomeMenu/HomeMenu.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

// Unistyles reads the safe-area insets natively, so the menu needs no insets hook.
export const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    gap: theme.space.md,
    paddingTop: rt.insets.top + theme.space.xxl,
    paddingBottom: rt.insets.bottom + theme.space.lg,
    paddingHorizontal: theme.space.lg,
    backgroundColor: theme.colors.background,
  },
  title: {
    ...roleFont(theme.type.title),
    fontSize: theme.type.title.scale,
    color: theme.colors.text,
    marginBottom: theme.space.lg,
  },
  section: {
    ...roleFont(theme.type.label),
    fontSize: theme.type.label.scale,
    color: theme.colors.textMuted,
    marginTop: theme.space.md,
  },
  button: {
    minHeight: theme.size.touch,
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    borderRadius: theme.shape.radius.md,
    backgroundColor: theme.colors.surface,
  },
  continue: { backgroundColor: theme.colors.accent },
  label: { ...roleFont(theme.type.button), fontSize: theme.type.button.scale, color: theme.colors.text },
  continueLabel: { ...roleFont(theme.type.button), fontSize: theme.type.button.scale, color: theme.colors.onAccent },
  continueCaption: {
    ...roleFont(theme.type.caption),
    fontSize: theme.type.caption.scale,
    color: theme.colors.onAccent,
  },
  links: { flexDirection: 'row', gap: theme.space.md, marginTop: 'auto' },
  link: { flex: 1 },
}))
```

Check that `src/theme/contrast.test.ts` covers the pairs `onAccent` on `accent`, `text` on `surface` and `textMuted` on `background`. If one is missing, write it under open questions. Do not change a theme file.

Create `src/home/components/HomeMenu/HomeMenu.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native'
import { LEVELS, type Level } from '@sudoku/core'
import { ThemeStatusBar } from '@/game/components/ThemeStatusBar'
import { LEVEL_NAMES } from './HomeMenu.constants'
import { styles } from './HomeMenu.styles'

type HomeMenuProps = {
  /** The level of the game in progress. Null when no game is in progress. */
  continueLevel: Level | null
  onNewGame(level: Level): void
  onContinue(): void
  onScan(): void
  onSettings(): void
}

export function HomeMenu({ continueLevel, onNewGame, onContinue, onScan, onSettings }: HomeMenuProps) {
  return (
    <View style={styles.screen}>
      <ThemeStatusBar />
      <Text accessibilityRole="header" style={styles.title}>
        Sudoku
      </Text>
      {continueLevel !== null && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Continue, ${LEVEL_NAMES[continueLevel]}`}
          onPress={onContinue}
          style={[styles.button, styles.continue]}
        >
          <Text style={styles.continueLabel}>Continue</Text>
          <Text style={styles.continueCaption}>{LEVEL_NAMES[continueLevel]}</Text>
        </Pressable>
      )}
      <Text accessibilityRole="header" style={styles.section}>
        New game
      </Text>
      {LEVELS.map((level) => (
        <Pressable key={level} accessibilityRole="button" onPress={() => onNewGame(level)} style={styles.button}>
          <Text style={styles.label}>{LEVEL_NAMES[level]}</Text>
        </Pressable>
      ))}
      <View style={styles.links}>
        <Pressable accessibilityRole="button" onPress={onScan} style={[styles.button, styles.link]}>
          <Text style={styles.label}>Scan a puzzle</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSettings} style={[styles.button, styles.link]}>
          <Text style={styles.label}>Settings</Text>
        </Pressable>
      </View>
    </View>
  )
}
```

Create `src/home/components/HomeMenu/index.ts`:

```ts
export { HomeMenu } from './HomeMenu'
```

- [ ] **Step 4: Implement the home screen**

Create `src/home/screens/HomeScreen/HomeScreen.constants.ts`:

```ts
export const REPLACE_TITLE = 'Start a new game?'
export const REPLACE_MESSAGE = 'Your current game ends.'
export const REPLACE_CONFIRM = 'New game'
export const REPLACE_CANCEL = 'Cancel'
```

Create `src/home/screens/HomeScreen/HomeScreen.tsx`:

```tsx
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Alert } from 'react-native'
import type { Level } from '@sudoku/core'
import { newGeneratedGame } from '@/game/utils/start.utils'
import { HomeMenu } from '@/home/components/HomeMenu'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { devWarn, errorMessage } from '@/utils/log.utils'
import { REPLACE_CANCEL, REPLACE_CONFIRM, REPLACE_MESSAGE, REPLACE_TITLE } from './HomeScreen.constants'

function confirmReplace(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(REPLACE_TITLE, REPLACE_MESSAGE, [
      { text: REPLACE_CANCEL, style: 'cancel', onPress: () => resolve(false) },
      { text: REPLACE_CONFIRM, style: 'destructive', onPress: () => resolve(true) },
    ])
  })
}

export function HomeScreen() {
  const router = useRouter()
  const { puzzles } = useGameStorage()
  const [continueLevel, setContinueLevel] = useState<Level | null>(null)
  // start() discards the game before it, so a second tap must not start a second game.
  const busy = useRef(false)

  useFocusEffect(
    useCallback(() => {
      let live = true
      puzzles
        .current()
        .then((progress) => {
          if (live) setContinueLevel(progress?.level ?? null)
        })
        .catch((error: unknown) => devWarn('storage', `The game in progress does not load: ${errorMessage(error)}`))
      return () => {
        live = false
      }
    }, [puzzles]),
  )

  const once = useCallback(async (task: () => Promise<void>) => {
    if (busy.current) return
    busy.current = true
    try {
      await task()
    } catch (error) {
      devWarn('storage', `The game does not start: ${errorMessage(error)}`)
    } finally {
      busy.current = false
    }
  }, [])

  const newGame = (level: Level) =>
    once(async () => {
      // Ask from the stored state at the tap: the focus refresh can still be on its way.
      if ((await puzzles.current()) !== null && !(await confirmReplace())) return
      await puzzles.start({ level, source: 'generated', game: newGeneratedGame(level, Math.random) })
      router.push('/game')
    })

  return (
    <HomeMenu
      continueLevel={continueLevel}
      onNewGame={newGame}
      onContinue={() => router.push('/game')}
      onScan={() => router.push('/scan')}
      onSettings={() => router.push('/settings')}
    />
  )
}
```

`start()` soft-deletes the game before it and writes no history entry (ADR-012, `PuzzleRepository`). So a confirmed new game discards the old one, and the history does not record it.

Create `src/home/screens/HomeScreen/index.ts`:

```ts
export { HomeScreen } from './HomeScreen'
```

- [ ] **Step 5: Run the tests and the lint, then commit**

```bash
pnpm --filter mobile exec jest src/home
just lint
/usr/bin/git add apps/mobile/src/home
/usr/bin/git commit -m "feat(home): a minimal home screen with the levels, Continue, Scan and Settings (#51)"
```

---

### Task 8: The play screen, the routes and the entry

**Files:**
- Create: `apps/mobile/src/game/screens/PlayScreen/PlayScreen.tsx`, `index.ts`
- Create: `apps/mobile/src/settings/screens/SettingsPlaceholderScreen/SettingsPlaceholderScreen.tsx`, `SettingsPlaceholderScreen.styles.ts`, `index.ts`
- Create: `apps/mobile/src/app/_layout.tsx`, `index.tsx`, `game.tsx`, `scan.tsx`, `settings.tsx`
- Create: `apps/mobile/devChecks.ts`
- Modify: `apps/mobile/index.ts`, root `package.json`
- Delete: `apps/mobile/App.tsx`

- [ ] **Step 1: Write the play screen**

Create `src/game/screens/PlayScreen/PlayScreen.tsx`:

```tsx
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toSavedGame, type Game } from '@sudoku/core'
import { SLOW_SAVE_MS } from '@/game/constants/save.constants'
import { GameSaveContext } from '@/game/hooks/useGameSaver'
import { GameScreen } from '@/game/screens/GameScreen'
import { createSaveQueue } from '@/game/utils/save.utils'
import { newGeneratedGame } from '@/game/utils/start.utils'
import type { SavedProgress } from '@/storage'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { devLog, devWarn, errorMessage } from '@/utils/log.utils'

function logSave(game: Game, ms: number) {
  if (!__DEV__) return
  // The size is measured only in a development build: it costs one more JSON pass.
  const bytes = JSON.stringify(toSavedGame(game)).length
  const slow = ms > SLOW_SAVE_MS ? ' (slow)' : ''
  devLog('storage', `saved in ${ms.toFixed(1)} ms, ${bytes} bytes${slow}`)
}

/**
 * The game in progress from PuzzleRepository. A route param holds no game (ADR-016), and Continue must read
 * the last save of the screen before. PuzzleRepository.save also moves a won or lost game to the history (ADR-012).
 */
export function PlayScreen() {
  const router = useRouter()
  const { puzzles } = useGameStorage()
  const [progress, setProgress] = useState<SavedProgress | null>(null)

  const home = useCallback(() => router.dismissTo('/'), [router])

  useEffect(() => {
    let live = true
    puzzles
      .current()
      .then((current) => {
        if (!live) return
        if (current === null) home()
        else setProgress(current)
      })
      .catch((error: unknown) => {
        devWarn('storage', `The game in progress does not load: ${errorMessage(error)}`)
        home()
      })
    return () => {
      live = false
    }
  }, [puzzles, home])

  const id = progress?.id
  const save = useMemo(
    () =>
      id === undefined
        ? null
        : createSaveQueue((game) => puzzles.save(id, game), {
            saved: logSave,
            failed: (error) => devWarn('storage', `The game does not save: ${errorMessage(error)}`),
          }),
    [puzzles, id],
  )

  const newPuzzle = useCallback(async () => {
    if (progress === null) return
    try {
      const game = newGeneratedGame(progress.level, Math.random)
      setProgress(await puzzles.start({ level: progress.level, source: 'generated', game }))
    } catch (error) {
      devWarn('storage', `The game does not start: ${errorMessage(error)}`)
    }
  }, [puzzles, progress])

  if (progress === null || save === null) return null
  return (
    <GameSaveContext value={save}>
      {/* A new id mounts a new game screen. A Game in start resumes as it was saved (startSession). */}
      <GameScreen key={progress.id} start={progress.game} onBack={home} />
    </GameSaveContext>
  )
}
```

`newPuzzle` is ready for #40's `onNewPuzzle` prop. Pass it in task 13, part A, when #40 merges. Until then, oxlint may report `newPuzzle` as unused. In that case, leave `newPuzzle` out of this task, and add it in task 13, part A.

Create `src/game/screens/PlayScreen/index.ts`:

```ts
export { PlayScreen } from './PlayScreen'
```

- [ ] **Step 2: Write the settings placeholder**

#38 builds the settings screen in `src/settings/` in parallel. This screen keeps the Settings link working until #38's screen takes the route (task 13, part B).

Create `src/settings/screens/SettingsPlaceholderScreen/SettingsPlaceholderScreen.styles.ts`:

```ts
import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    gap: theme.space.md,
    paddingTop: rt.insets.top + theme.space.xxl,
    paddingHorizontal: theme.space.lg,
    backgroundColor: theme.colors.background,
  },
  title: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale, color: theme.colors.text },
  body: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.textMuted },
}))
```

Create `src/settings/screens/SettingsPlaceholderScreen/SettingsPlaceholderScreen.tsx`:

```tsx
import { Text, View } from 'react-native'
import { ThemeStatusBar } from '@/game/components/ThemeStatusBar'
import { styles } from './SettingsPlaceholderScreen.styles'

/** Holds the settings route until the settings screen exists. Swipe right to go back. */
export function SettingsPlaceholderScreen() {
  return (
    <View style={styles.screen}>
      <ThemeStatusBar />
      <Text accessibilityRole="header" style={styles.title}>
        Settings
      </Text>
      <Text style={styles.body}>The assists and the theme come here.</Text>
    </View>
  )
}
```

Create `src/settings/screens/SettingsPlaceholderScreen/index.ts`:

```ts
export { SettingsPlaceholderScreen } from './SettingsPlaceholderScreen'
```

- [ ] **Step 3: Write the route files**

Each route file renders one screen and nothing else.

`src/app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router'
import { GameStorageProvider } from '@/storage/components/GameStorageProvider'

/** Each screen draws its own themed header and background, so the stack shows no native header (ADR-016). */
export default function RootLayout() {
  return (
    <GameStorageProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </GameStorageProvider>
  )
}
```

`src/app/index.tsx`:

```tsx
import { HomeScreen } from '@/home/screens/HomeScreen'

export default function HomeRoute() {
  return <HomeScreen />
}
```

`src/app/game.tsx`:

```tsx
import { PlayScreen } from '@/game/screens/PlayScreen'

export default function GameRoute() {
  return <PlayScreen />
}
```

`src/app/scan.tsx`:

```tsx
import { ScanFlow } from '@/scan/screens/ScanFlow'

export default function ScanRoute() {
  return <ScanFlow />
}
```

`src/app/settings.tsx`:

```tsx
import { SettingsPlaceholderScreen } from '@/settings/screens/SettingsPlaceholderScreen'

export default function SettingsRoute() {
  return <SettingsPlaceholderScreen />
}
```

- [ ] **Step 4: Move the dev checks out of `App.tsx`**

Create `apps/mobile/devChecks.ts` with `logOpenCVProbe` and `logModelParity` copied unchanged from `App.tsx` (with their imports from `@/scanner` and `@/utils/log.utils`), and this function:

```ts
/** Runs in a development build only. Inside the __DEV__ branch, so a release bundle leaves the 450 KB reference file out. */
export function runDevChecks(): void {
  if (!__DEV__) return
  logOpenCVProbe()
  logModelParity(require('./assets/models/reference-outputs.json'))
}
```

Replace `apps/mobile/index.ts` with:

```ts
// StyleSheet.configure must run before any StyleSheet.create (ADR-015).
// oxlint-disable-next-line import/no-unassigned-import -- the module registers the themes as its side effect.
import '@/theme/unistyles'
import { runDevChecks } from './devChecks'
// Expo Router wants its entry imported last in a custom entry (ADR-016).
// oxlint-disable-next-line import/no-unassigned-import -- the module registers the root component as its side effect.
import 'expo-router/entry'

runDevChecks()
```

Delete `App.tsx`:

```bash
/usr/bin/git rm apps/mobile/App.tsx
```

In the root `package.json`, change the `boundaries` script from `depcruise apps/mobile/App.tsx apps/mobile/src ...` to `depcruise apps/mobile/index.ts apps/mobile/devChecks.ts apps/mobile/src ...`. Keep the rest of the line.

- [ ] **Step 5: Move the App tests**

Delete `App.test.tsx`, `App.release.test.tsx` and `App.probeFailure.test.tsx` (`/usr/bin/git rm`). Create `apps/mobile/devChecks.test.ts`. It keeps the two facts that those tests proved, and the parity log:

```ts
import { waitFor } from '@testing-library/react-native'
import { Mat } from 'react-native-fast-opencv'
import { runDevChecks } from './devChecks'

describe('runDevChecks', () => {
  const dev = __DEV__

  afterEach(() => {
    Reflect.set(globalThis, '__DEV__', dev)
    jest.restoreAllMocks()
  })

  it('logs the fast-opencv probe and the model parity in a development build', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    runDevChecks()
    expect(log).toHaveBeenCalledWith('[scanner] fast-opencv works')
    await waitFor(() => expect(log).toHaveBeenCalledWith(expect.stringContaining('[scanner] model parity')))
  })

  it('logs a fast-opencv probe that throws, and does not throw', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.mocked(Mat.create).mockImplementationOnce(() => {
      throw new Error('native module missing')
    })
    expect(() => runDevChecks()).not.toThrow()
    expect(log).toHaveBeenCalledWith('[scanner] fast-opencv FAILED: native module missing')
    await waitFor(() => expect(log).toHaveBeenCalledWith(expect.stringContaining('[scanner] model parity')))
  })

  it('does nothing in a release build', () => {
    Reflect.set(globalThis, '__DEV__', false)
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    runDevChecks()
    expect(log).not.toHaveBeenCalled()
  })
})
```

If the parity check of the first test still logs after the spy goes away in the second test, keep the `waitFor` in both, as the old App tests did.

- [ ] **Step 6: Run the checks and commit**

```bash
pnpm --filter mobile exec jest devChecks src/game src/settings
just lint
just typecheck
/usr/bin/git add -A apps/mobile package.json
/usr/bin/git commit -m "feat(app): routes in src/app on a native stack, the play screen and the entry (#51)"
```

Expected: all pass. `sample.utils.ts` stays: other tests use it.

---

### Task 9: Route tests

**Files:**
- Create: `apps/mobile/test/routes.test.tsx`

`renderRouter` renders the real route screens on Expo Router's own stack. The test file is outside `src/app/`, as the docs require. The layout of the test gives an in-memory storage.

- [ ] **Step 1: Write the tests**

Create `apps/mobile/test/routes.test.tsx`:

```tsx
import { Stack } from 'expo-router'
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { Alert, type AlertButton } from 'react-native'
import { GIVENS_TARGET, createGame, generate } from '@sudoku/core'
import { createMemoryStorage, type GameStorage } from '@/storage'
import GameRoute from '@/app/game'
import HomeRoute from '@/app/index'
import ScanRoute from '@/app/scan'
import SettingsRoute from '@/app/settings'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'

function renderApp(storage: GameStorage = createMemoryStorage()) {
  renderRouter({
    _layout: () => (
      <GameStorageContext value={storage}>
        <Stack screenOptions={{ headerShown: false }} />
      </GameStorageContext>
    ),
    index: HomeRoute,
    game: GameRoute,
    scan: ScanRoute,
    settings: SettingsRoute,
  })
  return storage
}

// The board draws the grid after it knows its size.
const layOutBoard = async () =>
  fireEvent(await screen.findByTestId('board'), 'layout', { nativeEvent: { layout: { width: 358, height: 358 } } })

async function inProgress(storage: GameStorage) {
  const progress = await storage.puzzles.current()
  if (progress === null) throw new Error('No game in progress')
  return progress
}

async function startGame(storage: GameStorage, name = 'Easy') {
  fireEvent.press(await screen.findByRole('button', { name }))
  await waitFor(() => expect(screen).toHavePathname('/game'))
  await layOutBoard()
  return inProgress(storage)
}

const givensOf = (grid: readonly number[]) => grid.filter((digit) => digit !== 0).length

/** Answers the next Alert with the button of that text. */
function answerAlert(text: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
    buttons?.find((button) => button.text === text)?.onPress?.()
  })
}

afterEach(() => jest.restoreAllMocks())

it('opens on the home screen without Continue when no game is in progress', async () => {
  renderApp()
  expect(await screen.findByRole('button', { name: 'Easy' })).toBeTruthy()
  expect(screen).toHavePathname('/')
  expect(screen.queryByRole('button', { name: /^Continue/ })).toBeNull()
})

it('starts a new game at the tapped level and saves it', async () => {
  const storage = renderApp()
  const progress = await startGame(storage)
  expect(progress).toMatchObject({ level: 'easy', source: 'generated' })
  expect(givensOf(progress.game.givens)).toBe(GIVENS_TARGET.easy)
  expect(screen.getAllByTestId(/^cell-\d+$/)).toHaveLength(81)
})

it('a double tap on a level starts one game', async () => {
  const storage = createMemoryStorage()
  const start = jest.spyOn(storage.puzzles, 'start')
  renderApp(storage)
  const easy = await screen.findByRole('button', { name: 'Easy' })
  fireEvent.press(easy)
  fireEvent.press(easy)
  await waitFor(() => expect(screen).toHavePathname('/game'))
  expect(start).toHaveBeenCalledTimes(1)
})

it('saves a move, and Continue resumes the move', async () => {
  const storage = renderApp()
  const { game } = await startGame(storage)
  const cell = game.givens.findIndex((digit) => digit === 0)
  const digit = game.solution[cell] ?? 0
  fireEvent.press(screen.getByTestId(`cell-${cell}`))
  fireEvent.press(screen.getByLabelText(`Enter ${digit}`))
  await waitFor(async () => expect((await inProgress(storage)).game.entries[cell]).toBe(digit))

  fireEvent.press(screen.getByLabelText('Back to home'))
  fireEvent.press(await screen.findByRole('button', { name: 'Continue, Easy' }))
  await waitFor(() => expect(screen).toHavePathname('/game'))
  await layOutBoard()
  expect(screen.getByTestId(`cell-${cell}`).props.accessibilityLabel).toMatch(new RegExp(`, ${digit}$`))
})

it('Continue resumes the time played', async () => {
  const storage = createMemoryStorage()
  const { givens, solution } = generate('medium', 7)
  await storage.puzzles.start({
    level: 'medium',
    source: 'generated',
    game: { ...createGame({ givens, solution }), playedMs: 65_000 },
  })
  renderApp(storage)
  fireEvent.press(await screen.findByRole('button', { name: 'Continue, Medium' }))
  expect(await screen.findByLabelText('Time 01:05')).toBeTruthy()
})

it('selecting a cell does not save', async () => {
  const storage = createMemoryStorage()
  renderApp(storage)
  const { game } = await startGame(storage)
  const save = jest.spyOn(storage.puzzles, 'save')
  const open = game.givens.findIndex((digit) => digit === 0)
  fireEvent.press(screen.getByTestId(`cell-${open}`))
  fireEvent.press(screen.getByTestId('cell-0'))
  expect(save).not.toHaveBeenCalled()
})

it('the moves show at once while a save hangs', async () => {
  const storage = createMemoryStorage()
  renderApp(storage)
  const { game } = await startGame(storage)
  const save = jest.spyOn(storage.puzzles, 'save').mockReturnValue(new Promise<void>(() => undefined))
  const open = game.givens
    .map((digit, cell) => (digit === 0 ? cell : -1))
    .filter((cell) => cell !== -1)
    .slice(0, 3)
  for (const cell of open) {
    fireEvent.press(screen.getByTestId(`cell-${cell}`))
    fireEvent.press(screen.getByLabelText(`Enter ${game.solution[cell] ?? 0}`))
  }
  for (const cell of open) {
    expect(screen.getByTestId(`cell-${cell}`).props.accessibilityLabel).toMatch(new RegExp(`, ${game.solution[cell]}$`))
  }
  // The first write hangs, so the newer moves wait in one slot and are not written yet.
  expect(save).toHaveBeenCalledTimes(1)
})

it('asks before a new game replaces the game in progress, then discards it without history', async () => {
  const storage = renderApp()
  const first = await startGame(storage)
  fireEvent.press(screen.getByLabelText('Back to home'))
  const alert = answerAlert('New game')
  await screen.findByRole('button', { name: 'Continue, Easy' })
  const second = await startGame(storage, 'Hard')
  expect(alert).toHaveBeenCalledWith('Start a new game?', 'Your current game ends.', expect.any(Array))
  expect(second.id).not.toBe(first.id)
  expect(second.level).toBe('hard')
  expect(await storage.history.list()).toEqual([])
})

it('keeps the game in progress when the player cancels', async () => {
  const storage = renderApp()
  const first = await startGame(storage)
  fireEvent.press(screen.getByLabelText('Back to home'))
  const alert = answerAlert('Cancel')
  fireEvent.press(await screen.findByRole('button', { name: 'Hard' }))
  await waitFor(() => expect(alert).toHaveBeenCalled())
  expect(screen).toHavePathname('/')
  expect((await inProgress(storage)).id).toBe(first.id)
})

it('does not ask when no game is in progress', async () => {
  const alert = jest.spyOn(Alert, 'alert')
  const storage = renderApp()
  await startGame(storage)
  expect(alert).not.toHaveBeenCalled()
})

it('stays on the home screen when the game does not start', async () => {
  const storage = createMemoryStorage()
  jest.spyOn(storage.puzzles, 'start').mockRejectedValueOnce(new Error('disk full'))
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  renderApp(storage)
  fireEvent.press(await screen.findByRole('button', { name: 'Easy' }))
  await waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringContaining('[storage] The game does not start')))
  expect(screen).toHavePathname('/')
})

it('opens the scan flow', async () => {
  renderApp()
  fireEvent.press(await screen.findByRole('button', { name: 'Scan a puzzle' }))
  expect(await screen.findByTestId('camera')).toBeTruthy()
  expect(screen).toHavePathname('/scan')
})

it('opens Settings', async () => {
  renderApp()
  fireEvent.press(await screen.findByRole('button', { name: 'Settings' }))
  await waitFor(() => expect(screen).toHavePathname('/settings'))
})
```

The home screen stays mounted under the game screen in a stack, so a query can find home buttons while the game shows. The tests query labels that only one screen has. If a popped game screen stays mounted in Jest after Back, a second `board` appears after Continue. Then use `getAllByTestId('board').at(-1)` and the last match of each cell, and write this under open questions for the reviewer.

- [ ] **Step 2: Run them**

```bash
pnpm --filter mobile exec jest test/routes.test.tsx
```

Expected: all pass. Failures to expect, and their fixes:

- `SyntaxError: Cannot use import statement outside a module` in an `expo-router` file: the jest-expo preset should transform it. Add `expo-router` to a `transformIgnorePatterns` in the `jest` object of `apps/mobile/package.json`. Copy the rest of the pattern from `node_modules/jest-expo/jest-preset.js`, and add `\\.pnpm` for the isolated install.
- A `react-native-screens` native component is missing: write it under open question 4 with the error text. The fix is a mock in `jest.setup.ts`, which this plan does not own.
- `import ... from '@/app/index'` fails the folder-entry lint rule: import `@/app/index.tsx` the way the rule allows, or write the route mocks as `index: () => <HomeScreen />` with the feature screens. The route files are one line each, so the test loses nothing.

- [ ] **Step 3: Run every check and commit**

```bash
just lint
just typecheck
just test-ts
/usr/bin/git add apps/mobile/test/routes.test.tsx
/usr/bin/git commit -m "test(app): routes, Continue, the new-game question and save cost (#51)"
```

---

### Task 10: Development log check

- [ ] **Step 1: Start the dev server and read the types**

```bash
just app
```

Expected: Expo CLI writes `apps/mobile/expo-env.d.ts` and `.expo/types/`. `git status` does not show them. Stop the server. Run `just typecheck` again: it now checks the typed routes. If `router.push('/game')` fails the typecheck, a route file name is wrong.

---

### Task 11: Glossary

**Files:**
- Modify: `docs/architecture/12-glossary.md`

- [ ] **Step 1: Add the rows of this plan**

Add at the end of the table:

```markdown
| Home screen | The first screen of the app. It lists the levels, offers Continue for the game in progress, and links to Scan and Settings |
| Continue | The home screen button that resumes the game in progress at its last move, with its time played |
| Route | One screen that the app can show, at one path, such as `/game`. A file in `src/app/` defines it (ADR-016) |
| Route file | A file in `src/app/` that renders one screen from a feature folder and nothing else (ADR-016) |
| Native stack | The stack of screens that uses the iOS screen stack: the push animation and the swipe back. Expo Router gives it (ADR-016) |
| Save queue | The queue in front of `PuzzleRepository.save`. One write runs at a time, and only the newest game waits |
```

- [ ] **Step 2: Add the rows of the coordinator**

None of the four new terms is in the glossary on `origin/develop` (checked 2026-10-12). Check again before you add them. If a term exists by then, merge the meaning into that row. Do not add a second row. Add at the end of the table:

```markdown
| Pause layer | The layer over the grid while a game is paused. It says "Paused" and "Tap to resume". It hides every digit and note |
| Correction pad | The edit pad on the correction screen: a Given and Entry switch, the keys 1 to 9 and Clear |
| Given conflict | Two givens with the same digit in one row, column or box. The correction screen marks both |
| Assist preview | The small live grid on the settings screen. It shows the assists that are on |
```

Replace the "Correction screen" row with:

```markdown
| Correction screen | The screen after a scan. It shows the recognised grid, marks the uncertain cells and offers Retake. The player can fix a digit and its kind there |
```

If the coordinator passes more rows later, add them in the same way.

- [ ] **Step 3: Check and commit**

```bash
just docs-check
/usr/bin/git add docs/architecture/12-glossary.md
/usr/bin/git commit -m "docs(glossary): home screen, routes, save queue and the terms of the wave (#51)"
```

---

### Task 12: iPhone check, ADR accepted, pull request

- [ ] **Step 1: Make a new development build.** Expo Router, `react-native-screens`, `expo-linking` and `expo-constants` add native code. The developer runs this on the Mac with the iPhone connected:

```bash
cd apps/mobile && pnpm exec expo run:ios --device
```

- [ ] **Step 2: The developer runs the iPhone steps below.** Record each result, and copy the `[storage] saved in` lines of step 5.

- [ ] **Step 3: Accept the ADR when every step passes.** In `adr-016-navigation.md`, set `status: ACCEPTED` and `Status | Accepted`. Under Decision point 1, add the results as a list, as ADR-015 does, with the median and the slowest save time of step 5. In `00-DECISIONS.md`, delete "**Pending the iPhone check of #51.**". In `09-architecture-decisions.md`, set the status to `Accepted`. If a step fails, keep `Proposed` and report the failure.

```bash
just docs-check
/usr/bin/git add docs/architecture
/usr/bin/git commit -m "docs(adr): accept ADR-016 after the iPhone check (#51)"
```

- [ ] **Step 4: Tick the criteria.** Tick each met criterion of #51. Tick the criterion of #36 "After the app is killed, the puzzle resumes at the last move, timer included", and add under it: "Proved on the iPhone with #51." Use `gh issue edit <N> --body-file <file>` with the edited body. The criterion "Back to home, New puzzle and Try this puzzle again" stays open until task 13.

- [ ] **Step 5: Open the pull request** when the developer asks. Body: a summary, ADR-016, the "Files owned" table, the test evidence (the result lines of `just lint`, `just typecheck`, `just test-ts`, `just docs-check`), the iPhone results with the save times, and `Closes #51`. Then a second agent reviews the PR without this session's context (root `AGENTS.md`, Work tracking 8).

---

### Task 13: Connect the wave 4 screens (after #38, #39 and #40 merge)

Run each part after its issue merges into `develop`. Rebase this branch, or open a follow-up branch if #51 merged already.

- [ ] **Part A, after #40: New puzzle.** #40 gives `GameScreen` `onNewPuzzle()` and uses `onBack()` for "Back to home" (coordinator ruling). `onBack` goes home already. In `PlayScreen.tsx`, pass `onNewPuzzle={newPuzzle}` (task 8, step 1). Add to `test/routes.test.tsx`: lose a game (three wrong digits in one cell, as `GameScreen.test.tsx` does). Press "New puzzle". Expect a new game in progress with a new id and the same level, and one lost entry in the history. Press "Back to home" on a lost game, and expect the home screen without Continue. If #40 adds `onRetry()` (open question 2), pass a `retry` that calls `puzzles.start({ level, source, game: createGame({ givens, solution }) })` with the givens and solution of the lost game, then `setProgress`. Then tick the remaining criterion of #51.

- [ ] **Part B: the settings screen of #38.** If #38 merges before #51, do this part here. If #38 merges after #51, #38's last task does it (coordinator ruling). Change only `src/app/settings.tsx`: render #38's settings screen instead of `SettingsPlaceholderScreen`. Delete `src/settings/screens/SettingsPlaceholderScreen/`. Keep the test "opens Settings".

- [ ] **Part C, after #39 and #40: widen the start type.** Change `start: NewGame` to `start: GameStart` (from `@/game/utils/session.utils`) in `useGameSession.ts` and `GameScreen.tsx`. Delete the comment in `PlayScreen.tsx` that explains the `Game` in `start`.

- [ ] Run `just lint`, `just typecheck`, `just test-ts`. Commit each part, for example `feat(game): New puzzle starts a game at the same level (#51)`.

---

## iPhone steps for the developer

Use the new development build from task 12, step 1, with Metro running (`just app`), so the development logs show in the terminal. Do each step in Daylight. Then repeat steps 1 and 8 in Midnight (iOS Settings, Display & Brightness, Dark).

1. Open the app. The home screen shows "Sudoku", the levels Easy, Medium, Hard and Expert, and Scan a puzzle and Settings. No Continue button shows on a fresh install. The colours follow the theme. No white flash shows when a screen opens or closes.
2. Tap Medium. No question shows. The game screen opens with the iOS push animation, on a new puzzle.
3. Place three correct numbers and one note. Wait until the timer shows at least 00:20.
4. **QR-11:** note the time on the timer. Go to the iOS home screen, open the app switcher and swipe the app away. Open the app again. Continue shows "Medium", above the levels. Tap it. The three numbers and the note are there, and the timer starts at the noted time (± 1 s), not at 00:00.
5. **Save cost:** tap 20 cells quickly, one after the other. The selection follows each tap with no delay, and the terminal shows no new `[storage] saved in` line. Then place 10 numbers or notes as fast as you can. Each one shows at once. The terminal shows `[storage] saved in <ms> ms, <bytes> bytes` lines, at most one per move. Expected: most saves under 10 ms, none marked `(slow)` (over 50 ms), and a size between about 1 KB and 10 KB this early in a game. Copy the lines into the report.
6. Tap Back to home. Continue still shows. Tap Easy. The question "Start a new game? Your current game ends." shows. Tap Cancel. The home screen stays, and Continue still shows "Medium". Tap Easy again, then New game. A new easy game opens. Tap Back. Continue now shows "Easy".
7. On the game screen, swipe from the left edge. The app goes back to the home screen.
8. Tap Scan a puzzle. The camera opens, and the overlay runs as before. Swipe from the left edge. The home screen shows again, and the camera stops (the green camera dot goes away).
9. Tap Settings. The placeholder screen shows (or #38's screen, if it merged). Swipe back.
10. Lose a game: place three wrong numbers. Tap Back to home. No Continue shows, because the lost game moved to the history.

Report each step as passed or failed, with a screenshot of any failure. If step 1 shows a white flash in Midnight, report it (open question 5).

## Open questions

1. **The start type in #39's and #40's files.** `useGameSession(start: NewGame)` (#39) and `GameScreen` `start: NewGame` (#40) receive a `Game` to resume. This compiles, because a `Game` has every field of `NewGame`, and `startSession` tells them apart. The types do not show it. **Recommendation:** #51 exports `GameStart` from `session.utils.ts` now. Task 13, part C widens the two annotations after #39 and #40 merge.
2. **"Try this puzzle again" and the save.** If #40 restarts the puzzle inside `GameScreen` (a new key on `GameProvider`), the restarted game saves under the id of the lost game. `save()` moved that game to the history, so the store ignores every later save, and a kill loses the restarted game. **Recommendation:** #40 adds an `onRetry()` prop. `PlayScreen` starts a new game in progress from the same givens and mounts it under the new id (task 13, part A). Please rule on this.
3. **Settings route.** Settled by the coordinator. #51 ships `src/app/settings.tsx` with a placeholder screen in `src/settings/screens/SettingsPlaceholderScreen/`, a folder name that #38 does not use. Whichever of #38 and #51 merges last changes that one route file and deletes the placeholder (task 13, part B).
4. **A mock in `jest.setup.ts`.** `expo-router/testing-library` brings its own mocks. **Recommendation:** no change to `jest.setup.ts`. If task 9 shows that a mock is needed, #51 adds one block at the end of `jest.setup.ts` with the coordinator's approval, because the dependency comes with #51.
5. **A navigation theme.** The stack has a light default background behind the screens. Every screen draws its own background, so it should not show. **Recommendation:** no theme now. If iPhone step 1 shows a white flash in Midnight, `_layout.tsx` gets a `ThemeProvider` from `expo-router` with `colors.background` from `useUnistyles()`, in a small component in `src/home/components/`, so the layout stays thin.
6. **Files with no owner.** This plan takes `session.utils.ts`, `GameProvider/*`, the root `package.json` (one script), new folders under `src/storage/` and `src/settings/`, `05-building-block-view.md` and one row of `game-screen.md`. **Recommendation:** confirm #51 as owner in this wave. #38 must not create `src/settings/screens/SettingsPlaceholderScreen/`.
7. **The pause on background (#39).** iOS stops JS timers in the background. When the app returns, `useGameClock` reports the whole time away as played. #39 pauses the game when the app leaves the foreground, which fixes this. #51 saves the time when the app leaves, so a kill is correct already. **Recommendation:** no change in #51.
8. **ADR number.** This plan takes ADR-016. **Recommendation:** the ADR of #43 (motion sensor) takes ADR-017 or later.
9. **Typed routes on CI.** CI does not run `expo start`, so `Href` is a plain string there. The local typecheck after `just app` checks the routes. **Recommendation:** accept this for four routes. If a wrong route ever reaches `develop`, add `pnpm exec expo customize tsconfig.json` before the typecheck in `ci-ts.yml`.
