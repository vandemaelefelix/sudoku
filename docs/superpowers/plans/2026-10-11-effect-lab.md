# Effect Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give development builds an effect lab: a dev pill on the camera screen switches between four live overlay effects (Gathering dots, Spotlight and brackets, Grid lattice, Ripples) that share one engine and one scene, and the app remembers the choice (issue #20).

**Architecture:** `stepScene` turns the smoothed outline into one `Scene` per frame on the UI thread. Each effect is a module with `create`, `step` and `draw` worklets. `EffectCanvas` runs one frame callback: it steps the scene, steps the active effect and records one Skia picture. The active effect is a shared value that holds an index into `EFFECTS`. Only the dev pill on the JS thread writes it, and the pill saves the effect id through a `SettingsRepository` on the expo-sqlite key-value store. A release build has no pill and runs `DEFAULT_EFFECT` only.

**Tech Stack:** Expo SDK 57, React Native 0.86, Reanimated 4.5.1 (`useFrameCallback`, `useReducedMotion`, `SharedValue.get/set/modify`), react-native-worklets 0.10.1 (`scheduleOnRN`), React Native Skia 2.6.2 (`createPicture`, `Skia.RuntimeEffect.Make`, `SkRuntimeEffect.makeShader`, `drawAtlas`, `drawPath`, `drawRect`), expo-sqlite (`expo-sqlite/kv-store`), Jest with `jest-expo`, CanvasKit (`canvaskit-wasm` 0.41.0, a dependency of React Native Skia) for the SkSL compile check.

**Spec:** `docs/superpowers/specs/2026-10-11-effect-lab-design.md`. Prototype: Scan flow studies, sections 1 ("Spotlight and brackets", overlay `combo`), 1b (`FRAG`, `uKind == 0`), 1c (`AMB_BG`, `uBg == 3`) and 1d (gathering dots, already built as the dot field of #18).

## Prerequisites

- The worktree `/Users/felix/projects/sudoku-20-effect-lab` is on branch `feature/20-effect-lab`, on top of `feature/18-dot-field`.
- The worktree has no `node_modules` yet. Run `pnpm install` once from the worktree root before Task 1.
- The #18 work is still open. A jumpy dim is under investigation on #18. Do not change `smoothing.ts`, `previewMapping.ts` or anything in `src/scanner/`.

## Verified library facts

These facts were checked in `node_modules` and the Expo docs before this plan was written. Do not trust remembered APIs for anything else (`apps/mobile/AGENTS.md`).

| Fact | Where it was checked |
| --- | --- |
| `Skia.RuntimeEffect.Make(sksl)` **throws** a `JSError` with the text `Error in sksl: …` when the source does not compile. Its type is `SkRuntimeEffect \| null` | `@shopify/react-native-skia/cpp/api/JsiSkRuntimeEffectFactory.h` |
| `effect.makeShader(uniforms: number[])` **throws** when the array length is not the uniform float count. A `float3x3` takes 9 floats, column-major, in declaration order | `cpp/api/JsiSkRuntimeEffect.h` (`castUniforms`) |
| Runtime effects are SkSL in ES2 mode. `fwidth`, `dFdx` and `dFdy` are `$es3` only, so a runtime shader cannot use them. CanvasKit reports `no match for fwidth(float2)` | the SkSL module strings in `libskia.a`, and a CanvasKit compile in Node |
| A shader that fills the view: `paint.setShader(effect.makeShader(u))`, then `canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint)`. The shader gets the local position in view points as `main(float2 pos)` | `SkCanvas.drawRect`, `SkPaint.setShader` types |
| `createPicture(cb, rect?)` calls `cb(canvas)` at once, on the thread that calls it | `lib/typescript/src/skia/core/Picture.d.ts` |
| `PaintStyle.Stroke = 1`, `StrokeCap.Round = 1`, `StrokeJoin.Round = 1` | `lib/typescript/src/skia/types/Paint/Paint.d.ts` |
| CanvasKit 0.41.0 loads in Jest (`@jest-environment node`) when the test replaces the Expo `TextDecoder` with the one from `node:util`. It compiled both ported shaders: lattice 14 floats, ripples 15 floats | a scratch Jest run against `apps/mobile` of the #18 worktree |
| `scheduleOnRN` in the worklets Jest mock runs the function in a microtask | `react-native-worklets/lib/module/mock.js` |
| `import Storage from 'expo-sqlite/kv-store'`. `getItemAsync(key): Promise<string \| null>`, `setItemAsync(key, value): Promise<void>`. Install with `pnpm exec expo install expo-sqlite`. No config plugin is required. It is a native module, so the app needs a new development build | `https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/` |

Not verified: whether the default `Storage` instance opens its database on import or on the first call. Task 7, Step 1 checks this in `node_modules/expo-sqlite` after the install.

## Global Constraints

- Every function that runs on the UI thread starts with the `'worklet'` directive. This includes every `create`, `step` and `draw` of an effect, every `createPicture` callback, and every helper they call.
- In a worklet module, define a helper **above** the function that calls it. A call to a helper defined below fails at runtime with "is not a function", and Jest may not catch it.
- Worklet code uses no `at`, `toSorted`, `findLast`, `Set`, `Map` or classes. Use `for` loops and plain arrays.
- Write shared values with `.set()` or `.modify()`, never with `.value =` (oxlint `react/immutability`). Read shared values with `.get()` in new code.
- `draw` does not make a paint, a sprite or a compiled shader. These come from the `DrawKit`, which the engine makes once on the JS thread. A runtime shader object (`makeShader`) is made per frame, because its uniforms change every frame.
- The engine gets corners only from `CameraScreen`, and types only through `src/scanner/index.ts` (SUD-05). Only the effect index crosses from the JS thread to the UI thread. No corner and no dot position goes through the JS thread.
- The scene and one effect take at most 4 ms per frame on the UI thread.
- A release build has no dev pill, reads no setting and runs `DEFAULT_EFFECT` only.
- The saved choice uses expo-sqlite behind `SettingsRepository` (ADR-012).
- Values come from the prototype. Each value names its prototype section in a comment. The prototype draws a phone that is 220 pt wide. A length from the prototype is multiplied by `prototypeScale(width) = width / 220`. The prototype shaders ran at pixel density 2, so one prototype pixel is `prototypePixel(width) = prototypeScale(width) / 2` view points. The #18 dot sizes stay as they are.
- Prototype inputs map to the scene like this:

  | Prototype | Scene |
  | --- | --- |
  | `vis`, `uVis`, `uDet` (the detection fade-in) | `scene.presence` |
  | `p`, `uP` (the lock-on progress) | `lockProgress(scene) = presence × (1 − motion)` |
  | `uLockT` (seconds since lock-on, or −1) | `lockTime(scene)`: seconds since the scene became steady, or −1 |
  | `uTime` | seconds since the effect was created, 0 under Reduce Motion |

- Reduce Motion: a shader effect and a screen effect get `uTime = 0` and `uLockT = -1`. A path effect has no motion. Gathering dots keeps the Reduce Motion rule of #18.
- Code comments follow the root `AGENTS.md` "Code comments" rules. Do not refer to issues, pull requests, plans or tasks in code comments.
- Implementer subagents cannot run git. Move files with `mv`. The controller stages and commits with the message in each task.
- Commit messages: Conventional Commits with `(#20)`. Do not commit `apps/mobile/ios/` or `apps/mobile/dist/`.
- If `expo run:ios` rewrites `apps/mobile/package.json` or `apps/mobile/app.json`, revert that rewrite. **Exception:** the expo-sqlite dependency in `apps/mobile/package.json`, `pnpm-lock.yaml` and any `app.json` change that `expo install` makes in Task 7 are intended. Task 7 commits them. Do not revert them.
- A task is done when these pass from the worktree root: `just test-ts`, `just typecheck`, `just lint`, `just boundaries`, `just bundle`, `just docs-check`.
- oxlint `jest/expect-expect` rejects a test whose assertions sit only in a helper function. Put at least one `expect` in the body of every test.

## Review Focus

1. **A switch to Gathering dots while a grid is in view.** The scene does not report `found` again, but the dots must still gather at once. Test: Task 1 "gathers at once when the field starts while a grid is in view", and Task 3 "creates the new effect on a switch and keeps the scene".
2. **A view that is still 0 × 0, or that changes size.** The engine must wait, then build a new scene and call `create` again for the new size. Test: Task 3 "waits for the view size", "rebuilds the effect when the view size changes" and "creates the effect and a new scene when the view size changes".
3. **An unknown saved id, a failing store, or a pick before the saved choice loads.** The default effect runs, and a late load must not undo the pick. Test: Task 3 registry "gives the default effect for an unknown id", and Task 8 "runs the default effect for an unknown saved id", "runs the default effect and logs when the store fails", "keeps a pick made before the saved choice loads".
4. **A runtime shader that does not compile, or a uniform array of the wrong length.** Both throw in Skia, and an exception in the frame callback would stop every effect. The effect must draw nothing, and the pill must still work. Test: Task 2 "keeps the other effects when a shader does not compile", Task 5 "draws nothing for an effect whose shader did not compile, and logs the error", and the CanvasKit compile checks in Tasks 5 and 6 that compare the uniform float count with the builder.
5. **A release build.** It must not show the pill or read the setting. Test: Task 8 "shows no effect lab, reads no setting and runs the default effect".

Reduce Motion has its own tests in Tasks 1, 3, 5 and 6.

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/mobile/src/scan/effects/scene.ts` | `Scene`, `createScene`, `stepScene`, the scene constants |
| `apps/mobile/src/scan/effects/types.ts` | `Effect`, `AnyEffect`, `EffectFamily`, `DrawKit` |
| `apps/mobile/src/scan/effects/kit.ts` | `makeDrawKit`, `compileShader` |
| `apps/mobile/src/scan/effects/engine.ts` | `Engine`, `advance`: one frame of the scene and the active effect |
| `apps/mobile/src/scan/effects/index.ts` | `EFFECTS`, `DEFAULT_INDEX`, `DEFAULT_EFFECT`, `effectAt`, `effectIndex`, `findEffect` |
| `apps/mobile/src/scan/effects/EffectCanvas.tsx` | The engine component: frame callback, picture, `[fx]` timing log |
| `apps/mobile/src/scan/effects/EffectPicker.tsx` | The dev pill and the list |
| `apps/mobile/src/scan/effects/common/geometry.ts`, `layout.ts`, `assign.ts`, `spread.ts` | Moved from `dots/` without a change, except the import paths |
| `apps/mobile/src/scan/effects/common/sprite.ts` | `makeStarSprite`, `SPRITE_SIZE` (moved from `dots/draw.ts`) |
| `apps/mobile/src/scan/effects/common/dim.ts` | `drawDim`: the black dim, with or without the grid hole |
| `apps/mobile/src/scan/effects/common/shaderMatrix.ts` | `toColumnMajor`, `gridInverse`, `IDENTITY`, `prototypeScale`, `prototypePixel` |
| `apps/mobile/src/scan/effects/common/lock.ts` | `lockProgress`, `lockTime` |
| `apps/mobile/src/scan/effects/common/clock.ts` | `Clock`, `createClock`, `effectTime` |
| `apps/mobile/src/scan/effects/common/compileSkSL.js` | Test-only: compiles SkSL with CanvasKit in Jest |
| `apps/mobile/src/scan/effects/gathering-dots/` | `field.ts`, `draw.ts` (moved from `dots/`), `index.ts` (the effect) |
| `apps/mobile/src/scan/effects/spotlight-brackets/index.ts` | The path effect |
| `apps/mobile/src/scan/effects/grid-lattice/` | `shader.ts` (SkSL), `uniforms.ts`, `index.ts` |
| `apps/mobile/src/scan/effects/ripples/` | `shader.ts` (SkSL), `uniforms.ts`, `index.ts` |
| `apps/mobile/src/settings/SettingsRepository.ts` | `SettingsRepository`, `createSettingsRepository`, `kvSettings` on expo-sqlite kv-store |
| `apps/mobile/src/settings/memorySettings.ts` | `createMemorySettings`: the in-memory fake (ADR-012) |
| `apps/mobile/src/scan/CameraScreen.tsx` | Renders `EffectCanvas`, and `EffectPicker` in a development build |
| `apps/mobile/jest.setup.ts` | Mocks for the new Skia APIs and for `expo-sqlite/kv-store` |
| `apps/mobile/src/scan/dots/` | Deleted at the end of Task 3 |
| `docs/architecture/adr/adr-014-overlay-effects.md` and the index, glossary and concept files | Documentation |

Each module has a test file next to it with the same name and `.test.ts` or `.test.tsx`.

Two additions to the spec, both small:

- `Effect` has an optional `sksl` field. The engine compiles it once into `kit.shaders[effect.id]`. So a shader effect still needs only its folder and one line in `effects/index.ts`.
- `Scene` has a `steadyAt` field (the time the scene last became steady), and two fields that belong to `stepScene` (`speed`, `changedAt`). Effects use `steadyAt` through `lockTime` for the lock-on reaction in the steady state.

`EffectCanvas` takes a third prop, `effect: SharedValue<number>`, so that `CameraScreen` can share the index with the dev pill.

The spec lists "the quad path" in `effects/common/`. No effect needs it alone, so `drawDim` keeps the quad path inside. The spotlight draws its own bracket path.

Spec deviation to confirm with the developer: the spec says the brackets "get brighter in the steady state". In the prototype ("combo" overlay), the bracket opacity is `vis` and stays at 1. The steady-state reaction is that the brackets grow (12 % → 50 % of each edge) and the dim deepens (30 % → 52 %). This plan follows the prototype, because the spec makes the prototype the reference for every value.

---

### Task 1: The scene

Extract the grid facts of the dot field into `stepScene`. The dot field keeps only the dot simulation and reads the scene. `DotField` still renders the overlay at the end of this task. All behaviour and all tests of #18 stay. Tests that check scene facts move to `scene.test.ts`.

**Files:**
- Create: `apps/mobile/src/scan/effects/scene.ts`
- Test: `apps/mobile/src/scan/effects/scene.test.ts`
- Modify: `apps/mobile/src/scan/dots/field.ts` (whole file)
- Modify: `apps/mobile/src/scan/dots/field.test.ts` (whole file)
- Modify: `apps/mobile/src/scan/dots/draw.ts` (`drawField` signature and the dim)
- Modify: `apps/mobile/src/scan/dots/draw.test.ts` (whole file)
- Modify: `apps/mobile/src/scan/dots/DotField.tsx` (the frame callback)

**Interfaces:**
- Consumes: `Quad` from `'../../scanner'`. `ViewSize` from `'../previewMapping'`. `Homography`, `unitToQuad`, `invert` from `'../dots/geometry'` (Task 2 moves this module to `./common/geometry`).
- Produces:
  - `type GridEvent = 'found' | 'lost' | 'none'`
  - `type Scene = { t: number; dt: number; width: number; height: number; reduceMotion: boolean; quad: Quad | null; lastQuad: Quad | null; m: Homography | null; inverse: Homography | null; event: GridEvent; foundAt: number; lostAt: number; presence: number; motion: number; steady: boolean; steadyAt: number; speed: number; changedAt: number }`
  - `createScene(view: ViewSize): Scene`
  - `stepScene(scene: Scene, quad: Quad | null, t: number, reduceMotion: boolean): Scene` (mutates and returns `scene`)
  - `diagonal(quad: Quad): number`
  - Constants: `STEADY_SPEED = 30`, `MOTION_TIME = 0.3`, `STEADY_MOTION = 0.5`, `JUMP = 0.25`, `MAX_STEP = 0.1`, `PRESENCE_TIME = 0.4`
  - `type FieldState = { dots: FieldDot[]; holding: boolean; gatheredAt: number }`
  - `createField(view: ViewSize): FieldState`, `stepField(state: FieldState, scene: Scene): FieldState`
  - `drawField(canvas: SkCanvas, state: FieldState, scene: Scene, sprite: SkImage): void` (Task 3 changes the last parameter to `kit: DrawKit`)

- [ ] **Step 1: Write the failing scene test**

Create `apps/mobile/src/scan/effects/scene.test.ts`:

```ts
import type { Quad } from '../../scanner'
import { createScene, MAX_STEP, PRESENCE_TIME, type Scene, stepScene } from './scene'

const VIEW = { width: 402, height: 874 }

function gridAt(x: number, y: number, size = 300): Quad {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ]
}

/** A new quad object with the same corners, as the camera gives one per detection. */
function detection(quad: Quad | null): Quad | null {
  if (quad == null) return null
  return [{ ...quad[0] }, { ...quad[1] }, { ...quad[2] }, { ...quad[3] }]
}

/** Steps the scene at 60 fps from t0 to t1 with the same corners, one detection per frame. */
function run(scene: Scene, quad: Quad | null, t0: number, t1: number) {
  for (let t = t0; t <= t1 + 1e-9; t += 1 / 60) stepScene(scene, detection(quad), t, false)
  return scene
}

describe('stepScene', () => {
  it('reports found on the first usable quad', () => {
    const scene = run(createScene(VIEW), null, 0, 1)
    stepScene(scene, gridAt(50, 300), 1.5, false)
    expect(scene.event).toBe('found')
    expect(scene.foundAt).toBe(1.5)
    expect(scene.m).not.toBeNull()
    expect(scene.inverse).not.toBeNull()
  })

  it('reports found only once while the grid stays', () => {
    const scene = run(createScene(VIEW), gridAt(50, 300), 0, 1)
    expect(scene.event).toBe('none')
    expect(scene.foundAt).toBe(0)
  })

  it('reports lost when the grid goes, and keeps the last grid', () => {
    const grid = gridAt(50, 300)
    const scene = run(createScene(VIEW), grid, 0, 1)
    stepScene(scene, null, 1.5, false)
    expect(scene.event).toBe('lost')
    expect(scene.lostAt).toBe(1.5)
    expect(scene.quad).toBeNull()
    expect(scene.m).toBeNull()
    expect(scene.inverse).toBeNull()
    expect(scene.lastQuad).toEqual(grid)
  })

  it('reports a jump to another grid as found, with the loss in the same frame', () => {
    const scene = run(createScene(VIEW), gridAt(50, 100, 200), 0, 1)
    stepScene(scene, gridAt(50, 550, 200), 1.5, false)
    expect(scene.event).toBe('found')
    expect(scene.foundAt).toBe(1.5)
    expect(scene.lostAt).toBe(1.5)
  })

  it('does not count a small step as a jump', () => {
    const scene = run(createScene(VIEW), gridAt(50, 100, 200), 0, 1)
    stepScene(scene, gridAt(50, 150, 200), 1.5, false)
    expect(scene.event).toBe('none')
    expect(scene.foundAt).toBe(0)
  })

  it('treats a quad with three corners on one line as no grid', () => {
    const flat: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 0, y: 100 },
    ]
    const scene = run(createScene(VIEW), flat, 0, 1)
    expect(scene.quad).toBeNull()
    expect(scene.m).toBeNull()
    expect(scene.event).toBe('none')
    expect(scene.presence).toBe(0)
  })

  it('moves the presence to 1 in 0.4 s while a grid is found, and back after a loss', () => {
    const scene = run(createScene(VIEW), null, 0, 1)
    run(scene, gridAt(50, 300), 1, 1 + PRESENCE_TIME / 2)
    expect(scene.presence).toBeGreaterThan(0.4)
    expect(scene.presence).toBeLessThan(0.6)
    run(scene, gridAt(50, 300), 1 + PRESENCE_TIME / 2 + 1 / 60, 2)
    expect(scene.presence).toBe(1)
    run(scene, null, 2 + 1 / 60, 3)
    expect(scene.presence).toBe(0)
  })

  it('takes no step on the first frame', () => {
    const scene = createScene(VIEW)
    stepScene(scene, null, 5, false)
    expect(scene.dt).toBe(0)
    expect(scene.t).toBe(5)
  })

  it('clamps a long pause to 0.1 s', () => {
    const scene = run(createScene(VIEW), null, 0, 1)
    stepScene(scene, gridAt(50, 300), 1, false)
    stepScene(scene, gridAt(50, 300), 30, false)
    expect(scene.dt).toBe(MAX_STEP)
    expect(scene.presence).toBeLessThan(1)
  })

  it('keeps the motion while the grid moves at 60 pt/s and is seen every 4th frame', () => {
    const scene = run(createScene(VIEW), null, 0, 1)
    let quad: Quad | null = null
    let i = 0
    for (let t = 1; t < 3; t += 1 / 60, i++) {
      if (i % 4 === 0) quad = gridAt(50 + 60 * (t - 1), 300)
      stepScene(scene, quad, t, false)
    }
    expect(scene.motion).toBeGreaterThan(0.9)
    expect(scene.steady).toBe(false)
  })

  it('drives the motion to 0 when a still grid is seen again and again', () => {
    const scene = run(createScene(VIEW), null, 0, 1)
    let quad: Quad | null = null
    let i = 0
    for (let t = 1; t < 3; t += 1 / 60, i++) {
      if (i % 4 === 0) quad = gridAt(50, 300)
      stepScene(scene, quad, t, false)
    }
    expect(scene.motion).toBeLessThan(0.1)
  })

  it('becomes steady when the corners hold still, and records the time', () => {
    const scene = run(createScene(VIEW), null, 0, 1)
    run(scene, gridAt(50, 300), 1, 3)
    expect(scene.steady).toBe(true)
    expect(scene.steadyAt).toBeGreaterThan(1)
    expect(scene.steadyAt).toBeLessThan(2)
    stepScene(scene, null, 3 + 1 / 60, false)
    expect(scene.steady).toBe(false)
  })

  it('passes Reduce Motion to the effects', () => {
    const scene = createScene(VIEW)
    stepScene(scene, null, 0, true)
    expect(scene.reduceMotion).toBe(true)
  })
})
```

- [ ] **Step 2: Run the scene test to verify it fails**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects/scene`
Expected: FAIL with "Cannot find module './scene'".

- [ ] **Step 3: Write `scene.ts`**

Create `apps/mobile/src/scan/effects/scene.ts`:

```ts
import type { Quad } from '../../scanner'
import { type Homography, invert, unitToQuad } from '../dots/geometry'
import type { ViewSize } from '../previewMapping'

// Times are seconds. Speeds are points per second.
/** Corners slower than this count as slow. Provisional until the lock-on rule sets the threshold (scan-pipeline concept). */
export const STEADY_SPEED = 30
export const MOTION_TIME = 0.3
/** The scene is steady while motion is below this value. Provisional until the lock-on rule exists. */
export const STEADY_MOTION = 0.5
/** A corner step in one frame larger than this share of the grid diagonal means another grid. */
export const JUMP = 0.25
/** The longest step the scene takes, so a pause does not make an effect jump. */
export const MAX_STEP = 0.1
/** Seconds for presence to go from 0 to 1, or back. */
export const PRESENCE_TIME = 0.4

export type GridEvent = 'found' | 'lost' | 'none'

/**
 * The facts about the grid that every effect reads. Effects never change it. Times: seconds. Sizes: view points.
 * quad, m and inverse are null together when there is no usable grid. m maps the unit square to the view, inverse maps the view to the unit square.
 * event is for this frame only. A jump to another grid gives 'found', with lostAt and foundAt both at t.
 * presence and motion: 0..1. steadyAt: the time the scene last became steady. speed and changedAt belong to stepScene.
 */
export type Scene = {
  t: number
  dt: number
  width: number
  height: number
  reduceMotion: boolean
  quad: Quad | null
  lastQuad: Quad | null
  m: Homography | null
  inverse: Homography | null
  event: GridEvent
  foundAt: number
  lostAt: number
  presence: number
  motion: number
  steady: boolean
  steadyAt: number
  speed: number
  changedAt: number
}

/** Moves value toward target by at most step, so a fade over T seconds uses step = dt / T. */
function toward(value: number, target: number, step: number): number {
  'worklet'
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step)
}

function largestCornerStep(a: Quad, b: Quad): number {
  'worklet'
  let step = 0
  for (let i = 0; i < 4; i++) step = Math.max(step, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y))
  return step
}

export function diagonal(quad: Quad): number {
  'worklet'
  return Math.hypot(quad[2].x - quad[0].x, quad[2].y - quad[0].y)
}

export function createScene(view: ViewSize): Scene {
  'worklet'
  return {
    t: -1,
    dt: 0,
    width: view.width,
    height: view.height,
    reduceMotion: false,
    quad: null,
    lastQuad: null,
    m: null,
    inverse: null,
    event: 'none',
    foundAt: -1,
    lostAt: -1,
    presence: 0,
    motion: 1,
    steady: false,
    steadyAt: -1,
    speed: STEADY_SPEED,
    changedAt: -1,
  }
}

/** Advances the scene to time t. quad: the smoothed grid in view points, or null. Mutates and returns scene. */
export function stepScene(scene: Scene, quad: Quad | null, t: number, reduceMotion: boolean): Scene {
  'worklet'
  scene.dt = scene.t < 0 ? 0 : Math.min(MAX_STEP, Math.max(0, t - scene.t))
  scene.t = t
  scene.reduceMotion = reduceMotion
  const m = quad == null ? null : unitToQuad(quad)
  const inverse = m == null ? null : invert(m)
  const grid = m != null && inverse != null ? quad : null
  const previous = scene.quad
  // The camera sends a new quad object per detection, so speed is measured only at those changes.
  const changed = grid !== previous
  const step = grid != null && previous != null ? largestCornerStep(grid, previous) : 0
  const jumped = grid != null && previous != null && step > JUMP * diagonal(previous)
  scene.event = 'none'
  if (grid != null && (previous == null || jumped)) {
    if (jumped) scene.lostAt = t
    scene.event = 'found'
    scene.foundAt = t
    scene.speed = STEADY_SPEED
  } else if (grid == null && previous != null) {
    scene.event = 'lost'
    scene.lostAt = t
    scene.speed = STEADY_SPEED
  } else if (changed && grid != null && previous != null && t > scene.changedAt) {
    scene.speed = step / (t - scene.changedAt)
  }
  if (changed) scene.changedAt = t
  scene.motion = toward(scene.motion, Math.min(1, scene.speed / STEADY_SPEED), scene.dt / MOTION_TIME)
  scene.presence = toward(scene.presence, grid != null ? 1 : 0, scene.dt / PRESENCE_TIME)
  const steady = grid != null && scene.motion < STEADY_MOTION
  if (steady && !scene.steady) scene.steadyAt = t
  scene.steady = steady
  scene.quad = grid
  scene.m = grid == null ? null : m
  scene.inverse = grid == null ? null : inverse
  if (grid != null) scene.lastQuad = grid
  return scene
}
```

- [ ] **Step 4: Run the scene test to verify it passes**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects/scene`
Expected: PASS, 13 tests.

- [ ] **Step 5: Rewrite the field test against the scene**

Replace `apps/mobile/src/scan/dots/field.test.ts` with:

```ts
import type { Quad } from '../../scanner'
import { createScene, type Scene, stepScene } from '../effects/scene'
import {
  createField,
  FLIGHT,
  FREE_ALPHA,
  GATHER_ALPHA_END,
  MAX_DELAY,
  RELEASE_TIME,
  SPREAD_TIME,
  stepField,
  type FieldState,
} from './field'
import { intersections, invert, project, unitToQuad } from './geometry'

const VIEW = { width: 402, height: 874 }

type World = { scene: Scene; field: FieldState }

function world(): World {
  return { scene: createScene(VIEW), field: createField(VIEW) }
}

function gridAt(x: number, y: number, size = 300): Quad {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ]
}

/** A new quad object with the same corners, as the camera gives one per detection. */
function detection(quad: Quad | null): Quad | null {
  if (quad == null) return null
  return [{ ...quad[0] }, { ...quad[1] }, { ...quad[2] }, { ...quad[3] }]
}

/** One frame: the scene first, then the field, as the engine does it. */
function frame(w: World, quad: Quad | null, t: number, reduce = false) {
  stepScene(w.scene, quad, t, reduce)
  stepField(w.field, w.scene)
  return w
}

/** Advances at 60 fps from t0 to t1 with the same corners, one detection per frame. */
function run(w: World, quad: Quad | null, t0: number, t1: number, reduce = false) {
  for (let t = t0; t <= t1 + 1e-9; t += 1 / 60) frame(w, detection(quad), t, reduce)
  return w
}

const gathered = (w: World) => w.field.dots.filter((d) => d.target >= 0)

const positions = (w: World) => w.field.dots.map((d) => ({ x: d.x, y: d.y }))

/** The largest distance that any dot moved between two frames. */
function largestMove(before: { x: number; y: number }[], after: { x: number; y: number }[]) {
  let most = 0
  for (let i = 0; i < before.length; i++) most = Math.max(most, Math.hypot(after[i].x - before[i].x, after[i].y - before[i].y))
  return most
}

describe('stepField', () => {
  it('lets all dots float while there is no grid', () => {
    const w = run(world(), null, 0, 2)
    expect(gathered(w)).toHaveLength(0)
    expect(w.field.dots.every((d) => d.alpha <= FREE_ALPHA * 1.28 + 1e-9)).toBe(true)
  })

  it('sends one dot to each of the 100 intersections when a grid appears', () => {
    const w = run(world(), null, 0, 1)
    frame(w, gridAt(50, 300), 1)
    const targets = gathered(w).map((d) => d.target)
    expect(targets).toHaveLength(100)
    expect(new Set(targets).size).toBe(100)
  })

  it('gathers at once when the field starts while a grid is in view', () => {
    const grid = gridAt(50, 300)
    const scene = createScene(VIEW)
    for (let t = 0; t <= 1; t += 1 / 60) stepScene(scene, detection(grid), t, false)
    const w = { scene, field: createField(VIEW) }
    frame(w, detection(grid), 1 + 1 / 60)
    expect(w.scene.event).toBe('none')
    expect(gathered(w)).toHaveLength(100)
  })

  it('puts every gathered dot on its intersection after the flight', () => {
    const grid = gridAt(50, 300)
    const w = run(world(), null, 0, 1)
    run(w, grid, 1, 1 + MAX_DELAY + FLIGHT + 1)
    const points = intersections(unitToQuad(grid)!)
    for (const d of gathered(w)) {
      expect(Math.hypot(d.x - points[d.target].x, d.y - points[d.target].y)).toBeLessThan(0.01)
      expect(d.alpha).toBeCloseTo(GATHER_ALPHA_END, 6)
    }
  })

  it('keeps 15 % of the wobble while the grid moves', () => {
    const w = run(world(), null, 0, 1)
    for (let t = 1; t < 3; t += 1 / 60) frame(w, gridAt(50 + 60 * (t - 1), 300), t)
    expect(w.scene.motion).toBeGreaterThan(0.9)
    const points = intersections(unitToQuad(w.scene.quad!)!)
    const offsets = gathered(w).map((d) => Math.hypot(d.x - points[d.target].x, d.y - points[d.target].y))
    expect(Math.max(...offsets)).toBeGreaterThan(0.1)
    expect(Math.max(...offsets)).toBeLessThanOrEqual(0.15 * 9 * Math.SQRT2 + 1e-6)
  })

  it('keeps every free dot out of the grid and its margin', () => {
    const grid = gridAt(50, 300)
    const w = run(world(), null, 0, 1)
    run(w, grid, 1, 1 + SPREAD_TIME + 0.5)
    const inverse = invert(unitToQuad(grid)!)!
    for (const d of w.field.dots.filter((dot) => dot.target < 0)) {
      const q = project(inverse, d.x, d.y)
      const inside = q.x > -0.08 + 1e-6 && q.x < 1.08 - 1e-6 && q.y > -0.08 + 1e-6 && q.y < 1.08 - 1e-6
      expect(inside).toBe(false)
    }
  })

  it('frees the gathered dots when the grid is lost', () => {
    const w = run(world(), null, 0, 1)
    run(w, gridAt(50, 300), 1, 3)
    frame(w, null, 3 + 1 / 60)
    expect(gathered(w)).toHaveLength(0)
    expect(w.field.holding).toBe(false)
    run(w, null, 3 + 2 / 60, 3 + RELEASE_TIME + 0.1)
    expect(w.field.dots.every((d) => !d.releasing)).toBe(true)
  })

  it('reassigns when the grid jumps', () => {
    const w = run(world(), null, 0, 1)
    run(w, gridAt(50, 100, 200), 1, 3)
    frame(w, gridAt(50, 550, 200), 3 + 1 / 60)
    expect(w.field.gatheredAt).toBeCloseTo(3 + 1 / 60, 9)
    expect(gathered(w)).toHaveLength(100)
  })

  it('treats a quad with three corners on one line as no grid', () => {
    const flat: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 0, y: 100 },
    ]
    const w = run(world(), flat, 0, 1)
    expect(gathered(w)).toHaveLength(0)
    expect(w.field.dots.every((d) => Number.isFinite(d.x) && Number.isFinite(d.y))).toBe(true)
  })

  it('keeps every dot finite after a long pause', () => {
    const w = run(world(), null, 0, 1)
    frame(w, gridAt(50, 300), 1)
    frame(w, gridAt(50, 300), 30)
    expect(w.field.dots.every((d) => Number.isFinite(d.x) && Number.isFinite(d.y))).toBe(true)
  })

  it('places the gathered dots without a flight under Reduce Motion', () => {
    const grid = gridAt(50, 300)
    const w = run(world(), null, 0, 1, true)
    frame(w, grid, 1, true)
    const points = intersections(unitToQuad(grid)!)
    for (const d of gathered(w)) {
      expect(Math.hypot(d.x - points[d.target].x, d.y - points[d.target].y)).toBeLessThan(0.01)
      expect(d.alpha).toBe(0)
    }
    run(w, grid, 1 + 1 / 60, 1.3, true)
    expect(gathered(w).every((d) => d.alpha === GATHER_ALPHA_END)).toBe(true)
  })

  it('does not move the free dots under Reduce Motion', () => {
    const w = world()
    frame(w, null, 0, true)
    const before = positions(w)
    frame(w, null, 5, true)
    expect(positions(w)).toEqual(before)
  })

  it('does not jump a dot when the grid jumps', () => {
    const w = run(world(), null, 0, 1)
    run(w, gridAt(50, 100, 200), 1, 3)
    const before = positions(w)
    frame(w, detection(gridAt(50, 550, 200)), 3 + 1 / 60)
    expect(largestMove(before, positions(w))).toBeLessThanOrEqual(3)
  })

  it('does not jump a dot when the grid comes back 0.2 s after it was lost', () => {
    const w = run(world(), null, 0, 1)
    run(w, gridAt(50, 300), 1, 3)
    const lost = 3 + 1 / 60
    frame(w, null, lost)
    const back = lost + 0.2
    run(w, null, lost + 1 / 60, back - 1 / 60)
    const before = positions(w)
    frame(w, detection(gridAt(50, 300)), back)
    expect(largestMove(before, positions(w))).toBeLessThanOrEqual(3)
  })
})
```

The #18 tests "dims the view outside the grid once a grid is found", "clamps a long pause", "keeps the wobble while the grid moves at 60 pt/s and is seen every 4th frame" and "drives the wobble to 0 when a still grid is seen again and again" now live in `scene.test.ts`, because presence, the step clamp and motion belong to the scene.

- [ ] **Step 6: Run the field test to verify it fails**

Run: `cd apps/mobile && pnpm exec jest src/scan/dots/field`
Expected: FAIL. Jest does not type-check, so the failure comes at run time: the old `stepField(state, quad, t, reduceMotion)` gets the scene as its quad and throws a `TypeError`.

- [ ] **Step 7: Rewrite `field.ts` on the scene**

Replace `apps/mobile/src/scan/dots/field.ts` with:

```ts
import type { Point, Quad } from '../../scanner'
import { diagonal, type Scene } from '../effects/scene'
import type { ViewSize } from '../previewMapping'
import { assignNearest } from './assign'
import { type Homography, intersections, isBoxCorner, project, pushOutside } from './geometry'
import { createDots, type Dot, DOT_SPACING, twinkle, wander } from './layout'
import { spreadStep } from './spread'

// Stage 1 of the scan experience design. Opacities are 0..1, times are seconds, sizes are points.
export const DIM_SEARCH = 0.3
export const DIM_OUTSIDE = 0.45
export const FREE_ALPHA = 0.32
export const GATHER_ALPHA_START = 0.4
export const GATHER_ALPHA_END = 0.8
export const FLIGHT = 0.7
export const MAX_DELAY = 0.35
export const GROW = 1.25
export const GROW_BOX = 1.7
/** The share of its wobble that a gathered dot keeps while the corners move. */
export const WOBBLE = 0.15
/** Grid coordinates. */
export const MARGIN = 0.08
export const SPREAD_TIME = 1.0
export const RELEASE_TIME = 0.5
export const REDUCED_FADE = 0.2
const SPREAD_RADIUS = 1.3 * DOT_SPACING
const SPREAD_PUSH = 0.05 * DOT_SPACING
/** Grid diagonals from the grid centre within which free dots spread. */
const NEAR = 1.5
/** The share of the dot-to-target vector by which a flight bends sideways. */
const ARC = 0.18

/** origX, origY: the home from the layout. since: start of the flight or the release. x, y, radius, alpha: what drawField draws. */
export type FieldDot = Dot & {
  origX: number
  origY: number
  target: number
  delay: number
  since: number
  releasing: boolean
  fromX: number
  fromY: number
  x: number
  y: number
  radius: number
  alpha: number
}

/** holding: the dots are gathered on a grid. gatheredAt: the time of the last gather, which starts the spread of the free dots. */
export type FieldState = {
  dots: FieldDot[]
  holding: boolean
  gatheredAt: number
}

function smooth(x: number): number {
  'worklet'
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}

export function createField(view: ViewSize): FieldState {
  'worklet'
  const dots: FieldDot[] = createDots(view).map((dot) => ({
    ...dot,
    origX: dot.homeX,
    origY: dot.homeY,
    target: -1,
    delay: 0,
    since: -1,
    releasing: false,
    fromX: dot.homeX,
    fromY: dot.homeY,
    x: dot.homeX,
    y: dot.homeY,
    radius: dot.size,
    alpha: FREE_ALPHA,
  }))
  return { dots, holding: false, gatheredAt: -1 }
}

function gather(state: FieldState, m: Homography, t: number) {
  'worklet'
  const targets = intersections(m)
  const positions: Point[] = []
  for (let i = 0; i < state.dots.length; i++) positions.push({ x: state.dots[i].x, y: state.dots[i].y })
  const owner = assignNearest(positions, targets)
  // Each flight starts where the dot is drawn, so a re-gather does not jump.
  for (let i = 0; i < state.dots.length; i++) {
    const d = state.dots[i]
    d.target = -1
    d.releasing = false
    d.fromX = d.x
    d.fromY = d.y
    d.since = t
  }
  let longest = 0
  for (let j = 0; j < owner.length; j++) {
    if (owner[j] < 0) continue
    const p = positions[owner[j]]
    longest = Math.max(longest, Math.hypot(p.x - targets[j].x, p.y - targets[j].y))
  }
  for (let j = 0; j < owner.length; j++) {
    if (owner[j] < 0) continue
    const d = state.dots[owner[j]]
    const p = positions[owner[j]]
    d.target = j
    d.delay = longest > 0 ? (Math.hypot(p.x - targets[j].x, p.y - targets[j].y) / longest) * MAX_DELAY : 0
  }
  state.holding = true
  state.gatheredAt = t
}

function release(state: FieldState, t: number) {
  'worklet'
  for (let i = 0; i < state.dots.length; i++) {
    const d = state.dots[i]
    d.fromX = d.x
    d.fromY = d.y
    d.since = t
    d.releasing = true
    d.target = -1
    d.homeX = d.origX
    d.homeY = d.origY
  }
  state.holding = false
}

function spreadHomes(state: FieldState, scene: Scene, quad: Quad, m: Homography, inverse: Homography) {
  'worklet'
  const centre = project(m, 0.5, 0.5)
  const reach = diagonal(quad) * NEAR
  const free: number[] = []
  const homes: Point[] = []
  const movable: boolean[] = []
  for (let i = 0; i < state.dots.length; i++) {
    const d = state.dots[i]
    if (d.target >= 0) continue
    free.push(i)
    homes.push({ x: d.homeX, y: d.homeY })
    movable.push(Math.hypot(d.homeX - centre.x, d.homeY - centre.y) < reach)
  }
  const next = spreadStep(homes, movable, SPREAD_RADIUS, SPREAD_PUSH)
  for (let k = 0; k < free.length; k++) {
    if (!movable[k]) continue
    const inView = {
      x: Math.min(scene.width, Math.max(0, next[k].x)),
      y: Math.min(scene.height, Math.max(0, next[k].y)),
    }
    const home = pushOutside(inView, m, inverse, MARGIN)
    state.dots[free[k]].homeX = home.x
    state.dots[free[k]].homeY = home.y
  }
}

function placeGathered(d: FieldDot, t: number, m: Homography, motion: number, reduceMotion: boolean) {
  'worklet'
  const at = project(m, (d.target % 10) / 9, Math.floor(d.target / 10) / 9)
  const grow = isBoxCorner(d.target) ? GROW_BOX : GROW
  if (reduceMotion) {
    d.x = at.x
    d.y = at.y
    d.radius = d.size * grow
    d.alpha = GATHER_ALPHA_END * Math.min(1, Math.max(0, (t - d.since) / REDUCED_FADE))
    return
  }
  const w = wander(d, t)
  const w0 = wander(d, d.since)
  const u = smooth((t - d.since - d.delay) / FLIGHT)
  const sx = d.fromX + w.x - w0.x
  const sy = d.fromY + w.y - w0.y
  const ex = at.x + w.x * WOBBLE * motion
  const ey = at.y + w.y * WOBBLE * motion
  const arc = Math.sin(u * Math.PI) * ARC * (d.px / (2 * Math.PI) - 0.5)
  d.x = sx + (ex - sx) * u - (ey - sy) * arc
  d.y = sy + (ey - sy) * u + (ex - sx) * arc
  d.radius = d.size * (1 + (grow - 1) * u)
  d.alpha = (GATHER_ALPHA_START + (GATHER_ALPHA_END - GATHER_ALPHA_START) * u) * (u >= 1 ? 1 : twinkle(d, t))
}

function placeFree(
  state: FieldState,
  d: FieldDot,
  t: number,
  m: Homography | null,
  inverse: Homography | null,
  reduceMotion: boolean,
) {
  'worklet'
  const w = reduceMotion ? { x: 0, y: 0 } : wander(d, t)
  let x = d.homeX + w.x
  let y = d.homeY + w.y
  if (m != null && inverse != null) {
    const out = pushOutside({ x, y }, m, inverse, MARGIN)
    x = out.x
    y = out.y
  }
  // A release or a spread starts where the dot is drawn, and keeps its wander.
  const start = d.releasing ? d.since : state.gatheredAt
  const span = d.releasing ? RELEASE_TIME : SPREAD_TIME
  const moving = d.releasing || (m != null && inverse != null)
  const u = reduceMotion || !moving ? 1 : smooth((t - start) / span)
  if (u < 1) {
    const w0 = wander(d, start)
    const sx = d.fromX + w.x - w0.x
    const sy = d.fromY + w.y - w0.y
    x = sx + (x - sx) * u
    y = sy + (y - sy) * u
  }
  if (d.releasing && u >= 1) d.releasing = false
  d.x = x
  d.y = y
  d.radius = d.size
  d.alpha = FREE_ALPHA * (reduceMotion ? 1 : twinkle(d, t))
}

/**
 * Advances the dots to scene.t. Run stepScene first. Mutates and returns state.
 * The dots gather on 'found', and also on the first frame with a grid when the field is new, so a switch to this effect while a grid is in view gathers at once.
 */
export function stepField(state: FieldState, scene: Scene): FieldState {
  'worklet'
  const t = scene.t
  const quad = scene.quad
  const m = scene.m
  const inverse = scene.inverse
  if (quad != null && m != null && inverse != null) {
    if (scene.event === 'found' || !state.holding) gather(state, m, t)
    if (!scene.reduceMotion && t - state.gatheredAt < SPREAD_TIME) spreadHomes(state, scene, quad, m, inverse)
  } else if (state.holding) {
    release(state, t)
  }
  for (let i = 0; i < state.dots.length; i++) {
    const d = state.dots[i]
    if (d.target >= 0 && m != null) placeGathered(d, t, m, scene.motion, scene.reduceMotion)
    else placeFree(state, d, t, m, inverse, scene.reduceMotion)
  }
  return state
}
```

- [ ] **Step 8: Run the field test to verify it passes**

Run: `cd apps/mobile && pnpm exec jest src/scan/dots/field`
Expected: PASS, 14 tests.

- [ ] **Step 9: Change `drawField` to read the dim from the scene**

In `apps/mobile/src/scan/dots/draw.ts`:

1. Add `import type { Scene } from '../effects/scene'` below the `Quad` import.
2. Replace the `drawField` comment and function with:

```ts
/** Draws the dim as paths, then every dot in one atlas call with the star sprite. Runs on the UI thread inside createPicture. sprite: from makeStarSprite. */
export function drawField(canvas: SkCanvas, state: FieldState, scene: Scene, sprite: SkImage): void {
  'worklet'
  const dim = Skia.Paint()
  dim.setAntiAlias(true)
  dim.setColor(Skia.Color('#000000'))
  if (scene.presence > 0 && scene.lastQuad != null) {
    const search = DIM_SEARCH * (1 - scene.presence)
    if (search > 0) {
      const full = Skia.Paint()
      full.setColor(Skia.Color('#000000'))
      full.setAlphaf(search)
      canvas.drawPath(viewPath(scene.width, scene.height), full)
    }
    dim.setAlphaf(DIM_OUTSIDE * scene.presence)
    canvas.drawPath(withHole(scene.width, scene.height, scene.lastQuad), dim)
  } else {
    dim.setAlphaf(DIM_SEARCH)
    canvas.drawPath(viewPath(scene.width, scene.height), dim)
  }

  const whole = Skia.XYWHRect(0, 0, SPRITE_SIZE, SPRITE_SIZE)
  const srcs = []
  const dsts = []
  const colors = []
  for (let i = 0; i < state.dots.length; i++) {
    const d = state.dots[i]
    const scale = (STAR_SCALE * d.radius) / SPRITE_SIZE
    const offset = scale * (SPRITE_SIZE / 2)
    srcs.push(whole)
    dsts.push(Skia.RSXform(scale, 0, d.x - offset, d.y - offset))
    colors.push(new Float32Array([1, 1, 1, Math.min(1, d.alpha)]))
  }
  const atlas = Skia.Paint()
  atlas.setAntiAlias(true)
  canvas.drawAtlas(sprite, srcs, dsts, atlas, BlendMode.Modulate, colors)
}
```

The paints are still made per frame here. Task 3 moves them into the `DrawKit`.

- [ ] **Step 10: Change the drawing test to the scene**

Replace `apps/mobile/src/scan/dots/draw.test.ts` with:

```ts
import type { Quad } from '../../scanner'
import { createScene, stepScene } from '../effects/scene'
import { drawField, makeStarSprite, SPRITE_SIZE, STAR_SCALE } from './draw'
import { createField, DIM_OUTSIDE, DIM_SEARCH, stepField } from './field'

const VIEW = { width: 402, height: 874 }

function fakeCanvas() {
  return { drawAtlas: jest.fn(), drawPath: jest.fn() }
}

function world() {
  return { scene: createScene(VIEW), field: createField(VIEW) }
}

const sprite = makeStarSprite()

const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

describe('drawField', () => {
  it('draws every dot with one atlas call', () => {
    const w = world()
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, sprite)
    expect(canvas.drawAtlas).toHaveBeenCalledTimes(1)
    const [, srcs, dsts, , , colors] = canvas.drawAtlas.mock.calls[0]
    expect(srcs).toHaveLength(312)
    expect(dsts).toHaveLength(312)
    expect(colors).toHaveLength(312)
  })

  it('draws a star 9 × the dot radius wide, centred on the dot', () => {
    const w = world()
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, sprite)
    const dsts = canvas.drawAtlas.mock.calls[0][2]
    const dot = w.field.dots[5]
    const { scos, ssin, tx, ty } = dsts[5]
    expect(STAR_SCALE).toBe(9)
    expect(ssin).toBe(0)
    expect(scos * SPRITE_SIZE).toBeCloseTo(9 * dot.radius)
    expect(tx + (scos * SPRITE_SIZE) / 2).toBeCloseTo(dot.x)
    expect(ty + (scos * SPRITE_SIZE) / 2).toBeCloseTo(dot.y)
  })

  it('gives each dot a colour with the dot alpha', () => {
    const w = world()
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, sprite)
    const colors = canvas.drawAtlas.mock.calls[0][5]
    expect(colors[7][3]).toBeCloseTo(Math.min(1, w.field.dots[7].alpha))
  })

  it('dims the whole view while searching', () => {
    const w = world()
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, sprite)
    expect(canvas.drawPath).toHaveBeenCalledTimes(1)
    const paint = canvas.drawPath.mock.calls[0][1]
    expect(paint.setAlphaf).toHaveBeenCalledWith(DIM_SEARCH)
  })

  it('dims only outside the grid once the grid is found', () => {
    const w = world()
    for (let t = 0; t <= 1; t += 1 / 60) {
      stepScene(w.scene, grid, t, false)
      stepField(w.field, w.scene)
    }
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, sprite)
    expect(canvas.drawPath).toHaveBeenCalledTimes(1)
    const [path, paint] = canvas.drawPath.mock.calls[0]
    expect(path.calls).toContainEqual(['setFillType', 1])
    expect(paint.setAlphaf).toHaveBeenCalledWith(DIM_OUTSIDE)
  })
})
```

- [ ] **Step 11: Step the scene in `DotField`**

In `apps/mobile/src/scan/dots/DotField.tsx`:

1. Replace `import { createField, type FieldState, stepField } from './field'` with:

```ts
import { createScene, type Scene, stepScene } from '../effects/scene'
import { createField, type FieldState, stepField } from './field'
```

2. Replace `const field = useSharedValue<FieldState | null>(null)` with `const world = useSharedValue<{ scene: Scene; field: FieldState } | null>(null)`.
3. Replace the `field.modify(...)` call and the `picture.set(...)` line with:

```ts
    world.modify((current) => {
      'worklet'
      if (current == null || current.scene.width !== size.width || current.scene.height !== size.height) {
        const scene = stepScene(createScene(size), outline.value, t, reduceMotion)
        return { scene, field: stepField(createField(size), scene) }
      }
      stepScene(current.scene, outline.value, t, reduceMotion)
      stepField(current.field, current.scene)
      return current
    }, true)
    const now = world.get()
    if (now != null) {
      picture.set(
        createPicture((canvas) => {
          'worklet'
          drawField(canvas, now.field, now.scene, sprite)
        }),
      )
    }
```

`DotField.test.tsx` does not change. It checks the same behaviour.

- [ ] **Step 12: Run all checks**

Run: `just test-ts && just typecheck && just lint && just boundaries && just bundle && just docs-check`
Expected: all pass. `DotField.test.tsx` still passes without a change.

- [ ] **Step 13: Commit**

```bash
git add apps/mobile/src/scan/effects/scene.ts apps/mobile/src/scan/effects/scene.test.ts apps/mobile/src/scan/dots/field.ts apps/mobile/src/scan/dots/field.test.ts apps/mobile/src/scan/dots/draw.ts apps/mobile/src/scan/dots/draw.test.ts apps/mobile/src/scan/dots/DotField.tsx
git commit -m "feat(app): add the scene for overlay effects (#20)"
```

---

### Task 2: Effect types, common helpers and the draw kit

Move the geometry, layout, assignment and push-apart modules to `effects/common/` without a change, except the import paths. Add the effect types, the shared drawing helpers and the `DrawKit`. Nothing on screen changes in this task.

**Files:**
- Move: `apps/mobile/src/scan/dots/{geometry,layout,assign,spread}.ts` and their `.test.ts` files to `apps/mobile/src/scan/effects/common/`
- Create: `apps/mobile/src/scan/effects/types.ts`
- Create: `apps/mobile/src/scan/effects/kit.ts`, test `kit.test.ts`
- Create: `apps/mobile/src/scan/effects/common/sprite.ts` (moved out of `dots/draw.ts`)
- Create: `apps/mobile/src/scan/effects/common/dim.ts`, test `dim.test.ts`
- Create: `apps/mobile/src/scan/effects/common/shaderMatrix.ts`, test `shaderMatrix.test.ts`
- Create: `apps/mobile/src/scan/effects/common/lock.ts`, test `lock.test.ts`
- Create: `apps/mobile/src/scan/effects/common/clock.ts`, test `clock.test.ts`
- Modify: `apps/mobile/src/scan/effects/scene.ts` (one import)
- Modify: `apps/mobile/src/scan/dots/field.ts`, `field.test.ts`, `draw.ts`, `draw.test.ts`, `DotField.tsx` (imports, and the sprite moves out of `draw.ts`)
- Modify: `apps/mobile/jest.setup.ts` (the Skia mock)

**Interfaces:**
- Consumes: `Scene`, `createScene`, `stepScene` from Task 1.
- Produces:
  - `type EffectFamily = 'path' | 'shader' | 'screen' | 'simulation'`
  - `type DrawKit = { sprite: SkImage; spriteRect: SkRect; fill: SkPaint; stroke: SkPaint; atlas: SkPaint; shader: SkPaint; shaders: { [id: string]: SkRuntimeEffect | null } }`
  - `type Effect<S> = { id: string; name: string; family: EffectFamily; sksl?: string; create(scene: Scene): S; step(state: S, scene: Scene): S; draw(canvas: SkCanvas, state: S, scene: Scene, kit: DrawKit): void }`
  - `type AnyEffect = Effect<unknown>`
  - `makeDrawKit(effects: readonly AnyEffect[]): DrawKit`, `compileShader(id: string, sksl: string): SkRuntimeEffect | null`
  - `makeStarSprite(): SkImage`, `SPRITE_SIZE = 64` in `effects/common/sprite.ts`
  - `drawDim(canvas: SkCanvas, paint: SkPaint, width: number, height: number, quad: Quad | null, alpha: number): void`
  - `PROTOTYPE_WIDTH = 220`, `IDENTITY: Homography`, `prototypeScale(width: number): number`, `prototypePixel(width: number): number`, `toColumnMajor(m: Homography): number[]`, `gridInverse(scene: Scene): Homography | null`
  - `lockProgress(scene: Scene): number`, `lockTime(scene: Scene): number`
  - `type Clock = { start: number }`, `createClock(scene: Scene): Clock`, `effectTime(clock: Clock, scene: Scene): number`

- [ ] **Step 1: Move the four modules**

Run from the worktree root:

```bash
mkdir -p apps/mobile/src/scan/effects/common
mv apps/mobile/src/scan/dots/geometry.ts apps/mobile/src/scan/dots/geometry.test.ts apps/mobile/src/scan/dots/layout.ts apps/mobile/src/scan/dots/layout.test.ts apps/mobile/src/scan/dots/assign.ts apps/mobile/src/scan/dots/assign.test.ts apps/mobile/src/scan/dots/spread.ts apps/mobile/src/scan/dots/spread.test.ts apps/mobile/src/scan/effects/common/
```

Then change only these import lines:

| File | Old import | New import |
| --- | --- | --- |
| `effects/common/geometry.ts` | `from '../../scanner'` | `from '../../../scanner'` |
| `effects/common/geometry.test.ts` | `from '../../scanner'` | `from '../../../scanner'` |
| `effects/common/layout.ts` | `from '../../scanner'`, `from '../previewMapping'` | `from '../../../scanner'`, `from '../../previewMapping'` |
| `effects/common/assign.ts` | `from '../../scanner'` | `from '../../../scanner'` |
| `effects/common/spread.ts` | `from '../../scanner'` | `from '../../../scanner'` |
| `effects/scene.ts` | `from '../dots/geometry'` | `from './common/geometry'` |
| `dots/field.ts` | `from './assign'`, `'./geometry'`, `'./layout'`, `'./spread'` | `from '../effects/common/assign'`, `'../effects/common/geometry'`, `'../effects/common/layout'`, `'../effects/common/spread'` |
| `dots/field.test.ts` | `from './geometry'` | `from '../effects/common/geometry'` |

- [ ] **Step 2: Move the star sprite to `common/sprite.ts`**

Create `apps/mobile/src/scan/effects/common/sprite.ts` with the sprite code from `dots/draw.ts`, unchanged:

```ts
import { type SkImage, Skia, TileMode } from '@shopify/react-native-skia'

/** Pixels. Sharp at 3x density for the largest dot: radius 1.25 × 1.7 pt gives a star of about 19 pt. */
export const SPRITE_SIZE = 64

/** A white core with a soft halo that fades out at the image edge, which is 4.5 radii from the centre. */
export function makeStarSprite(): SkImage {
  'worklet'
  const surface = Skia.Surface.Make(SPRITE_SIZE, SPRITE_SIZE)
  if (surface == null) throw new Error('Cannot make the star sprite surface')
  const half = SPRITE_SIZE / 2
  const paint = Skia.Paint()
  paint.setShader(
    Skia.Shader.MakeRadialGradient(
      { x: half, y: half },
      half,
      [
        Skia.Color('rgba(255,255,255,1)'),
        Skia.Color('rgba(255,255,255,1)'),
        Skia.Color('rgba(255,255,255,0.3)'),
        Skia.Color('rgba(255,255,255,0)'),
      ],
      [0, 0.2, 0.45, 1],
      TileMode.Clamp,
    ),
  )
  surface.getCanvas().drawPaint(paint)
  return surface.makeImageSnapshot()
}
```

In `apps/mobile/src/scan/dots/draw.ts`:

1. Delete `SPRITE_SIZE` and `makeStarSprite`.
2. Change the Skia import to `import { BlendMode, FillType, type SkCanvas, type SkImage, Skia } from '@shopify/react-native-skia'`.
3. Add `import { SPRITE_SIZE } from '../effects/common/sprite'`.

In `apps/mobile/src/scan/dots/draw.test.ts`, change the import of `./draw` to:

```ts
import { makeStarSprite, SPRITE_SIZE } from '../effects/common/sprite'
import { drawField, STAR_SCALE } from './draw'
```

In `apps/mobile/src/scan/dots/DotField.tsx`, change `import { drawField, makeStarSprite } from './draw'` to:

```ts
import { makeStarSprite } from '../effects/common/sprite'
import { drawField } from './draw'
```

- [ ] **Step 3: Run the tests to confirm the move**

Run: `cd apps/mobile && pnpm exec jest src/scan`
Expected: PASS. The same test count as at the end of Task 1.

- [ ] **Step 4: Extend the Skia mock**

In `apps/mobile/jest.setup.ts`, inside the `jest.mock('@shopify/react-native-skia', …)` factory:

1. Add these enums next to `FillType`:

```ts
    PaintStyle: { Fill: 0, Stroke: 1 },
    StrokeCap: { Butt: 0, Round: 1, Square: 2 },
    StrokeJoin: { Miter: 0, Round: 1, Bevel: 2 },
```

2. Replace the `Paint:` entry with:

```ts
      Paint: () => ({
        setAntiAlias: jest.fn(),
        setColor: jest.fn(),
        setAlphaf: jest.fn(),
        setShader: jest.fn(),
        setStyle: jest.fn(),
        setStrokeWidth: jest.fn(),
        setStrokeCap: jest.fn(),
        setStrokeJoin: jest.fn(),
      }),
```

3. Add this entry to the `Skia` object, after `Shader`:

```ts
      RuntimeEffect: { Make: jest.fn(() => ({ makeShader: jest.fn(() => ({})) })) },
```

- [ ] **Step 5: Write the failing tests for the common helpers**

Create `apps/mobile/src/scan/effects/common/dim.test.ts`:

```ts
import { Skia } from '@shopify/react-native-skia'
import type { Quad } from '../../../scanner'
import { drawDim } from './dim'

const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

function setup() {
  return { canvas: { drawPath: jest.fn() }, paint: Skia.Paint() as unknown as { setAlphaf: jest.Mock } }
}

describe('drawDim', () => {
  it('draws nothing at alpha 0', () => {
    const { canvas, paint } = setup()
    drawDim(canvas as never, paint as never, 402, 874, grid, 0)
    expect(canvas.drawPath).not.toHaveBeenCalled()
  })

  it('dims the whole view without a quad', () => {
    const { canvas, paint } = setup()
    drawDim(canvas as never, paint as never, 402, 874, null, 0.3)
    const [path, used] = canvas.drawPath.mock.calls[0]
    expect(path.calls[0]).toEqual(['moveTo', 0, 0])
    expect(path.calls).not.toContainEqual(['setFillType', 1])
    expect(used).toBe(paint)
    expect(paint.setAlphaf).toHaveBeenCalledWith(0.3)
  })

  it('cuts the grid out of the dim with an even-odd hole', () => {
    const { canvas, paint } = setup()
    drawDim(canvas as never, paint as never, 402, 874, grid, 0.45)
    const path = canvas.drawPath.mock.calls[0][0]
    expect(path.calls).toContainEqual(['moveTo', 50, 300])
    expect(path.calls).toContainEqual(['setFillType', 1])
  })

  it('clamps the alpha to 1', () => {
    const { canvas, paint } = setup()
    drawDim(canvas as never, paint as never, 402, 874, null, 1.4)
    expect(paint.setAlphaf).toHaveBeenCalledWith(1)
  })
})
```

Create `apps/mobile/src/scan/effects/common/shaderMatrix.test.ts`:

```ts
import type { Quad } from '../../../scanner'
import { createScene, stepScene } from '../scene'
import { invert, project, unitToQuad } from './geometry'
import { gridInverse, IDENTITY, prototypePixel, prototypeScale, toColumnMajor } from './shaderMatrix'

const skewed: Quad = [
  { x: 100, y: 200 },
  { x: 300, y: 190 },
  { x: 330, y: 420 },
  { x: 80, y: 400 },
]

describe('toColumnMajor', () => {
  it('gives the 9 floats of a float3x3 uniform, column by column, with 1 at the end', () => {
    const m = unitToQuad(skewed)!
    const c = toColumnMajor(m)
    expect(c).toHaveLength(9)
    expect(c[8]).toBe(1)
    const u = 0.3
    const v = 0.7
    const w = c[2] * u + c[5] * v + c[8]
    const p = project(m, u, v)
    expect((c[0] * u + c[3] * v + c[6]) / w).toBeCloseTo(p.x, 6)
    expect((c[1] * u + c[4] * v + c[7]) / w).toBeCloseTo(p.y, 6)
  })

  it('keeps the identity', () => {
    expect(toColumnMajor(IDENTITY)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
  })
})

describe('prototype units', () => {
  it('scales the 220 pt prototype phone to the view, at pixel density 2', () => {
    expect(prototypeScale(440)).toBe(2)
    expect(prototypePixel(440)).toBe(1)
  })
})

describe('gridInverse', () => {
  it('uses the inverse of the scene while a grid is found', () => {
    const scene = stepScene(createScene({ width: 402, height: 874 }), skewed, 0, false)
    expect(gridInverse(scene)).toBe(scene.inverse)
  })

  it('computes the inverse of the last grid after a loss', () => {
    const scene = stepScene(createScene({ width: 402, height: 874 }), skewed, 0, false)
    stepScene(scene, null, 0.1, false)
    expect(scene.inverse).toBeNull()
    expect(gridInverse(scene)).toEqual(invert(unitToQuad(skewed)!))
  })

  it('gives null before any grid', () => {
    expect(gridInverse(createScene({ width: 402, height: 874 }))).toBeNull()
  })
})
```

Create `apps/mobile/src/scan/effects/common/lock.test.ts`:

```ts
import { createScene } from '../scene'
import { lockProgress, lockTime } from './lock'

const scene = () => createScene({ width: 402, height: 874 })

describe('lockProgress', () => {
  it('grows as the corners slow down while a grid is found', () => {
    expect(lockProgress({ ...scene(), presence: 1, motion: 0.25 })).toBe(0.75)
  })

  it('is 0 without a grid', () => {
    expect(lockProgress({ ...scene(), presence: 0, motion: 0 })).toBe(0)
  })
})

describe('lockTime', () => {
  it('gives the seconds since the scene became steady', () => {
    expect(lockTime({ ...scene(), steady: true, t: 5, steadyAt: 3.5 })).toBe(1.5)
  })

  it('gives -1 while the scene is not steady', () => {
    expect(lockTime({ ...scene(), steady: false, t: 5, steadyAt: 3.5 })).toBe(-1)
  })
})
```

Create `apps/mobile/src/scan/effects/common/clock.test.ts`:

```ts
import { createScene } from '../scene'
import { createClock, effectTime } from './clock'

const scene = () => createScene({ width: 402, height: 874 })

describe('effectTime', () => {
  it('counts the seconds from the creation of the effect', () => {
    const clock = createClock({ ...scene(), t: 100 })
    expect(effectTime(clock, { ...scene(), t: 102.5 })).toBe(2.5)
  })

  it('stops the time under Reduce Motion', () => {
    const clock = createClock({ ...scene(), t: 100 })
    expect(effectTime(clock, { ...scene(), t: 102.5, reduceMotion: true })).toBe(0)
  })
})
```

Create `apps/mobile/src/scan/effects/kit.test.ts`:

```ts
import { PaintStyle, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia'
import { makeDrawKit } from './kit'
import type { AnyEffect } from './types'

const make = jest.mocked(Skia.RuntimeEffect.Make)

function fakeEffect(id: string, sksl?: string): AnyEffect {
  return { id, name: id, family: 'shader', sksl, create: () => null, step: (state) => state, draw: () => undefined }
}

beforeEach(() => jest.clearAllMocks())

describe('makeDrawKit', () => {
  it('compiles the shader of each effect once, by id', () => {
    const kit = makeDrawKit([fakeEffect('a', 'half4 main(float2 p) { return half4(1); }'), fakeEffect('b')])
    expect(make).toHaveBeenCalledTimes(1)
    expect(make).toHaveBeenCalledWith('half4 main(float2 p) { return half4(1); }')
    expect(kit.shaders.a).not.toBeNull()
    expect('b' in kit.shaders).toBe(false)
  })

  it('keeps the other effects when a shader does not compile', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    make.mockImplementationOnce(() => {
      throw new Error('Error in sksl: bad')
    })
    const kit = makeDrawKit([fakeEffect('bad', 'x'), fakeEffect('good', 'y')])
    expect(kit.shaders.bad).toBeNull()
    expect(kit.shaders.good).not.toBeNull()
    expect(log).toHaveBeenCalledWith('[fx] bad shader failed: Error in sksl: bad')
    log.mockRestore()
  })

  it('sets up the stroke paint once, with round caps and joins', () => {
    const stroke = makeDrawKit([]).stroke as unknown as Record<string, jest.Mock>
    expect(stroke.setStyle).toHaveBeenCalledWith(PaintStyle.Stroke)
    expect(stroke.setStrokeCap).toHaveBeenCalledWith(StrokeCap.Round)
    expect(stroke.setStrokeJoin).toHaveBeenCalledWith(StrokeJoin.Round)
  })

  it('makes the star sprite once', () => {
    makeDrawKit([])
    expect(jest.mocked(Skia.Surface.Make)).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 6: Run the new tests to verify they fail**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects/kit src/scan/effects/common/dim src/scan/effects/common/shaderMatrix src/scan/effects/common/lock src/scan/effects/common/clock`
Expected: FAIL with "Cannot find module" for `./dim`, `./shaderMatrix`, `./lock`, `./clock` and `./kit`.

- [ ] **Step 7: Write the types**

Create `apps/mobile/src/scan/effects/types.ts`:

```ts
import type { SkCanvas, SkImage, SkPaint, SkRect, SkRuntimeEffect } from '@shopify/react-native-skia'
import type { Scene } from './scene'

export type EffectFamily = 'path' | 'shader' | 'screen' | 'simulation'

/**
 * Resources that the engine makes once on the JS thread, so draw never makes them per frame.
 * draw sets the colour, alpha and shader of a paint before each use. shaders: the compiled sksl of each effect by id, or null when it did not compile.
 */
export type DrawKit = {
  sprite: SkImage
  spriteRect: SkRect
  fill: SkPaint
  stroke: SkPaint
  atlas: SkPaint
  shader: SkPaint
  shaders: { [id: string]: SkRuntimeEffect | null }
}

/**
 * One way to draw the live overlay. Every function is a worklet. id is stable: the saved choice uses it.
 * create runs on the first frame, on a view size change and on a switch to the effect. step may change the state and returns it.
 * sksl: a runtime shader source that the engine compiles once into kit.shaders[id].
 */
export type Effect<S> = {
  id: string
  name: string
  family: EffectFamily
  sksl?: string
  create(scene: Scene): S
  step(state: S, scene: Scene): S
  draw(canvas: SkCanvas, state: S, scene: Scene, kit: DrawKit): void
}

// The methods use method syntax on purpose: it lets an Effect<FieldState> stand in an AnyEffect list.
export type AnyEffect = Effect<unknown>
```

- [ ] **Step 8: Write the common helpers**

Create `apps/mobile/src/scan/effects/common/dim.ts`:

```ts
import { FillType, type SkCanvas, type SkPaint, Skia } from '@shopify/react-native-skia'
import type { Quad } from '../../../scanner'

function viewPath(width: number, height: number) {
  'worklet'
  return Skia.Path.Make().moveTo(0, 0).lineTo(width, 0).lineTo(width, height).lineTo(0, height).close()
}

function withHole(width: number, height: number, quad: Quad) {
  'worklet'
  return viewPath(width, height)
    .moveTo(quad[0].x, quad[0].y)
    .lineTo(quad[1].x, quad[1].y)
    .lineTo(quad[2].x, quad[2].y)
    .lineTo(quad[3].x, quad[3].y)
    .close()
    .setFillType(FillType.EvenOdd)
}

/** A black dim over the view. quad: the hole, or null for no hole. alpha: 0..1, clamped. Sets the colour and alpha of paint. */
export function drawDim(
  canvas: SkCanvas,
  paint: SkPaint,
  width: number,
  height: number,
  quad: Quad | null,
  alpha: number,
): void {
  'worklet'
  if (alpha <= 0) return
  paint.setColor(Skia.Color('#000000'))
  paint.setAlphaf(Math.min(1, alpha))
  canvas.drawPath(quad == null ? viewPath(width, height) : withHole(width, height, quad), paint)
}
```

Create `apps/mobile/src/scan/effects/common/shaderMatrix.ts`:

```ts
import type { Scene } from '../scene'
import { type Homography, invert, unitToQuad } from './geometry'

/** Points. The width of the phone that the prototype draws. */
export const PROTOTYPE_WIDTH = 220

export const IDENTITY: Homography = [1, 0, 0, 0, 1, 0, 0, 0]

/** The factor from prototype points to view points. */
export function prototypeScale(width: number): number {
  'worklet'
  return width / PROTOTYPE_WIDTH
}

/** View points per prototype pixel. The prototype shaders ran at pixel density 2. */
export function prototypePixel(width: number): number {
  'worklet'
  return prototypeScale(width) / 2
}

/** The 9 floats of an SkSL float3x3 uniform. Skia reads a matrix uniform column by column. */
export function toColumnMajor(m: Homography): number[] {
  'worklet'
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], 1]
}

/** The view-to-grid matrix of the current grid, or of the last grid while an effect fades out after a loss. Null before any grid. */
export function gridInverse(scene: Scene): Homography | null {
  'worklet'
  if (scene.inverse != null) return scene.inverse
  if (scene.lastQuad == null) return null
  const m = unitToQuad(scene.lastQuad)
  return m == null ? null : invert(m)
}
```

Create `apps/mobile/src/scan/effects/common/lock.ts`:

```ts
import type { Scene } from '../scene'

// Lock-on does not exist yet (scan-pipeline concept, open questions). The prototype's lock-on progress and lock-on time are
// approximated from the steady state, so each effect shows its lock-on reaction when the corners hold still.

/** 0..1: the prototype's lock-on progress p. */
export function lockProgress(scene: Scene): number {
  'worklet'
  return scene.presence * (1 - scene.motion)
}

/** Seconds since the scene became steady, or -1: the prototype's uLockT. */
export function lockTime(scene: Scene): number {
  'worklet'
  return scene.steady ? scene.t - scene.steadyAt : -1
}
```

Create `apps/mobile/src/scan/effects/common/clock.ts`:

```ts
import type { Scene } from '../scene'

/** start: seconds on the frame clock when the effect was created. */
export type Clock = { start: number }

export function createClock(scene: Scene): Clock {
  'worklet'
  return { start: scene.t }
}

/**
 * Seconds since the effect was created, and 0 under Reduce Motion, which stops shader time.
 * A float uniform loses precision on the raw frame clock, so shaders get this small value.
 */
export function effectTime(clock: Clock, scene: Scene): number {
  'worklet'
  return scene.reduceMotion ? 0 : scene.t - clock.start
}
```

- [ ] **Step 9: Write the kit**

Create `apps/mobile/src/scan/effects/kit.ts`:

```ts
import { PaintStyle, type SkRuntimeEffect, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia'
import { makeStarSprite, SPRITE_SIZE } from './common/sprite'
import type { AnyEffect, DrawKit } from './types'

function logShaderError(id: string, error: unknown) {
  if (__DEV__) console.log(`[fx] ${id} shader failed: ${error instanceof Error ? error.message : String(error)}`)
}

/** Null when the source does not compile. Skia throws on a compile error. */
export function compileShader(id: string, sksl: string): SkRuntimeEffect | null {
  try {
    const effect = Skia.RuntimeEffect.Make(sksl)
    if (effect == null) logShaderError(id, 'no runtime effect')
    return effect
  } catch (error) {
    logShaderError(id, error)
    return null
  }
}

/** Runs once on the JS thread. Skia objects are host objects, so the frame worklet can capture the kit. */
export function makeDrawKit(effects: readonly AnyEffect[]): DrawKit {
  const fill = Skia.Paint()
  fill.setAntiAlias(true)
  const stroke = Skia.Paint()
  stroke.setAntiAlias(true)
  stroke.setStyle(PaintStyle.Stroke)
  stroke.setStrokeCap(StrokeCap.Round)
  stroke.setStrokeJoin(StrokeJoin.Round)
  const atlas = Skia.Paint()
  atlas.setAntiAlias(true)
  const shader = Skia.Paint()
  const shaders: { [id: string]: SkRuntimeEffect | null } = {}
  for (const effect of effects) {
    if (effect.sksl != null) shaders[effect.id] = compileShader(effect.id, effect.sksl)
  }
  return {
    sprite: makeStarSprite(),
    spriteRect: Skia.XYWHRect(0, 0, SPRITE_SIZE, SPRITE_SIZE),
    fill,
    stroke,
    atlas,
    shader,
    shaders,
  }
}
```

- [ ] **Step 10: Run the new tests to verify they pass**

Run: `cd apps/mobile && pnpm exec jest src/scan`
Expected: PASS. The new files add 4 + 6 + 4 + 2 + 4 = 20 tests.

- [ ] **Step 11: Run all checks**

Run: `just test-ts && just typecheck && just lint && just boundaries && just bundle && just docs-check`
Expected: all pass.

- [ ] **Step 12: Commit**

```bash
git add -A apps/mobile/src/scan apps/mobile/jest.setup.ts
git commit -m "feat(app): add the effect types, the draw kit and the shared drawing helpers (#20)"
```

---

### Task 3: Gathering dots, the registry and the engine

Wrap the dot field as the first effect. Add the registry and the engine. `CameraScreen` renders `EffectCanvas` in place of `DotField`. Then delete `DotField` and the `dots/` folder. The draw code uses the `DrawKit`, so it makes no paint per frame.

**Files:**
- Move: `apps/mobile/src/scan/dots/field.ts`, `field.test.ts`, `draw.ts`, `draw.test.ts` to `apps/mobile/src/scan/effects/gathering-dots/`
- Modify: `apps/mobile/src/scan/effects/gathering-dots/draw.ts` (whole file), `draw.test.ts` (whole file), `field.ts` and `field.test.ts` (imports)
- Create: `apps/mobile/src/scan/effects/gathering-dots/index.ts`, test `index.test.ts`
- Create: `apps/mobile/src/scan/effects/index.ts`, test `index.test.ts`
- Create: `apps/mobile/src/scan/effects/engine.ts`, test `engine.test.ts`
- Create: `apps/mobile/src/scan/effects/EffectCanvas.tsx`, test `EffectCanvas.test.tsx`
- Modify: `apps/mobile/src/scan/CameraScreen.tsx`, `CameraScreen.test.tsx`
- Delete: `apps/mobile/src/scan/dots/DotField.tsx`, `DotField.test.tsx`, and the empty `dots/` folder

**Interfaces:**
- Consumes: `Scene`, `createScene`, `stepScene` (Task 1). `Effect`, `AnyEffect`, `DrawKit`, `makeDrawKit`, `drawDim`, `SPRITE_SIZE` (Task 2). `FieldState`, `createField`, `stepField`, `DIM_SEARCH`, `DIM_OUTSIDE` (Task 1).
- Produces:
  - `drawField(canvas: SkCanvas, state: FieldState, scene: Scene, kit: DrawKit): void`, `STAR_SCALE = 9`
  - `gatheringDots: Effect<FieldState>` with id `'gathering-dots'`
  - `EFFECTS: readonly AnyEffect[]`, `DEFAULT_INDEX = 0`, `DEFAULT_EFFECT: AnyEffect`, `effectAt(index: number): AnyEffect` (worklet), `effectIndex(id: string | null): number`, `findEffect(id: string | null): AnyEffect`
  - `type Engine = { index: number; scene: Scene; state: unknown }`
  - `advance(engine: Engine | null, index: number, effect: AnyEffect, view: ViewSize, quad: Quad | null, t: number, reduceMotion: boolean): Engine`
  - `EffectCanvas({ outline, view, effect }: { outline: SharedValue<Quad | null>; view: SharedValue<ViewSize>; effect: SharedValue<number> })`
  - The development log line `[fx] <id> <fps> fps, overlay <ms> ms`

- [ ] **Step 1: Move the field and its drawing**

Run from the worktree root:

```bash
mkdir -p apps/mobile/src/scan/effects/gathering-dots
mv apps/mobile/src/scan/dots/field.ts apps/mobile/src/scan/dots/field.test.ts apps/mobile/src/scan/dots/draw.ts apps/mobile/src/scan/dots/draw.test.ts apps/mobile/src/scan/effects/gathering-dots/
```

In `effects/gathering-dots/field.ts`, replace the import block with:

```ts
import type { Point, Quad } from '../../../scanner'
import type { ViewSize } from '../../previewMapping'
import { assignNearest } from '../common/assign'
import { type Homography, intersections, isBoxCorner, project, pushOutside } from '../common/geometry'
import { createDots, type Dot, DOT_SPACING, twinkle, wander } from '../common/layout'
import { spreadStep } from '../common/spread'
import { diagonal, type Scene } from '../scene'
```

In `effects/gathering-dots/field.test.ts`, change the imports to:

```ts
import type { Quad } from '../../../scanner'
import { intersections, invert, project, unitToQuad } from '../common/geometry'
import { createScene, type Scene, stepScene } from '../scene'
```

Keep the import of `./field` as it is.

- [ ] **Step 2: Write the failing drawing test**

Replace `apps/mobile/src/scan/effects/gathering-dots/draw.test.ts` with:

```ts
import type { Quad } from '../../../scanner'
import { SPRITE_SIZE } from '../common/sprite'
import { makeDrawKit } from '../kit'
import { createScene, stepScene } from '../scene'
import { drawField, STAR_SCALE } from './draw'
import { createField, DIM_OUTSIDE, DIM_SEARCH, stepField } from './field'

const VIEW = { width: 402, height: 874 }

function fakeCanvas() {
  return { drawAtlas: jest.fn(), drawPath: jest.fn() }
}

function world() {
  return { scene: createScene(VIEW), field: createField(VIEW), kit: makeDrawKit([]) }
}

const fillOf = (kit: ReturnType<typeof makeDrawKit>) => kit.fill as unknown as { setAlphaf: jest.Mock }

const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

describe('drawField', () => {
  it('draws every dot with one atlas call, with the sprite and the paint of the kit', () => {
    const w = world()
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, w.kit)
    expect(canvas.drawAtlas).toHaveBeenCalledTimes(1)
    const [image, srcs, dsts, paint, , colors] = canvas.drawAtlas.mock.calls[0]
    expect(image).toBe(w.kit.sprite)
    expect(paint).toBe(w.kit.atlas)
    expect(srcs).toHaveLength(312)
    expect(dsts).toHaveLength(312)
    expect(colors).toHaveLength(312)
  })

  it('draws a star 9 × the dot radius wide, centred on the dot', () => {
    const w = world()
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, w.kit)
    const dsts = canvas.drawAtlas.mock.calls[0][2]
    const dot = w.field.dots[5]
    const { scos, ssin, tx, ty } = dsts[5]
    expect(STAR_SCALE).toBe(9)
    expect(ssin).toBe(0)
    expect(scos * SPRITE_SIZE).toBeCloseTo(9 * dot.radius)
    expect(tx + (scos * SPRITE_SIZE) / 2).toBeCloseTo(dot.x)
    expect(ty + (scos * SPRITE_SIZE) / 2).toBeCloseTo(dot.y)
  })

  it('gives each dot a colour with the dot alpha', () => {
    const w = world()
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, w.kit)
    const colors = canvas.drawAtlas.mock.calls[0][5]
    expect(colors[7][3]).toBeCloseTo(w.field.dots[7].alpha)
  })

  it('clamps the dot alpha to 1', () => {
    const w = world()
    w.field.dots[0].alpha = 1.4
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, w.kit)
    expect(canvas.drawAtlas.mock.calls[0][5][0][3]).toBe(1)
  })

  it('dims the whole view while searching', () => {
    const w = world()
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, w.kit)
    expect(canvas.drawPath).toHaveBeenCalledTimes(1)
    expect(canvas.drawPath.mock.calls[0][1]).toBe(w.kit.fill)
    expect(fillOf(w.kit).setAlphaf).toHaveBeenCalledWith(DIM_SEARCH)
  })

  it('dims only outside the grid once the grid is found', () => {
    const w = world()
    for (let t = 0; t <= 1; t += 1 / 60) {
      stepScene(w.scene, grid, t, false)
      stepField(w.field, w.scene)
    }
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, w.kit)
    expect(canvas.drawPath).toHaveBeenCalledTimes(1)
    expect(canvas.drawPath.mock.calls[0][0].calls).toContainEqual(['setFillType', 1])
    expect(fillOf(w.kit).setAlphaf).toHaveBeenCalledWith(DIM_OUTSIDE)
  })

  it('dims both the view and the outside of the grid while the grid fades in', () => {
    const w = world()
    w.scene.presence = 0.5
    w.scene.lastQuad = grid
    const canvas = fakeCanvas()
    drawField(canvas as never, w.field, w.scene, w.kit)
    expect(canvas.drawPath).toHaveBeenCalledTimes(2)
    expect(canvas.drawPath.mock.calls[0][0].calls).not.toContainEqual(['setFillType', 1])
    expect(canvas.drawPath.mock.calls[1][0].calls).toContainEqual(['setFillType', 1])
    expect(fillOf(w.kit).setAlphaf.mock.calls).toEqual([[DIM_SEARCH * 0.5], [DIM_OUTSIDE * 0.5]])
  })
})
```

- [ ] **Step 3: Run the drawing test to verify it fails**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects/gathering-dots/draw`
Expected: FAIL with "Cannot find module". The moved old `draw.ts` still has the import paths of `dots/`.

- [ ] **Step 4: Rewrite `draw.ts` on the kit**

Replace `apps/mobile/src/scan/effects/gathering-dots/draw.ts` with:

```ts
import { BlendMode, type SkCanvas, Skia } from '@shopify/react-native-skia'
import { drawDim } from '../common/dim'
import { SPRITE_SIZE } from '../common/sprite'
import type { Scene } from '../scene'
import type { DrawKit } from '../types'
import { DIM_OUTSIDE, DIM_SEARCH, type FieldState } from './field'

/** The width of a drawn star as a multiple of the dot radius. */
export const STAR_SCALE = 9

/** Draws the dim as paths, then every dot in one atlas call with kit.sprite. Runs on the UI thread inside createPicture. */
export function drawField(canvas: SkCanvas, state: FieldState, scene: Scene, kit: DrawKit): void {
  'worklet'
  // A picture records a copy of the paint at each draw call, so both dims can use kit.fill.
  if (scene.presence > 0 && scene.lastQuad != null) {
    drawDim(canvas, kit.fill, scene.width, scene.height, null, DIM_SEARCH * (1 - scene.presence))
    drawDim(canvas, kit.fill, scene.width, scene.height, scene.lastQuad, DIM_OUTSIDE * scene.presence)
  } else {
    drawDim(canvas, kit.fill, scene.width, scene.height, null, DIM_SEARCH)
  }
  const srcs = []
  const dsts = []
  const colors = []
  for (let i = 0; i < state.dots.length; i++) {
    const d = state.dots[i]
    const scale = (STAR_SCALE * d.radius) / SPRITE_SIZE
    const offset = scale * (SPRITE_SIZE / 2)
    srcs.push(kit.spriteRect)
    dsts.push(Skia.RSXform(scale, 0, d.x - offset, d.y - offset))
    colors.push(new Float32Array([1, 1, 1, Math.min(1, d.alpha)]))
  }
  canvas.drawAtlas(kit.sprite, srcs, dsts, kit.atlas, BlendMode.Modulate, colors)
}
```

- [ ] **Step 5: Run the drawing test to verify it passes**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects/gathering-dots`
Expected: PASS, the field test (14) and the drawing test (7).

- [ ] **Step 6: Write the failing tests for the effect, the registry and the engine**

Create `apps/mobile/src/scan/effects/gathering-dots/index.test.ts`:

```ts
import type { Quad } from '../../../scanner'
import { makeDrawKit } from '../kit'
import { createScene, stepScene } from '../scene'
import { gatheringDots } from './index'

const VIEW = { width: 402, height: 874 }

const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

describe('gatheringDots', () => {
  it('is the simulation effect with a stable id', () => {
    expect(gatheringDots.id).toBe('gathering-dots')
    expect(gatheringDots.name).toBe('Gathering dots')
    expect(gatheringDots.family).toBe('simulation')
  })

  it('creates a field with the dot density of the view', () => {
    const scene = stepScene(createScene(VIEW), null, 0, false)
    expect(gatheringDots.create(scene).dots).toHaveLength(312)
  })

  it('gathers 100 dots when the scene has a grid', () => {
    const scene = stepScene(createScene(VIEW), grid, 0, false)
    const state = gatheringDots.step(gatheringDots.create(scene), scene)
    expect(state.dots.filter((d) => d.target >= 0)).toHaveLength(100)
  })

  it('draws the dots in one atlas call', () => {
    const scene = stepScene(createScene(VIEW), null, 0, false)
    const canvas = { drawAtlas: jest.fn(), drawPath: jest.fn() }
    gatheringDots.draw(canvas as never, gatheringDots.create(scene), scene, makeDrawKit([]))
    expect(canvas.drawAtlas).toHaveBeenCalledTimes(1)
  })
})
```

Create `apps/mobile/src/scan/effects/index.test.ts`:

```ts
import { DEFAULT_EFFECT, DEFAULT_INDEX, EFFECTS, effectAt, effectIndex, findEffect } from './index'

const FAMILIES = ['path', 'shader', 'screen', 'simulation']

describe('the effect registry', () => {
  it('gives every effect a unique id, a name and a known family', () => {
    const ids = EFFECTS.map((effect) => effect.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const effect of EFFECTS) {
      expect(effect.name.length).toBeGreaterThan(0)
      expect(FAMILIES).toContain(effect.family)
    }
  })

  it('starts on Gathering dots', () => {
    expect(DEFAULT_INDEX).toBe(0)
    expect(DEFAULT_EFFECT.id).toBe('gathering-dots')
  })

  it('finds an effect by id', () => {
    expect(findEffect('gathering-dots')).toBe(EFFECTS[effectIndex('gathering-dots')])
  })

  it('gives the default effect for an unknown id', () => {
    expect(effectIndex('deleted-effect')).toBe(DEFAULT_INDEX)
    expect(findEffect('deleted-effect')).toBe(DEFAULT_EFFECT)
    expect(findEffect(null)).toBe(DEFAULT_EFFECT)
  })

  it('gives the default effect for an index out of range', () => {
    expect(effectAt(EFFECTS.length)).toBe(DEFAULT_EFFECT)
    expect(effectAt(-1)).toBe(DEFAULT_EFFECT)
    expect(effectAt(0.5)).toBe(DEFAULT_EFFECT)
  })
})
```

Create `apps/mobile/src/scan/effects/engine.test.ts`:

```ts
import type { Quad } from '../../scanner'
import { advance } from './engine'
import type { AnyEffect } from './types'

const VIEW = { width: 402, height: 874 }

const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

function fakeEffect(id: string) {
  return {
    id,
    name: id,
    family: 'path',
    create: jest.fn(() => ({ id })),
    step: jest.fn((state: unknown) => state),
    draw: jest.fn(),
  } satisfies AnyEffect
}

describe('advance', () => {
  it('creates the effect on the first frame, then steps it', () => {
    const a = fakeEffect('a')
    const engine = advance(null, 0, a, VIEW, null, 1, false)
    expect(a.create).toHaveBeenCalledTimes(1)
    expect(a.step).toHaveBeenCalledWith({ id: 'a' }, engine.scene)
    expect(engine.state).toEqual({ id: 'a' })
    expect(engine.scene.t).toBe(1)
  })

  it('keeps the state from frame to frame', () => {
    const a = fakeEffect('a')
    const first = advance(null, 0, a, VIEW, null, 1, false)
    const second = advance(first, 0, a, VIEW, null, 1 + 1 / 60, false)
    expect(a.create).toHaveBeenCalledTimes(1)
    expect(a.step).toHaveBeenCalledTimes(2)
    expect(second.state).toBe(first.state)
  })

  it('creates the new effect on a switch and keeps the scene', () => {
    const a = fakeEffect('a')
    const b = fakeEffect('b')
    const first = advance(null, 0, a, VIEW, grid, 1, false)
    const second = advance(first, 1, b, VIEW, grid, 1 + 1 / 60, false)
    expect(b.create).toHaveBeenCalledTimes(1)
    expect(second.scene).toBe(first.scene)
    expect(second.scene.foundAt).toBe(1)
    expect(second.state).toEqual({ id: 'b' })
    expect(second.index).toBe(1)
  })

  it('creates the effect and a new scene when the view size changes', () => {
    const a = fakeEffect('a')
    const first = advance(null, 0, a, VIEW, null, 1, false)
    const second = advance(first, 0, a, { width: 804, height: 874 }, null, 1.1, false)
    expect(a.create).toHaveBeenCalledTimes(2)
    expect(second.scene).not.toBe(first.scene)
    expect(second.scene.width).toBe(804)
  })

  it('passes Reduce Motion to the scene', () => {
    const engine = advance(null, 0, fakeEffect('a'), VIEW, null, 1, true)
    expect(engine.scene.reduceMotion).toBe(true)
  })
})
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects/gathering-dots/index src/scan/effects/index src/scan/effects/engine`
Expected: FAIL with "Cannot find module" for `./index` in `gathering-dots/`, `./index` in `effects/` and `./engine`.

- [ ] **Step 8: Write the effect, the registry and the engine**

Create `apps/mobile/src/scan/effects/gathering-dots/index.ts`:

```ts
import type { Effect } from '../types'
import { drawField } from './draw'
import { createField, type FieldState, stepField } from './field'

/** The dot field of the scan experience design, stage 1. */
export const gatheringDots: Effect<FieldState> = {
  id: 'gathering-dots',
  name: 'Gathering dots',
  family: 'simulation',
  create: createField,
  step: stepField,
  draw: drawField,
}
```

Create `apps/mobile/src/scan/effects/index.ts`:

```ts
import { gatheringDots } from './gathering-dots'
import type { AnyEffect } from './types'

// To add an effect, add its folder and one line here. The dev list keeps this order within a family.
export const EFFECTS: readonly AnyEffect[] = [gatheringDots]

/** A release build runs only this effect. */
export const DEFAULT_INDEX = 0
export const DEFAULT_EFFECT = EFFECTS[DEFAULT_INDEX]

export function effectAt(index: number): AnyEffect {
  'worklet'
  return Number.isInteger(index) && index >= 0 && index < EFFECTS.length ? EFFECTS[index] : DEFAULT_EFFECT
}

/** DEFAULT_INDEX for an unknown id, for example the saved id of a deleted effect. */
export function effectIndex(id: string | null): number {
  const index = EFFECTS.findIndex((effect) => effect.id === id)
  return index < 0 ? DEFAULT_INDEX : index
}

export function findEffect(id: string | null): AnyEffect {
  return EFFECTS[effectIndex(id)]
}
```

Create `apps/mobile/src/scan/effects/engine.ts`:

```ts
import type { Quad } from '../../scanner'
import type { ViewSize } from '../previewMapping'
import { createScene, type Scene, stepScene } from './scene'
import type { AnyEffect } from './types'

/** index: the effect index that state belongs to. */
export type Engine = { index: number; scene: Scene; state: unknown }

/**
 * One frame on the UI thread: the scene first, then the active effect. effect: effectAt(index).
 * A new view size gives a new scene and a new effect state. A new index gives a new effect state, and the scene stays.
 */
export function advance(
  engine: Engine | null,
  index: number,
  effect: AnyEffect,
  view: ViewSize,
  quad: Quad | null,
  t: number,
  reduceMotion: boolean,
): Engine {
  'worklet'
  if (engine == null || engine.scene.width !== view.width || engine.scene.height !== view.height) {
    const scene = stepScene(createScene(view), quad, t, reduceMotion)
    return { index, scene, state: effect.step(effect.create(scene), scene) }
  }
  const scene = stepScene(engine.scene, quad, t, reduceMotion)
  const state = engine.index === index ? engine.state : effect.create(scene)
  return { index, scene, state: effect.step(state, scene) }
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects/gathering-dots/index src/scan/effects/index src/scan/effects/engine`
Expected: PASS, 4 + 5 + 5 tests.

- [ ] **Step 10: Write the failing engine component test**

Create `apps/mobile/src/scan/effects/EffectCanvas.test.tsx`:

```tsx
import { createPicture } from '@shopify/react-native-skia'
import { render, screen } from '@testing-library/react-native'
import { type SharedValue, useFrameCallback, useReducedMotion } from 'react-native-reanimated'
import type { Quad } from '../../scanner'
import type { ViewSize } from '../previewMapping'
import { EffectCanvas } from './EffectCanvas'
import { DEFAULT_INDEX } from './index'

const frameCallback = jest.mocked(useFrameCallback)
const picture = jest.mocked(createPicture)
const reducedMotion = jest.mocked(useReducedMotion)

const VIEW = { width: 402, height: 874 }

/** A shared value stand-in. get() reads value, so a test can change value between frames with Object.assign. */
function shared<T>(value: T) {
  const holder = {
    value,
    get: () => holder.value,
    set: jest.fn((next: T) => {
      holder.value = next
    }),
  }
  return holder as unknown as SharedValue<T>
}

/** Runs the last registered frame callback at time t (seconds). */
function tick(t: number) {
  const callback = frameCallback.mock.calls.at(-1)![0]
  callback({ timestamp: t * 1000, timeSincePreviousFrame: 16, timeSinceFirstFrame: t * 1000 })
}

/** Draws the last recorded picture into a fake canvas. */
function lastFrame() {
  const draw = picture.mock.calls.at(-1)![0]
  const canvas = { drawAtlas: jest.fn(), drawPath: jest.fn(), drawRect: jest.fn() }
  draw(canvas as never)
  return canvas
}

function renderCanvas(view: ViewSize, effect = DEFAULT_INDEX, outline: Quad | null = null) {
  const props = { outline: shared(outline), view: shared(view), effect: shared(effect) }
  render(<EffectCanvas {...props} />)
  return props
}

beforeEach(() => {
  jest.clearAllMocks()
  reducedMotion.mockReturnValue(false)
})

describe('EffectCanvas', () => {
  it('draws on a canvas that ignores touches', () => {
    renderCanvas(VIEW)
    expect(screen.getByTestId('skia-canvas').props.pointerEvents).toBe('none')
    expect(screen.getByTestId('skia-picture')).toBeTruthy()
  })

  it('waits for the view size', () => {
    renderCanvas({ width: 0, height: 0 })
    picture.mockClear()
    tick(1)
    expect(picture).not.toHaveBeenCalled()
  })

  it('draws the gathering dots after the first frame', () => {
    renderCanvas(VIEW)
    tick(1)
    expect(lastFrame().drawAtlas.mock.calls[0][2]).toHaveLength(312)
  })

  it('rebuilds the effect when the view size changes', () => {
    const props = renderCanvas(VIEW)
    tick(1)
    Object.assign(props.view, { value: { width: 804, height: 874 } })
    tick(1.1)
    expect(lastFrame().drawAtlas.mock.calls[0][2]).toHaveLength(24 * 26)
  })

  it('runs the default effect for an index out of range', () => {
    renderCanvas(VIEW, 99)
    tick(1)
    expect(lastFrame().drawAtlas.mock.calls[0][2]).toHaveLength(312)
  })

  it('keeps the free dots still under Reduce Motion', () => {
    reducedMotion.mockReturnValue(true)
    renderCanvas(VIEW)
    tick(1)
    const before = lastFrame().drawAtlas.mock.calls[0][2]
    tick(5)
    expect(lastFrame().drawAtlas.mock.calls[0][2]).toEqual(before)
  })

  it('logs the effect id with the frame rate', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    renderCanvas(VIEW)
    for (let i = 0; i <= 62; i++) tick(1 + i / 60)
    await Promise.resolve()
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[fx\] gathering-dots \d+\.\d fps, overlay \d+\.\d\d ms$/))
    log.mockRestore()
  })
})
```

- [ ] **Step 11: Run the component test to verify it fails**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects/EffectCanvas`
Expected: FAIL with "Cannot find module './EffectCanvas'".

- [ ] **Step 12: Write `EffectCanvas.tsx`**

Create `apps/mobile/src/scan/effects/EffectCanvas.tsx`:

```tsx
import { Canvas, createPicture, Picture } from '@shopify/react-native-skia'
import { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { type SharedValue, useFrameCallback, useReducedMotion, useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import type { Quad } from '../../scanner'
import { countFrame, EMPTY_WINDOW } from '../frameRate'
import type { ViewSize } from '../previewMapping'
import { advance, type Engine } from './engine'
import { EFFECTS, effectAt } from './index'
import { makeDrawKit } from './kit'

function logOverlay(id: string, fps: number, overlayMs: number) {
  if (__DEV__) console.log(`[fx] ${id} ${fps.toFixed(1)} fps, overlay ${overlayMs.toFixed(2)} ms`)
}

/**
 * outline: the smoothed grid in view points, or null. view: the size of the camera view in points.
 * effect: an index into EFFECTS. Only the JS thread writes it, and only when the developer picks an effect.
 */
export function EffectCanvas({
  outline,
  view,
  effect,
}: {
  outline: SharedValue<Quad | null>
  view: SharedValue<ViewSize>
  effect: SharedValue<number>
}) {
  const reduceMotion = useReducedMotion()
  const kit = useMemo(() => makeDrawKit(EFFECTS), [])
  const empty = useMemo(
    () =>
      createPicture(() => {
        'worklet'
      }),
    [],
  )
  const engine = useSharedValue<Engine | null>(null)
  const picture = useSharedValue(empty)
  const timing = useSharedValue(EMPTY_WINDOW)

  useFrameCallback((frame) => {
    'worklet'
    const size = view.get()
    if (size.width <= 0 || size.height <= 0) return
    const t = frame.timestamp / 1000
    const started = Date.now()
    const index = effect.get()
    const active = effectAt(index)
    const quad = outline.get()
    engine.modify((current) => {
      'worklet'
      return advance(current, index, active, size, quad, t, reduceMotion)
    }, true)
    const now = engine.get()
    if (now == null) return
    picture.set(
      createPicture((canvas) => {
        'worklet'
        active.draw(canvas, now.state, now.scene, kit)
      }),
    )
    if (__DEV__) {
      const result = countFrame(timing.get(), t, Date.now() - started)
      timing.set(result.window)
      if (result.report !== null) scheduleOnRN(logOverlay, active.id, result.report.fps, result.report.detectionMs)
    }
  })

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  )
}
```

`Date.now()` has a resolution of 1 ms. The log gives the mean over one second, which is precise enough for the 4 ms budget.

- [ ] **Step 13: Run the component test to verify it passes**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects/EffectCanvas`
Expected: PASS, 7 tests.

- [ ] **Step 14: Change the camera screen test first**

In `apps/mobile/src/scan/CameraScreen.test.tsx`:

1. Replace `import { DotField } from './dots/DotField'` with:

```ts
import { DEFAULT_INDEX } from './effects'
import { EffectCanvas } from './effects/EffectCanvas'
```

2. Replace `jest.mock('./dots/DotField', () => ({ DotField: jest.fn(() => null) }))` with `jest.mock('./effects/EffectCanvas', () => ({ EffectCanvas: jest.fn(() => null) }))`.
3. Replace `const dotField = jest.mocked(DotField)` with `const effectCanvas = jest.mocked(EffectCanvas)`.
4. Replace every `dotField.mock.calls` with `effectCanvas.mock.calls` (three places).
5. Rename the test "gives the dot field the camera view size" to "gives the effect canvas the camera view size".
6. Add this test to the `describe('CameraScreen')` block:

```tsx
  it('starts the overlay on the default effect', () => {
    givenPermission('authorized')
    render(<CameraScreen />)
    expect(effectCanvas.mock.calls.at(-1)![0].effect.value).toBe(DEFAULT_INDEX)
  })
```

- [ ] **Step 15: Run the camera screen test to verify it fails**

Run: `cd apps/mobile && pnpm exec jest src/scan/CameraScreen`
Expected: FAIL. `EffectCanvas` is never rendered, so `effectCanvas.mock.calls.at(-1)` is undefined.

- [ ] **Step 16: Use `EffectCanvas` in `CameraScreen.tsx`**

In `apps/mobile/src/scan/CameraScreen.tsx`:

1. Replace `import { DotField } from './dots/DotField'` with:

```ts
import { DEFAULT_INDEX } from './effects'
import { EffectCanvas } from './effects/EffectCanvas'
```

2. Add `const effect = useSharedValue(DEFAULT_INDEX)` after `const outline = useSharedValue<Quad | null>(null)`.
3. Replace `<DotField outline={outline} view={viewSize} />` with `<EffectCanvas outline={outline} view={viewSize} effect={effect} />`.

Then delete the old component and the empty folder:

```bash
rm apps/mobile/src/scan/dots/DotField.tsx apps/mobile/src/scan/dots/DotField.test.tsx
rmdir apps/mobile/src/scan/dots
```

`rmdir` fails if a file is left in `dots/`. Every file in it moved in Tasks 2 and 3, so the folder is empty.

- [ ] **Step 17: Run all checks**

Run: `just test-ts && just typecheck && just lint && just boundaries && just bundle && just docs-check`
Expected: all pass. `just boundaries` confirms that `src/scan/effects/` reaches the scanner only through `src/scanner/index.ts`.

- [ ] **Step 18: Commit**

```bash
git add -A apps/mobile/src/scan
git commit -m "feat(app): draw the overlay through the effect engine, with gathering dots as the default (#20)"
```

---

### Task 4: Spotlight and brackets

The path family. A black dim outside the grid and an L-shaped bracket on each grid corner. The values come from the prototype, section 1, study "Spotlight and brackets" (overlay `combo`, in `Phone.render`):

| Value | Prototype | Here |
| --- | --- | --- |
| Dim outside the grid | `dark = vis * (0.3 + 0.22 * p)`, black, even-odd hole on the grid | `presence × (DIM_BASE + DIM_STEADY × p)`, `DIM_BASE = 0.3`, `DIM_STEADY = 0.22` |
| Bracket length, as a share of each edge from the corner | `frac = 0.12 + 0.38 * p * p` | `BRACKET_BASE + BRACKET_STEADY × p²`, `0.12` and `0.38` |
| Bracket stroke | `stroke="#fff"`, `stroke-width="2.6"`, round cap and join | white, `BRACKET_WIDTH = 2.6` prototype points × `prototypeScale(width)` |
| Bracket opacity | `br = vis` | `presence` |

The prototype draws nothing before a grid is found, so this effect has no search dim. In the steady state, `p` goes to 1: the dim goes from 30 % to 52 % and the brackets grow from 12 % to 50 % of each edge. That is the steady-state reaction.

**Files:**
- Create: `apps/mobile/src/scan/effects/spotlight-brackets/index.ts`, test `index.test.ts`
- Modify: `apps/mobile/src/scan/effects/index.ts` (one import, one line)
- Modify: `apps/mobile/src/scan/effects/EffectCanvas.test.tsx` (one test)

**Interfaces:**
- Consumes: `Effect`, `DrawKit` (Task 2), `drawDim`, `lockProgress`, `prototypeScale` (Task 2), `Scene` (Task 1), `EFFECTS`, `effectIndex` (Task 3).
- Produces: `spotlightBrackets: Effect<null>` with id `'spotlight-brackets'`. `bracketPath(quad: Quad, share: number): SkPath`. Constants `DIM_BASE`, `DIM_STEADY`, `BRACKET_BASE`, `BRACKET_STEADY`, `BRACKET_WIDTH`.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/scan/effects/spotlight-brackets/index.test.ts`:

```ts
import type { Quad } from '../../../scanner'
import { makeDrawKit } from '../kit'
import { createScene, type Scene, stepScene } from '../scene'
import {
  BRACKET_BASE,
  BRACKET_STEADY,
  BRACKET_WIDTH,
  bracketPath,
  DIM_BASE,
  DIM_STEADY,
  spotlightBrackets,
} from './index'

const VIEW = { width: 402, height: 874 }

const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

/** A scene with the grid found, at the given presence and motion. */
function sceneWith(presence: number, motion: number): Scene {
  return { ...stepScene(createScene(VIEW), grid, 0, false), presence, motion }
}

function fakeCanvas() {
  return { drawPath: jest.fn() }
}

const mocked = (paint: unknown) => paint as Record<string, jest.Mock>

describe('spotlightBrackets', () => {
  it('is the path effect with a stable id and no state', () => {
    const scene = sceneWith(1, 1)
    expect(spotlightBrackets.id).toBe('spotlight-brackets')
    expect(spotlightBrackets.name).toBe('Spotlight and brackets')
    expect(spotlightBrackets.family).toBe('path')
    expect(spotlightBrackets.create(scene)).toBeNull()
    expect(spotlightBrackets.step(null, scene)).toBeNull()
  })

  it('draws nothing before a grid is found', () => {
    const scene = stepScene(createScene(VIEW), null, 0, false)
    const canvas = fakeCanvas()
    spotlightBrackets.draw(canvas as never, null, scene, makeDrawKit([]))
    expect(canvas.drawPath).not.toHaveBeenCalled()
  })

  it('dims outside the grid and draws short brackets while the corners move', () => {
    const kit = makeDrawKit([])
    const canvas = fakeCanvas()
    spotlightBrackets.draw(canvas as never, null, sceneWith(1, 1), kit)
    expect(canvas.drawPath).toHaveBeenCalledTimes(2)
    const [hole, fill] = canvas.drawPath.mock.calls[0]
    expect(fill).toBe(kit.fill)
    expect(hole.calls).toContainEqual(['setFillType', 1])
    expect(mocked(kit.fill).setAlphaf).toHaveBeenCalledWith(DIM_BASE)
    const [brackets, stroke] = canvas.drawPath.mock.calls[1]
    expect(stroke).toBe(kit.stroke)
    expect(brackets.calls.filter((call: unknown[]) => call[0] === 'moveTo')).toHaveLength(4)
    expect(brackets.calls[0]).toEqual(['moveTo', 50, 300 + 300 * BRACKET_BASE])
  })

  it('deepens the dim and grows the brackets when the corners hold still', () => {
    const kit = makeDrawKit([])
    const canvas = fakeCanvas()
    spotlightBrackets.draw(canvas as never, null, sceneWith(1, 0), kit)
    expect(mocked(kit.fill).setAlphaf).toHaveBeenCalledWith(DIM_BASE + DIM_STEADY)
    const brackets = canvas.drawPath.mock.calls[1][0]
    expect(brackets.calls[0]).toEqual(['moveTo', 50, 300 + 300 * (BRACKET_BASE + BRACKET_STEADY)])
  })

  it('fades the dim and the brackets in with the presence', () => {
    const kit = makeDrawKit([])
    spotlightBrackets.draw(fakeCanvas() as never, null, sceneWith(0.5, 1), kit)
    expect(mocked(kit.fill).setAlphaf).toHaveBeenCalledWith(0.5 * DIM_BASE)
    expect(mocked(kit.stroke).setAlphaf).toHaveBeenCalledWith(0.5)
  })

  it('scales the bracket stroke from the prototype phone to the view', () => {
    const kit = makeDrawKit([])
    spotlightBrackets.draw(fakeCanvas() as never, null, sceneWith(1, 1), kit)
    expect(mocked(kit.stroke).setStrokeWidth.mock.calls[0][0]).toBeCloseTo((BRACKET_WIDTH * 402) / 220, 9)
  })
})

describe('bracketPath', () => {
  it('draws an L on each corner, along both edges', () => {
    const path = bracketPath(grid, 0.5) as unknown as { calls: unknown[][] }
    expect(path.calls.slice(0, 3)).toEqual([
      ['moveTo', 50, 450],
      ['lineTo', 50, 300],
      ['lineTo', 200, 300],
    ])
    expect(path.calls).toHaveLength(12)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects/spotlight-brackets`
Expected: FAIL with "Cannot find module './index'".

- [ ] **Step 3: Write the effect**

Create `apps/mobile/src/scan/effects/spotlight-brackets/index.ts`:

```ts
import { type SkCanvas, Skia } from '@shopify/react-native-skia'
import type { Quad } from '../../../scanner'
import { drawDim } from '../common/dim'
import { lockProgress } from '../common/lock'
import { prototypeScale } from '../common/shaderMatrix'
import type { Scene } from '../scene'
import type { DrawKit, Effect } from '../types'

// Prototype section 1, "Spotlight and brackets". p is lockProgress(scene).
/** Dim outside the grid: presence × (DIM_BASE + DIM_STEADY × p). */
export const DIM_BASE = 0.3
export const DIM_STEADY = 0.22
/** Bracket length as a share of each edge: BRACKET_BASE + BRACKET_STEADY × p². */
export const BRACKET_BASE = 0.12
export const BRACKET_STEADY = 0.38
/** Prototype points. */
export const BRACKET_WIDTH = 2.6

/** One L per corner: share of the edge to the previous corner, the corner, share of the edge to the next corner. */
export function bracketPath(quad: Quad, share: number) {
  'worklet'
  const path = Skia.Path.Make()
  for (let i = 0; i < 4; i++) {
    const c = quad[i]
    const a = quad[(i + 3) % 4]
    const b = quad[(i + 1) % 4]
    path.moveTo(c.x + (a.x - c.x) * share, c.y + (a.y - c.y) * share)
    path.lineTo(c.x, c.y)
    path.lineTo(c.x + (b.x - c.x) * share, c.y + (b.y - c.y) * share)
  }
  return path
}

function create(): null {
  'worklet'
  return null
}

function step(state: null): null {
  'worklet'
  return state
}

function draw(canvas: SkCanvas, _state: null, scene: Scene, kit: DrawKit): void {
  'worklet'
  const quad = scene.lastQuad
  if (quad == null || scene.presence <= 0) return
  const p = lockProgress(scene)
  drawDim(canvas, kit.fill, scene.width, scene.height, quad, scene.presence * (DIM_BASE + DIM_STEADY * p))
  kit.stroke.setColor(Skia.Color('#ffffff'))
  kit.stroke.setAlphaf(scene.presence)
  kit.stroke.setStrokeWidth(BRACKET_WIDTH * prototypeScale(scene.width))
  canvas.drawPath(bracketPath(quad, BRACKET_BASE + BRACKET_STEADY * p * p), kit.stroke)
}

export const spotlightBrackets: Effect<null> = {
  id: 'spotlight-brackets',
  name: 'Spotlight and brackets',
  family: 'path',
  create,
  step,
  draw,
}
```

- [ ] **Step 4: Register the effect**

In `apps/mobile/src/scan/effects/index.ts`:

1. Add `import { spotlightBrackets } from './spotlight-brackets'` below the `gatheringDots` import.
2. Change the list to `export const EFFECTS: readonly AnyEffect[] = [gatheringDots, spotlightBrackets]`.

- [ ] **Step 5: Add the switch test to the engine component**

In `apps/mobile/src/scan/effects/EffectCanvas.test.tsx`:

1. Change the registry import to `import { DEFAULT_INDEX, effectIndex } from './index'`.
2. Add this constant below `VIEW`:

```tsx
const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]
```

3. Add this test to the `describe('EffectCanvas')` block:

```tsx
  it('switches to another effect on the next frame and draws nothing of the old one', () => {
    const props = renderCanvas(VIEW, DEFAULT_INDEX, grid)
    tick(1)
    expect(lastFrame().drawAtlas).toHaveBeenCalledTimes(1)
    Object.assign(props.effect, { value: effectIndex('spotlight-brackets') })
    tick(1 + 1 / 60)
    const canvas = lastFrame()
    expect(canvas.drawAtlas).not.toHaveBeenCalled()
    expect(canvas.drawPath).toHaveBeenCalledTimes(2)
  })
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects`
Expected: PASS. The spotlight test has 7 tests. `EffectCanvas` has 8.

- [ ] **Step 7: Run all checks**

Run: `just test-ts && just typecheck && just lint && just boundaries && just bundle && just docs-check`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/scan/effects
git commit -m "feat(app): add the spotlight and brackets effect (#20)"
```

---

### Task 5: Grid lattice

The shader family. Faint cell lines and box lines on the paper, a light band that sweeps over the grid, and a dim outside. The SkSL is a port of the prototype, section 1b, `FRAG` with `uKind == 0`. Every number in the shader comes from that source.

**What changed in the port:**

| GLSL in the prototype | SkSL here | Reason |
| --- | --- | --- |
| `vec2 px = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr` | `main(float2 pos)`, `pos` in view points | Skia gives the local position, top-left origin |
| `uniform mat3 uM` | `uniform float3x3 uInv` | The same matrix: view points to the unit square. `toColumnMajor` gives the 9 floats |
| `fwidth(uv)` | `(abs(ddx) + abs(ddy)) * uPixel` | Runtime SkSL has no `fwidth`. `ddx`, `ddy` are the columns of the Jacobian of `uv = (uInv · (pos, 1)).xy / z` |
| `fwidth` per device pixel at density 2 | `uPixel = prototypePixel(width)` | So line widths match the prototype at the scale of the view |
| `uVis` | `uVis = presence` | |
| `o = vec4(C, A + D * (1 - A))` with `C = pc * (A / la)` | `half4(half3(0.88, 0.94, 1.0) * A, A + D * (1 - A))` | The same premultiplied colour. `pc / la` is the constant colour |
| `uRes`, `uDpr`, `uKind` | removed | Not needed for one kind in view points |

The Jacobian: with `h = uInv · (x, y, 1)` and `uv = h.xy / h.z`, the derivative along x is `(uInv[0].xy − uv · uInv[0].z) / h.z`, and along y it is `(uInv[1].xy − uv · uInv[1].z) / h.z`. `uInv[0]` is the first column of the matrix.

**Uniforms, in declaration order (14 floats):**

| Uniform | Floats | Unit | Value |
| --- | --- | --- | --- |
| `uInv` | 9 | view points → unit square | `toColumnMajor(gridInverse(scene))` |
| `uPixel` | 1 | view points | `prototypePixel(scene.width)` |
| `uTime` | 1 | seconds | `effectTime(clock, scene)`, 0 under Reduce Motion |
| `uVis` | 1 | 0..1 | `scene.presence` |
| `uP` | 1 | 0..1 | `lockProgress(scene)` |
| `uLockT` | 1 | seconds, or −1 | `lockTime(scene)`, −1 under Reduce Motion |

**Test strategy:** the shader cannot run in Jest. So:

1. `latticeUniforms` is a pure worklet. Jest checks the order, the length and the Reduce Motion values.
2. `draw` runs on a fake canvas with the mocked `RuntimeEffect`. Jest checks one `makeShader`, one `setShader` and one `drawRect` over the view.
3. `shader.test.ts` compiles `LATTICE_SKSL` with CanvasKit, the WebAssembly build of Skia, in Jest. It checks that the uniform float count equals the length of `latticeUniforms`. This runs in `just test-ts`, not in `just bundle`, because Metro does not compile SkSL. The device check (Task 10) confirms that the native Skia compiles it too: a compile error gives an `[fx] grid-lattice shader failed` line in the Metro log.

**Files:**
- Create: `apps/mobile/src/scan/effects/common/compileSkSL.js`
- Create: `apps/mobile/src/scan/effects/grid-lattice/shader.ts`, test `shader.test.ts`
- Create: `apps/mobile/src/scan/effects/grid-lattice/uniforms.ts`
- Create: `apps/mobile/src/scan/effects/grid-lattice/index.ts`, test `index.test.ts`
- Modify: `apps/mobile/src/scan/effects/index.ts` (one import, one line)
- Modify: `apps/mobile/src/scan/effects/EffectCanvas.test.tsx` (two tests)

**Interfaces:**
- Consumes: `Clock`, `createClock`, `effectTime`, `gridInverse`, `toColumnMajor`, `prototypePixel`, `lockProgress`, `lockTime`, `IDENTITY` (Task 2). `makeDrawKit` (Task 2). `Scene` (Task 1).
- Produces:
  - `LATTICE_SKSL: string`
  - `latticeUniforms(scene: Scene, inverse: Homography, time: number): number[]` (14 floats)
  - `gridLattice: Effect<Clock>` with id `'grid-lattice'` and `sksl: LATTICE_SKSL`
  - `compileSkSL(source: string): Promise<{ error: string; floats: number }>` (tests only)

- [ ] **Step 1: Write the test-only SkSL compiler**

Create `apps/mobile/src/scan/effects/common/compileSkSL.js`:

```js
// Tests only. Loads CanvasKit, the WebAssembly build of Skia that React Native Skia depends on, so Jest can compile SkSL.
// Run it in a test file with the docblock `@jest-environment node`.
const { TextDecoder } = require('node:util')
const path = require('node:path')

let loading = null

/** Resolves to { error, floats }. error: '' when the source compiles. floats: the uniform float count, or -1. */
function compileSkSL(source) {
  if (loading == null) {
    const skia = path.dirname(require.resolve('@shopify/react-native-skia/package.json'))
    const init = require(require.resolve('canvaskit-wasm/bin/full/canvaskit', { paths: [skia] }))
    // The TextDecoder of the Expo runtime refuses the encoding label that CanvasKit asks for.
    globalThis.TextDecoder = TextDecoder
    loading = init({})
  }
  return loading.then((kit) => {
    let error = ''
    const effect = kit.RuntimeEffect.Make(source, (message) => {
      error = message
    })
    return { error, floats: effect == null ? -1 : effect.getUniformFloatCount() }
  })
}

module.exports = { compileSkSL }
```

`canvaskit-wasm` is not a direct dependency of the app. pnpm installs it for React Native Skia, so the file resolves it from the folder of `@shopify/react-native-skia`.

- [ ] **Step 2: Write the failing tests**

Create `apps/mobile/src/scan/effects/grid-lattice/shader.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { compileSkSL } from '../common/compileSkSL'
import { IDENTITY } from '../common/shaderMatrix'
import { createScene } from '../scene'
import { LATTICE_SKSL } from './shader'
import { latticeUniforms } from './uniforms'

describe('LATTICE_SKSL', () => {
  it('compiles as a Skia runtime shader with one float for each uniform value', async () => {
    const result = await compileSkSL(LATTICE_SKSL)
    expect(result.error).toBe('')
    expect(result.floats).toBe(latticeUniforms(createScene({ width: 402, height: 874 }), IDENTITY, 0).length)
  })

  it('has no fwidth, which runtime shaders do not support', async () => {
    expect(LATTICE_SKSL).not.toContain('fwidth')
    const result = await compileSkSL('half4 main(float2 p) { return fwidth(p).xyxy; }')
    expect(result.error).toContain('fwidth')
  })
})
```

Create `apps/mobile/src/scan/effects/grid-lattice/index.test.ts`:

```ts
import type { Quad } from '../../../scanner'
import { IDENTITY, prototypePixel, toColumnMajor } from '../common/shaderMatrix'
import { makeDrawKit } from '../kit'
import { createScene, type Scene, stepScene } from '../scene'
import { gridLattice } from './index'
import { LATTICE_SKSL } from './shader'
import { latticeUniforms } from './uniforms'

const VIEW = { width: 402, height: 874 }

const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

/** A scene one second after the grid was found, so presence is 1. */
function found(): Scene {
  const scene = createScene(VIEW)
  for (let t = 0; t <= 1; t += 1 / 60) stepScene(scene, grid, t, false)
  return scene
}

function fakeCanvas() {
  return { drawRect: jest.fn() }
}

type MockShaderEffect = { makeShader: jest.Mock }

beforeEach(() => jest.clearAllMocks())

describe('latticeUniforms', () => {
  it('gives the 14 floats in the order of the shader uniforms', () => {
    const scene = found()
    const u = latticeUniforms(scene, scene.inverse!, 2.5)
    expect(u).toHaveLength(14)
    expect(u.slice(0, 9)).toEqual(toColumnMajor(scene.inverse!))
    expect(u[9]).toBe(prototypePixel(402))
    expect(u[10]).toBe(2.5)
    expect(u[11]).toBe(scene.presence)
    expect(u[12]).toBe(scene.presence * (1 - scene.motion))
    expect(u[13]).toBe(-1)
  })

  it('gives the seconds since the scene became steady as the lock-on time', () => {
    const scene = { ...found(), steady: true, steadyAt: 0.25 }
    expect(latticeUniforms(scene, IDENTITY, 0)[13]).toBeCloseTo(scene.t - 0.25, 9)
  })

  it('stops the lock-on reaction under Reduce Motion', () => {
    const scene = { ...found(), reduceMotion: true, steady: true, steadyAt: 0.25 }
    expect(latticeUniforms(scene, IDENTITY, 0)[13]).toBe(-1)
  })
})

describe('gridLattice', () => {
  it('is the shader effect with a stable id and its SkSL', () => {
    expect(gridLattice.id).toBe('grid-lattice')
    expect(gridLattice.name).toBe('Grid lattice')
    expect(gridLattice.family).toBe('shader')
    expect(gridLattice.sksl).toBe(LATTICE_SKSL)
  })

  it('counts its shader time from its creation', () => {
    const scene = found()
    const clock = gridLattice.create(scene)
    expect(clock.start).toBe(scene.t)
    expect(gridLattice.step(clock, scene)).toBe(clock)
  })

  it('fills the view with the lattice shader in one draw call', () => {
    const scene = found()
    const kit = makeDrawKit([gridLattice])
    const canvas = fakeCanvas()
    gridLattice.draw(canvas as never, gridLattice.create(scene), scene, kit)
    const effect = kit.shaders['grid-lattice'] as unknown as MockShaderEffect
    expect(effect.makeShader).toHaveBeenCalledTimes(1)
    expect(effect.makeShader.mock.calls[0][0]).toHaveLength(14)
    expect((kit.shader as unknown as { setShader: jest.Mock }).setShader).toHaveBeenCalledWith(
      effect.makeShader.mock.results[0].value,
    )
    expect(canvas.drawRect).toHaveBeenCalledWith({ x: 0, y: 0, width: 402, height: 874 }, kit.shader)
  })

  it('stops its time under Reduce Motion', () => {
    const scene = found()
    const clock = gridLattice.create(scene)
    const kit = makeDrawKit([gridLattice])
    gridLattice.draw(fakeCanvas() as never, clock, { ...scene, t: scene.t + 2, reduceMotion: true }, kit)
    const effect = kit.shaders['grid-lattice'] as unknown as MockShaderEffect
    expect(effect.makeShader.mock.calls[0][0][10]).toBe(0)
  })

  it('draws nothing before a grid is found', () => {
    const scene = stepScene(createScene(VIEW), null, 0, false)
    const canvas = fakeCanvas()
    gridLattice.draw(canvas as never, gridLattice.create(scene), scene, makeDrawKit([gridLattice]))
    expect(canvas.drawRect).not.toHaveBeenCalled()
  })

  it('draws nothing when its shader did not compile', () => {
    const scene = found()
    const canvas = fakeCanvas()
    gridLattice.draw(canvas as never, gridLattice.create(scene), scene, makeDrawKit([]))
    expect(canvas.drawRect).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects/grid-lattice`
Expected: FAIL with "Cannot find module './shader'" and "Cannot find module './index'".

- [ ] **Step 4: Write the shader source**

Create `apps/mobile/src/scan/effects/grid-lattice/shader.ts`:

```ts
// Prototype section 1b, "Grid lattice" (FRAG, uKind == 0), ported from GLSL to SkSL.
// Runtime SkSL has no fwidth. The size of one prototype pixel in grid units comes from the Jacobian of uInv at the pixel.
// Uniforms, in order: uInv (view points to the unit square), uPixel (view points per prototype pixel), uTime (s),
// uVis (0..1), uP (0..1), uLockT (s, or -1). latticeUniforms builds them in this order.
export const LATTICE_SKSL = `
uniform float3x3 uInv;
uniform float uPixel;
uniform float uTime;
uniform float uVis;
uniform float uP;
uniform float uLockT;

half4 main(float2 pos) {
  float3 h = uInv * float3(pos, 1.0);
  float2 uv = h.xy / h.z;
  float2 ddx = (uInv[0].xy - uv * uInv[0].z) / h.z;
  float2 ddy = (uInv[1].xy - uv * uInv[1].z) / h.z;
  float2 fw = max((abs(ddx) + abs(ddy)) * uPixel, float2(1e-5));
  float pxs = max(fw.x, fw.y);
  float e = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float inside = step(0.0, e);
  float ed = e / pxs;
  float outside = 1.0 - smoothstep(-1.0, 1.0, ed);
  float lockF = uLockT < 0.0 ? 0.0 : exp(-uLockT * 3.0);
  float2 d9 = abs(fract(uv * 9.0 + 0.5) - 0.5) / (fw * 9.0);
  float2 d3 = abs(fract(uv * 3.0 + 0.5) - 0.5) / (fw * 3.0);
  float border = 1.0 - smoothstep(0.5, 1.6, abs(ed));
  float dim = outside * (0.28 + 0.22 * uP);
  float thin = 1.0 - smoothstep(0.35, 1.3, min(d9.x, d9.y));
  float thick = 1.0 - smoothstep(0.8, 1.9, min(d3.x, d3.y));
  float lines = max(thin * 0.5, thick) * inside;
  float w = fract(uTime * 0.42) * 1.6 - 0.3;
  float bd = ((uv.x + uv.y) * 0.5 - w) / 0.07;
  float band = exp(-bd * bd);
  float la = lines * (0.1 + 0.35 * uP + 0.85 * band * (1.0 - 0.5 * uP) + 0.9 * lockF);
  la += inside * (0.05 * band + 0.12 * lockF);
  la = max(la, border * (0.45 + 0.55 * uP));
  float A = clamp(la, 0.0, 1.0) * uVis;
  float D = clamp(dim, 0.0, 1.0) * uVis;
  return half4(half3(0.88, 0.94, 1.0) * A, A + D * (1.0 - A));
}
`
```

This exact source compiled in CanvasKit 0.41.0 with 14 uniform floats when this plan was written.

- [ ] **Step 5: Write the uniform builder and the effect**

Create `apps/mobile/src/scan/effects/grid-lattice/uniforms.ts`:

```ts
import type { Homography } from '../common/geometry'
import { lockProgress, lockTime } from '../common/lock'
import { prototypePixel, toColumnMajor } from '../common/shaderMatrix'
import type { Scene } from '../scene'

/** The 14 floats of LATTICE_SKSL, in its uniform order. inverse: view points to the unit square. time: from effectTime. */
export function latticeUniforms(scene: Scene, inverse: Homography, time: number): number[] {
  'worklet'
  const uniforms = toColumnMajor(inverse)
  uniforms.push(
    prototypePixel(scene.width),
    time,
    scene.presence,
    lockProgress(scene),
    scene.reduceMotion ? -1 : lockTime(scene),
  )
  return uniforms
}
```

Create `apps/mobile/src/scan/effects/grid-lattice/index.ts`:

```ts
import { type SkCanvas, Skia } from '@shopify/react-native-skia'
import { type Clock, createClock, effectTime } from '../common/clock'
import { gridInverse } from '../common/shaderMatrix'
import type { Scene } from '../scene'
import type { DrawKit, Effect } from '../types'
import { LATTICE_SKSL } from './shader'
import { latticeUniforms } from './uniforms'

const ID = 'grid-lattice'

function step(state: Clock): Clock {
  'worklet'
  return state
}

function draw(canvas: SkCanvas, state: Clock, scene: Scene, kit: DrawKit): void {
  'worklet'
  const effect = kit.shaders[ID]
  const inverse = gridInverse(scene)
  if (effect == null || inverse == null || scene.presence <= 0) return
  kit.shader.setShader(effect.makeShader(latticeUniforms(scene, inverse, effectTime(state, scene))))
  canvas.drawRect(Skia.XYWHRect(0, 0, scene.width, scene.height), kit.shader)
}

export const gridLattice: Effect<Clock> = {
  id: ID,
  name: 'Grid lattice',
  family: 'shader',
  sksl: LATTICE_SKSL,
  create: createClock,
  step,
  draw,
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects/grid-lattice`
Expected: PASS, 2 + 9 tests.

- [ ] **Step 7: Register the effect and test it in the engine component**

In `apps/mobile/src/scan/effects/index.ts`:

1. Add `import { gridLattice } from './grid-lattice'` above the `spotlightBrackets` import.
2. Change the list to `export const EFFECTS: readonly AnyEffect[] = [gatheringDots, spotlightBrackets, gridLattice]`.

In `apps/mobile/src/scan/effects/EffectCanvas.test.tsx`:

1. Change the Skia import to `import { createPicture, Skia } from '@shopify/react-native-skia'`.
2. Add these tests to the `describe('EffectCanvas')` block:

```tsx
  it('fills the view with the lattice once a grid is found', () => {
    renderCanvas(VIEW, effectIndex('grid-lattice'), grid)
    tick(1)
    tick(1 + 1 / 60)
    expect(lastFrame().drawRect).toHaveBeenCalledTimes(1)
  })

  it('draws nothing for an effect whose shader did not compile, and logs the error', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.mocked(Skia.RuntimeEffect.Make).mockImplementationOnce(() => {
      throw new Error('Error in sksl: bad')
    })
    renderCanvas(VIEW, effectIndex('grid-lattice'), grid)
    tick(1)
    tick(1 + 1 / 60)
    expect(lastFrame().drawRect).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith('[fx] grid-lattice shader failed: Error in sksl: bad')
    log.mockRestore()
  })
```

The lattice is the first effect with `sksl` in `EFFECTS`, so `mockImplementationOnce` hits its compile.

- [ ] **Step 8: Run all checks**

Run: `just test-ts && just typecheck && just lint && just boundaries && just bundle && just docs-check`
Expected: all pass. `just typecheck` accepts `compileSkSL.js` because the Expo base config sets `allowJs` without `checkJs`.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/scan/effects
git commit -m "feat(app): add the grid lattice shader effect (#20)"
```

---

### Task 6: Ripples

The screen family. A fixed screen of dots over the view on a dim. When a grid is found, the dots outside it swell in waves that move out from the grid edge. The SkSL is a port of the prototype, section 1c, `AMB_BG` with `uBg == 3`. Every number comes from that source.

**What changed in the port:**

| GLSL in the prototype | SkSL here | Reason |
| --- | --- | --- |
| `px` in prototype points | `float2 px = pos / uScale` | The dot screen keeps the prototype spacing of 10 prototype points, scaled to the view |
| `fwidth(uv)` | the Jacobian of `uInv`, times `uPixel` | As in Task 5 |
| `uDet = smooth((t - 0.9) / 0.4)` (the detection fade-in) | `uDet = presence` | Presence also fades in over 0.4 s |
| `uFade` (the end fade of the prototype loop) | removed | The live view has no end |
| `uMf`, `uRes`, `uDpr`, `uBg` | removed | Not needed for one kind in view points |

Before any grid, the effect passes `IDENTITY` as `uInv`. With `uDet = 0`, the grid terms are 0, and the view shows the plain dot screen under a 30 % dim.

**Uniforms, in declaration order (15 floats):**

| Uniform | Floats | Unit | Value |
| --- | --- | --- | --- |
| `uInv` | 9 | view points → unit square | `toColumnMajor(gridInverse(scene) ?? IDENTITY)` |
| `uPixel` | 1 | view points | `prototypePixel(scene.width)` |
| `uScale` | 1 | view points per prototype point | `prototypeScale(scene.width)` |
| `uTime` | 1 | seconds | `effectTime(clock, scene)`, 0 under Reduce Motion |
| `uDet` | 1 | 0..1 | `scene.presence` |
| `uP` | 1 | 0..1 | `lockProgress(scene)` |
| `uLockT` | 1 | seconds, or −1 | `lockTime(scene)`, −1 under Reduce Motion, so the burst ring does not move |

**Test strategy:** the same as Task 5. The compile check runs in `just test-ts`. The device check confirms the native compile.

**Files:**
- Create: `apps/mobile/src/scan/effects/ripples/shader.ts`, test `shader.test.ts`
- Create: `apps/mobile/src/scan/effects/ripples/uniforms.ts`
- Create: `apps/mobile/src/scan/effects/ripples/index.ts`, test `index.test.ts`
- Modify: `apps/mobile/src/scan/effects/index.ts` (one import, one line)

**Interfaces:**
- Consumes: as Task 5, plus `prototypeScale` and `compileSkSL` (Task 5).
- Produces:
  - `RIPPLES_SKSL: string`
  - `rippleUniforms(scene: Scene, inverse: Homography, time: number): number[]` (15 floats)
  - `ripples: Effect<Clock>` with id `'ripples'` and `sksl: RIPPLES_SKSL`

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/src/scan/effects/ripples/shader.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { compileSkSL } from '../common/compileSkSL'
import { IDENTITY } from '../common/shaderMatrix'
import { createScene } from '../scene'
import { RIPPLES_SKSL } from './shader'
import { rippleUniforms } from './uniforms'

describe('RIPPLES_SKSL', () => {
  it('compiles as a Skia runtime shader with one float for each uniform value', async () => {
    const result = await compileSkSL(RIPPLES_SKSL)
    expect(result.error).toBe('')
    expect(result.floats).toBe(rippleUniforms(createScene({ width: 402, height: 874 }), IDENTITY, 0).length)
  })
})
```

Create `apps/mobile/src/scan/effects/ripples/index.test.ts`:

```ts
import type { Quad } from '../../../scanner'
import { IDENTITY, prototypePixel, prototypeScale, toColumnMajor } from '../common/shaderMatrix'
import { makeDrawKit } from '../kit'
import { createScene, type Scene, stepScene } from '../scene'
import { ripples } from './index'
import { RIPPLES_SKSL } from './shader'
import { rippleUniforms } from './uniforms'

const VIEW = { width: 402, height: 874 }

const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

/** A scene one second after the grid was found, so presence is 1. */
function found(): Scene {
  const scene = createScene(VIEW)
  for (let t = 0; t <= 1; t += 1 / 60) stepScene(scene, grid, t, false)
  return scene
}

function fakeCanvas() {
  return { drawRect: jest.fn() }
}

type MockShaderEffect = { makeShader: jest.Mock }

/** The uniforms of the one makeShader call of a draw. */
function drawnUniforms(scene: Scene) {
  const kit = makeDrawKit([ripples])
  const canvas = fakeCanvas()
  ripples.draw(canvas as never, ripples.create(scene), scene, kit)
  const effect = kit.shaders.ripples as unknown as MockShaderEffect
  return { canvas, kit, uniforms: effect.makeShader.mock.calls[0][0] as number[] }
}

beforeEach(() => jest.clearAllMocks())

describe('rippleUniforms', () => {
  it('gives the 15 floats in the order of the shader uniforms', () => {
    const scene = found()
    const u = rippleUniforms(scene, scene.inverse!, 2.5)
    expect(u).toHaveLength(15)
    expect(u.slice(0, 9)).toEqual(toColumnMajor(scene.inverse!))
    expect(u[9]).toBe(prototypePixel(402))
    expect(u[10]).toBe(prototypeScale(402))
    expect(u[11]).toBe(2.5)
    expect(u[12]).toBe(scene.presence)
    expect(u[13]).toBe(scene.presence * (1 - scene.motion))
    expect(u[14]).toBe(-1)
  })

  it('stops the burst ring under Reduce Motion', () => {
    const scene = { ...found(), reduceMotion: true, steady: true, steadyAt: 0.25 }
    expect(rippleUniforms(scene, IDENTITY, 0)[14]).toBe(-1)
  })
})

describe('ripples', () => {
  it('is the screen effect with a stable id and its SkSL', () => {
    expect(ripples.id).toBe('ripples')
    expect(ripples.name).toBe('Ripples')
    expect(ripples.family).toBe('screen')
    expect(ripples.sksl).toBe(RIPPLES_SKSL)
    const scene = found()
    const clock = ripples.create(scene)
    expect(clock.start).toBe(scene.t)
    expect(ripples.step(clock, scene)).toBe(clock)
  })

  it('draws the plain dot screen while searching', () => {
    const scene = stepScene(createScene(VIEW), null, 0, false)
    const { canvas, kit, uniforms } = drawnUniforms(scene)
    expect(uniforms.slice(0, 9)).toEqual(toColumnMajor(IDENTITY))
    expect(uniforms[12]).toBe(0)
    expect(canvas.drawRect).toHaveBeenCalledWith({ x: 0, y: 0, width: 402, height: 874 }, kit.shader)
  })

  it('sends the waves out from the grid once it is found', () => {
    const scene = found()
    const { uniforms } = drawnUniforms(scene)
    expect(uniforms.slice(0, 9)).toEqual(toColumnMajor(scene.inverse!))
    expect(uniforms[12]).toBe(1)
  })

  it('stops its time under Reduce Motion', () => {
    const scene = found()
    const kit = makeDrawKit([ripples])
    ripples.draw(fakeCanvas() as never, ripples.create(scene), { ...scene, t: scene.t + 2, reduceMotion: true }, kit)
    const effect = kit.shaders.ripples as unknown as MockShaderEffect
    expect(effect.makeShader.mock.calls[0][0][11]).toBe(0)
  })

  it('draws nothing when its shader did not compile', () => {
    const scene = found()
    const canvas = fakeCanvas()
    ripples.draw(canvas as never, ripples.create(scene), scene, makeDrawKit([]))
    expect(canvas.drawRect).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects/ripples`
Expected: FAIL with "Cannot find module './shader'" and "Cannot find module './index'".

- [ ] **Step 3: Write the shader source**

Create `apps/mobile/src/scan/effects/ripples/shader.ts`:

```ts
// Prototype section 1c, "Ripples" (AMB_BG, uBg == 3), ported from GLSL to SkSL.
// Runtime SkSL has no fwidth. The size of one prototype pixel in grid units comes from the Jacobian of uInv at the pixel.
// Uniforms, in order: uInv (view points to the unit square), uPixel (view points per prototype pixel),
// uScale (view points per prototype point), uTime (s), uDet (0..1), uP (0..1), uLockT (s, or -1). rippleUniforms builds them in this order.
export const RIPPLES_SKSL = `
uniform float3x3 uInv;
uniform float uPixel;
uniform float uScale;
uniform float uTime;
uniform float uDet;
uniform float uP;
uniform float uLockT;

float sdBox(float2 p, float2 b) {
  float2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

half4 main(float2 pos) {
  float2 px = pos / uScale;
  float3 h = uInv * float3(pos, 1.0);
  float2 uv = h.xy / h.z;
  float2 ddx = (uInv[0].xy - uv * uInv[0].z) / h.z;
  float2 ddy = (uInv[1].xy - uv * uInv[1].z) / h.z;
  float2 fw = max((abs(ddx) + abs(ddy)) * uPixel, float2(1e-5));
  float pxs = max(fw.x, fw.y);
  float sd = sdBox(uv - 0.5, float2(0.5));
  float edPx = -sd / pxs;
  float outside = 1.0 - smoothstep(-1.0, 1.0, edPx);
  float dimA = mix(0.3, outside * (0.5 + 0.1 * uP), uDet);
  float hide = 1.0 - uDet * (1.0 - outside);
  float S = 10.0;
  float d = length(fract(px / S) - 0.5) * S;
  float dout = max(-edPx, 0.0);
  float w = 0.5 + 0.5 * sin(dout * 0.22 - uTime * (13.0 + 13.0 * uP));
  float env = exp(-dout / 110.0) * uDet;
  float burst = 0.0;
  if (uLockT >= 0.0) {
    float rb = (dout - uLockT * 320.0) / 14.0;
    burst = exp(-rb * rb) * exp(-uLockT * 1.5);
  }
  float k = max(w * env, burst);
  float r = 0.7 + 1.9 * k;
  float dots = (1.0 - smoothstep(r - 0.5, r + 0.5, d)) * (0.22 + 0.55 * k) * hide;
  float A = clamp(dots, 0.0, 1.0);
  return half4(half3(A), A + dimA * (1.0 - A));
}
`
```

This exact source compiled in CanvasKit 0.41.0 with 15 uniform floats when this plan was written.

- [ ] **Step 4: Write the uniform builder and the effect**

Create `apps/mobile/src/scan/effects/ripples/uniforms.ts`:

```ts
import type { Homography } from '../common/geometry'
import { lockProgress, lockTime } from '../common/lock'
import { prototypePixel, prototypeScale, toColumnMajor } from '../common/shaderMatrix'
import type { Scene } from '../scene'

/** The 15 floats of RIPPLES_SKSL, in its uniform order. inverse: view points to the unit square. time: from effectTime. */
export function rippleUniforms(scene: Scene, inverse: Homography, time: number): number[] {
  'worklet'
  const uniforms = toColumnMajor(inverse)
  uniforms.push(
    prototypePixel(scene.width),
    prototypeScale(scene.width),
    time,
    scene.presence,
    lockProgress(scene),
    scene.reduceMotion ? -1 : lockTime(scene),
  )
  return uniforms
}
```

Create `apps/mobile/src/scan/effects/ripples/index.ts`:

```ts
import { type SkCanvas, Skia } from '@shopify/react-native-skia'
import { type Clock, createClock, effectTime } from '../common/clock'
import { gridInverse, IDENTITY } from '../common/shaderMatrix'
import type { Scene } from '../scene'
import type { DrawKit, Effect } from '../types'
import { RIPPLES_SKSL } from './shader'
import { rippleUniforms } from './uniforms'

const ID = 'ripples'

function step(state: Clock): Clock {
  'worklet'
  return state
}

function draw(canvas: SkCanvas, state: Clock, scene: Scene, kit: DrawKit): void {
  'worklet'
  const effect = kit.shaders[ID]
  if (effect == null) return
  // The dot screen shows before any grid. With presence 0 the shader ignores the matrix.
  const inverse = gridInverse(scene) ?? IDENTITY
  kit.shader.setShader(effect.makeShader(rippleUniforms(scene, inverse, effectTime(state, scene))))
  canvas.drawRect(Skia.XYWHRect(0, 0, scene.width, scene.height), kit.shader)
}

export const ripples: Effect<Clock> = {
  id: ID,
  name: 'Ripples',
  family: 'screen',
  sksl: RIPPLES_SKSL,
  create: createClock,
  step,
  draw,
}
```

- [ ] **Step 5: Register the effect**

In `apps/mobile/src/scan/effects/index.ts`:

1. Add `import { ripples } from './ripples'` below the `gridLattice` import.
2. Change the list to `export const EFFECTS: readonly AnyEffect[] = [gatheringDots, spotlightBrackets, gridLattice, ripples]`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects`
Expected: PASS. The ripples tests add 1 + 7.

- [ ] **Step 7: Run all checks**

Run: `just test-ts && just typecheck && just lint && just boundaries && just bundle && just docs-check`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/scan/effects
git commit -m "feat(app): add the ripples screen effect (#20)"
```

---

### Task 7: SettingsRepository on the expo-sqlite key-value store

Add expo-sqlite and the first repository of ADR-012. The repository has only `get` and `set`. An in-memory fake stands in for it in Jest.

**Files:**
- Modify: `apps/mobile/package.json`, `pnpm-lock.yaml` (and `apps/mobile/app.json` only if `expo install` changes it), through `pnpm exec expo install expo-sqlite`
- Create: `apps/mobile/src/settings/SettingsRepository.ts`, test `SettingsRepository.test.ts`
- Create: `apps/mobile/src/settings/memorySettings.ts`, test `memorySettings.test.ts`
- Modify: `apps/mobile/jest.setup.ts` (a mock for `expo-sqlite/kv-store`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type SettingsRepository = { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> }`
  - `type KeyValueStore = { getItemAsync(key: string): Promise<string | null>; setItemAsync(key: string, value: string): Promise<void> }`
  - `createSettingsRepository(store: KeyValueStore): SettingsRepository`
  - `kvSettings: SettingsRepository` (on the default `expo-sqlite/kv-store` instance)
  - `createMemorySettings(initial?: Record<string, string>): SettingsRepository`

- [ ] **Step 1: Add expo-sqlite and check its API**

Run: `cd apps/mobile && pnpm exec expo install expo-sqlite`
Expected: `apps/mobile/package.json` gets `"expo-sqlite"` with the version that fits SDK 57, and `pnpm-lock.yaml` changes.

These changes are intended. Commit them in Step 9. Do not revert them in the device check.

Then check the API in `node_modules`, because the plan took it from the docs:

```bash
grep -n '"./kv-store"' apps/mobile/node_modules/expo-sqlite/package.json
grep -n "getItemAsync\|setItemAsync" apps/mobile/node_modules/expo-sqlite/build/Storage.d.ts
grep -n "export default\|openDatabase" apps/mobile/node_modules/expo-sqlite/src/Storage.ts
```

Expected: the package exports `./kv-store`. `getItemAsync(key: string): Promise<string | null>` and `setItemAsync(key: string, value: …): Promise<void>` exist. The default export is a storage instance that opens its database on the first call, not on import. If the database opens on import, stop and tell the controller: a release build imports this module, and the spec says a release build reads no setting.

Open `apps/mobile/app.json`. Before this step it has no `plugins` key. If `expo install` added a `plugins` entry for `expo-sqlite`, keep it and tell the controller, so the commit in Step 9 includes it.

- [ ] **Step 2: Mock the key-value store in Jest**

Add this mock to `apps/mobile/jest.setup.ts`, after the `react-native-vision-camera-resizer` mock:

```ts
// The key-value store of expo-sqlite is native. This stand-in keeps the values in memory for one test file.
jest.mock('expo-sqlite/kv-store', () => {
  const mockItems = new Map<string, string>()
  return {
    __esModule: true,
    default: {
      getItemAsync: jest.fn(async (key: string) => mockItems.get(key) ?? null),
      setItemAsync: jest.fn(async (key: string, value: string) => {
        mockItems.set(key, value)
      }),
    },
  }
})
```

- [ ] **Step 3: Write the failing tests**

Create `apps/mobile/src/settings/SettingsRepository.test.ts`:

```ts
import Storage from 'expo-sqlite/kv-store'
import { createSettingsRepository, kvSettings } from './SettingsRepository'

function fakeStore() {
  return {
    getItemAsync: jest.fn(async (_key: string): Promise<string | null> => 'ripples'),
    setItemAsync: jest.fn(async (_key: string, _value: string) => undefined),
  }
}

describe('createSettingsRepository', () => {
  it('reads a key from the store', async () => {
    const store = fakeStore()
    await expect(createSettingsRepository(store).get('lab.effect')).resolves.toBe('ripples')
    expect(store.getItemAsync).toHaveBeenCalledWith('lab.effect')
  })

  it('writes a key to the store', async () => {
    const store = fakeStore()
    await createSettingsRepository(store).set('lab.effect', 'grid-lattice')
    expect(store.setItemAsync).toHaveBeenCalledWith('lab.effect', 'grid-lattice')
  })
})

describe('kvSettings', () => {
  it('gives null for a key that was never set', async () => {
    await expect(kvSettings.get('never-set')).resolves.toBeNull()
  })

  it('keeps a value in the expo-sqlite key-value store', async () => {
    await kvSettings.set('lab.effect', 'grid-lattice')
    await expect(kvSettings.get('lab.effect')).resolves.toBe('grid-lattice')
    expect(jest.mocked(Storage.setItemAsync)).toHaveBeenCalledWith('lab.effect', 'grid-lattice')
  })
})
```

Create `apps/mobile/src/settings/memorySettings.test.ts`:

```ts
import { createMemorySettings } from './memorySettings'

describe('createMemorySettings', () => {
  it('gives null for a key that was never set', async () => {
    await expect(createMemorySettings().get('lab.effect')).resolves.toBeNull()
  })

  it('gives back the value that was set', async () => {
    const settings = createMemorySettings()
    await settings.set('lab.effect', 'ripples')
    await expect(settings.get('lab.effect')).resolves.toBe('ripples')
  })

  it('starts with the given values', async () => {
    await expect(createMemorySettings({ 'lab.effect': 'grid-lattice' }).get('lab.effect')).resolves.toBe('grid-lattice')
  })

  it('keeps each instance apart', async () => {
    const a = createMemorySettings()
    await a.set('lab.effect', 'ripples')
    await expect(createMemorySettings().get('lab.effect')).resolves.toBeNull()
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd apps/mobile && pnpm exec jest src/settings`
Expected: FAIL with "Cannot find module './SettingsRepository'" and "Cannot find module './memorySettings'".

- [ ] **Step 5: Write the repository**

Create `apps/mobile/src/settings/SettingsRepository.ts`:

```ts
import Storage from 'expo-sqlite/kv-store'

/** App settings as string pairs (ADR-012). Screens use this interface, never the store. */
export type SettingsRepository = {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

/** The part of the expo-sqlite key-value store that settings use. */
export type KeyValueStore = {
  getItemAsync(key: string): Promise<string | null>
  setItemAsync(key: string, value: string): Promise<void>
}

export function createSettingsRepository(store: KeyValueStore): SettingsRepository {
  return {
    get: (key) => store.getItemAsync(key),
    set: (key, value) => store.setItemAsync(key, value),
  }
}

export const kvSettings: SettingsRepository = createSettingsRepository(Storage)
```

Create `apps/mobile/src/settings/memorySettings.ts`:

```ts
import type { SettingsRepository } from './SettingsRepository'

/** The in-memory fake of SettingsRepository for Jest (ADR-012). */
export function createMemorySettings(initial: Record<string, string> = {}): SettingsRepository {
  const items = new Map(Object.entries(initial))
  return {
    get: async (key) => items.get(key) ?? null,
    set: async (key, value) => {
      items.set(key, value)
    },
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/mobile && pnpm exec jest src/settings`
Expected: PASS, 4 + 4 tests.

- [ ] **Step 7: Run all checks**

Run: `just test-ts && just typecheck && just lint && just boundaries && just bundle && just docs-check`
Expected: all pass. If `just typecheck` says the `Storage` type does not match `KeyValueStore`, read `apps/mobile/node_modules/expo-sqlite/build/Storage.d.ts` and change only `KeyValueStore` to match the real signatures.

- [ ] **Step 8: Check the Expo setup**

Run: `cd apps/mobile && pnpm dlx expo-doctor`
Expected: no problem with `expo-sqlite`.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml apps/mobile/jest.setup.ts apps/mobile/src/settings
git add apps/mobile/app.json   # only if expo install changed it in Step 1
git commit -m "feat(app): add the settings repository on the expo-sqlite key-value store (#20)"
```

---

### Task 8: The dev pill and the saved choice

A pill at the top of the camera screen shows the name of the active effect. A tap opens the list of effects, grouped by family. A tap on an effect switches to it at once, closes the list and saves the effect id. On start, the pill reads the saved id back. Only a development build renders the pill.

**Files:**
- Create: `apps/mobile/src/scan/effects/EffectPicker.tsx`, test `EffectPicker.test.tsx`
- Modify: `apps/mobile/src/scan/CameraScreen.tsx`, `CameraScreen.test.tsx`

**Interfaces:**
- Consumes: `EFFECTS`, `DEFAULT_INDEX`, `effectIndex` (Task 3). `EffectFamily` (Task 2). `SettingsRepository`, `kvSettings`, `createMemorySettings` (Task 7). The `effect` shared value of `CameraScreen` (Task 3).
- Produces: `EFFECT_KEY = 'lab.effect'`. `EffectPicker({ effect, settings }: { effect: SharedValue<number>; settings: SettingsRepository })`. Test ids `effect-pill`, `effect-list`, `effect-<id>`.

- [ ] **Step 1: Write the failing picker test**

Create `apps/mobile/src/scan/effects/EffectPicker.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { SharedValue } from 'react-native-reanimated'
import { createMemorySettings } from '../../settings/memorySettings'
import type { SettingsRepository } from '../../settings/SettingsRepository'
import { EFFECT_KEY, EffectPicker } from './EffectPicker'
import { DEFAULT_INDEX, EFFECTS, effectIndex } from './index'

/** A shared value stand-in that the picker writes with set(). */
function shared(value: number) {
  const holder = {
    value,
    get: () => holder.value,
    set: jest.fn((next: number) => {
      holder.value = next
    }),
  }
  return holder as unknown as SharedValue<number>
}

/** Renders the picker and lets the saved choice load. */
async function renderPicker(settings: SettingsRepository) {
  const effect = shared(DEFAULT_INDEX)
  render(<EffectPicker effect={effect} settings={settings} />)
  await act(async () => {})
  return effect
}

describe('EffectPicker', () => {
  it('shows the name of the default effect', async () => {
    await renderPicker(createMemorySettings())
    expect(screen.getByText('Gathering dots')).toBeTruthy()
    expect(screen.queryByTestId('effect-list')).toBeNull()
  })

  it('lists every effect, grouped by family', async () => {
    await renderPicker(createMemorySettings())
    fireEvent.press(screen.getByTestId('effect-pill'))
    for (const effect of EFFECTS) expect(screen.getByTestId(`effect-${effect.id}`)).toBeTruthy()
    for (const family of ['Simulation', 'Path', 'Shader', 'Screen']) expect(screen.getByText(family)).toBeTruthy()
  })

  it('switches at once and closes the list', async () => {
    const effect = await renderPicker(createMemorySettings())
    fireEvent.press(screen.getByTestId('effect-pill'))
    fireEvent.press(screen.getByTestId('effect-ripples'))
    expect(effect.get()).toBe(effectIndex('ripples'))
    expect(screen.queryByTestId('effect-list')).toBeNull()
    expect(screen.getByText('Ripples')).toBeTruthy()
  })

  it('saves the choice', async () => {
    const settings = createMemorySettings()
    await renderPicker(settings)
    fireEvent.press(screen.getByTestId('effect-pill'))
    fireEvent.press(screen.getByTestId('effect-grid-lattice'))
    await act(async () => {})
    await expect(settings.get(EFFECT_KEY)).resolves.toBe('grid-lattice')
  })

  it('restores the saved choice on start', async () => {
    const effect = await renderPicker(createMemorySettings({ [EFFECT_KEY]: 'grid-lattice' }))
    expect(effect.get()).toBe(effectIndex('grid-lattice'))
    expect(screen.getByText('Grid lattice')).toBeTruthy()
  })

  it('runs the default effect for an unknown saved id', async () => {
    const effect = await renderPicker(createMemorySettings({ [EFFECT_KEY]: 'deleted-effect' }))
    expect(effect.get()).toBe(DEFAULT_INDEX)
    expect(screen.getByText('Gathering dots')).toBeTruthy()
  })

  it('runs the default effect and logs when the store fails', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    const failing: SettingsRepository = {
      get: () => Promise.reject(new Error('disk')),
      set: () => Promise.reject(new Error('disk')),
    }
    const effect = await renderPicker(failing)
    expect(effect.get()).toBe(DEFAULT_INDEX)
    fireEvent.press(screen.getByTestId('effect-pill'))
    fireEvent.press(screen.getByTestId('effect-ripples'))
    await act(async () => {})
    expect(effect.get()).toBe(effectIndex('ripples'))
    expect(log).toHaveBeenCalledWith('[fx] settings failed: disk')
    log.mockRestore()
  })

  it('keeps a pick made before the saved choice loads', async () => {
    let resolve: (id: string | null) => void = () => undefined
    const slow: SettingsRepository = {
      get: () =>
        new Promise<string | null>((done) => {
          resolve = done
        }),
      set: async () => undefined,
    }
    const effect = shared(DEFAULT_INDEX)
    render(<EffectPicker effect={effect} settings={slow} />)
    fireEvent.press(screen.getByTestId('effect-pill'))
    fireEvent.press(screen.getByTestId('effect-ripples'))
    await act(async () => {
      resolve('grid-lattice')
    })
    expect(effect.get()).toBe(effectIndex('ripples'))
    expect(screen.getByText('Ripples')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the picker test to verify it fails**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects/EffectPicker`
Expected: FAIL with "Cannot find module './EffectPicker'".

- [ ] **Step 3: Write `EffectPicker.tsx`**

Create `apps/mobile/src/scan/effects/EffectPicker.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import type { SettingsRepository } from '../../settings/SettingsRepository'
import { DEFAULT_INDEX, EFFECTS, effectIndex } from './index'
import type { EffectFamily } from './types'

/** The settings key of the saved effect id. */
export const EFFECT_KEY = 'lab.effect'

const FAMILIES: { family: EffectFamily; title: string }[] = [
  { family: 'simulation', title: 'Simulation' },
  { family: 'path', title: 'Path' },
  { family: 'shader', title: 'Shader' },
  { family: 'screen', title: 'Screen' },
]

function logSettingsError(error: unknown) {
  if (__DEV__) console.log(`[fx] settings failed: ${error instanceof Error ? error.message : String(error)}`)
}

/** The dev pill and the list of effects. Render it only in a development build. effect: the index that EffectCanvas reads. */
export function EffectPicker({ effect, settings }: { effect: SharedValue<number>; settings: SettingsRepository }) {
  const [index, setIndex] = useState(DEFAULT_INDEX)
  const [open, setOpen] = useState(false)
  // A pick before the saved choice loads wins, so a slow store does not undo it.
  const picked = useRef(false)

  useEffect(() => {
    let alive = true
    settings.get(EFFECT_KEY).then((id) => {
      if (!alive || picked.current) return
      const saved = effectIndex(id)
      effect.set(saved)
      setIndex(saved)
    }, logSettingsError)
    return () => {
      alive = false
    }
  }, [effect, settings])

  function pick(next: number) {
    picked.current = true
    effect.set(next)
    setIndex(next)
    setOpen(false)
    settings.set(EFFECT_KEY, EFFECTS[next].id).catch(logSettingsError)
  }

  return (
    <View style={styles.layer} pointerEvents="box-none">
      <Pressable
        testID="effect-pill"
        accessibilityRole="button"
        accessibilityLabel={`Effect: ${EFFECTS[index].name}`}
        style={styles.pill}
        onPress={() => setOpen(!open)}
      >
        <Text style={styles.pillText}>{EFFECTS[index].name}</Text>
      </Pressable>
      {open ? (
        <View testID="effect-list" style={styles.list}>
          {FAMILIES.filter(({ family }) => EFFECTS.some((fx) => fx.family === family)).map(({ family, title }) => (
            <View key={family}>
              <Text style={styles.family}>{title}</Text>
              {EFFECTS.map((fx, i) =>
                fx.family !== family ? null : (
                  <Pressable
                    key={fx.id}
                    testID={`effect-${fx.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: i === index }}
                    style={styles.row}
                    onPress={() => pick(i)}
                  >
                    <Text style={i === index ? styles.rowActive : styles.rowText}>{fx.name}</Text>
                  </Pressable>
                ),
              )}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', paddingTop: 60 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.6)' },
  pillText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  list: { marginTop: 8, padding: 12, minWidth: 240, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.8)' },
  family: { marginTop: 8, color: 'rgba(255,255,255,0.6)', fontSize: 12, textTransform: 'uppercase' },
  row: { paddingVertical: 8 },
  rowText: { color: '#ffffff', fontSize: 16 },
  rowActive: { color: '#ffd60a', fontSize: 16, fontWeight: '600' },
})
```

The family titles are plain text. `textTransform` shows them in capitals, and the test finds them by their plain text.

- [ ] **Step 4: Run the picker test to verify it passes**

Run: `cd apps/mobile && pnpm exec jest src/scan/effects/EffectPicker`
Expected: PASS, 8 tests.

- [ ] **Step 5: Change the camera screen test first**

In `apps/mobile/src/scan/CameraScreen.test.tsx`:

1. Add these imports:

```ts
import Storage from 'expo-sqlite/kv-store'
import { kvSettings } from '../settings/SettingsRepository'
import { EffectPicker } from './effects/EffectPicker'
```

2. Add `jest.mock('./effects/EffectPicker', () => ({ EffectPicker: jest.fn(() => null) }))` below the `EffectCanvas` mock.
3. Add `const effectPicker = jest.mocked(EffectPicker)` below `const effectCanvas = jest.mocked(EffectCanvas)`.
4. Add these tests at the end of the `describe('CameraScreen')` block:

```tsx
  it('shows the effect lab in a development build, on the same effect index as the canvas', () => {
    givenPermission('authorized')
    render(<CameraScreen />)
    const props = effectPicker.mock.calls.at(-1)![0]
    expect(props.effect).toBe(effectCanvas.mock.calls.at(-1)![0].effect)
    expect(props.settings).toBe(kvSettings)
  })

  describe('in a release build', () => {
    const dev = __DEV__
    beforeEach(() => Object.assign(globalThis, { __DEV__: false }))
    afterEach(() => Object.assign(globalThis, { __DEV__: dev }))

    it('shows no effect lab, reads no setting and runs the default effect', () => {
      givenPermission('authorized')
      render(<CameraScreen />)
      expect(effectPicker).not.toHaveBeenCalled()
      expect(jest.mocked(Storage.getItemAsync)).not.toHaveBeenCalled()
      expect(effectCanvas.mock.calls.at(-1)![0].effect.value).toBe(DEFAULT_INDEX)
    })
  })
```

- [ ] **Step 6: Run the camera screen test to verify it fails**

Run: `cd apps/mobile && pnpm exec jest src/scan/CameraScreen`
Expected: FAIL. "shows the effect lab in a development build" fails because `CameraScreen` does not render `EffectPicker`.

- [ ] **Step 7: Render the pill in `CameraScreen.tsx`**

In `apps/mobile/src/scan/CameraScreen.tsx`:

1. Add these imports:

```ts
import { kvSettings } from '../settings/SettingsRepository'
import { EffectPicker } from './effects/EffectPicker'
```

2. Below `<EffectCanvas outline={outline} view={viewSize} effect={effect} />`, add:

```tsx
      {__DEV__ ? <EffectPicker effect={effect} settings={kvSettings} /> : null}
```

In a release build, Metro replaces `__DEV__` with `false` and removes the pill. The `effect` shared value then stays at `DEFAULT_INDEX`.

- [ ] **Step 8: Run all checks**

Run: `just test-ts && just typecheck && just lint && just boundaries && just bundle && just docs-check`
Expected: all pass. If the release test cannot change `__DEV__` (the test fails with the picker still rendered), report it to the controller. Do not move the `__DEV__` check into a module constant, because a constant is read once at import.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/scan/effects/EffectPicker.tsx apps/mobile/src/scan/effects/EffectPicker.test.tsx apps/mobile/src/scan/CameraScreen.tsx apps/mobile/src/scan/CameraScreen.test.tsx
git commit -m "feat(app): add the dev pill that switches and remembers the overlay effect (#20)"
```

---

### Task 9: Documentation

ADR-014, the decision index, the glossary and the scan-pipeline concept.

**Files:**
- Create: `docs/architecture/adr/adr-014-overlay-effects.md`
- Modify: `docs/architecture/00-DECISIONS.md` (one row)
- Modify: `docs/architecture/09-architecture-decisions.md` (one row)
- Modify: `docs/architecture/12-glossary.md` (three rows changed, five rows added)
- Modify: `docs/architecture/00-concepts/scan-pipeline.md` (four places)

**Interfaces:**
- Consumes: the names from Tasks 1 to 8: `Scene`, `stepScene`, `EffectCanvas`, `EFFECTS`, `DEFAULT_EFFECT`, `SettingsRepository`, `lab.effect`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Write ADR-014**

Create `docs/architecture/adr/adr-014-overlay-effects.md`:

```markdown
---
status: DRAFT
---

# ADR-014: Scan overlay effects as plug-in modules, with an effect lab in development builds

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-11 |
| Contact | Felix      |

## Context

The live overlay on the camera screen shows the user that the app sees the grid
([scan pipeline](../00-concepts/scan-pipeline.md)). The prototype "Scan flow studies" has 21 live
overlay effects in four families: path, shader, screen and simulation. A browser shows them, but
the developer must judge them on the real camera, with real corners, real light and the frame
budget of the phone.

Before this decision, the dot field was the only overlay. It computed its own grid facts: found,
lost, jump, presence and motion. A second effect would repeat that code. The
[effect lab design](../../superpowers/specs/2026-10-11-effect-lab-design.md) gives the full
reasoning.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| One React component per effect | Simple to start | Each component repeats the grid facts and the frame callback. A switch mounts a new canvas and loses the grid state |
| One shader with an effect index | One draw call | Fits only the shader family. Path and simulation effects cannot live in one shader. One compile error stops every effect |
| **Effect modules on one engine and one scene** | The grid facts are computed once. An effect is one folder and one line. A switch keeps the scene | A small framework to keep: the effect interface, the draw kit and the registry |

## Decision

1. An effect is a module with three worklets: `create`, `step` and `draw`
   (`src/scan/effects/types.ts`). An effect reads the scene. It never changes the scene.
2. `stepScene` computes the grid facts once per frame on the UI thread: the grid and its
   matrices, the found and lost events, presence, motion and the steady state.
3. One engine, `EffectCanvas`, runs one frame callback and records one Skia picture. The active
   effect is a shared value with an index into `EFFECTS`. Only the JS thread writes it.
4. The engine makes the paints, the star sprite and the compiled runtime shaders once, in a draw
   kit. An effect does not make them per frame.
5. A shader effect is a Skia runtime shader in SkSL. Runtime SkSL has no `fwidth`, so the shader
   calculates the pixel size from the Jacobian of the inverse homography.
6. A development build has an effect lab: a dev pill on the camera screen lists the effects and
   switches at once. The pill saves the effect id as `lab.effect` through `SettingsRepository`
   on the expo-sqlite key-value store (ADR-012).
7. A release build has no pill, reads no setting and runs `DEFAULT_EFFECT` (Gathering dots) only.

## Consequences

- To add an effect, add a folder in `src/scan/effects/` and one line in `effects/index.ts`. To
  remove an effect, delete both.
- The scene and one effect must stay within 4 ms per frame on the UI thread.
- A shader that does not compile draws nothing, and the development log names it. Jest compiles
  every SkSL source with CanvasKit, so most compile errors fail `just test-ts`.
- The saved choice is a key-value pair, not a row. The row rules of ADR-012 (UUID keys,
  timestamps, soft delete) are for data that may sync. A development setting does not sync.
- Lock-on does not exist yet. Each effect shows its lock-on reaction in the steady state.
- The other 17 effects of the prototype can come later without a change to the engine.

## Reassessment Triggers

- The developer picks an effect for players. A player setting needs its own ADR and a settings
  screen.
- One effect needs more than 4 ms per frame, or needs a fact that the scene does not give.
- The lock-on rule exists. Then the scene gives a real lock-on event in place of the steady state.
```

- [ ] **Step 2: Add ADR-014 to the decision index and chapter 9**

In `docs/architecture/00-DECISIONS.md`, add this row at the end of the "Scanning and ML" table:

```markdown
| ADR-014 | Live overlay effects are modules on one engine and one scene. Development builds have an effect lab with a dev pill. Release builds run the default effect only. | Concept | 2026-10-11 | Felix | [ADR-014](adr/adr-014-overlay-effects.md) |
```

In `docs/architecture/09-architecture-decisions.md`, add this row at the end of the "Active ADRs" table:

```markdown
| ADR-014 | Scan overlay effects as plug-in modules on one engine and one scene, with an effect lab (dev pill, saved choice) in development builds only | Proposed | 2026-10-11 | [ADR-014](./adr/adr-014-overlay-effects.md) |
```

- [ ] **Step 3: Update the glossary**

In `docs/architecture/12-glossary.md`, change three rows:

1. In the "Skia" row, change "used for the dot field and the transition" to "used for the overlay effects and the transition".
2. In the "Outline" row, change "The camera screen gives it to the dot field" to "The camera screen gives it to the effect engine".
3. In the "Dot field" row, change "The live overlay on the camera screen: faint dots" to "The simulation of the Gathering dots effect, the default effect: faint dots".

Then add these rows after the "Gathered dot" row:

```markdown
| Effect | One way to draw the live overlay on the camera screen. A module with `create`, `step` and `draw` in `src/scan/effects/` (ADR-014) |
| Scene | The facts about the grid that the engine gives to every effect in each frame: the grid, its matrices, found and lost, presence, motion and the steady state |
| Effect lab | The switch between effects in a development build: the dev pill and its list. A release build does not have it |
| Dev pill | The button at the top of the camera screen in a development build. It shows the active effect and opens the list of effects |
| Draw kit | The paints, the star sprite and the compiled runtime shaders that the engine makes once and gives to every effect |
```

- [ ] **Step 4: Update the scan-pipeline concept**

In `docs/architecture/00-concepts/scan-pipeline.md`:

1. In "Why", change "does the dot field snap onto the grid" to "does the live overlay snap onto the grid".
2. In "What", change "It is cheap and drives the dot field." to "It is cheap and drives the live overlay."
3. In the block diagram, change `o["Dot field in Skia"]` to `o["Active effect in Skia"]`.
4. In the Stages table, replace the "Dot field" row with:

```markdown
| Live overlay | Scan UI, UI thread | ≤ 4 ms per frame for the scene and one effect | The active effect draws from the scene, which the engine computes once per frame from the smoothed corners. The default effect is Gathering dots. A development build switches effects with the dev pill (ADR-014). See the [effect lab design](../../superpowers/specs/2026-10-11-effect-lab-design.md) |
```

5. In "Threads and coordinates", row "Frame processor to UI thread", change "smooths it and Skia draws the dot field" to "smooths it, steps the scene and Skia draws the active effect".

- [ ] **Step 5: Check the links**

Run: `just docs-check`
Expected: "0 broken link(s)".

- [ ] **Step 6: Commit**

```bash
git add docs/architecture
git commit -m "docs: add ADR-014 for the overlay effects and the effect lab (#20)"
```

---

### Task 10: Device check and issue update

This task needs the iPhone. The developer connects it and runs the app. The controller drives the steps. An implementer subagent does not run this task.

**Files:** none, unless a value changes. Then change the value in the effect module and in this plan's table for that effect, in one `fix(app): … (#20)` commit.

- [ ] **Step 1: Build a new development build**

expo-sqlite is a new native module, so the app needs a new build. Run from `apps/mobile`:

```bash
xcrun devicectl list devices
pnpm exec expo run:ios --device <id>
```

Use the identifier of the iPhone from the first command. Then start Metro with `just app` if it does not run.

After the build, run `git status`. If `expo run:ios` changed `apps/mobile/package.json` or `apps/mobile/app.json`, revert only that new change with `git checkout -- <file>`. The expo-sqlite dependency is already committed in Task 7, so a revert of new changes does not remove it. Never commit `apps/mobile/ios/`.

- [ ] **Step 2: Check each effect on the camera**

Open the camera screen. For each of the four effects, pick it with the dev pill. Point the phone at a sudoku for 30 s, hold still for 5 s, then move the grid out of view. Read the Metro log.

| Check | Expected |
| --- | --- |
| `[fx] <id> … fps, overlay … ms` | overlay ≤ 4.00 ms on every line |
| Frame rate in the `[fx]` line | the display rate (120 fps on a ProMotion iPhone, else 60 fps) |
| `[camera] … fps` | 30.0 fps stays |
| `[fx] <id> shader failed` | no such line for `grid-lattice` and `ripples` |
| A switch | the new effect shows on the next frame, and nothing of the old effect stays |
| Gathering dots | the same behaviour as at the end of #18 |
| Spotlight and brackets | the dim and four white brackets on the corners. The brackets grow and the dim deepens when the phone holds still |
| Grid lattice | faint cell and box lines on the paper, a light band sweeps over the grid, a dim outside |
| Ripples | a fixed screen of dots. With a grid, the dots outside swell in waves that move out from the grid edge. A ring runs out when the phone holds still |

- [ ] **Step 3: Check the saved choice and Reduce Motion**

1. Pick Ripples. Reload the app (press `r` in Metro). Expected: the pill shows Ripples, and Ripples runs.
2. Turn on Settings → Accessibility → Motion → Reduce Motion. Restart the app. Expected: the band of the lattice and the waves of the ripples stand still. The gathering dots follow the Reduce Motion rule of #18.

If a value looks wrong on the device, change it with the developer, as the "Files" line of this task says.

- [ ] **Step 4: Draft the issue comment**

Draft a comment for issue #20 with: the iPhone model, the `[fx]` overlay time and frame rate of each effect, the result of each check in Steps 2 and 3, and the acceptance criteria that are met. Show the draft to the developer. Post it with `gh issue comment 20` and tick the criteria only after the developer approves.

