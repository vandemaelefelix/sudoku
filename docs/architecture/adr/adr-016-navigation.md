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
5. **The entry is `index.ts`.** It registers the themes first (ADR-015). It imports
   `expo-router/entry` last of the imports. The development checks run after the imports.
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
