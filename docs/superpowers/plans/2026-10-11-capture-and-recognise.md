# Capture and Recognise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock on to a steady grid, take a photo, recognise the 81 cells on a worklet runtime off the JS thread, and show the digits in a plain 9 × 9 result view (issue #6).

**Architecture:** The scene on the UI thread gets a real lock-on progress and a latch. At lock-on, the effect canvas sends one normalised quad to the JS thread. A shutter button does the same with the current quad. The JS thread plays a haptic, takes a `UHD_16_9` photo and hands the photo, the quad and the fast-tflite model to `recognise()` on the **scanner runtime** (`createWorkletRuntime`). `recognise()` turns the photo into an upright image, re-detects the corners near the locked quad on a downscaled copy, flattens the grid to 576 × 576 with fast-opencv, slices 81 cells and classifies them in one call.

**Tech Stack:** TypeScript, Expo 57, React Native 0.86, VisionCamera 5.2.3 (Nitro), `react-native-nitro-image` 0.15.2, `react-native-worklets` 0.10.1, `react-native-fast-opencv` 1.0.1, `react-native-fast-tflite` 3.0.1, `expo-haptics` (new), Reanimated 4, Jest (jest-expo), oxlint, dependency-cruiser.

**Spec:** `docs/superpowers/specs/2026-10-11-capture-flow-design.md`, sections "Architecture", "#6: lock-on, capture and recognise", "Error cases", "Testing" and "Open questions". Also read `docs/architecture/00-concepts/scan-pipeline.md` and `docs/architecture/00-concepts/model-contract.md`.

## Global Constraints

- Branch: `feature/6-capture-and-recognise`, made from `origin/develop` (it holds #5). Commits reference the issue: `feat(scan): ... (#6)`.
- Git: in this worktree a hook rewrites `git` to `rtk git`, and the sandbox refuses it. Run `/usr/bin/git`, one plain command per Bash call.
- Do not push, open a pull request or edit GitHub. The developer does it, or asks for it.
- The app reaches the scanner only through `src/scanner/index.ts` (SUD-05).
- Photos, images and cell images stay on the device. Do not save them to a file, the gallery or the network (SUD-02).
- Every function that runs on the scanner runtime has the `'worklet'` directive. Do not use classes (also not `ModelContractError`) in that path: a worklet cannot capture a class.
- Release every fast-opencv object with `release()`. Dispose every Nitro `Image` and the `Photo` with `dispose()` (ADR-002, "Memory").
- Lock-on: `LOCK_DWELL` = 0.7 s to start, tuned between 0.6 and 0.8 s on the device. `STEADY_SPEED` = 30 pt/s and `STEADY_MOTION` = 0.5 stay the steady rule.
- Photo output: `CommonResolutions.UHD_16_9`, `qualityPrioritization: 'speed'` when the device supports it, else `'balanced'`. No shutter sound (`enableShutterSound: false`).
- Re-detection: search box = the quad's bounding box grown by 10 % of its size on each side. Accept a re-detected quad only when each corner lies within 4 % of the mean grid side from its mapped corner.
- Rough flatten: 576 × 576 px (9 × 64). Cell image: 64 × 64 RGB. Model input `[81, 32, 32, 1]` through the existing `preprocessCells`.
- `ios/` and `android/` are generated. Do not edit them. A new native module (`expo-haptics`) needs a new development build.
- Writing style and comments: root `AGENTS.md` (Simplified Technical English, light; a comment gives a fact the code cannot show; no TODO).
- Before a task is done, run from the repository root: `just lint`, `just typecheck`, `just test-ts`.
- iPhone builds (Tasks 1 and 9): see "Device runs" below. Ask the developer to connect the phone first.

## Review Focus

1. **Lock-on and a shutter press in the same moment.** Only one photo and one `recognise()` call may run. Pinned in Task 6 ("takes one photo when capture comes twice").
2. **A photo whose rows end in padding** (`byteLength / height > width × 4`). The RGB copy and the warp must skip the padding, not shear the image. Pinned in Task 4 (`toRgb`) and Task 5 (`warpGrid`).
3. **A re-detected quad that is another grid, or the grid cut by the search box.** `recognise()` must keep the locked quad, never the far one. Pinned in Task 5 ("keeps the locked quad when the found corners are too far").
4. **`recognise()` fails anywhere** (no grid, OpenCV throws, the model output is wrong, the model did not load). The result is `ok: false` with a reason, the photo and images are disposed, and Retake works. Pinned in Tasks 5 and 6.
5. **Detections after lock-on** (the phone moves, another grid comes into view). The scene stays on the locked quad and `onLock` fires only once. Pinned in Task 2 (scene latch) and Task 7 (EffectCanvas).

## Device runs

From `apps/mobile`, with the phone connected:

```bash
lsof -nP -iTCP:8081 -sTCP:LISTEN
```

If another worktree owns port 8081, stop that Metro (the developer wants port 8081). Then:

```bash
DEVELOPER_DIR=/Applications/Xcode-27.0.0.app/Contents/Developer pnpm exec expo run:ios --device 00008150-000E688A3CD9401C
```

Do not set `CI=1`: it turns off Metro reloads. Read the `[scanner]`, `[scan]`, `[fx]` and `[camera]` lines in the Metro output.

---

## File structure

| File | Responsibility |
| --- | --- |
| `apps/mobile/src/scan/effects/scene.ts` (modify) | `LOCK_DWELL`, `lockProgress`, `lockedAt`, the latch |
| `apps/mobile/src/scan/effects/common/lock.ts` (modify) | `lockTime` from `lockedAt`. `lockProgress()` is removed: effects read `scene.lockProgress` |
| `apps/mobile/src/scan/effects/grid-lattice/uniforms.ts`, `ripples/uniforms.ts`, `spotlight-brackets/index.ts` (modify) | Read the real lock-on values |
| `apps/mobile/src/scan/effects/gathering-dots/field.ts` (modify) | The gathered dots settle and brighten over the progress |
| `apps/mobile/src/scanner/pixels.ts` (create) | `RawPixels`, `Rect`, `FLAT_SIZE`, `bytesPerPixel`, `rowBytes`, `toRgb`, `cropRgb`, `sliceCells` |
| `apps/mobile/src/scanner/photoGeometry.ts` (create) | `downscaleSize`, `toPhotoPixels`, `searchRect`, `fromCrop`, `cornerOffset` |
| `apps/mobile/src/scanner/warp.ts` (create) | `warpGrid`: the fast-opencv perspective warp |
| `apps/mobile/src/scanner/classifier.ts` (modify) | `runModel` worklet. `Classifier` exposes its `model` |
| `apps/mobile/src/scanner/recognise.ts` (create) | `recognise()` and `locateGrid()`, worklets |
| `apps/mobile/src/scanner/scanner.ts` (create) | The scanner runtime and `createScanner()` |
| `apps/mobile/src/scanner/index.ts` (modify) | Exports `createScanner`, `Scanner`, `RecogniseResult`, `CornerSource` |
| `apps/mobile/src/scan/useCapture.ts` (create) | Capture state, haptic, photo, `[scan]` log |
| `apps/mobile/src/scan/ResultView.tsx` (create) | The plain 9 × 9 result with Retake |
| `apps/mobile/src/scan/effects/EffectCanvas.tsx` (modify) | Calls `onLock` once with the normalised quad |
| `apps/mobile/src/scan/CameraScreen.tsx` (modify) | Photo output, shutter, phases, result view |
| `apps/mobile/jest.setup.ts`, `package.json` (modify) | `expo-haptics`, photo output mocks |
| Docs (modify) | ADR-002, scan-pipeline concept, the spec's open questions |

---

### Task 0: Prepare the worktree

No code and no commit. The controller (not a subagent) runs it.

- [ ] **Step 1: Check the branch.** Run `/usr/bin/git status`. Expected: `On branch feature/6-capture-and-recognise`, clean tree, at `d7d103e`.

- [ ] **Step 2: Copy the model run.** Check `ml/artifacts/20261009-210543-cell-classifier/cell-classifier.tflite`. If it is missing, copy the folder from the main checkout:

```bash
cp -R /Users/felix/projects/sudoku/ml/artifacts/20261009-210543-cell-classifier ml/artifacts/
```

- [ ] **Step 3: Install the model.** Run `just install-model artifacts/20261009-210543-cell-classifier`. Then run `/usr/bin/git status --short`. Expected: no change (the manifest and the reference outputs in git match), and `apps/mobile/assets/models/cell-classifier.tflite` exists.

- [ ] **Step 4: Baseline.** Run `just lint`, `just typecheck` and `just test-ts`. Expected: all pass. Write down the number of Jest tests.

---

### Task 1: Device check — Nitro objects on the scanner runtime

This task answers the spec's open question "Nitro objects can pass into the scanner runtime". It is a spike. Its code is **not committed**. Only the result goes into the docs. The controller runs it with the developer, because it needs the phone.

Background: `react-native-nitro-modules` 0.37 registers a worklets serializer for every `HybridObject` (`src/worklets/installWorkletsSupport.ts`). So a `Photo`, an `Image` and a `TfliteModel` should cross into a worklet runtime as boxed references. `NitroModules.box()` / `.unbox()` is the explicit form. fast-opencv works in the VisionCamera frame-processor runtime, but not yet proven in a runtime from `createWorkletRuntime`.

**Files (spike, not committed):**
- Create: `apps/mobile/src/scanner/runtimeProbe.ts`
- Modify: `apps/mobile/src/scan/CameraScreen.tsx`

- [ ] **Step 1: Write the probe.** Create `apps/mobile/src/scanner/runtimeProbe.ts`:

```ts
import { DataTypes, Mat } from 'react-native-fast-opencv'
import { loadTensorflowModel, type TfliteModel } from 'react-native-fast-tflite'
import { type BoxedHybridObject, NitroModules } from 'react-native-nitro-modules'
import type { Photo } from 'react-native-vision-camera'
import { createWorkletRuntime, runOnRuntimeAsync } from 'react-native-worklets'
import modelFile from '../../assets/models/cell-classifier.tflite'
import { INPUT_LENGTH } from './preprocess'

function probeSteps(photo: Photo, model: TfliteModel): string[] {
  'worklet'
  const lines: string[] = []
  const attempt = (name: string, step: () => string) => {
    try {
      lines.push(`${name}: ok, ${step()}`)
    } catch (error) {
      lines.push(`${name}: FAILED, ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  attempt('photo', () => `${photo.width} x ${photo.height}, ${photo.orientation}, mirrored ${photo.isMirrored}`)
  let started = Date.now()
  const image = photo.toImage()
  attempt('toImage', () => `${image.width} x ${image.height} in ${Date.now() - started} ms`)
  started = Date.now()
  attempt('pixels', () => {
    const raw = image.toRawPixelData()
    return `${raw.pixelFormat}, ${raw.buffer.byteLength / raw.height} bytes per row for ${raw.width} px, ${Date.now() - started} ms`
  })
  attempt('resize', () => {
    const small = image.resize(360, 640)
    const raw = small.toRawPixelData()
    small.dispose()
    return `${raw.width} x ${raw.height} ${raw.pixelFormat}`
  })
  attempt('model', () => {
    started = Date.now()
    const outputs = model.runSync([new Float32Array(INPUT_LENGTH).buffer])
    return `${outputs.length} outputs in ${Date.now() - started} ms`
  })
  attempt('opencv', () => {
    const mat = Mat.create(2, 3, DataTypes.CV_8U)
    try {
      return `${mat.rows} x ${mat.cols}`
    } finally {
      mat.release()
    }
  })
  image.dispose()
  return lines
}

export async function probeScannerRuntime(photo: Photo): Promise<string[]> {
  const model = await loadTensorflowModel(modelFile, [])
  const runtime = createWorkletRuntime({ name: 'scanner-probe' })
  const lines: string[] = []
  try {
    const direct = await runOnRuntimeAsync(runtime, probeSteps, photo, model)
    lines.push(...direct.map((line) => `direct ${line}`))
  } catch (error) {
    lines.push(`direct FAILED: ${error instanceof Error ? error.message : String(error)}`)
  }
  try {
    const boxed = await runOnRuntimeAsync(
      runtime,
      (p: BoxedHybridObject<Photo>, m: BoxedHybridObject<TfliteModel>) => {
        'worklet'
        return probeSteps(p.unbox(), m.unbox())
      },
      NitroModules.box(photo),
      NitroModules.box(model),
    )
    lines.push(...boxed.map((line) => `boxed ${line}`))
  } catch (error) {
    lines.push(`boxed FAILED: ${error instanceof Error ? error.message : String(error)}`)
  }
  return lines
}
```

If `runOnRuntimeAsync` refuses `probeSteps` because the photo cannot be serialized, the `direct FAILED` line records it. That is a result, not a bug in the probe.

- [ ] **Step 2: Add a temporary probe button.** In `CameraScreen.tsx`:
  - Import `CommonResolutions, usePhotoOutput` from `react-native-vision-camera`, `Pressable` from `react-native` and `probeScannerRuntime` from `../scanner/runtimeProbe` (the spike may skip the scanner boundary; it is not committed).
  - Add `const photoOutput = usePhotoOutput({ targetResolution: CommonResolutions.UHD_16_9, qualityPrioritization: 'balanced' })` next to `frameOutput`.
  - Change `outputs={[frameOutput]}` to `outputs={[frameOutput, photoOutput]}`.
  - Add after `<EffectCanvas … />`:

```tsx
<Pressable
  style={{ position: 'absolute', bottom: 48, alignSelf: 'center', padding: 16, backgroundColor: 'white' }}
  onPress={() => {
    void (async () => {
      const photo = await photoOutput.capturePhoto({}, {})
      try {
        for (const line of await probeScannerRuntime(photo)) console.log(`[probe] ${line}`)
      } finally {
        photo.dispose()
      }
    })().catch((error: unknown) => console.log(`[probe] FAILED: ${String(error)}`))
  }}
>
  <Text>Probe</Text>
</Pressable>
```

- [ ] **Step 3: Save the spike.** Run `/usr/bin/git diff > <scratchpad>/runtime-probe.diff`. Copy `runtimeProbe.ts` to the scratchpad too.

- [ ] **Step 4: Run on the iPhone.** Ask the developer to connect the phone. Build as in "Device runs". Hold the phone upright over a printed sudoku. Press Probe twice: once upright, once with the phone turned to landscape. Copy every `[probe]` line.

- [ ] **Step 5: Decide.** Use the first row that matches.

| Result | Decision for Tasks 5 and 6 |
| --- | --- |
| Every `direct` line is ok | The plan stands as written |
| `direct` fails for the photo or the model, every `boxed` line is ok | Task 5, `scanner.ts`: pass `NitroModules.box(photo)` and `NitroModules.box(model)`, and unbox them in a wrapper worklet before `recognise()`. Add this to the Task 5 test |
| The photo or the image fails both ways, the model and opencv work | Spec fallback: "the photo crosses as raw pixels". `useCapture` calls `photo.toImageAsync()`, `image.resizeAsync()` and `toRawPixelDataAsync()` on the JS thread. `recognise()` takes `(full: RawPixels, small: RawPixels, quad, model, outputs)` and skips its image step. Tell the developer before Task 5 |
| The model or opencv fails both ways | Stop. Report the lines to the developer. ADR-002 point 4 (a Swift plugin for the failing step) needs the developer's decision |

Also note from the lines:
- whether `toImage` gives an upright image (upright phone: `width < height`);
- the pixel format (expected `BGRA`) and whether rows have padding;
- the time of `toImage` and `pixels` (it goes into the total budget).

- [ ] **Step 6: Remove the spike.**

```bash
/usr/bin/git restore apps/mobile/src/scan/CameraScreen.tsx
rm apps/mobile/src/scanner/runtimeProbe.ts
```

Run `/usr/bin/git status --short`. Expected: clean.

- [ ] **Step 7: Record the result.** In `docs/architecture/adr/adr-002-react-native-and-scanner-engine.md`, after the block "Result, fast-opencv build (2026-10-10, …)", add a block in the same style:

```markdown
Result, scanner runtime (2026-10-11, issue #6, first task):

- A `Photo`, a nitro-image `Image` and a fast-tflite model <pass / do not pass> into a runtime from `createWorkletRuntime` <as arguments / only through `NitroModules.box()`>.
- fast-opencv <works / does not work> on that runtime.
- `photo.toImage()` gives an upright <W × H> image in <N> ms. `toRawPixelData()` gives <format>, <bytes> bytes per row, in <N> ms.
```

Fill in the measured values. In the spec's "Open questions" table, change the row "Nitro objects (the photo, the image) can pass into the scanner runtime" so that "Decided by" reads the result, for example `Decided in #6: yes, as arguments (ADR-002)`.

- [ ] **Step 8: Commit.**

```bash
/usr/bin/git add docs/architecture/adr/adr-002-react-native-and-scanner-engine.md docs/superpowers/specs/2026-10-11-capture-flow-design.md
/usr/bin/git commit -m "docs: record that Nitro objects reach the scanner runtime (#6)"
```

---

### Task 2: The lock-on rule in the scene

**Files:**
- Modify: `apps/mobile/src/scan/effects/scene.ts`
- Modify: `apps/mobile/src/scan/effects/scene.test.ts`
- Modify: `apps/mobile/src/scan/effects/common/lock.ts`, `common/lock.test.ts`
- Modify: `apps/mobile/src/scan/effects/grid-lattice/uniforms.ts`, `ripples/uniforms.ts`, `spotlight-brackets/index.ts` (and their tests if they compute the old approximation)

**Interfaces:**
- Produces: `export const LOCK_DWELL = 0.7` in `scene.ts`.
- Produces: two new `Scene` fields: `lockProgress: number` (0..1) and `lockedAt: number` (seconds, `-1` before lock-on). `createScene` sets them to `0` and `-1`.
- Produces: `lockTime(scene: Scene): number` in `common/lock.ts`: seconds since `lockedAt`, or `-1`. `lockProgress()` is removed.

- [ ] **Step 1: Write the failing tests.** Add to `scene.test.ts` (it has `VIEW`, `gridAt`, `detection` and `run`). Add `LOCK_DWELL` to the import from `./scene`.

```ts
describe('lock-on', () => {
  const FRAME = 1 / 60

  it('grows the progress from the time the scene becomes steady', () => {
    const scene = run(createScene(VIEW), gridAt(50, 300), 0, 0.5)
    expect(scene.steady).toBe(true)
    expect(scene.lockProgress).toBeCloseTo((scene.t - scene.steadyAt) / LOCK_DWELL, 6)
    expect(scene.lockProgress).toBeGreaterThan(0)
    expect(scene.lockedAt).toBe(-1)
  })

  it('locks on LOCK_DWELL after the scene becomes steady', () => {
    const scene = run(createScene(VIEW), gridAt(50, 300), 0, 2)
    expect(scene.lockProgress).toBe(1)
    expect(Math.abs(scene.lockedAt - (scene.steadyAt + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
  })

  it('resets the progress when the grid is lost', () => {
    const scene = run(createScene(VIEW), gridAt(50, 300), 0, 0.5)
    stepScene(scene, null, 0.5 + FRAME, false)
    expect(scene.lockProgress).toBe(0)
  })

  it('restarts the progress when the grid jumps to another grid', () => {
    const scene = run(createScene(VIEW), gridAt(50, 100, 200), 0, 0.5)
    stepScene(scene, gridAt(50, 550, 200), 0.5 + FRAME, false)
    expect(scene.lockProgress).toBe(0)
  })

  it('keeps the locked quad and ignores new detections after lock-on', () => {
    const locked = gridAt(50, 300)
    const scene = run(createScene(VIEW), locked, 0, 2)
    const lockedAt = scene.lockedAt
    stepScene(scene, gridAt(50, 100, 200), 2 + FRAME, false)
    stepScene(scene, null, 2 + 2 * FRAME, false)
    expect(scene.quad).toEqual(locked)
    expect(scene.event).toBe('none')
    expect(scene.lockedAt).toBe(lockedAt)
    expect(scene.lockProgress).toBe(1)
  })

  it('starts unlocked', () => {
    const scene = createScene(VIEW)
    expect(scene.lockProgress).toBe(0)
    expect(scene.lockedAt).toBe(-1)
  })
})
```

Replace the body of `common/lock.test.ts`:

```ts
import { createScene } from '../scene'
import { lockTime } from './lock'

const scene = () => createScene({ width: 402, height: 874 })

describe('lockTime', () => {
  it('gives the seconds since lock-on', () => {
    expect(lockTime({ ...scene(), t: 5, lockedAt: 3.5 })).toBe(1.5)
  })

  it('gives -1 before lock-on', () => {
    expect(lockTime({ ...scene(), t: 5, lockedAt: -1 })).toBe(-1)
  })
})
```

- [ ] **Step 2: Run the tests to see them fail.** Run `pnpm --filter mobile exec jest src/scan/effects/scene.test.ts src/scan/effects/common/lock.test.ts`. Expected: FAIL (`LOCK_DWELL` is undefined, `lockProgress` is undefined on the scene).

- [ ] **Step 3: Implement the rule.** In `scene.ts`:
  - Change the comments of `STEADY_SPEED` and `STEADY_MOTION`: they are now the lock-on threshold. Replace "Provisional until the lock-on rule …" with "The lock-on threshold. Tune it on the device (capture flow design)."
  - Add below `STEADY_MOTION`:

```ts
/** Seconds the grid must stay steady before the scan locks on. Tune it between 0.6 and 0.8 on the device (capture flow design). */
export const LOCK_DWELL = 0.7
```

  - Add to the `Scene` type, after `steadyAt`: `lockProgress: number` and `lockedAt: number`. Extend the type comment: `lockProgress: 0..1, see LOCK_DWELL. lockedAt: the time of lock-on, or -1. From lock-on, the scene keeps the locked quad and ignores new detections.`
  - In `createScene`, add `lockProgress: 0,` and `lockedAt: -1,`.
  - In `stepScene`, change the parameter name `quad` to `detected` and add as the first lines after `scene.reduceMotion = reduceMotion`:

```ts
  const quad = scene.lockedAt >= 0 ? scene.quad : detected
```

  - After `scene.steady = steady`, add:

```ts
  if (scene.lockedAt < 0) {
    // foundAt also moves on a jump, so a switch to another grid starts the dwell again.
    const since = Math.max(scene.steadyAt, scene.foundAt)
    scene.lockProgress = steady ? Math.min(1, Math.max(0, (t - since) / LOCK_DWELL)) : 0
    if (scene.lockProgress >= 1) scene.lockedAt = t
  }
```

  - Update the `stepScene` comment: `quad` becomes `detected`: "detected: the smoothed grid in view points, or null. After lock-on it is ignored."

- [ ] **Step 4: Replace the approximation.** Replace `common/lock.ts` with:

```ts
import type { Scene } from '../scene'

/** Seconds since lock-on, or -1: the prototype's uLockT. */
export function lockTime(scene: Scene): number {
  'worklet'
  return scene.lockedAt < 0 ? -1 : scene.t - scene.lockedAt
}
```

  In `grid-lattice/uniforms.ts` and `ripples/uniforms.ts`, import only `lockTime` and replace `lockProgress(scene)` with `scene.lockProgress`. In `spotlight-brackets/index.ts`, remove the `lockProgress` import, change `const p = lockProgress(scene)` to `const p = scene.lockProgress`, and change the comment "p is lockProgress(scene)" to "p is scene.lockProgress".

- [ ] **Step 5: Run all app tests.** Run `pnpm --filter mobile exec jest src/scan`. Expected: the new tests pass. A test that built its expected value from `presence * (1 - motion)` or from `steadyAt` now fails: change its scene literal to set `lockProgress` or `lockedAt` directly, because these are now scene facts. Do not change the code to match an old test.

- [ ] **Step 6: Check.** Run `just lint`, `just typecheck`, `just test-ts`. Expected: all pass.

- [ ] **Step 7: Commit.**

```bash
/usr/bin/git add apps/mobile/src/scan/effects
/usr/bin/git commit -m "feat(scan): lock on after the grid is steady for LOCK_DWELL (#6)"
```

---

### Task 3: The gathered dots show the lock-on progress

**Files:**
- Modify: `apps/mobile/src/scan/effects/gathering-dots/field.ts`
- Modify: `apps/mobile/src/scan/effects/gathering-dots/field.test.ts`

**Interfaces:**
- Consumes: `scene.lockProgress` (Task 2).
- Produces: `export const LOCK_BRIGHTEN = 0.25` in `field.ts`. A landed gathered dot has alpha `GATHER_ALPHA_END × (1 + LOCK_BRIGHTEN × p)`: 80 % at `p = 0`, 100 % at `p = 1`.

Spec: "the leftover wobble of the gathered dots goes from 15 % to 0, their twinkle goes to 0, and their opacity goes from 80 % to 100 %". `WOBBLE` is the 15 %. The existing `motion` factor stays (the #18 tuning), and `(1 − p)` takes it to 0. The twinkle already stops when a dot lands. The progress also fades it out for a dot that is still in flight.

- [ ] **Step 1: Write the failing tests.** Add to `field.test.ts` (it has `world`, `gridAt`, `run`, `gathered`). Import `LOCK_BRIGHTEN` from `./field`.

```ts
describe('lock-on progress', () => {
  it('brightens the landed dots to full opacity at lock-on', () => {
    const w = run(world(), gridAt(50, 300), 0, 2.5)
    expect(w.scene.lockProgress).toBe(1)
    for (const d of gathered(w)) expect(d.alpha).toBeCloseTo(GATHER_ALPHA_END * (1 + LOCK_BRIGHTEN), 6)
    expect(GATHER_ALPHA_END * (1 + LOCK_BRIGHTEN)).toBeCloseTo(1, 6)
  })

  it('puts the landed dots exactly on the intersections at lock-on', () => {
    const w = run(world(), gridAt(50, 300), 0, 2.5)
    const m = w.scene.m!
    for (const d of gathered(w)) {
      const at = project(m, (d.target % 10) / 9, Math.floor(d.target / 10) / 9)
      expect(d.x).toBeCloseTo(at.x, 6)
      expect(d.y).toBeCloseTo(at.y, 6)
    }
  })

  it('keeps the brightness at GATHER_ALPHA_END without progress', () => {
    const w = run(world(), gridAt(50, 300), 0, 2.5)
    w.scene.lockProgress = 0
    stepField(w.field, w.scene)
    for (const d of gathered(w).filter((dot) => w.scene.t - dot.since - dot.delay >= FLIGHT)) {
      expect(d.alpha).toBeCloseTo(GATHER_ALPHA_END, 6)
    }
  })

  it('brightens the dots under Reduce Motion too', () => {
    const w = run(world(), gridAt(50, 300), 0, 2.5, true)
    for (const d of gathered(w)) expect(d.alpha).toBeCloseTo(GATHER_ALPHA_END * (1 + LOCK_BRIGHTEN), 6)
  })
})
```

- [ ] **Step 2: Run them to see them fail.** Run `pnpm --filter mobile exec jest src/scan/effects/gathering-dots/field.test.ts`. Expected: FAIL (`LOCK_BRIGHTEN` undefined, alpha 0.8).

- [ ] **Step 3: Implement.** In `field.ts`:
  - Add after `WOBBLE`:

```ts
/** The share by which lock-on brightens a gathered dot: GATHER_ALPHA_END 0.8 goes to 1. */
export const LOCK_BRIGHTEN = 0.25
```

  - Change the signature of `placeGathered` to `placeGathered(d: FieldDot, t: number, m: Homography, motion: number, lock: number, reduceMotion: boolean)`.
  - In the Reduce Motion branch, change the alpha line to:

```ts
    d.alpha = GATHER_ALPHA_END * (1 + LOCK_BRIGHTEN * lock) * Math.min(1, Math.max(0, (t - d.since) / REDUCED_FADE))
```

  - Change the end point and the alpha:

```ts
  const settle = WOBBLE * motion * (1 - lock)
  const ex = at.x + w.x * settle
  const ey = at.y + w.y * settle
```

```ts
  const flicker = u >= 1 ? 1 : twinkle(d, t) + (1 - twinkle(d, t)) * lock
  d.alpha = (GATHER_ALPHA_START + (GATHER_ALPHA_END - GATHER_ALPHA_START) * u) * flicker * (1 + LOCK_BRIGHTEN * lock)
```

  - In `stepField`, pass `scene.lockProgress`: `placeGathered(d, t, m, scene.motion, scene.lockProgress, scene.reduceMotion)`.

- [ ] **Step 4: Run the field tests.** Expected: the new tests pass. An existing test that runs a still grid past about 0.9 s now sees the locked alpha (1.0) or zero wobble. Change that test's expectation to the locked value, or shorten its run to end before lock-on. Do not change the code to match an old test.

- [ ] **Step 5: Check.** Run `just lint`, `just typecheck`, `just test-ts`. Expected: all pass.

- [ ] **Step 6: Commit.**

```bash
/usr/bin/git add apps/mobile/src/scan/effects/gathering-dots
/usr/bin/git commit -m "feat(scan): the gathered dots settle and brighten during lock-on (#6)"
```

---

### Task 4: Pixel and photo geometry helpers

Pure worklet functions. `recognise()` (Task 5) is built from them.

**Files:**
- Create: `apps/mobile/src/scanner/pixels.ts`, `apps/mobile/src/scanner/pixels.test.ts`
- Create: `apps/mobile/src/scanner/photoGeometry.ts`, `apps/mobile/src/scanner/photoGeometry.test.ts`

**Interfaces:**
- Consumes: `CELL_SIZE`, `CELLS` from `./preprocess`; `Point`, `Quad` from `./quad`.
- Produces (`pixels.ts`):
  - `type RawPixels = { buffer: ArrayBuffer; width: number; height: number; pixelFormat: string }` (a nitro-image `RawPixelData` fits it)
  - `type Rect = { x: number; y: number; width: number; height: number }` (integer pixels)
  - `const FLAT_SIZE = 576`
  - `bytesPerPixel(format: string): number`
  - `rowBytes(raw: RawPixels): number`
  - `toRgb(raw: RawPixels): Uint8Array`
  - `cropRgb(rgb: Uint8Array, width: number, rect: Rect): Uint8Array`
  - `sliceCells(flat: Uint8Array): Uint8Array`
- Produces (`photoGeometry.ts`):
  - `const DETECT_LONG_SIDE = 640`
  - `downscaleSize(width: number, height: number): { width: number; height: number }`
  - `toPhotoPixels(quad: Quad, width: number, height: number): Point[]`
  - `searchRect(quad: Quad, width: number, height: number, grow: number): Rect`
  - `fromCrop(quad: Quad, rect: Rect, width: number, height: number): Quad`
  - `cornerOffset(a: Quad, b: Quad, width: number, height: number): number`

- [ ] **Step 1: Write the failing pixel tests.** Create `pixels.test.ts`:

```ts
import { CELL_SIZE, CELLS } from './preprocess'
import { bytesPerPixel, cropRgb, FLAT_SIZE, rowBytes, sliceCells, toRgb } from './pixels'

describe('toRgb', () => {
  it('reads BGRA and skips the padding at the end of each row', () => {
    // 2 × 2 pixels, 12 bytes per row: 8 bytes of pixels and 4 bytes of padding.
    const bytes = new Uint8Array([
      3, 2, 1, 255, 6, 5, 4, 255, 99, 99, 99, 99,
      9, 8, 7, 255, 12, 11, 10, 255, 99, 99, 99, 99,
    ])
    const rgb = toRgb({ buffer: bytes.buffer, width: 2, height: 2, pixelFormat: 'BGRA' })
    expect(Array.from(rgb)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('reads RGBA and ARGB', () => {
    const rgba = new Uint8Array([1, 2, 3, 255])
    const argb = new Uint8Array([255, 1, 2, 3])
    expect(Array.from(toRgb({ buffer: rgba.buffer, width: 1, height: 1, pixelFormat: 'RGBA' }))).toEqual([1, 2, 3])
    expect(Array.from(toRgb({ buffer: argb.buffer, width: 1, height: 1, pixelFormat: 'ARGB' }))).toEqual([1, 2, 3])
  })

  it('refuses an unknown pixel format', () => {
    expect(() => toRgb({ buffer: new ArrayBuffer(4), width: 1, height: 1, pixelFormat: 'unknown' })).toThrow(
      'unsupported pixel format unknown',
    )
  })

  it('refuses a buffer that is too short for its rows', () => {
    expect(() => toRgb({ buffer: new ArrayBuffer(12), width: 2, height: 2, pixelFormat: 'BGRA' })).toThrow(RangeError)
  })
})

describe('rowBytes and bytesPerPixel', () => {
  it('gives the row length with padding', () => {
    expect(rowBytes({ buffer: new ArrayBuffer(2 * 4160), width: 1000, height: 2, pixelFormat: 'BGRA' })).toBe(4160)
  })

  it('gives 3 bytes for RGB and 4 for BGRA', () => {
    expect(bytesPerPixel('RGB')).toBe(3)
    expect(bytesPerPixel('BGRA')).toBe(4)
  })
})

describe('cropRgb', () => {
  it('copies the rect, row by row', () => {
    // 4 × 3 pixels. Each byte holds its pixel index.
    const rgb = new Uint8Array(4 * 3 * 3).map((_, i) => Math.floor(i / 3))
    const crop = cropRgb(rgb, 4, { x: 1, y: 1, width: 2, height: 2 })
    expect(Array.from(crop).filter((_, i) => i % 3 === 0)).toEqual([5, 6, 9, 10])
  })
})

describe('sliceCells', () => {
  it('cuts 81 cells of 64 × 64 RGB, row by row', () => {
    const flat = new Uint8Array(FLAT_SIZE * FLAT_SIZE * 3)
    for (let y = 0; y < FLAT_SIZE; y++) {
      for (let x = 0; x < FLAT_SIZE; x++) {
        const p = (y * FLAT_SIZE + x) * 3
        flat[p] = Math.floor(y / CELL_SIZE) * 9 + Math.floor(x / CELL_SIZE)
        flat[p + 1] = y % CELL_SIZE
        flat[p + 2] = x % CELL_SIZE
      }
    }
    const cells = sliceCells(flat)
    expect(cells).toHaveLength(CELLS * CELL_SIZE * CELL_SIZE * 3)
    const p = (10 * CELL_SIZE * CELL_SIZE + 5 * CELL_SIZE + 7) * 3
    expect([cells[p], cells[p + 1], cells[p + 2]]).toEqual([10, 5, 7])
    const last = (80 * CELL_SIZE * CELL_SIZE + 63 * CELL_SIZE + 63) * 3
    expect([cells[last], cells[last + 1], cells[last + 2]]).toEqual([80, 63, 63])
  })

  it('refuses a flat image of the wrong size', () => {
    expect(() => sliceCells(new Uint8Array(10))).toThrow(RangeError)
  })
})
```

- [ ] **Step 2: Write the failing geometry tests.** Create `photoGeometry.test.ts`:

```ts
import { cornerOffset, downscaleSize, fromCrop, searchRect, toPhotoPixels } from './photoGeometry'
import type { Quad } from './quad'

function square(x: number, y: number, size: number): Quad {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ]
}

describe('downscaleSize', () => {
  it('keeps the live long side and the photo aspect ratio', () => {
    expect(downscaleSize(2160, 3840)).toEqual({ width: 360, height: 640 })
    expect(downscaleSize(3840, 2160)).toEqual({ width: 640, height: 360 })
    expect(downscaleSize(3024, 4032)).toEqual({ width: 480, height: 640 })
  })
})

describe('toPhotoPixels', () => {
  it('maps the normalised quad to OpenCV pixels of an upright photo', () => {
    expect(toPhotoPixels(square(0.25, 0.5, 0.25), 2160, 3840)[0]).toEqual({ x: 539.5, y: 1919.5 })
  })

  it('maps the same quad to a landscape photo', () => {
    expect(toPhotoPixels(square(0.25, 0.5, 0.25), 3840, 2160)[2]).toEqual({ x: 1919.5, y: 1619.5 })
  })
})

describe('searchRect', () => {
  it('grows the bounding box by grow times its size on each side', () => {
    const quad: Quad = [
      { x: 0.25, y: 0.25 },
      { x: 0.75, y: 0.25 },
      { x: 0.75, y: 0.5 },
      { x: 0.25, y: 0.5 },
    ]
    expect(searchRect(quad, 360, 640, 0.1)).toEqual({ x: 72, y: 144, width: 216, height: 192 })
  })

  it('clamps the box to the image', () => {
    expect(searchRect(square(0.02, 0.02, 0.96), 360, 640, 0.1)).toEqual({ x: 0, y: 0, width: 360, height: 640 })
  })
})

describe('fromCrop', () => {
  it('maps a quad normalised to the crop back to the whole image', () => {
    const quad = fromCrop(square(0.5, 0.5, 0.25), { x: 72, y: 144, width: 216, height: 192 }, 360, 640)
    expect(quad[0].x).toBeCloseTo(0.5, 9)
    expect(quad[0].y).toBeCloseTo(0.375, 9)
  })
})

describe('cornerOffset', () => {
  it('is 0 for the same quad', () => {
    expect(cornerOffset(square(0.2, 0.2, 0.5), square(0.2, 0.2, 0.5), 100, 100)).toBe(0)
  })

  it('gives the largest corner distance as a share of the mean side', () => {
    const moved = square(0.2, 0.2, 0.5)
    moved[2] = { x: 0.72, y: 0.7 }
    expect(cornerOffset(moved, square(0.2, 0.2, 0.5), 100, 100)).toBeCloseTo(0.04, 9)
  })
})
```

- [ ] **Step 3: Run them to see them fail.** Run `pnpm --filter mobile exec jest src/scanner/pixels.test.ts src/scanner/photoGeometry.test.ts`. Expected: FAIL (modules not found).

- [ ] **Step 4: Implement `pixels.ts`.**

```ts
import { CELL_SIZE, CELLS } from './preprocess'

/** Raw pixels as nitro-image gives them. A row may end in padding: the row length is byteLength / height. */
export type RawPixels = { buffer: ArrayBuffer; width: number; height: number; pixelFormat: string }

/** Integer pixels. */
export type Rect = { x: number; y: number; width: number; height: number }

/** The side of the rough flatten: 9 cells of CELL_SIZE. */
export const FLAT_SIZE = 9 * CELL_SIZE

/** Byte offsets of red, green and blue inside one pixel, and the bytes per pixel. */
const LAYOUTS: { [format: string]: { r: number; g: number; b: number; bytes: number } } = {
  RGBA: { r: 0, g: 1, b: 2, bytes: 4 },
  RGBX: { r: 0, g: 1, b: 2, bytes: 4 },
  BGRA: { r: 2, g: 1, b: 0, bytes: 4 },
  BGRX: { r: 2, g: 1, b: 0, bytes: 4 },
  ARGB: { r: 1, g: 2, b: 3, bytes: 4 },
  XRGB: { r: 1, g: 2, b: 3, bytes: 4 },
  ABGR: { r: 3, g: 2, b: 1, bytes: 4 },
  XBGR: { r: 3, g: 2, b: 1, bytes: 4 },
  RGB: { r: 0, g: 1, b: 2, bytes: 3 },
  BGR: { r: 2, g: 1, b: 0, bytes: 3 },
}

function layoutOf(format: string) {
  'worklet'
  const layout = LAYOUTS[format]
  if (layout == null) throw new Error(`unsupported pixel format ${format}`)
  return layout
}

export function bytesPerPixel(format: string): number {
  'worklet'
  return layoutOf(format).bytes
}

/** Throws when the buffer does not hold height whole rows of width pixels. */
export function rowBytes(raw: RawPixels): number {
  'worklet'
  const row = raw.buffer.byteLength / raw.height
  if (!Number.isInteger(row) || row < raw.width * bytesPerPixel(raw.pixelFormat)) {
    throw new RangeError(`${raw.buffer.byteLength} bytes do not hold ${raw.height} rows of ${raw.width} ${raw.pixelFormat} pixels`)
  }
  return row
}

/** Interleaved RGB, width × height × 3, without padding. */
export function toRgb(raw: RawPixels): Uint8Array {
  'worklet'
  const layout = layoutOf(raw.pixelFormat)
  const row = rowBytes(raw)
  const src = new Uint8Array(raw.buffer)
  const out = new Uint8Array(raw.width * raw.height * 3)
  for (let y = 0; y < raw.height; y++) {
    let p = y * row
    let q = y * raw.width * 3
    for (let x = 0; x < raw.width; x++) {
      out[q] = src[p + layout.r]
      out[q + 1] = src[p + layout.g]
      out[q + 2] = src[p + layout.b]
      p += layout.bytes
      q += 3
    }
  }
  return out
}

/** rgb: interleaved RGB, width pixels per row. */
export function cropRgb(rgb: Uint8Array, width: number, rect: Rect): Uint8Array {
  'worklet'
  const out = new Uint8Array(rect.width * rect.height * 3)
  for (let y = 0; y < rect.height; y++) {
    const start = ((rect.y + y) * width + rect.x) * 3
    out.set(rgb.subarray(start, start + rect.width * 3), y * rect.width * 3)
  }
  return out
}

/** flat: FLAT_SIZE × FLAT_SIZE RGB. Returns 81 cell images of CELL_SIZE × CELL_SIZE RGB, row by row, as preprocessCells reads them. */
export function sliceCells(flat: Uint8Array): Uint8Array {
  'worklet'
  if (flat.length !== FLAT_SIZE * FLAT_SIZE * 3) {
    throw new RangeError(`expected ${FLAT_SIZE * FLAT_SIZE * 3} bytes of flattened grid, got ${flat.length}`)
  }
  const rowLength = CELL_SIZE * 3
  const out = new Uint8Array(CELLS * CELL_SIZE * CELL_SIZE * 3)
  for (let n = 0; n < CELLS; n++) {
    const top = Math.floor(n / 9) * CELL_SIZE
    const left = (n % 9) * CELL_SIZE
    for (let y = 0; y < CELL_SIZE; y++) {
      const start = ((top + y) * FLAT_SIZE + left) * 3
      out.set(flat.subarray(start, start + rowLength), (n * CELL_SIZE + y) * rowLength)
    }
  }
  return out
}
```

- [ ] **Step 5: Implement `photoGeometry.ts`.**

```ts
import type { Rect } from './pixels'
import type { Point, Quad } from './quad'

/** The long side of the downscaled photo for the corner search. The live detector uses 640 too (DETECT_HEIGHT). */
export const DETECT_LONG_SIDE = 640

export function downscaleSize(width: number, height: number): { width: number; height: number } {
  'worklet'
  const scale = DETECT_LONG_SIDE / Math.max(width, height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** OpenCV puts pixel centres on integers. This is the inverse of toGridDetection, which adds 0.5. */
export function toPhotoPixels(quad: Quad, width: number, height: number): Point[] {
  'worklet'
  return quad.map((p) => ({ x: p.x * width - 0.5, y: p.y * height - 0.5 }))
}

/** The quad's bounding box in a width × height image, grown by grow × its size on each side and clamped to the image. */
export function searchRect(quad: Quad, width: number, height: number, grow: number): Rect {
  'worklet'
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  for (const p of quad) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const growX = grow * (maxX - minX)
  const growY = grow * (maxY - minY)
  const x0 = Math.max(0, Math.floor((minX - growX) * width))
  const y0 = Math.max(0, Math.floor((minY - growY) * height))
  const x1 = Math.min(width, Math.ceil((maxX + growX) * width))
  const y1 = Math.min(height, Math.ceil((maxY + growY) * height))
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

/** quad: normalised to the rect. Returns it normalised to the whole width × height image. */
export function fromCrop(quad: Quad, rect: Rect, width: number, height: number): Quad {
  'worklet'
  const map = (p: Point): Point => ({ x: (p.x * rect.width + rect.x) / width, y: (p.y * rect.height + rect.y) / height })
  return [map(quad[0]), map(quad[1]), map(quad[2]), map(quad[3])]
}

/** The largest distance between matching corners of a and b, as a share of b's mean side. Both quads are normalised to one width × height image. */
export function cornerOffset(a: Quad, b: Quad, width: number, height: number): number {
  'worklet'
  let sides = 0
  let largest = 0
  for (let i = 0; i < 4; i++) {
    const next = b[(i + 1) % 4]
    sides += Math.hypot((next.x - b[i].x) * width, (next.y - b[i].y) * height)
    largest = Math.max(largest, Math.hypot((a[i].x - b[i].x) * width, (a[i].y - b[i].y) * height))
  }
  return largest / (sides / 4)
}
```

- [ ] **Step 6: Run the tests.** Expected: PASS.

- [ ] **Step 7: Check.** Run `just lint`, `just typecheck`, `just test-ts`. Expected: all pass.

- [ ] **Step 8: Commit.**

```bash
/usr/bin/git add apps/mobile/src/scanner/pixels.ts apps/mobile/src/scanner/pixels.test.ts apps/mobile/src/scanner/photoGeometry.ts apps/mobile/src/scanner/photoGeometry.test.ts
/usr/bin/git commit -m "feat(scanner): pixel and photo geometry helpers for recognise (#6)"
```

---

### Task 5: `recognise()` on the scanner runtime

**Files:**
- Create: `apps/mobile/src/scanner/warp.ts`, `apps/mobile/src/scanner/warp.test.ts`
- Modify: `apps/mobile/src/scanner/classifier.ts`, `apps/mobile/src/scanner/classifier.test.ts`
- Create: `apps/mobile/src/scanner/recognise.ts`, `apps/mobile/src/scanner/recognise.test.ts`
- Create: `apps/mobile/src/scanner/scanner.ts`, `apps/mobile/src/scanner/scanner.test.ts`
- Modify: `apps/mobile/src/scanner/index.ts`

**Interfaces:**
- Consumes: Task 4 helpers; `findGrid(pixels, width, height): GridDetection | null` (`./findGrid`); `preprocessCells`; `decodeOutputs`; `loadClassifier`.
- Produces (`warp.ts`): `warpGrid(raw: RawPixels, corners: Point[], side: number): RawPixels` (same pixel format as `raw`).
- Produces (`classifier.ts`): `type OutputIndex = { digit: number; kind: number }`; `runModel(model: TfliteModel, outputs: OutputIndex, input: Float32Array): RawOutputs` (a worklet); `Classifier` gets `model: TfliteModel`.
- Produces (`recognise.ts`):

```ts
export type ImageSource = {
  width: number
  height: number
  resize(width: number, height: number): ImageSource
  toRawPixelData(): RawPixels
  dispose(): void
}
export type PhotoSource = { toImage(): ImageSource }
export type CornerSource = 'redetected' | 'locked' | 'found'
export type RecogniseTimings = { imageMs: number; detectMs: number; flattenMs: number; classifyMs: number }
export type RecogniseResult =
  | { ok: true; cells: CellResult[]; quad: Quad; corners: CornerSource; cornerOffset: number | null; timings: RecogniseTimings }
  | { ok: false; reason: string }
export const CORNER_TOLERANCE = 0.04
export const SEARCH_GROW = 0.1
export function locateGrid(small: Uint8Array, width: number, height: number, quad: Quad | null): Located | null
export function recognise(photo: PhotoSource, quad: Quad | null, model: TfliteModel, outputs: OutputIndex): RecogniseResult
```

- Produces (`scanner.ts`): `type Scanner = { recognise(photo: Photo, quad: Quad | null): Promise<RecogniseResult> }`; `createScanner(): Promise<Scanner>` (one load per app, the same promise every call).

If Task 1 chose the "boxed" row, `scanner.ts` boxes the photo and the model, as Task 1 Step 5 says. If it chose the "raw pixels" row, stop and agree the changed interface with the developer before this task.

- [ ] **Step 1: Make the model call a worklet.** In `classifier.test.ts`, change the last test so that it does not need the class:

```ts
  it('refuses an output of the wrong size', () => {
    const model = fakeModel(rows(10, 2), rows(4, 1))
    model.runSync = () => [new ArrayBuffer(8), new ArrayBuffer(8)]
    expect(() => createClassifier(model, MANIFEST).run(new Float32Array(INPUT_LENGTH))).toThrow(
      'the digit output has 8 bytes, expected 3240',
    )
  })
```

  Add a test:

```ts
  it('exposes the model, so the scanner runtime can call it', () => {
    const model = fakeModel(rows(10, 2), rows(4, 1))
    expect(createClassifier(model, MANIFEST).model).toBe(model)
  })
```

  Run `pnpm --filter mobile exec jest src/scanner/classifier.test.ts`. Expected: the new test fails (`model` is undefined).

  In `classifier.ts`:
  - Add `export type OutputIndex = { digit: number; kind: number }` and use it for `ModelManifest.outputs`.
  - Add `model: TfliteModel` to `Classifier`.
  - Add `'worklet'` to `copyOutput`, and make it throw `Error`, not `ModelContractError` (a worklet cannot capture the class). Update its comment: "Copies an output: fast-tflite writes the next call into the same buffer. Throws Error, not ModelContractError: it runs on the scanner runtime."
  - Add:

```ts
/** Runs on the scanner runtime too. input: INPUT_LENGTH floats. */
export function runModel(model: TfliteModel, outputs: OutputIndex, input: Float32Array): RawOutputs {
  'worklet'
  if (input.length !== INPUT_LENGTH) throw new RangeError(`expected ${INPUT_LENGTH} input values, got ${input.length}`)
  const result = model.runSync([new Float32Array(input).buffer])
  return {
    digit: copyOutput(result[outputs.digit], CELLS * DIGIT_CLASSES, 'digit'),
    kind: copyOutput(result[outputs.kind], CELLS * KIND_CLASSES.length, 'kind'),
  }
}
```

  - In `createClassifier`, replace the `run` arrow with `const run = (input: Float32Array): RawOutputs => runModel(model, manifest.outputs, input)` and return `{ manifest, model, run, classify: (input) => decodeOutputs(run(input)) }`. Remove the now unused `digit`/`kind` destructuring only if nothing else uses it (the shape checks use it, so keep it).

  Run the classifier tests. Expected: PASS.

- [ ] **Step 2: Write the failing warp test.** Create `warp.test.ts`:

```ts
import { Mat, OpenCV, Point2f } from 'react-native-fast-opencv'
import { warpGrid } from './warp'

type Fake = { release: jest.Mock }
const created: Fake[] = []
function fake<T extends object>(extra: T): T & Fake {
  const object = { ...extra, release: jest.fn() }
  created.push(object)
  return object
}

jest.mock('react-native-fast-opencv', () => ({
  BorderTypes: { BORDER_REPLICATE: 1 },
  DataTypes: { CV_8U: 0 },
  DecompTypes: { DECOMP_LU: 0 },
  InterpolationFlags: { INTER_LINEAR: 1 },
  Mat: {
    createFromBuffer: jest.fn((_type: string, rows: number, cols: number) => fake({ rows, cols })),
    create: jest.fn(() => fake({ toBuffer: () => ({ buffer: new Uint8Array(4 * 4 * 4).fill(7) }) })),
  },
  Point2f: { create: jest.fn((x: number, y: number) => fake({ x, y })) },
  Point2fVector: { create: jest.fn(() => fake({})) },
  Size: { create: jest.fn(() => fake({})) },
  Scalar: { create: jest.fn(() => fake({})) },
  OpenCV: { getPerspectiveTransform: jest.fn(() => fake({})), warpPerspective: jest.fn() },
}))

const corners = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
]

beforeEach(() => {
  created.length = 0
  jest.clearAllMocks()
})

it('returns side × side pixels in the source format', () => {
  const out = warpGrid({ buffer: new ArrayBuffer(100 * 100 * 4), width: 100, height: 100, pixelFormat: 'BGRA' }, corners, 4)
  expect(out).toMatchObject({ width: 4, height: 4, pixelFormat: 'BGRA' })
  expect(new Uint8Array(out.buffer)).toHaveLength(64)
  expect(new Uint8Array(out.buffer)[0]).toBe(7)
})

it('reads a padded row as extra columns', () => {
  warpGrid({ buffer: new ArrayBuffer(100 * 104 * 4), width: 100, height: 100, pixelFormat: 'BGRA' }, corners, 4)
  expect(jest.mocked(Mat.createFromBuffer).mock.calls[0].slice(1, 4)).toEqual([100, 104, 4])
})

it('maps the corners to the edges of the square', () => {
  warpGrid({ buffer: new ArrayBuffer(100 * 100 * 4), width: 100, height: 100, pixelFormat: 'BGRA' }, corners, 4)
  const points = jest.mocked(Point2f.create).mock.calls
  expect(points.slice(0, 4)).toEqual([[10, 10], [90, 10], [90, 90], [10, 90]])
  expect(points.slice(4)).toEqual([[-0.5, -0.5], [3.5, -0.5], [3.5, 3.5], [-0.5, 3.5]])
})

it('releases every OpenCV object, also when the warp throws', () => {
  jest.mocked(OpenCV.warpPerspective).mockImplementationOnce(() => {
    throw new Error('warp failed')
  })
  expect(() =>
    warpGrid({ buffer: new ArrayBuffer(100 * 100 * 4), width: 100, height: 100, pixelFormat: 'BGRA' }, corners, 4),
  ).toThrow('warp failed')
  expect(created.length).toBeGreaterThan(0)
  for (const object of created) expect(object.release).toHaveBeenCalledTimes(1)
})
```

  Run `pnpm --filter mobile exec jest src/scanner/warp.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `warp.ts`.**

```ts
import {
  BorderTypes,
  DataTypes,
  DecompTypes,
  InterpolationFlags,
  Mat,
  OpenCV,
  Point2f,
  Point2fVector,
  Scalar,
  Size,
} from 'react-native-fast-opencv'
import { bytesPerPixel, type RawPixels, rowBytes } from './pixels'
import type { Point } from './quad'

type Releasable = { release(): void }

/**
 * corners: OpenCV pixels in raw, in quad order. Returns side × side pixels in the pixel format of raw.
 * Releases every OpenCV object before it returns or throws.
 */
export function warpGrid(raw: RawPixels, corners: Point[], side: number): RawPixels {
  'worklet'
  // Garbage collection in a worklet runtime can lag, so each object is released here (ADR-002).
  const owned: Releasable[] = []
  function own<T extends Releasable>(object: T): T {
    owned.push(object)
    return object
  }
  try {
    const channels = bytesPerPixel(raw.pixelFormat)
    const row = rowBytes(raw)
    if (row % channels !== 0) throw new RangeError(`a row of ${row} bytes is not whole ${raw.pixelFormat} pixels`)
    // A padded row becomes extra columns on the right. The warp reads only inside the grid, so they never show.
    const src = own(Mat.createFromBuffer('uint8', raw.height, row / channels, channels as 3 | 4, new Uint8Array(raw.buffer)))
    const from = own(Point2fVector.create(corners.map((p) => own(Point2f.create(p.x, p.y)))))
    // Pixel centres are on integers, so the edges of the square are at -0.5 and side - 0.5.
    const edge = side - 0.5
    const to = own(
      Point2fVector.create([
        own(Point2f.create(-0.5, -0.5)),
        own(Point2f.create(edge, -0.5)),
        own(Point2f.create(edge, edge)),
        own(Point2f.create(-0.5, edge)),
      ]),
    )
    const transform = own(OpenCV.getPerspectiveTransform(from, to, DecompTypes.DECOMP_LU))
    // warpPerspective gives dst the type of src.
    const dst = own(Mat.create(side, side, DataTypes.CV_8U))
    OpenCV.warpPerspective(
      src,
      dst,
      transform,
      own(Size.create(side, side)),
      InterpolationFlags.INTER_LINEAR,
      BorderTypes.BORDER_REPLICATE,
      own(Scalar.create(0)),
    )
    // A copy: the buffer of toBuffer can belong to the Mat, which is released below.
    const pixels = dst.toBuffer('uint8').buffer.slice()
    return { buffer: pixels.buffer, width: side, height: side, pixelFormat: raw.pixelFormat }
  } finally {
    for (const object of owned) object.release()
  }
}
```

  Run the warp tests. Expected: PASS. If the fast-opencv types refuse an argument (for example `channels as 3 | 4`), fix the cast to the type in `node_modules/react-native-fast-opencv/src/objects/Objects.ts`, not with `any`.

- [ ] **Step 4: Write the failing recognise tests.** Create `recognise.test.ts`:

```ts
import type { TfliteModel } from './classifier'
import { findGrid } from './findGrid'
import { downscaleSize, searchRect, toPhotoPixels } from './photoGeometry'
import { FLAT_SIZE, type Rect } from './pixels'
import type { Quad } from './quad'
import { CORNER_TOLERANCE, type ImageSource, recognise, SEARCH_GROW } from './recognise'
import { warpGrid } from './warp'

jest.mock('./findGrid', () => ({ findGrid: jest.fn() }))
jest.mock('./warp', () => ({ warpGrid: jest.fn() }))

const find = jest.mocked(findGrid)
const warp = jest.mocked(warpGrid)
const OUTPUTS = { digit: 0, kind: 1 }
// A 16:9 photo, smaller than the real one so the test stays fast.
const PHOTO = { width: 720, height: 1280 }
const SMALL = downscaleSize(PHOTO.width, PHOTO.height)
const LOCKED: Quad = [
  { x: 0.2, y: 0.3 },
  { x: 0.8, y: 0.3 },
  { x: 0.8, y: 0.65 },
  { x: 0.2, y: 0.65 },
]

function image(width: number, height: number, disposed: string[]): ImageSource {
  return {
    width,
    height,
    resize: (w, h) => image(w, h, disposed),
    toRawPixelData: () => ({ buffer: new ArrayBuffer(width * height * 4), width, height, pixelFormat: 'BGRA' }),
    dispose: () => disposed.push(`${width}x${height}`),
  }
}

function photo(disposed: string[] = []) {
  return { toImage: () => image(PHOTO.width, PHOTO.height, disposed) }
}

/** Every cell gets digit 3, printed. */
function model(): TfliteModel {
  const digit = new Float32Array(81 * 10)
  const kind = new Float32Array(81 * 4)
  for (let n = 0; n < 81; n++) {
    digit[n * 10 + 3] = 1
    kind[n * 4 + 1] = 1
  }
  return {
    inputs: [{ shape: [81, 32, 32, 1], dataType: 'float32' }],
    outputs: [{ shape: [81, 10] }, { shape: [81, 4] }],
    runSync: () => [digit.buffer.slice(0), kind.buffer.slice(0)],
  }
}

/** The quad as findGrid returns it for the crop rect: normalised to the crop. */
function inCrop(quad: Quad, rect: Rect): Quad {
  const map = (p: { x: number; y: number }) => ({
    x: (p.x * SMALL.width - rect.x) / rect.width,
    y: (p.y * SMALL.height - rect.y) / rect.height,
  })
  return [map(quad[0]), map(quad[1]), map(quad[2]), map(quad[3])]
}

function shifted(quad: Quad, dx: number): Quad {
  return [quad[0], quad[1], { x: quad[2].x + dx, y: quad[2].y }, quad[3]]
}

beforeEach(() => {
  jest.clearAllMocks()
  warp.mockImplementation((_raw, _corners, side) => ({
    buffer: new ArrayBuffer(side * side * 4),
    width: side,
    height: side,
    pixelFormat: 'BGRA',
  }))
})

it('uses the re-detected corners when they lie near the locked quad', () => {
  const near = shifted(LOCKED, 0.01)
  find.mockReturnValue({ quad: inCrop(near, searchRect(LOCKED, SMALL.width, SMALL.height, SEARCH_GROW)), score: 0.5 })
  const result = recognise(photo(), LOCKED, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expect(result.corners).toBe('redetected')
  expect(result.quad[2].x).toBeCloseTo(near[2].x, 6)
  expect(result.cornerOffset).toBeLessThanOrEqual(CORNER_TOLERANCE)
  expect(result.cells).toHaveLength(81)
  expect(result.cells[0]).toMatchObject({ digit: 3, kind: 'printed' })
})

it('searches only the grown box around the locked quad', () => {
  find.mockReturnValue(null)
  recognise(photo(), LOCKED, model(), OUTPUTS)
  const rect = searchRect(LOCKED, SMALL.width, SMALL.height, SEARCH_GROW)
  expect(find.mock.calls[0].slice(1)).toEqual([rect.width, rect.height])
  expect(find.mock.calls[0][0]).toHaveLength(rect.width * rect.height * 3)
})

it('keeps the locked quad when the found corners are too far', () => {
  const far = shifted(LOCKED, 0.1)
  find.mockReturnValue({ quad: inCrop(far, searchRect(LOCKED, SMALL.width, SMALL.height, SEARCH_GROW)), score: 0.5 })
  const result = recognise(photo(), LOCKED, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expect(result.corners).toBe('locked')
  expect(result.quad).toEqual(LOCKED)
  expect(result.cornerOffset).toBeGreaterThan(CORNER_TOLERANCE)
})

it('keeps the locked quad when the search finds nothing', () => {
  find.mockReturnValue(null)
  const result = recognise(photo(), LOCKED, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expect(result.corners).toBe('locked')
  expect(result.cornerOffset).toBeNull()
})

it('flattens the photo from the chosen corners in photo pixels', () => {
  find.mockReturnValue(null)
  recognise(photo(), LOCKED, model(), OUTPUTS)
  expect(warp.mock.calls[0][0]).toMatchObject({ width: PHOTO.width, height: PHOTO.height })
  expect(warp.mock.calls[0][1]).toEqual(toPhotoPixels(LOCKED, PHOTO.width, PHOTO.height))
  expect(warp.mock.calls[0][2]).toBe(FLAT_SIZE)
})

it('searches the whole photo when there is no quad', () => {
  find.mockReturnValue({ quad: LOCKED, score: 0.5 })
  const result = recognise(photo(), null, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expect(result.corners).toBe('found')
  expect(find.mock.calls[0].slice(1)).toEqual([SMALL.width, SMALL.height])
})

it('fails when there is no quad and no grid in the photo', () => {
  find.mockReturnValue(null)
  expect(recognise(photo(), null, model(), OUTPUTS)).toEqual({ ok: false, reason: 'no grid in the photo' })
})

it('fails with the reason when a step throws, and disposes every image', () => {
  find.mockReturnValue(null)
  warp.mockImplementation(() => {
    throw new Error('warp failed')
  })
  const disposed: string[] = []
  expect(recognise(photo(disposed), LOCKED, model(), OUTPUTS)).toEqual({ ok: false, reason: 'warp failed' })
  expect(disposed.sort()).toEqual([`${PHOTO.width}x${PHOTO.height}`, `${SMALL.width}x${SMALL.height}`].sort())
})

it('gives the time of each step', () => {
  find.mockReturnValue(null)
  const result = recognise(photo(), LOCKED, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expect(Object.keys(result.timings).sort()).toEqual(['classifyMs', 'detectMs', 'flattenMs', 'imageMs'])
})
```

  Run `pnpm --filter mobile exec jest src/scanner/recognise.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 5: Implement `recognise.ts`.**

```ts
import { type CellResult, decodeOutputs, type OutputIndex, runModel, type TfliteModel } from './classifier'
import { findGrid } from './findGrid'
import { cornerOffset, downscaleSize, fromCrop, searchRect, toPhotoPixels } from './photoGeometry'
import { cropRgb, FLAT_SIZE, type RawPixels, sliceCells, toRgb } from './pixels'
import { preprocessCells } from './preprocess'
import type { Quad } from './quad'
import { warpGrid } from './warp'

// Capture flow design, "recognise(photo, quad)". Every function here runs on the scanner runtime.

/** The part of a nitro-image Image that recognise uses. */
export type ImageSource = {
  width: number
  height: number
  resize(width: number, height: number): ImageSource
  toRawPixelData(): RawPixels
  dispose(): void
}

/** The part of a VisionCamera Photo that recognise uses. toImage applies the EXIF orientation. */
export type PhotoSource = { toImage(): ImageSource }

/** redetected: found near the locked quad. locked: the locked quad itself. found: a search of the whole photo, after a shutter press without a grid. */
export type CornerSource = 'redetected' | 'locked' | 'found'

/** Milliseconds. */
export type RecogniseTimings = { imageMs: number; detectMs: number; flattenMs: number; classifyMs: number }

/** quad: the corners used, normalised to the upright photo. cornerOffset: of the re-detected corners from the locked quad, as a share of the grid side, or null. */
export type RecogniseResult =
  | { ok: true; cells: CellResult[]; quad: Quad; corners: CornerSource; cornerOffset: number | null; timings: RecogniseTimings }
  | { ok: false; reason: string }

/** A re-detected corner farther than this share of the grid side from the locked corner belongs to another grid. */
export const CORNER_TOLERANCE = 0.04
/** The search box around the locked quad grows by this share of its size on each side. */
export const SEARCH_GROW = 0.1

type Located = { quad: Quad; corners: CornerSource; cornerOffset: number | null }

/** small: the RGB photo, width × height. quad: the locked quad, normalised, or null. Null when there is no quad and no grid. */
export function locateGrid(small: Uint8Array, width: number, height: number, quad: Quad | null): Located | null {
  'worklet'
  if (quad == null) {
    const found = findGrid(small, width, height)
    return found == null ? null : { quad: found.quad, corners: 'found', cornerOffset: null }
  }
  const rect = searchRect(quad, width, height, SEARCH_GROW)
  const found = findGrid(cropRgb(small, width, rect), rect.width, rect.height)
  if (found == null) return { quad, corners: 'locked', cornerOffset: null }
  const candidate = fromCrop(found.quad, rect, width, height)
  const offset = cornerOffset(candidate, quad, width, height)
  return offset <= CORNER_TOLERANCE
    ? { quad: candidate, corners: 'redetected', cornerOffset: offset }
    : { quad, corners: 'locked', cornerOffset: offset }
}

/** quad: the locked quad, normalised to the upright frame, or null for a shutter press without a grid. Never throws. */
export function recognise(
  photo: PhotoSource,
  quad: Quad | null,
  model: TfliteModel,
  outputs: OutputIndex,
): RecogniseResult {
  'worklet'
  const images: ImageSource[] = []
  try {
    let started = Date.now()
    const image = photo.toImage()
    images.push(image)
    const size = downscaleSize(image.width, image.height)
    const small = image.resize(size.width, size.height)
    images.push(small)
    const smallRaw = small.toRawPixelData()
    const smallRgb = toRgb(smallRaw)
    const full = image.toRawPixelData()
    const imageMs = Date.now() - started

    started = Date.now()
    const located = locateGrid(smallRgb, smallRaw.width, smallRaw.height, quad)
    if (located == null) return { ok: false, reason: 'no grid in the photo' }
    const detectMs = Date.now() - started

    started = Date.now()
    const flat = toRgb(warpGrid(full, toPhotoPixels(located.quad, full.width, full.height), FLAT_SIZE))
    const cellImages = sliceCells(flat)
    const flattenMs = Date.now() - started

    started = Date.now()
    const cells = decodeOutputs(runModel(model, outputs, preprocessCells(cellImages)))
    const classifyMs = Date.now() - started

    return {
      ok: true,
      cells,
      quad: located.quad,
      corners: located.corners,
      cornerOffset: located.cornerOffset,
      timings: { imageMs, detectMs, flattenMs, classifyMs },
    }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  } finally {
    for (const image of images) image.dispose()
  }
}
```

  Run the recognise tests. Expected: PASS.

- [ ] **Step 6: Write the failing scanner tests.** Create `scanner.test.ts`:

```ts
import type { Photo } from 'react-native-vision-camera'
import { createWorkletRuntime } from 'react-native-worklets'
import { loadClassifier } from './model'
import type { Quad } from './quad'
import { recognise } from './recognise'

jest.mock('./model', () => ({ loadClassifier: jest.fn() }))
jest.mock('./recognise', () => ({ recognise: jest.fn() }))
jest.mock('react-native-worklets', () => ({
  createWorkletRuntime: jest.fn(() => ({ name: 'scanner' })),
  runOnRuntimeAsync: jest.fn(async (_runtime: unknown, worklet: (...args: unknown[]) => unknown, ...args: unknown[]) =>
    worklet(...args),
  ),
}))

const QUAD: Quad = [
  { x: 0.2, y: 0.3 },
  { x: 0.8, y: 0.3 },
  { x: 0.8, y: 0.65 },
  { x: 0.2, y: 0.65 },
]
const MODEL = { runSync: jest.fn() }
const photo = {} as Photo

// createScanner keeps one promise per module, so each test loads a fresh module.
function freshScanner(): Promise<import('./scanner').Scanner> {
  let module: typeof import('./scanner') | undefined
  jest.isolateModules(() => {
    module = require('./scanner')
  })
  return module!.createScanner()
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(loadClassifier).mockResolvedValue({
    model: MODEL,
    manifest: { outputs: { digit: 0, kind: 1 } },
  } as unknown as Awaited<ReturnType<typeof loadClassifier>>)
})

it('runs recognise with the photo, the quad, the model and the output index', async () => {
  jest.mocked(recognise).mockReturnValue({ ok: false, reason: 'no grid in the photo' })
  const scanner = await freshScanner()
  await scanner.recognise(photo, QUAD)
  expect(recognise).toHaveBeenCalledWith(photo, QUAD, MODEL, { digit: 0, kind: 1 })
})

it('makes one scanner runtime for many calls', async () => {
  jest.mocked(recognise).mockReturnValue({ ok: false, reason: 'no grid in the photo' })
  const scanner = await freshScanner()
  await scanner.recognise(photo, QUAD)
  await scanner.recognise(photo, null)
  expect(createWorkletRuntime).toHaveBeenCalledTimes(1)
})

it('turns a rejected run into a failure', async () => {
  const { runOnRuntimeAsync } = jest.requireMock('react-native-worklets')
  runOnRuntimeAsync.mockRejectedValueOnce(new Error('runtime crashed'))
  const scanner = await freshScanner()
  await expect(scanner.recognise(photo, QUAD)).resolves.toEqual({ ok: false, reason: 'runtime crashed' })
})

it('rejects when the model does not load', async () => {
  jest.mocked(loadClassifier).mockRejectedValue(new Error('the scanner does not implement model contract 2.0'))
  await expect(freshScanner()).rejects.toThrow('model contract 2.0')
})
```

  Run `pnpm --filter mobile exec jest src/scanner/scanner.test.ts`. Expected: FAIL (module not found).

  Note: `jest.isolateModules` gives `./scanner` a fresh module registry, so its mocks must come from the same registry. If the mocked `recognise` that `./scanner` sees is not the one the test sees, move the `require` of `./recognise`, `./model` and `react-native-worklets` into the same `isolateModules` block and return them with the scanner. Keep the assertions as they are.

- [ ] **Step 7: Implement `scanner.ts`.**

```ts
import type { Photo } from 'react-native-vision-camera'
import { createWorkletRuntime, runOnRuntimeAsync, type WorkletRuntime } from 'react-native-worklets'
import { loadClassifier } from './model'
import type { Quad } from './quad'
import { recognise, type RecogniseResult } from './recognise'

/** recognise never rejects: a failure is a result with ok false. */
export type Scanner = { recognise(photo: Photo, quad: Quad | null): Promise<RecogniseResult> }

let runtime: WorkletRuntime | null = null
let scanner: Promise<Scanner> | null = null

/** The scanner runtime: one per app, made at the first scan (capture flow design, "Architecture"). */
function scannerRuntime(): WorkletRuntime {
  if (runtime == null) runtime = createWorkletRuntime({ name: 'scanner' })
  return runtime
}

/** Loads the model once per app. A model that breaks the contract rejects every call with the same ModelContractError. */
export function createScanner(): Promise<Scanner> {
  if (scanner == null) scanner = loadScanner()
  return scanner
}

async function loadScanner(): Promise<Scanner> {
  const { model, manifest } = await loadClassifier()
  const outputs = manifest.outputs
  return {
    recognise: (photo, quad) =>
      runOnRuntimeAsync(scannerRuntime(), recognise, photo, quad, model, outputs).catch(
        (error: unknown): RecogniseResult => ({
          ok: false,
          reason: error instanceof Error ? error.message : String(error),
        }),
      ),
  }
}
```

  If TypeScript refuses `photo` for `PhotoSource` (the nitro `Image` type differs from `ImageSource`), add a narrow cast at this one call with a comment that names the structural match, for example `photo as PhotoSource // nitro-image Image has every ImageSource member`. Do not widen `ImageSource`.

  Run the scanner tests. Expected: PASS.

- [ ] **Step 8: Export through the boundary.** In `src/scanner/index.ts`, add:

```ts
export { type CornerSource, type RecogniseResult, type RecogniseTimings } from './recognise'
export { createScanner, type Scanner } from './scanner'
```

- [ ] **Step 9: Check.** Run `just lint`, `just typecheck`, `just test-ts`, `just boundaries`. Expected: all pass.

- [ ] **Step 10: Commit.**

```bash
/usr/bin/git add apps/mobile/src/scanner
/usr/bin/git commit -m "feat(scanner): recognise a photo on the scanner runtime (#6)"
```

---

### Task 6: The capture hook and the result view

**Files:**
- Modify: `apps/mobile/package.json`, `pnpm-lock.yaml` (through `expo install`)
- Modify: `apps/mobile/jest.setup.ts`
- Create: `apps/mobile/src/scan/useCapture.ts`, `apps/mobile/src/scan/useCapture.test.tsx`
- Create: `apps/mobile/src/scan/ResultView.tsx`, `apps/mobile/src/scan/ResultView.test.tsx`

**Interfaces:**
- Consumes: `createScanner`, `Scanner`, `RecogniseResult`, `Quad` from `../scanner`.
- Produces (`useCapture.ts`):

```ts
export type CaptureState = { phase: 'live' } | { phase: 'recognising' } | { phase: 'result'; result: RecogniseResult }
export function formatScanLog(photoMs: number, totalMs: number, result: RecogniseResult): string
export function useCapture(photoOutput: Pick<CameraPhotoOutput, 'capturePhoto'>): {
  state: CaptureState
  capture: (quad: Quad | null) => void   // stable identity, safe to call from scheduleOnRN
  retake: () => void
}
```

- Produces (`ResultView.tsx`): `ResultView({ result, onRetake }: { result: RecogniseResult; onRetake: () => void })`. testIDs: `result-view`, `result-cell-<n>` (n = 0..80), `result-failure`, `retake`.

- [ ] **Step 1: Add expo-haptics.** Read `https://docs.expo.dev/versions/v57.0.0/sdk/haptics/` and check that `impactAsync` and `ImpactFeedbackStyle.Light` exist in SDK 57. Then, from `apps/mobile`:

```bash
pnpm exec expo install expo-haptics
```

  Expected: `package.json` gets `expo-haptics` with a `~57.x` range. Add to `jest.setup.ts`, after the `react-native-fast-tflite` mock:

```ts
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light' },
}))
```

  Add to the `react-native-vision-camera` mock in `jest.setup.ts`:

```ts
    usePhotoOutput: jest.fn(() => ({ capturePhoto: jest.fn() })),
    CommonResolutions: { UHD_16_9: { width: 2160, height: 3840 } },
```

- [ ] **Step 2: Write the failing hook tests.** Create `useCapture.test.tsx`:

```ts
import { act, renderHook } from '@testing-library/react-native'
import { impactAsync } from 'expo-haptics'
import type { Photo } from 'react-native-vision-camera'
import { createScanner, type Quad, type RecogniseResult } from '../scanner'
import { formatScanLog, useCapture } from './useCapture'

jest.mock('../scanner', () => ({ ...jest.requireActual('../scanner'), createScanner: jest.fn() }))

const QUAD: Quad = [
  { x: 0.2, y: 0.3 },
  { x: 0.8, y: 0.3 },
  { x: 0.8, y: 0.65 },
  { x: 0.2, y: 0.65 },
]
const OK: RecogniseResult = {
  ok: true,
  cells: [],
  quad: QUAD,
  corners: 'redetected',
  cornerOffset: 0.012,
  timings: { imageMs: 80, detectMs: 15, flattenMs: 20, classifyMs: 60 },
}

function setup(result: RecogniseResult = OK) {
  const photo = { dispose: jest.fn() } as unknown as Photo
  const output = { capturePhoto: jest.fn(async () => photo) }
  const recognise = jest.fn(async () => result)
  jest.mocked(createScanner).mockResolvedValue({ recognise })
  const hook = renderHook(() => useCapture(output))
  return { hook, output, photo, recognise }
}

beforeEach(() => jest.clearAllMocks())

it('plays the haptic, takes a photo and recognises it with the quad', async () => {
  const { hook, output, photo, recognise } = setup()
  await act(async () => hook.result.current.capture(QUAD))
  expect(impactAsync).toHaveBeenCalledTimes(1)
  expect(output.capturePhoto).toHaveBeenCalledTimes(1)
  expect(output.capturePhoto).toHaveBeenCalledWith({ enableShutterSound: false }, {})
  expect(recognise).toHaveBeenCalledWith(photo, QUAD)
  expect(photo.dispose).toHaveBeenCalledTimes(1)
  expect(hook.result.current.state).toEqual({ phase: 'result', result: OK })
})

it('shows the recognising phase while the scan runs', () => {
  const { hook } = setup()
  act(() => hook.result.current.capture(QUAD))
  expect(hook.result.current.state).toEqual({ phase: 'recognising' })
})

it('takes one photo when capture comes twice', async () => {
  const { hook, output } = setup()
  await act(async () => {
    hook.result.current.capture(QUAD)
    hook.result.current.capture(null)
  })
  expect(output.capturePhoto).toHaveBeenCalledTimes(1)
})

it('gives a failure with the reason when the photo fails', async () => {
  const { hook, output } = setup()
  output.capturePhoto.mockRejectedValueOnce(new Error('the camera is not ready'))
  await act(async () => hook.result.current.capture(QUAD))
  expect(hook.result.current.state).toEqual({ phase: 'result', result: { ok: false, reason: 'the camera is not ready' } })
})

it('gives a failure without a photo when the model did not load', async () => {
  const { hook, output } = setup()
  jest.mocked(createScanner).mockRejectedValue(new Error('the scanner does not implement model contract 2.0'))
  await act(async () => hook.result.current.capture(QUAD))
  expect(output.capturePhoto).not.toHaveBeenCalled()
  expect(hook.result.current.state).toMatchObject({ phase: 'result', result: { ok: false } })
})

it('goes back to live on retake, and captures again', async () => {
  const { hook, output } = setup()
  await act(async () => hook.result.current.capture(QUAD))
  act(() => hook.result.current.retake())
  expect(hook.result.current.state).toEqual({ phase: 'live' })
  await act(async () => hook.result.current.capture(QUAD))
  expect(output.capturePhoto).toHaveBeenCalledTimes(2)
})

it('keeps capture the same function across renders', () => {
  const { hook } = setup()
  const first = hook.result.current.capture
  hook.rerender({})
  expect(hook.result.current.capture).toBe(first)
})

describe('formatScanLog', () => {
  it('gives the time of each step', () => {
    expect(formatScanLog(120, 310, OK)).toBe(
      '[scan] photo 120 ms, image 80 ms, detect 15 ms (redetected, offset 1.2 %), flatten 20 ms, classify 60 ms, total 310 ms',
    )
  })

  it('gives the reason of a failure', () => {
    expect(formatScanLog(120, 200, { ok: false, reason: 'no grid in the photo' })).toBe(
      '[scan] failed after 200 ms: no grid in the photo',
    )
  })
})
```

  Run `pnpm --filter mobile exec jest src/scan/useCapture.test.tsx`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `useCapture.ts`.**

```ts
import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CameraPhotoOutput } from 'react-native-vision-camera'
import { createScanner, type Quad, type RecogniseResult } from '../scanner'

export type CaptureState = { phase: 'live' } | { phase: 'recognising' } | { phase: 'result'; result: RecogniseResult }

/** photoMs: from capture to the photo. totalMs: from capture to the result. */
export function formatScanLog(photoMs: number, totalMs: number, result: RecogniseResult): string {
  if (!result.ok) return `[scan] failed after ${totalMs} ms: ${result.reason}`
  const t = result.timings
  const offset = result.cornerOffset == null ? '' : `, offset ${(result.cornerOffset * 100).toFixed(1)} %`
  return (
    `[scan] photo ${photoMs} ms, image ${t.imageMs} ms, detect ${t.detectMs} ms (${result.corners}${offset}), ` +
    `flatten ${t.flattenMs} ms, classify ${t.classifyMs} ms, total ${totalMs} ms`
  )
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** capture keeps its identity, because the UI thread holds it from the first frame. A second capture before retake does nothing. */
export function useCapture(photoOutput: Pick<CameraPhotoOutput, 'capturePhoto'>) {
  const [state, setState] = useState<CaptureState>({ phase: 'live' })
  const output = useRef(photoOutput)
  const busy = useRef(false)

  useEffect(() => {
    output.current = photoOutput
  }, [photoOutput])

  // The model loads at start, so the first scan does not wait for it. A load failure shows at the first capture.
  useEffect(() => {
    createScanner().catch(() => undefined)
  }, [])

  const capture = useCallback((quad: Quad | null) => {
    if (busy.current) return
    busy.current = true
    setState({ phase: 'recognising' })
    const started = Date.now()
    impactAsync(ImpactFeedbackStyle.Light).catch(() => undefined)
    void (async () => {
      let photoMs = 0
      let result: RecogniseResult
      try {
        const scanner = await createScanner()
        // The haptic is the feedback. The developer chose no shutter sound.
        const photo = await output.current.capturePhoto({ enableShutterSound: false }, {})
        photoMs = Date.now() - started
        try {
          result = await scanner.recognise(photo, quad)
        } finally {
          photo.dispose()
        }
      } catch (error) {
        result = { ok: false, reason: reasonOf(error) }
      }
      if (__DEV__) console.log(formatScanLog(photoMs, Date.now() - started, result))
      setState({ phase: 'result', result })
    })()
  }, [])

  const retake = useCallback(() => {
    busy.current = false
    setState({ phase: 'live' })
  }, [])

  return { state, capture, retake }
}
```

  Run the hook tests. Expected: PASS. If the console output of `[scan]` lines makes the test noisy, spy on `console.log` in the test with `jest.spyOn(console, 'log').mockImplementation(() => undefined)` in `beforeEach`.

- [ ] **Step 4: Write the failing result view tests.** Create `ResultView.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import type { CellResult, RecogniseResult } from '../scanner'
import { ResultView } from './ResultView'

function cells(): CellResult[] {
  return Array.from({ length: 81 }, (_, n) => {
    if (n === 0) return { digit: 5, kind: 'printed', confidence: 0.99, validPair: true }
    if (n === 1) return { digit: 7, kind: 'handwritten', confidence: 0.95, validPair: true }
    return { digit: 0, kind: 'none', confidence: 0.99, validPair: true }
  })
}

const OK: RecogniseResult = {
  ok: true,
  cells: cells(),
  quad: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
  corners: 'locked',
  cornerOffset: null,
  timings: { imageMs: 0, detectMs: 0, flattenMs: 0, classifyMs: 0 },
}

it('shows 81 cells with the digit and the kind', () => {
  render(<ResultView result={OK} onRetake={jest.fn()} />)
  expect(screen.getAllByTestId(/^result-cell-/)).toHaveLength(81)
  expect(screen.getByTestId('result-cell-0')).toHaveTextContent('5P')
  expect(screen.getByTestId('result-cell-1')).toHaveTextContent('7H')
  expect(screen.getByTestId('result-cell-2')).toHaveTextContent('')
})

it('shows the reason of a failure', () => {
  render(<ResultView result={{ ok: false, reason: 'no grid in the photo' }} onRetake={jest.fn()} />)
  expect(screen.getByTestId('result-failure')).toHaveTextContent('The scan failed: no grid in the photo')
  expect(screen.queryByTestId('result-cell-0')).toBeNull()
})

it('calls onRetake', () => {
  const onRetake = jest.fn()
  render(<ResultView result={OK} onRetake={onRetake} />)
  fireEvent.press(screen.getByTestId('retake'))
  expect(onRetake).toHaveBeenCalledTimes(1)
})
```

  Run it. Expected: FAIL (module not found). If `toHaveTextContent` is not available, use `expect(within(cell).getByText('5')).toBeTruthy()` style assertions instead; check how `CameraScreen.test.tsx` asserts text and follow it.

- [ ] **Step 5: Implement `ResultView.tsx`.**

```tsx
import { StatusBar } from 'expo-status-bar'
import { Button, StyleSheet, Text, View } from 'react-native'
import type { Kind, RecogniseResult } from '../scanner'

// Issue #19 replaces this view with the correction screen.

const KIND_LABEL: { [kind in Kind]: string } = { none: '', notes: '', printed: 'P', handwritten: 'H' }

export function ResultView({ result, onRetake }: { result: RecogniseResult; onRetake: () => void }) {
  return (
    <View testID="result-view" style={styles.screen}>
      <StatusBar style="dark" />
      {result.ok ? (
        <View style={styles.grid}>
          {result.cells.map((cell, n) => (
            <View key={n} testID={`result-cell-${n}`} style={styles.cell}>
              <Text style={styles.digit}>{cell.digit === 0 ? '' : String(cell.digit)}</Text>
              <Text style={styles.kind}>{KIND_LABEL[cell.kind]}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text testID="result-failure" style={styles.message}>
          The scan failed: {result.reason}
        </Text>
      )}
      <Button testID="retake" title="Retake" onPress={onRetake} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 16, backgroundColor: 'white' },
  grid: { width: '100%', aspectRatio: 1, flexDirection: 'row', flexWrap: 'wrap', borderWidth: 2 },
  cell: {
    width: `${100 / 9}%`,
    height: `${100 / 9}%`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  digit: { fontSize: 22, fontWeight: '600' },
  kind: { position: 'absolute', right: 2, bottom: 1, fontSize: 9 },
  message: { fontSize: 17, textAlign: 'center' },
})
```

  Run the result view tests. Expected: PASS.

- [ ] **Step 6: Check.** Run `just lint`, `just typecheck`, `just test-ts`. Expected: all pass.

- [ ] **Step 7: Commit.**

```bash
/usr/bin/git add apps/mobile/package.json pnpm-lock.yaml apps/mobile/jest.setup.ts apps/mobile/src/scan/useCapture.ts apps/mobile/src/scan/useCapture.test.tsx apps/mobile/src/scan/ResultView.tsx apps/mobile/src/scan/ResultView.test.tsx
/usr/bin/git commit -m "feat(scan): capture a photo, recognise it and show the result (#6)"
```

---

### Task 7: Wire lock-on and the shutter into the camera screen

**Files:**
- Modify: `apps/mobile/src/scan/effects/EffectCanvas.tsx`, `EffectCanvas.test.tsx`
- Modify: `apps/mobile/src/scan/CameraScreen.tsx`, `CameraScreen.test.tsx`

**Interfaces:**
- Consumes: `scene.lockedAt` (Task 2), `useCapture` and `ResultView` (Task 6).
- Produces: `EffectCanvas` props gain `frameQuad: SharedValue<Quad | null>` (the smoothed quad, normalised to the upright frame) and `onLock: (quad: Quad) => void`.

- [ ] **Step 1: Write the failing EffectCanvas test.** Read the top of `EffectCanvas.test.tsx` to see how it renders the canvas and how it reaches the `useFrameCallback` worklet. Add (reuse the file's helpers where they exist; this version is self-contained):

```tsx
describe('lock-on', () => {
  const VIEW: ViewSize = { width: 402, height: 874 }
  const GRID: Quad = [
    { x: 50, y: 300 },
    { x: 350, y: 300 },
    { x: 350, y: 600 },
    { x: 50, y: 600 },
  ]
  const NORMALISED: Quad = [
    { x: 0.2, y: 0.3 },
    { x: 0.8, y: 0.3 },
    { x: 0.8, y: 0.65 },
    { x: 0.2, y: 0.65 },
  ]
  /** A shared value that gives a new quad object per read, as the camera gives one per detection. */
  function fresh(quad: Quad): SharedValue<Quad | null> {
    const copy = () => quad.map((p) => ({ ...p })) as Quad
    return { get: copy, value: copy() } as unknown as SharedValue<Quad | null>
  }
  function constant<T>(value: T): SharedValue<T> {
    return { get: () => value, value } as unknown as SharedValue<T>
  }

  it('calls onLock once, with the normalised quad, when the scene locks on', async () => {
    const onLock = jest.fn()
    render(
      <EffectCanvas
        outline={fresh(GRID)}
        view={constant(VIEW)}
        effect={constant(DEFAULT_INDEX)}
        frameQuad={constant<Quad | null>(NORMALISED)}
        onLock={onLock}
      />,
    )
    const callback = jest.mocked(useFrameCallback).mock.calls.at(-1)![0]
    for (let ms = 0; ms <= 3000; ms += 1000 / 60) callback({ timestamp: ms } as never)
    // The worklets mock runs scheduleOnRN in a microtask.
    await new Promise((resolve) => setImmediate(resolve))
    expect(onLock).toHaveBeenCalledTimes(1)
    expect(onLock).toHaveBeenCalledWith(NORMALISED)
  })
})
```

  If the file mocks `./index` with test effects, the test effects still step the real scene through `advance()`, so the lock-on happens. Run `pnpm --filter mobile exec jest src/scan/effects/EffectCanvas.test.tsx`. Expected: FAIL (`onLock` not called; TypeScript may also complain about the new props).

- [ ] **Step 2: Implement in `EffectCanvas.tsx`.**
  - Add to the props and their type: `frameQuad: SharedValue<Quad | null>` and `onLock: (quad: Quad) => void`.
  - Extend the comment: `frameQuad: the same grid, normalised to the upright frame. onLock: called once per scene, on the JS thread, with frameQuad at lock-on.`
  - After `if (now == null) return`, add:

```ts
    // lockedAt equals t only in the frame of lock-on, so the quad crosses to the JS thread once.
    if (now.scene.lockedAt === t) {
      const locked = frameQuad.get()
      if (locked != null) scheduleOnRN(onLock, locked)
    }
```

  Update every other `<EffectCanvas … />` in the tests with the two new props. Run the EffectCanvas tests. Expected: PASS.

- [ ] **Step 3: Write the failing camera screen tests.** In `CameraScreen.test.tsx`, mock the capture hook and the result view at the top:

```tsx
import { ResultView } from './ResultView'
import { useCapture } from './useCapture'

jest.mock('./useCapture', () => ({ useCapture: jest.fn() }))
jest.mock('./ResultView', () => ({ ResultView: jest.fn(() => null) }))

const captureHook = jest.mocked(useCapture)
const capture = jest.fn()
const retake = jest.fn()

function givenPhase(state: ReturnType<typeof useCapture>['state']) {
  captureHook.mockReturnValue({ state, capture, retake })
}
```

  Call `givenPhase({ phase: 'live' })` in the file's `beforeEach`. Add:

```tsx
describe('capture', () => {
  it('passes capture to the canvas as onLock', () => {
    givenPermission('authorized')
    render(<CameraScreen />)
    expect(jest.mocked(EffectCanvas).mock.calls.at(-1)![0]).toMatchObject({ onLock: capture })
  })

  it('captures the current frame quad on a shutter press', () => {
    givenPermission('authorized')
    render(<CameraScreen />)
    fireEvent.press(screen.getByTestId('shutter'))
    expect(capture).toHaveBeenCalledWith(null)
  })

  it('shows a spinner instead of the shutter while it recognises', () => {
    givenPermission('authorized')
    givenPhase({ phase: 'recognising' })
    render(<CameraScreen />)
    expect(screen.getByTestId('recognising')).toBeTruthy()
    expect(screen.queryByTestId('shutter')).toBeNull()
  })

  it('shows the result view with retake after a scan', () => {
    givenPermission('authorized')
    const result = { ok: false as const, reason: 'no grid in the photo' }
    givenPhase({ phase: 'result', result })
    render(<CameraScreen />)
    expect(screen.queryByTestId('camera')).toBeNull()
    expect(jest.mocked(ResultView).mock.calls.at(-1)![0]).toEqual({ result, onRetake: retake })
  })

  it('adds the photo output to the camera', () => {
    givenPermission('authorized')
    render(<CameraScreen />)
    expect(screen.getByTestId('camera').props.outputs).toHaveLength(2)
  })
})
```

  Run `pnpm --filter mobile exec jest src/scan/CameraScreen.test.tsx`. Expected: the new tests FAIL.

- [ ] **Step 4: Implement in `CameraScreen.tsx`.**
  - Imports: add `ActivityIndicator, Pressable` from `react-native`; `CommonResolutions, usePhotoOutput` from `react-native-vision-camera`; `ResultView` from `./ResultView`; `useCapture` from `./useCapture`.
  - After `const effect = …`, add:

```tsx
  const frameQuad = useSharedValue<Quad | null>(null)
  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.UHD_16_9,
    // 'speed' throws on a device without it (VisionCamera, PhotoOutputOptions).
    qualityPrioritization: device?.supportsSpeedQualityPrioritization === true ? 'speed' : 'balanced',
  })
  const { state, capture, retake } = useCapture(photoOutput)
```

  - In the `useAnimatedReaction` body, after `smoothing.set(smoothed)`, add `frameQuad.set(smoothed == null ? null : smoothed.quad)`.
  - After the `device == null` branch, add:

```tsx
  if (state.phase === 'result') return <ResultView result={state.result} onRetake={retake} />
```

  - Change `outputs={[frameOutput]}` to `outputs={[frameOutput, photoOutput]}`.
  - Give `EffectCanvas` the props `frameQuad={frameQuad}` and `onLock={capture}`.
  - After `EffectCanvas` and before the `EffectPicker` line, add:

```tsx
      <View style={styles.bottom} pointerEvents="box-none">
        {state.phase === 'recognising' ? (
          <ActivityIndicator testID="recognising" color="white" size="large" />
        ) : (
          <Pressable
            testID="shutter"
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            style={styles.shutter}
            onPress={() => capture(frameQuad.get())}
          />
        )}
      </View>
```

  - Add to `styles`:

```ts
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 48, alignItems: 'center' },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.3)' },
```

  - Check `supportsSpeedQualityPrioritization` in `node_modules/react-native-vision-camera/src/specs/inputs/CameraDevice.nitro.ts`. If the name differs, use the real name.

  Run the camera screen tests. Expected: PASS. Then run all app tests: `App.test.tsx` renders the real `CameraScreen` and `useCapture`. If it now fails because `createScanner` runs, check that `jest.setup.ts` mocks fast-tflite (it does) and that the failure is not a real bug before you change the test.

- [ ] **Step 5: Check.** Run `just lint`, `just typecheck`, `just test-ts`, `just boundaries`. Expected: all pass.

- [ ] **Step 6: Commit.**

```bash
/usr/bin/git add apps/mobile/src/scan
/usr/bin/git commit -m "feat(scan): capture at lock-on or on the shutter, then show the result (#6)"
```

---

### Task 8: Run on the iPhone, tune and record

The controller runs this task with the developer. It needs the phone and a printed sudoku. A subagent can write the doc changes in Step 6 from the numbers.

**Files:**
- Modify (only when tuning needs it): `apps/mobile/src/scan/effects/scene.ts`
- Modify: `docs/architecture/adr/adr-002-react-native-and-scanner-engine.md`
- Modify: `docs/architecture/00-concepts/scan-pipeline.md`
- Modify: `docs/superpowers/specs/2026-10-11-capture-flow-design.md` (section "Open questions")

- [ ] **Step 1: Build.** Run `just bundle` from the repository root. Expected: the bundle passes. Ask the developer to connect the phone. Build as in "Device runs" (the new native module `expo-haptics` needs it).

- [ ] **Step 2: Lock-on.** Hold the phone still over a printed sudoku. Expected: the dots gather, settle and brighten; a light haptic at lock-on; a spinner; then the result view. Note how long the still phase felt. Repeat 5 times. Then hold the phone over a page with two grids and move slowly: it must not lock on while the outline switches grids.

- [ ] **Step 3: Read the logs.** For each scan, copy:
  - the `[scan]` line (photo, image, detect with the corner source and offset, flatten, classify, total);
  - the `[fx] gathering-dots … fps` lines while the spinner shows. Pass: 60 fps (± 2), the spec's "test animation on the UI thread".
  - Count how many of the 81 digits are right on the result view.

- [ ] **Step 4: Shutter.** Press the shutter with a grid in view (expected: a result), and over an empty table (expected: "The scan failed: no grid in the photo" and Retake works).

- [ ] **Step 5: Tune.** If lock-on comes too fast (a moving phone locks on) or too slow, change `LOCK_DWELL` (0.6 to 0.8), `STEADY_SPEED` or `STEADY_MOTION` in `scene.ts`, rebuild with a Metro reload and repeat Step 2. Run `just test-ts` after a change: the scene tests use the constants, not fixed numbers.

- [ ] **Step 6: Record.** Write the measured values in:
  - `scan-pipeline.md`, "Stages", row "Lock-on": the final `LOCK_DWELL`, `STEADY_SPEED`, `STEADY_MOTION`. Row "Rough flatten" and "Classification": the measured times. "Threads and coordinates", row "Capture source": the real path (`photo.toImage()` on the scanner runtime, `image.resize()` to 640 px for the re-detection, the warp of the BGRA photo). "Open questions": change the lock-on row to "Decided in #6: …".
  - `adr-002-…md`, under the block from Task 1, add "Result, capture (2026-10-11, issue #6)" with: the fast-opencv steps used (`cvtColor`, `GaussianBlur`, `adaptiveThreshold`, `findContours`, `approxPolyDP`, `getPerspectiveTransform`, `warpPerspective`) and that each works on the scanner runtime; the downscale uses nitro-image `resize()`; morphology is available and not needed; the UI frame rate during `recognise()`; the `[scan]` times. Do not change the ADR status: memory and thermal checks are still open.
  - The spec's "Open questions": the rows for `LOCK_DWELL …` and for "The photo and the video frames have the same field of view at 16:9". For the field of view, use the corner offsets from the logs: offsets under 4 % on most scans mean the same field of view; larger offsets mean `recognise()` must map through the crop. If the offsets are large, tell the developer before you write the answer.
  - Check `00-DECISIONS.md` and `09-architecture-decisions.md`: change them only if the one-line summary of ADR-002 is no longer true.

- [ ] **Step 7: Check.** Run `just docs-check`, `just lint`, `just typecheck`, `just test-ts`. Expected: all pass.

- [ ] **Step 8: Commit.** Commit tuning and docs separately:

```bash
/usr/bin/git add apps/mobile/src/scan/effects/scene.ts
/usr/bin/git commit -m "fix(scan): tune the lock-on rule on the iPhone (#6)"
/usr/bin/git add docs
/usr/bin/git commit -m "docs: record the capture timings and the lock-on values from the iPhone (#6)"
```

  Skip the first commit if nothing was tuned.

---

### Task 9: Whole-branch review

- [ ] **Step 1:** Run `just lint`, `just typecheck`, `just test-ts`, `just boundaries`, `just docs-check`, `just bundle`. Expected: all pass.
- [ ] **Step 2:** A fresh reviewer (without this session's context) reviews `origin/develop..HEAD` against the spec section "#6" and this plan's Review Focus. Fix the findings, or answer them.
- [ ] **Step 3:** Report to the developer: the acceptance criteria of issue #6 that are met, the device numbers, and the open items below. Do not push or open the pull request until the developer asks.

## Decisions from the plan review

- Issue #6, first acceptance criterion, now says `LOCK_DWELL` seconds instead of N frames (edited 2026-10-11).
- No shutter sound: `capturePhoto({ enableShutterSound: false }, {})`. The haptic is the feedback. iOS can still force the sound in some regions.
