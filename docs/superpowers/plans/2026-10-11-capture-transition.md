# Capture Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At lock-on, play the transition from the camera into the correction screen: the photo flattens into the grid square with the gathered dots on it, the dots turn to ink, the grid lines grow, the digits sweep in with printed and handwritten styles, uncertain cells get a dashed ring and the panel slides up (issue #19).

**Architecture:** A pure timeline `transitionAt(t)` gives every channel at time `t`. A clock on the UI thread advances `t` and holds at two gates (the photo is a Skia image; `recognise()` has returned). Three layers draw from the same clock: a Skia `TransitionCanvas` under the overlay (light background, the warped photo, the white cells, the growing lines), the existing `EffectCanvas` in a new capture phase (the gathered dots ride the moving quad, pulse, turn to ink and shrink; the free dots drift out), and React Native views (title, digits, rings, panel) whose opacity comes from the clock. At 1.5 s the phase becomes `review` and a static `CorrectionScreen` with the same layout replaces the layers.

**Tech Stack:** TypeScript, Expo 57, React Native 0.86, Reanimated 4, react-native-worklets 0.10, `@shopify/react-native-skia` 2.6.2, VisionCamera 5, nitro-image, `react-native-safe-area-context` (new, through `expo install`), Jest.

**Spec:** `docs/superpowers/specs/2026-10-11-capture-flow-design.md`, section "#19: the transition and the correction screen". Also `docs/superpowers/specs/2026-10-11-scan-experience-design.md`, "Stage 2" and "Stage 3", and the prototype "Scan flow studies" sections 1d and 3 (saved copy: `.superpowers/sdd/2026-10-11-capture-and-recognise/artifact-scan-flow.html`, the `makeGather` result part and the `Phone.render` `cfg.mode` part).

The developer asked (2026-10-11) to build this without a plan review: "go ahead and implement it until it's finished". Plan approval is waived for this issue.

## Global Constraints

- Branch: `feature/19-capture-transition`, stacked on `feature/6-capture-and-recognise`. Commits: `feat(scan): ... (#19)`.
- Git: `/usr/bin/git`, one plain command per Bash call. Do not push, open a pull request or edit GitHub.
- The app reaches the scanner only through `src/scanner/index.ts` (SUD-05). The game does not depend on the correction screen (SUD-03).
- No router (capture flow design, "Screens"). `ScanFlow` holds the phase.
- Timeline (seconds, from lock-on): flash 25 % → 0 at 0.00–0.25; gathered-dot pulse to 1.6 × radius and back at 0.00–0.25; flatten of the photo and the gathered dots 0.05–0.50; free dots drift 40 pt outward and fade 0.05–0.45; dim (black) to the light background 0.05–0.50; dots white to ink 0.15–0.45; cell area to white 0.30–0.55; lines grow from the middle of each row and column 0.35–0.70; photo fades out 0.50–0.80; dots shrink into the crossings 0.65–0.95; digits in a diagonal sweep 0.55–1.20 (each cell starts 28 ms × (row + column) after 0.55 and fades in 150 ms); rings on uncertain cells 1.20–1.40; panel slides up 1.20–1.50. Every ramp uses smoothstep.
- Gates: photo at 0.05 (opens when the photo is a Skia image; until then the live preview shows under the flash); results at 0.70 (opens when `recognise()` returns). A closed gate holds the clock. A spinner shows when the results gate holds for more than 1 s. On `ok: false` the results gate stays closed and the panel says the scan failed and offers Retake.
- When the photo draws, the camera stops (`isActive = false`).
- At 1.5 s the phase becomes `review`; the transition layers unmount; the correction screen looks the same, so the change is not visible.
- Reduce Motion: a cross-fade of 0.3 s from the frozen view to the correction screen replaces the flatten. All digits show at the end of the fade. The gates still apply.
- Cell styles: given (`printed`) text colour, weight 600; entry (`handwritten`) accent blue, weight 500; uncertain = `confidence < REVIEW_CONFIDENCE` (0.9, provisional) or an invalid pair → a dashed amber ring, 1.5 pt, inside the cell, in addition to the digit style; empty and `notes` → empty (an uncertain empty cell still gets a ring).
- Grid lines: box lines 2 pt in ink, cell lines 1 pt in the line colour.
- Panel: the number of cells to check, "Play this puzzle" (shown, disabled: the game does not exist), "Retake" (back to `live` with a new scene).
- Colours are tokens in `src/theme/colors.ts`, each with a light and a dark value. `app.json` stays light only. Light values from the prototype: background `#f4f5f8`, surface `#ffffff`, text `#141821`, muted `#5c6475`, line `#cfd4de`, ink `#1d2330`, accent `#2f5bd3`, warning `#d98a1c`, warning text `#9a5c0a`, warning surface `#fbefd9`. Dark: background `#0f1116`, surface `#171a22`, text `#e7e9ef`, muted `#9aa1b2`, line `#272b35`, ink `#e7e9ef`, accent `#84a0ff`, warning `#f0aa4a`, warning text `#f0aa4a`, warning surface `#3a2a12`.
- Every function that runs on the UI thread has `'worklet'`. The overlay stays within 4 ms per frame.
- Writing style and comments: root `AGENTS.md`. No TODO. Comments cite durable sources (scan-pipeline concept, ADRs), not specs or issues.
- Before a task is done, run from the repository root: `just lint`, `just typecheck`, `just test-ts`, `just boundaries`.
- A Metro server runs against this worktree for the phone. Leave it alone.

## Review Focus

1. **`recognise()` is slower than the lines.** The clock must hold at 0.70, show a spinner after 1 s, and continue when the result arrives. Pinned in Task 2 and Task 6.
2. **`recognise()` fails.** No digits, the panel shows the failure and Retake, Retake gives a fresh live scene. Pinned in Task 6.
3. **A shutter press without a grid** (no locked quad). There is nothing to flatten from: use the cross-fade path. Pinned in Task 6.
4. **The transition ends exactly on the correction screen.** The transition and the review screen use one `correctionLayout`, and the warped quad ends on its grid square. Pinned in Task 1 and Task 2.
5. **Resources.** The photo is disposed after both the recognise and the Skia conversion settle; the nitro images of the conversion are disposed; the Skia image is released at Retake. Pinned in Task 5.

---

## File structure

| File | Responsibility |
| --- | --- |
| `apps/mobile/src/theme/colors.ts` (create) | Colour tokens, light and dark, and `useColors()` |
| `apps/mobile/src/scan/correction/layout.ts` (create) | `correctionLayout(view, insets)` |
| `apps/mobile/src/scan/correction/cells.ts` (create) | `REVIEW_CONFIDENCE`, `cellLook`, `cellsToCheck` |
| `apps/mobile/src/scan/correction/gridLines.ts` (create) | `drawGridLines`, shared by the transition and the board |
| `apps/mobile/src/scan/correction/CorrectionScreen.tsx` (create) | The correction screen, static or driven by the transition clock |
| `apps/mobile/src/scan/transition/timeline.ts` (create) | `transitionAt`, `advanceClock`, gates, constants |
| `apps/mobile/src/scan/transition/warp.ts` (create) | `lerpQuad`, `quadToQuad`, `photoMatrix` |
| `apps/mobile/src/scan/transition/photoImage.ts` (create) | Photo → Skia image on the JS thread |
| `apps/mobile/src/scan/transition/TransitionCanvas.tsx` (create) | Background, warped photo, white cells, lines |
| `apps/mobile/src/scan/effects/scene.ts`, `engine.ts`, `EffectCanvas.tsx`, `gathering-dots/*` (modify) | The capture phase of the overlay |
| `apps/mobile/src/scan/useCapture.ts` (modify) | Capture state with the photo image and the result |
| `apps/mobile/src/scan/CameraScreen.tsx` (modify) | Live + transition layers |
| `apps/mobile/src/scan/ScanFlow.tsx` (create) | The phase: `live`/`transition` → `review` |
| `apps/mobile/App.tsx` (modify) | Renders `ScanFlow` |
| `apps/mobile/src/scan/ResultView.tsx` (delete) | Replaced by the correction screen |

---

### Task 1: Theme tokens, the correction layout and the cell looks

**Files:** create `src/theme/colors.ts`, `src/scan/correction/layout.ts`, `src/scan/correction/cells.ts`, with tests.

**Interfaces (produces):**

```ts
// src/theme/colors.ts
export type Colors = {
  background: string; surface: string; text: string; muted: string; line: string; ink: string
  accent: string; warning: string; warningText: string; warningSurface: string
}
export const LIGHT: Colors
export const DARK: Colors
/** app.json is light only, so this returns LIGHT until the developer decides on dark mode. */
export function useColors(): Colors

// src/scan/correction/layout.ts
export type Rect = { x: number; y: number; width: number; height: number }
export type Insets = { top: number; bottom: number; left: number; right: number }
export type CorrectionLayout = { title: Rect; grid: Rect; panel: Rect }
export function correctionLayout(view: ViewSize, insets: Insets): CorrectionLayout  // 'worklet'

// src/scan/correction/cells.ts
export const REVIEW_CONFIDENCE = 0.9
export type CellLook = { digit: string; style: 'given' | 'entry' | 'empty'; uncertain: boolean }
export function cellLook(cell: CellResult): CellLook   // 'worklet'
export function cellsToCheck(cells: CellResult[]): number
```

Layout rules (points): side margin 16 (plus the side insets); title: top = insets.top + 8, height 52, full width minus margins; grid: square, x centred, top = title bottom + 12, side = min(view width − 2 × margin, panel top − 12 − grid top); panel: x = 10 + insets.left, width = view width − 20 − insets.left − insets.right, height 168, bottom = view height − insets.bottom − 12. Round nothing.

`cellLook`: digit 0 or kind `none`/`notes` → `{ digit: '', style: 'empty' }`; kind `printed` → `given`; `handwritten` → `entry`; `uncertain = confidence < REVIEW_CONFIDENCE || !validPair`. `cellsToCheck` counts uncertain cells.

Tests: layout on 402 × 874 with insets top 62, bottom 34: title, grid and panel do not overlap, the grid is square and centred, the panel bottom is 874 − 34 − 12; a short view (402 × 600) shrinks the grid to fit above the panel. Cell looks for each kind, the confidence threshold (0.89 uncertain, 0.9 not), an invalid pair, an uncertain empty cell. `useColors()` returns `LIGHT`. Every `DARK` key exists in `LIGHT`.

Commit: `feat(scan): theme tokens, the correction layout and the cell looks (#19)`.

### Task 2: The timeline, the clock and the warp maths

**Files:** create `src/scan/transition/timeline.ts`, `src/scan/transition/warp.ts`, with tests.

**Interfaces (produces):**

```ts
// timeline.ts — every function 'worklet'
export const TRANSITION_END = 1.5
export const REDUCED_END = 0.3
export const GATE_PHOTO = 0.05
export const GATE_RESULTS = 0.7
export const SPINNER_DELAY = 1
export type Gates = { photo: boolean; results: boolean }
/** Every value is 0..1. digit is read with digitAlpha. */
export type Channels = {
  flash: number; pulse: number; flatten: number; freeDrift: number; dim: number; ink: number
  cells: number; lines: number; photo: number; shrink: number; title: number; rings: number; panel: number
}
export function transitionAt(t: number, reduceMotion: boolean): Channels
export function digitAlpha(t: number, row: number, col: number, reduceMotion: boolean): number
/** The next clock time: t + dt, held at a closed gate (GATE_PHOTO, then GATE_RESULTS; with Reduce Motion both gates are at 0). */
export function advanceClock(t: number, dt: number, gates: Gates, reduceMotion: boolean): number
export function transitionEnd(reduceMotion: boolean): number

// warp.ts — every function 'worklet'
export function lerpQuad(a: Quad, b: Quad, u: number): Quad
/** The square of a Rect as a Quad, in quad corner order. */
export function rectQuad(rect: Rect): Quad
/** 9 numbers, row-major, the homography that maps quad a onto quad b. Null when a quad is degenerate. */
export function quadToQuad(a: Quad, b: Quad): number[] | null
/** Maps photo pixels (photoWidth × photoHeight, upright) to view points so that the normalised locked quad lands on screenQuad. */
export function photoMatrix(photoWidth: number, photoHeight: number, locked: Quad, screenQuad: Quad): number[] | null
```

Channel meanings: `flash` = 1 − ramp(0, 0.25) (the caller multiplies by 0.25 alpha); `pulse` = sin(π · ramp(0, 0.25)); `flatten` = ramp(0.05, 0.50); `freeDrift` = ramp(0.05, 0.45); `dim` = ramp(0.05, 0.50); `ink` = ramp(0.15, 0.45); `cells` = ramp(0.30, 0.55); `lines` = ramp(0.35, 0.70); `photo` = 1 − ramp(0.50, 0.80); `shrink` = ramp(0.65, 0.95); `title` = ramp(0.50, 0.80); `rings` = ramp(1.20, 1.40); `panel` = ramp(1.20, 1.50). `ramp(a, b)` = smoothstep of (t − a)/(b − a), clamped. `digitAlpha` = ramp(0.55 + 0.028 (row + col), 0.55 + 0.028 (row + col) + 0.15).

Reduce Motion: one fade f = ramp(0, 0.3): `flatten` = 1 (no movement: the caller draws the photo in place, see Task 6), `photo` = 1 − f, `dim` = f, `cells` = `lines` = `title` = `rings` = `panel` = f, `ink` = f, `shrink` = f, `freeDrift` = f, `flash` = 0, `pulse` = 0; `digitAlpha` = f.

`quadToQuad` uses `unitToQuad` and `invert` from `src/scan/effects/common/geometry.ts`: H = unitToQuad(b) ∘ unitToQuad(a)⁻¹, normalised so H[8] = 1. `photoMatrix` = quadToQuad(lockedInPhotoPixels, screenQuad) where lockedInPhotoPixels = locked corners × (width, height).

Tests: channel values at 0, 0.05, 0.25, 0.5, 0.7, 1.0, 1.5 (spot values; each channel starts at its start and ends at its end); `digitAlpha` for cell (0, 0) at 0.55 and 0.70, cell (8, 8) ends by 1.2; the clock holds at 0.05 without the photo, at 0.7 without the results, passes both when open, never goes past `transitionEnd`; Reduce Motion fade values. Warp: `quadToQuad` maps each corner of a onto b (1e-6) for a trapezoid; `photoMatrix` maps the locked corners in photo pixels onto the screen quad; at flatten 0 the screen quad equals the preview quad, so an affine cover mapping is reproduced for a point outside the grid (check one photo corner against `toPreview`).

Commit: `feat(scan): the transition timeline, its clock and the warp maths (#19)`.

### Task 3: The capture phase of the overlay

**Files:** modify `src/scan/effects/scene.ts`, `engine.ts`, `EffectCanvas.tsx`, `gathering-dots/field.ts`, `gathering-dots/draw.ts`, and tests.

**Interfaces:**
- `Scene` gets `capture: Channels | null` (null in the live phase; `createScene` sets null).
- `engine.ts`: `advanceCapture(engine: Engine, effect: AnyEffect, quad: Quad, t: number, channels: Channels): Engine` — 'worklet'. It sets `scene.dt`/`scene.t`, sets `scene.quad`, `scene.lastQuad`, `scene.m`, `scene.inverse` from `quad` (bypassing the lock-on latch), `scene.capture = channels`, `scene.event = 'none'`, then runs `effect.step`.
- `EffectCanvas` gets an optional prop `capture?: SharedValue<{ quad: Quad; channels: Channels } | null>`. When its value is not null, the frame callback calls `advanceCapture` instead of `advance` and does not call `onLock`.
- Gathering dots in the capture phase (`scene.capture != null`):
  - Gathered dots sit exactly on their intersections of `scene.m` (no wobble, no flight: a dot still in flight jumps to its end), radius × (1 + 0.6 · pulse) × (1 − shrink), alpha 1 − shrink.
  - Their colour goes from white to ink by `ink`. `drawField` takes the ink colour from a new `DrawKit` field `ink: [number, number, number]` (the `LIGHT.ink` RGB, 0..1).
  - Free dots move 40 pt outward from the grid centre by `freeDrift` (from where they were at the first capture frame) and fade by `freeDrift`.
  - Both dims fade by `1 − dim`.
- Other effects ignore `scene.capture` (they are development options).

Tests: `advanceCapture` ignores the latch and uses the given quad; with channels at the end values the gathered dots have radius 0 and the dims draw with alpha 0; at pulse 1 the radius is 1.6 ×; free dots are 40 pt farther from the grid centre at freeDrift 1 and have alpha 0; ink 1 gives the ink colour; EffectCanvas calls `advanceCapture` and never `onLock` while `capture` is set.

Commit: `feat(scan): the overlay rides the capture transition (#19)`.

### Task 4: The correction screen and the grid lines

**Files:** `pnpm exec expo install react-native-safe-area-context` (from apps/mobile); create `src/scan/correction/gridLines.ts`, `src/scan/correction/CorrectionScreen.tsx`, with tests; mock the safe-area module in `jest.setup.ts` if the library's own Jest mock does not fit.

**Interfaces:**

```ts
// gridLines.ts — 'worklet'
/** Draws the 20 lines of the grid that m maps the unit square onto. grow 0..1: each line grows from its middle. Box lines 2 pt ink, cell lines 1 pt line colour. */
export function drawGridLines(canvas: SkCanvas, paint: SkPaint, m: Homography, grow: number, ink: string, line: string): void

// CorrectionScreen.tsx
export type CorrectionProps = {
  result: RecogniseResult | null        // null while recognise() runs
  layout: CorrectionLayout
  onRetake: () => void
  /** The transition clock. Without it, everything shows (the review phase). */
  clock?: SharedValue<number>
  reduceMotion?: boolean
  /** True while the results gate holds longer than SPINNER_DELAY. */
  waiting?: SharedValue<boolean>
}
export function CorrectionScreen(props: CorrectionProps): JSX.Element
```

- Without `clock` (review): background colour, a Skia board (white square, `drawGridLines` with grow 1), title "Check the scan" with subtitle "Tap a digit to fix it" (muted), 81 digit cells styled by `cellLook`, dashed rings (`borderStyle: 'dashed'`, 1.5 pt, warning colour, radius 6, inset 1.5 pt) on uncertain cells, the panel (surface, radius 24, shadow) with a warning chip "● N cells to check" (hidden when N = 0, then "All cells look sure"), the disabled "Play this puzzle" button (accent, 50 % opacity, `accessibilityState.disabled`), and "Retake".
- With `clock`: no background and no board (the transition canvas draws them); the title opacity is `title`, each digit's opacity is `digitAlpha`, the rings `rings`, the panel slides up from 140 % of its height by `panel`. Use Reanimated `useAnimatedStyle` reading `transitionAt(clock.value, reduceMotion)`.
- `result.ok === false`: no digits, no rings; the panel shows "The scan failed" and the reason in muted text, and Retake; with a clock the panel shows as soon as the clock reaches the results gate (failure keeps the gate closed).
- `result === null` with `waiting` true: an `ActivityIndicator` in the grid centre.
- testIDs: `correction-screen`, `correction-cell-<n>`, `correction-ring-<n>`, `correction-panel`, `play`, `retake`, `correction-failure`, `correction-waiting`.

Tests (static mode): given/entry/empty styles (colour and weight from tokens), rings only on uncertain cells, the count text, Play disabled, Retake calls `onRetake`, the failure text. Animated mode: renders without a board, and with clock at 1.5 every style is visible (use the jest Reanimated mock; keep it simple).

Commit: `feat(scan): the correction screen (#19)`.

### Task 5: Capture state with the photo image

**Files:** create `src/scan/transition/photoImage.ts` (+ test); modify `src/scan/useCapture.ts` (+ test).

**Interfaces:**

```ts
// photoImage.ts
/** Upright Skia image of the photo, long side at most maxSide px. Disposes every nitro image it makes. Runs on the JS thread. */
export async function photoToSkImage(photo: Photo, maxSide: number): Promise<SkImage>

// useCapture.ts
export type CaptureState =
  | { phase: 'live' }
  | { phase: 'capturing'; quad: Quad | null; image: SkImage | null; result: RecogniseResult | null }
export function useCapture(photoOutput): { state: CaptureState; capture(quad: Quad | null): void; retake(): void }
```

- `photoToSkImage`: `photo.toImageAsync()`, then `image.resizeAsync(w, h)` with the long side `maxSide` (this also makes the pixels upright, ADR-002), then `toRawPixelDataAsync()`, then `Skia.Image.MakeImage({ width, height, colorType, alphaType: AlphaType.Premul }, Skia.Data.fromBytes(new Uint8Array(buffer)), rowBytes)` with `colorType` `ColorType.BGRA_8888` for `BGRA`/`BGRX` and `ColorType.RGBA_8888` for `RGBA`/`RGBX`; any other format throws. Check the exact Skia 2.6.2 names in `node_modules/@shopify/react-native-skia`. Throw when `MakeImage` returns null. `maxSide` = 1600 (enough for a 3× screen).
- `useCapture`: `capture(quad)` sets `{ phase: 'capturing', quad, image: null, result: null }` at once (the transition starts at lock-on), plays the haptic, takes the photo, then runs `scanner.recognise(photo, quad)` and `photoToSkImage(photo, 1600)` in parallel. Each sets its field when it settles (a conversion failure leaves `image` null and logs in `__DEV__`; the transition then cross-fades). The photo is disposed after both settle. A model that did not load gives `result: { ok: false, reason }` and no photo. `retake()` disposes the Skia image (`image.dispose()`) and goes to `live`. The `[scan]` log stays.

Tests: the state goes capturing → image set → result set; the photo is disposed once, after both; a conversion failure keeps `image` null and still gives the result; retake disposes the image; double capture takes one photo; the conversion picks the colour type from the pixel format and disposes the nitro images.

Commit: `feat(scan): keep the photo as a Skia image for the transition (#19)`.

### Task 6: The transition and the scan flow

**Files:** create `src/scan/transition/TransitionCanvas.tsx`, `src/scan/ScanFlow.tsx` (+ tests); modify `src/scan/CameraScreen.tsx`, `App.tsx`, their tests; delete `src/scan/ResultView.tsx` and its test.

**Behaviour:**
- `ScanFlow` holds `phase: 'live' | 'review'` plus the last `RecogniseResult`. In `live` it renders `CameraScreen` (key changes on Retake, so the scene is new). When the transition ends it switches to `review` and renders the static `CorrectionScreen` with the same layout (safe-area insets from `useSafeAreaInsets`; `App` wraps in `SafeAreaProvider`). Retake from either phase → `live`.
- `CameraScreen` in the `capturing` state:
  - The camera stays mounted. `isActive` becomes false once `state.image` is set (the photo draws).
  - A transition clock (`useSharedValue(0)`) advances in a `useFrameCallback` with `advanceClock`, from shared gate values: `photo` = image is set, or there is no locked quad, or the conversion failed (then it cross-fades instead); `results` = `result?.ok === true`. When the clock reaches `transitionEnd`, `scheduleOnRN(onDone, result)` once.
  - `waiting` = the clock holds at the results gate for more than `SPINNER_DELAY`.
  - The locked quad in view points: `toPreview(state.quad, aspect, view)` with the frame aspect at capture time (keep the last `FrameDetection.aspect`).
  - The screen quad per frame: `lerpQuad(lockedView, rectQuad(layout.grid), channels.flatten)`. The `EffectCanvas` `capture` shared value gets `{ quad, channels }` each frame.
  - Layer order: `Camera` → `TransitionCanvas` (light background with alpha `dim`; the photo with `photoMatrix` and alpha `photo`; the white cell area on the screen quad with alpha `cells`; `drawGridLines` on the screen quad with grow `lines`) → `EffectCanvas` (dim and dots) → `CorrectionScreen` with `clock` (title, digits, rings, panel) → a white flash view with opacity `0.25 × flash`.
  - Reduce Motion, or no locked quad, or no image: the cross-fade path: no warp, the photo (if any) is drawn with the preview cover mapping and fades by `photo`; everything else fades in by the Reduce Motion channels.
  - The shutter and the effect picker hide in `capturing`.
  - A failed result: the clock holds at 0.70, the panel shows the failure with Retake (Task 4).
- `App` renders `<SafeAreaProvider><ScanFlow /></SafeAreaProvider>`. The parity and probe logs stay.
- Log `[scan] transition done in N ms` (from lock-on) in `__DEV__`; this measures QR-07.

**Tests:** `ScanFlow`: live → review after `onDone`, Retake → live with a new key; `CameraScreen`: in `capturing` it renders the transition layers, hides the shutter, gives `EffectCanvas` a `capture` value, sets `isActive` false once the image exists; the clock gates (drive the frame callback from the Reanimated mock): holds at 0.05 without image, at 0.7 without result, reaches the end and calls `onDone` once; the failure path keeps the clock at 0.7 and shows the failure; the no-quad path uses the cross-fade. `TransitionCanvas` draws through `createPicture` (assert it renders; the drawing maths is covered by Task 2).

Commit: `feat(scan): the capture transition into the correction screen (#19)`.

### Task 7: Build for the phone and record

Controller only. Run `just bundle`. Rebuild the development build on the phone (new native module). Watch the `[scan]` and `[fx]` logs if the developer scans. Record in the scan-pipeline concept ("The transition") and in the capture flow design's open questions only what was measured. Commit `docs: ... (#19)`.
