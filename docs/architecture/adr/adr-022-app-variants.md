---
status: DRAFT
---

# ADR-022: Two app variants and an icon generated from the Op-art theme

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-14 |
| Contact | Felix      |

## Context

The app used the Expo placeholder icon. Every build also used one bundle ID, so a development build
replaced the production app on the phone, with its saved games. The developer cannot see which build
is installed.

The icon must follow the iOS rules (an opaque 1024 px light icon, plus dark and tinted icons) and the
Android rules (an adaptive icon with a safe zone, plus a monochrome layer).

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| One variant, a ribbon only in development builds | No new bundle ID | The two builds still replace each other. The ribbon shows only what is installed now |
| Two variants, unset `APP_VARIANT` means production | The Expo tutorial default | A plain `expo run:ios`, the daily command, replaces the production app |
| **Two variants, unset `APP_VARIANT` means development** | A local build never touches the production app | A release build must set `APP_VARIANT=production`. `just ios-release` does it |
| Icon PNGs drawn by hand in a design tool | No script | Each change repeats for 14 files. The 9 drifts from the theme font |
| **Icon PNGs generated from one SVG design** | One source. The 9 is the Instrument Serif outline | Two development dependencies: resvg and opentype.js |

## Decision

1. `app.json` holds the production config. `app.config.ts` reads `APP_VARIANT`.
2. An unset or empty `APP_VARIANT` means development. An unknown value stops the build.
3. The development variant has the bundle ID and Android package `com.vandemaelefelix.sudoku.dev`,
   the name "Sudoku Dev", the scheme `sudoku-dev` and icons with a "DEV" ribbon.
4. `scripts/icons/` draws every icon layer in one 100 × 100 design. `just icons` renders the PNGs
   into `apps/mobile/assets/icons/`. The PNGs are committed.
5. The splash screen shows a still image of the mark until #93 (animate the splash screen).

## Consequences

- The first development build installs as a new app. Its data starts empty. The production app keeps
  its data.
- A change of variant needs `expo prebuild --clean`, because `ios/` keeps the last bundle ID. The
  `just ios-dev` and `just ios-release` recipes do this.
- `just pull-scans` takes the bundle ID of the variant.
- iOS applies the iOS 26 glass effect to the PNG icon. An Icon Composer `.icon` file is not used.

## Reassessment Triggers

- EAS Build is adopted (ADR-010): move `APP_VARIANT` into the build profiles of `eas.json`.
- A preview variant for testers is needed.
- Icon Composer files become available from a script: replace the iOS PNGs with a `.icon` file.
