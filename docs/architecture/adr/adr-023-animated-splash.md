---
status: DRAFT
---

# ADR-023: An animated splash from the system appearance

| Field | Value |
| --- | --- |
| Project | Sudoku |
| Status | Proposed |
| Date | 2026-10-14 |
| Contact | Felix |
| Supersedes | Decision 5 of ADR-022 |

## Context

ADR-022 decision 5 keeps a still image of the app mark as the splash until #93. The developer does
not want the splash to look like a logo. A native splash is a static image. It cannot animate.
The JavaScript runtime needs time to start, and the player can save a theme that the native layer
cannot read.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| The still mark of ADR-022 | No work | It looks like a logo. It ends with a jump |
| A Lottie file | The animation is data | A new dependency. The title font of the theme cannot match. A design tool is needed |
| Reanimated views for the cells | The same tool as the game grid | 189 animated views change on every frame |
| **A Skia picture for the cells and Reanimated text for the word** | One draw for all cells. The word is real text, so the font matches the home title. Both libraries are in the app | The cell drawing is code and not a design file |
| A native splash that follows the saved theme | The colours match the theme | The native config is fixed at build time |

## Decision

1. The native splash shows only a ground colour: `#ffffff` in light mode and `#0f1116` in dark
   mode. It has no image. The values live in `src/theme/splash.colors.ts`.
2. A `SplashOverlay` in `RootLayout` draws the same ground, then the animation "Soft wave, softer"
   (the splash concept).
3. The intro runs at once. The exit starts when the intro is done and the home reports ready, or
   after 3 seconds.
4. The overlay has `pointerEvents="none"`.
5. With Reduce Motion on, the app draws no overlay. The native splash hides when the home is ready.
6. The splash colours follow the system appearance. The word uses the title font of the saved theme.
   Its colour changes to the title colour during the glide.
7. This ADR supersedes decision 5 of ADR-022.

## Consequences

- The splash image `assets/icons/splash/splash-light.png` and its line in `scripts/icons/icons.mjs`
  go away. The icon and the favicon stay.
- The change needs a new native build, because `app.json` changes. `just ios-dev` and
  `just ios-release` run `expo prebuild --clean`.
- On a fast phone the intro adds about 0.9 s before the home is fully visible. The home is ready
  and takes touches earlier, because the overlay passes touches through.
- During the intro the ground hides the home menu, but the menu already takes touches. A tap on the blank splash can start a game at a level the player did not see. This follows from decision 4.
- A light splash opens a Midnight home with a white-to-dark change during the wave. This is by
  design.
- Android is not built yet. Android 12 and later may draw the app icon on a splash with no image.

## Reassessment Triggers

- The first Android build draws the app icon on the splash: add a transparent splash image.
- The app needs more than 3 seconds to show the home on a normal phone.
- A fifth theme puts the title in another place than the top left corner.
- The developer finds the intro too slow: cut the hold, then shorten the letters.
