# iPhone Development Build Implementation Plan (issue #2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run a development build of the app on the developer's iPhone. It shows the back camera full screen, and an empty frame processor logs the frame rate. GitHub issue #2.

**Architecture:** The app gets the VisionCamera 5 stack: Nitro modules and the `react-native-worklets` runtime, plus Reanimated and Skia for later issues. Native configuration lives in `app.json` only, because `ios/` is generated (CNG). A pure worklet function counts frames. The camera screen in `src/scan/` asks for permission, shows the preview, and logs the count through `scheduleOnRN`. A last task proves that `react-native-fast-opencv` builds and runs on the device. That is the first validation row of ADR-002.

**Tech Stack:** Expo SDK 57.0.27, React Native 0.86.3, React 19.2.3, pnpm workspaces, react-native-vision-camera 5.2.3, react-native-vision-camera-worklets 5.2.3, react-native-nitro-modules 0.37.1, react-native-nitro-image 0.15.2, react-native-worklets 0.10.1, react-native-reanimated 4.5.1, @shopify/react-native-skia 2.6.2, react-native-fast-opencv 1.0.1, jest-expo 57, React Native Testing Library.

**Spec (read these first):**
- `AGENTS.md` and `apps/mobile/AGENTS.md` (working rules, writing style, "do not trust remembered Expo APIs")
- `docs/architecture/adr/adr-002-react-native-and-scanner-engine.md` (the stack and its validation table)
- `docs/architecture/adr/adr-013-fixtures-and-data-licensing.md` (decision 5: the camera usage text)
- `docs/architecture/00-concepts/model-contract.md` (section Manifest: `tflite` in `assetExts`)
- `docs/architecture/05-building-block-view.md` §5.4 (the scanner interface)
- Issue #2: `gh issue view 2`. Its "Research notes (#11)" section names the packages.
- Research for this plan: VisionCamera 5.2.3 sources, Expo 57 `bundledNativeModules.json`, a scratch install and a scratch prebuild. The findings are in the "Verified facts" section below.

## Verified facts (from research before this plan)

- VisionCamera 5.2.3 has **no Expo config plugin**. The permission text goes in `ios.infoPlist.NSCameraUsageDescription`. Do not add it to `plugins`.
- **No `babel.config.js`.** `babel-preset-expo` 57 adds `react-native-worklets/plugin` when the package resolves. Do not add the plugin by hand.
- API: `useCameraPermission()` returns `{ status, hasPermission, canRequestPermission, requestPermission }`. `useCameraDevice('back')` returns `CameraDevice | undefined`. Render `<Camera device isActive outputs />`. `useFrameOutput({ pixelFormat, onFrame(frame) { 'worklet'; …; frame.dispose() } })`. `frame.timestamp` is in **seconds**. Use `scheduleOnRN(fn, ...args)` from `react-native-worklets` (`runOnJS` is deprecated). Use `createSynchronizable(initial)` with `getBlocking()` and `setBlocking()` for state across frames.
- **Always call `frame.dispose()`.** Without it, the frame pool stalls and frames drop.
- Jest: VisionCamera ships no mock. Mock both `react-native-worklets` (`react-native-worklets/lib/module/mock`) and `react-native-vision-camera`. Either one unmocked fails on import. The worklets mock's `createSynchronizable` is the identity function, so the setup file replaces it.
- The Expo 57 Podfile targets iOS 16.4, which covers VisionCamera. `expo-build-properties` is not needed.
- The **iOS simulator has no camera.** Camera checks need the real iPhone.
- Expo 57 needs **Xcode 26.4 or later**. This Mac now has Xcode 27.0.0 (through Xcodes.app). `xcode-select` still points at the Command Line Tools, and CocoaPods is not installed (checked 2026-10-09).
- fast-opencv 1.0.1: no config plugin, autolinks through its podspec, New Architecture only. Issue #117 is about RN 0.87, not 0.86. PR #119 is the fallback patch.

## Global Constraints

- Branch `feature/2-iphone-dev-build`. The pull request targets `develop`. Commits are Conventional Commits ending with `(#2)`. Do not push to `main` or `develop`.
- Do not create, edit or commit `apps/mobile/ios/` or `apps/mobile/android/` (ADR-002, CNG). Configure native behaviour in `app.json` only.
- Add Expo-managed packages with `pnpm exec expo install <package>` from `apps/mobile/`. Add the other native packages with `pnpm add <package>@<exact version>` from `apps/mobile/`. Pin exact versions (no `^` or `~`) for the non-Expo packages.
- Do not install `react-native-worklets-core`. VisionCamera 5 uses `react-native-worklets`.
- Do not add a `babel.config.js`.
- The camera usage text says that scans stay on the phone (ADR-013, SUD-02). Exact text: `Sudoku uses the camera to scan a paper sudoku. The photos never leave your iPhone.`
- Do not request the microphone. Do not add `NSMicrophoneUsageDescription`.
- `metro.config.js` lists `tflite` in `resolver.assetExts` (model contract).
- The app reaches the scanner only through `src/scanner/index.ts` (SUD-05). The game does not import the scanner (SUD-03). `just boundaries` checks both.
- CI runs on Linux without Xcode: `just typecheck`, `just lint-ts`, `just boundaries`, `just test-ts` and `just bundle` must pass without a native build.
- Prose follows the writing rules in `AGENTS.md`.

## Review Focus

1. **The developer denied the camera once.** iOS does not ask again. Expected: the screen says so and offers a button that opens the app's settings, not a blank screen. Pinned in Task 3.
2. **A frame processor that forgets `frame.dispose()` on an error.** The preview freezes after a few frames. Expected: `dispose()` runs even when the counting code throws. Pinned in Task 3 (the `onFrame` test).
3. **The frame clock jumps backwards or starts late** (the first frame, the session restarting after the app returns to the foreground). Expected: the meter restarts its window and never reports a negative or infinite rate. Pinned in Task 2.
4. **The app goes to the background and comes back.** VisionCamera issue #4209 crashes when a camera session is freed and recreated. Expected: the preview resumes and the app does not crash. Pinned by the device check in Task 4.
5. **CI has no native modules.** A native import in a file that Jest or `expo export` loads breaks CI. Expected: the setup file mocks every native package, and `just bundle` still passes. Pinned in Tasks 1, 3 and 5.

## File Structure

```
apps/mobile/
├── app.json                      # bundle id, camera text, iPhone only
├── metro.config.js               # Expo default + tflite asset extension
├── metro.config.test.js          # checks the tflite asset extension
├── jest.setup.ts                 # mocks for worklets, VisionCamera, fast-opencv
├── package.json                  # native dependencies, jest setupFiles
├── App.tsx                       # renders the camera screen
├── App.test.tsx
└── src/
    ├── scan/
    │   ├── frameRate.ts          # countFrame(): pure worklet frame-rate meter
    │   ├── frameRate.test.ts
    │   ├── CameraScreen.tsx      # permission, preview, frame-rate log
    │   └── CameraScreen.test.tsx
    └── scanner/
        ├── index.ts              # exports probeOpenCV (SUD-05)
        ├── opencvProbe.ts        # one Mat round trip through fast-opencv
        └── opencvProbe.test.ts
```

---

### Task 0: Prepare the Mac and the iPhone (developer)

This task is for the developer. An agent cannot do it, because it needs `sudo`, an Apple ID and the phone. The agent that runs the plan stops here, asks the developer to do it, and continues when the developer confirms.

- [x] **Step 1a: Install Xcode.** Done: `/Applications/Xcode-27.0.0.app` (through Xcodes.app). Expo 57 asks for Xcode 26.4 or later. Xcode 27 is newer than the version Expo 57 was tested with. If the build in Task 4 fails inside React Native or a pod with a compiler error, install Xcode 26.4+ beside it in Xcodes.app, select that one and retry. Record which Xcode built the app.
- [ ] **Step 1b: Select it.**
```bash
sudo xcode-select -s /Applications/Xcode-27.0.0.app
xcodebuild -version
```
Expected: `Xcode 27.0`.
- [ ] **Step 2: Accept the licence and install the iOS platform.** Run `sudo xcodebuild -license accept`. Then run `xcodebuild -downloadPlatform iOS`.
- [ ] **Step 3: Install CocoaPods.** Run `brew install cocoapods`. Then run `pod --version`. Expected: a version is printed.
- [ ] **Step 4: Sign in.** In Xcode → Settings → Accounts, add your Apple ID. A free personal team is enough for a development build.
- [ ] **Step 5: Prepare the iPhone.**
  1. Connect it with a cable.
  2. Trust the Mac.
  3. Turn on Settings → Privacy & Security → Developer Mode.
  4. Restart the phone.
- [ ] **Step 6: Confirm.** Tell the agent the Xcode version and the iPhone model with its iOS version.

---

### Task 1: Native dependencies and app configuration

**Files:**
- Modify: `apps/mobile/package.json`, `apps/mobile/app.json`, `pnpm-lock.yaml`
- Create: `apps/mobile/metro.config.js`, `apps/mobile/metro.config.test.js`, `apps/mobile/jest.setup.ts`

**Interfaces:**
- Produces: the installed packages, and a Jest setup file. In the setup file, `react-native-vision-camera` exports `Camera` (renders a `View` with `testID="camera"`), `useCameraPermission`, `useCameraDevice` and `useFrameOutput`, all `jest.fn()` that later tests override. `react-native-worklets` exports the library mock, plus a working `createSynchronizable` with `getBlocking`/`setBlocking`. `react-native-fast-opencv` exports `Mat.create` (returns `{ rows, cols, release: jest.fn() }`) and `DataTypes.CV_8U = 0`.

- [ ] **Step 1: Install the Expo-managed packages**

```bash
cd apps/mobile
pnpm exec expo install react-native-reanimated react-native-worklets @shopify/react-native-skia
```
Expected in `package.json`: `react-native-reanimated` `4.5.1`, `react-native-worklets` `0.10.1`, `@shopify/react-native-skia` `2.6.2` (Expo writes `~` ranges here, keep them).

- [ ] **Step 2: Install VisionCamera 5 and Nitro, with exact versions**

```bash
pnpm add react-native-vision-camera@5.2.3 react-native-vision-camera-worklets@5.2.3 react-native-nitro-modules@0.37.1 react-native-nitro-image@0.15.2 --save-exact
```
Run: `pnpm exec expo install --check`
Expected: `Dependencies are up to date`. If it reports a mismatch for an Expo-managed package, run the version it names through `expo install`. Report it.

- [ ] **Step 3: Configure `app.json`**

Change the `ios` block to:
```json
"ios": {
  "supportsTablet": false,
  "bundleIdentifier": "com.vandemaelefelix.sudoku",
  "infoPlist": {
    "NSCameraUsageDescription": "Sudoku uses the camera to scan a paper sudoku. The photos never leave your iPhone."
  }
}
```
Also set `"name": "Sudoku"` (the home-screen name and `$(PRODUCT_NAME)`). Keep `slug` as `mobile`. Do not add a `plugins` entry for VisionCamera.

- [ ] **Step 4: Write the failing Metro test**

`apps/mobile/metro.config.test.js`:
```js
const config = require('./metro.config')

describe('metro config', () => {
  it('bundles TFLite models as assets (model contract)', () => {
    expect(config.resolver.assetExts).toContain('tflite')
  })

  it('keeps the default image assets', () => {
    expect(config.resolver.assetExts).toContain('png')
  })
})
```
Run: `pnpm --filter mobile exec jest metro.config.test.js`
Expected: FAIL, `Cannot find module './metro.config'`.

- [ ] **Step 5: Write `metro.config.js`**

```js
// Expo's Metro defaults, plus the model file type (docs/architecture/00-concepts/model-contract.md).
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
config.resolver.assetExts.push('tflite')

module.exports = config
```
Run the test again. Expected: PASS. Then run `just bundle` from the repository root. Expected: the bundle builds.

- [ ] **Step 6: Write the Jest setup file**

`apps/mobile/jest.setup.ts`:
```ts
// Native modules do not exist in Jest. Each mock gives tests a stand-in they can override.

jest.mock('react-native-worklets', () => {
  const mock = jest.requireActual('react-native-worklets/lib/module/mock')
  return {
    ...mock,
    // The library mock returns the value itself. The camera screen needs a holder.
    createSynchronizable: <T,>(initial: T) => {
      let value = initial
      return {
        getBlocking: () => value,
        getDirty: () => value,
        setBlocking: (next: T | ((previous: T) => T)) => {
          value = typeof next === 'function' ? (next as (previous: T) => T)(value) : next
        },
      }
    },
  }
})

jest.mock('react-native-vision-camera', () => {
  const { View } = jest.requireActual('react-native')
  const { createElement } = jest.requireActual('react')
  return {
    Camera: (props: object) => createElement(View, { testID: 'camera', ...props }),
    useCameraPermission: jest.fn(() => ({
      status: 'authorized',
      hasPermission: true,
      canRequestPermission: false,
      requestPermission: jest.fn(async () => true),
    })),
    useCameraDevice: jest.fn(() => ({ id: 'back' })),
    useFrameOutput: jest.fn(() => ({})),
  }
})

jest.mock('react-native-fast-opencv', () => ({
  DataTypes: { CV_8U: 0 },
  Mat: {
    create: jest.fn((rows: number, cols: number) => ({ rows, cols, release: jest.fn() })),
  },
}))
```
In `apps/mobile/package.json`, change the `jest` block to:
```json
"jest": {
  "preset": "jest-expo",
  "setupFiles": ["<rootDir>/jest.setup.ts"]
}
```
The fast-opencv mock is used from Task 5. Jest mocks a module that is not installed only with `{ virtual: true }`. Until Task 5, the third argument `{ virtual: true }` is required. Add it now and remove it in Task 5:
```ts
jest.mock('react-native-fast-opencv', () => ({ … }), { virtual: true })
```

- [ ] **Step 7: Run every check and commit**

Run: `just typecheck && just lint-ts && just boundaries && just test-ts && just bundle` — all pass.
Run: `pnpm dlx expo-doctor` from `apps/mobile`. Report its output. Fix only failures that come from this task.
```bash
git add apps/mobile/package.json apps/mobile/app.json apps/mobile/metro.config.js apps/mobile/metro.config.test.js apps/mobile/jest.setup.ts pnpm-lock.yaml
git commit -m "chore(app): add VisionCamera 5, worklets, Reanimated and Skia (#2)"
```

---

### Task 2: Frame-rate meter

**Files:**
- Create: `apps/mobile/src/scan/frameRate.ts`
- Test: `apps/mobile/src/scan/frameRate.test.ts`

**Interfaces:**
- Produces:
  - `type FrameWindow = { start: number; frames: number }`.
  - `const EMPTY_WINDOW: FrameWindow` with `{ start: -1, frames: 0 }`.
  - `countFrame(window: FrameWindow, timestamp: number): { window: FrameWindow; fps: number | null }`. This is a worklet. `timestamp` is in seconds. It returns a rate once per window of at least 1 s, and `null` otherwise.

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/scan/frameRate.test.ts`:
```ts
import { countFrame, EMPTY_WINDOW, type FrameWindow } from './frameRate'

function feed(timestamps: number[]): Array<number | null> {
  let window: FrameWindow = EMPTY_WINDOW
  return timestamps.map((t) => {
    const result = countFrame(window, t)
    window = result.window
    return result.fps
  })
}

describe('countFrame', () => {
  it('reports nothing for the first frame', () => {
    expect(feed([10])).toEqual([null])
  })

  it('reports 30 fps after one second of frames at 30 fps', () => {
    const timestamps = Array.from({ length: 31 }, (_, i) => 10 + i / 30)
    const rates = feed(timestamps)
    expect(rates.slice(0, 30).every((r) => r === null)).toBe(true)
    expect(rates[30]).toBeCloseTo(30, 5)
  })

  it('starts a new window after a report', () => {
    const timestamps = Array.from({ length: 61 }, (_, i) => i / 30)
    const rates = feed(timestamps).filter((r) => r !== null)
    expect(rates).toHaveLength(2)
    expect(rates[1]).toBeCloseTo(30, 5)
  })

  it('restarts when the clock goes backwards', () => {
    expect(feed([5, 5.5, 2, 2.5])).toEqual([null, null, null, null])
  })

  it('never reports a rate that is not finite', () => {
    const rates = feed([1, 1, 1, 2.5])
    expect(rates.every((r) => r === null || Number.isFinite(r))).toBe(true)
    expect(rates[3]).toBeCloseTo(3 / 1.5, 5)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter mobile exec jest src/scan/frameRate.test.ts`
Expected: FAIL, `Cannot find module './frameRate'`.

- [ ] **Step 3: Implement**

`apps/mobile/src/scan/frameRate.ts`:
```ts
// Counts camera frames in windows of at least one second. Runs as a worklet on the camera thread.

export type FrameWindow = { start: number; frames: number }

export const EMPTY_WINDOW: FrameWindow = { start: -1, frames: 0 }

export function countFrame(
  window: FrameWindow,
  timestamp: number,
): { window: FrameWindow; fps: number | null } {
  'worklet'
  if (window.start < 0 || timestamp < window.start) {
    return { window: { start: timestamp, frames: 0 }, fps: null }
  }
  const frames = window.frames + 1
  const elapsed = timestamp - window.start
  if (elapsed >= 1) {
    return { window: { start: timestamp, frames: 0 }, fps: frames / elapsed }
  }
  return { window: { start: window.start, frames }, fps: null }
}
```

- [ ] **Step 4: Run tests and lint, commit**

Run: `just typecheck && just lint-ts && just test-ts` — all pass.
```bash
git add apps/mobile/src/scan/frameRate.ts apps/mobile/src/scan/frameRate.test.ts
git commit -m "feat(app): count camera frames per second in a worklet (#2)"
```

---

### Task 3: Camera screen

**Files:**
- Create: `apps/mobile/src/scan/CameraScreen.tsx`
- Test: `apps/mobile/src/scan/CameraScreen.test.tsx`
- Modify: `apps/mobile/App.tsx`, `apps/mobile/App.test.tsx`

**Interfaces:**
- Consumes: `countFrame`, `EMPTY_WINDOW` (Task 2), and the Jest mocks (Task 1).
- Produces: `CameraScreen(): JSX.Element`. It renders one of these, with `testID`s for tests:
  - `camera`: the preview.
  - `camera-denied`: the text and the "Open Settings" button (`testID="open-settings"`).
  - `camera-waiting`: shown while permission is asked.
  - `camera-missing`: no back camera.
- The frame-rate log line is `[camera] <n.n> fps`.

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/scan/CameraScreen.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { useCameraDevice, useCameraPermission, useFrameOutput } from 'react-native-vision-camera'
import { CameraScreen } from './CameraScreen'

const permission = jest.mocked(useCameraPermission)
const device = jest.mocked(useCameraDevice)
const frameOutput = jest.mocked(useFrameOutput)

function givenPermission(status: 'authorized' | 'denied' | 'not-determined') {
  const requestPermission = jest.fn(async () => true)
  permission.mockReturnValue({
    status,
    hasPermission: status === 'authorized',
    canRequestPermission: status === 'not-determined',
    requestPermission,
  } as unknown as ReturnType<typeof useCameraPermission>)
  return requestPermission
}

type FrameConfig = { onFrame: (frame: { timestamp: number; dispose: () => void }) => void }

function onFrame() {
  const config = frameOutput.mock.calls.at(-1)?.[0] as unknown as FrameConfig
  return config.onFrame
}

beforeEach(() => {
  jest.clearAllMocks()
  device.mockReturnValue({ id: 'back' } as unknown as ReturnType<typeof useCameraDevice>)
})

describe('CameraScreen', () => {
  it('shows the camera full screen when permission is given', () => {
    givenPermission('authorized')
    render(<CameraScreen />)
    expect(screen.getByTestId('camera')).toBeTruthy()
  })

  it('asks for permission the first time', () => {
    const request = givenPermission('not-determined')
    render(<CameraScreen />)
    expect(request).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('camera-waiting')).toBeTruthy()
  })

  it('offers the settings when permission was denied', () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue()
    givenPermission('denied')
    render(<CameraScreen />)
    expect(screen.getByTestId('camera-denied')).toBeTruthy()
    fireEvent.press(screen.getByTestId('open-settings'))
    expect(openSettings).toHaveBeenCalledTimes(1)
  })

  it('says so when the phone has no back camera', () => {
    givenPermission('authorized')
    device.mockReturnValue(undefined)
    render(<CameraScreen />)
    expect(screen.getByTestId('camera-missing')).toBeTruthy()
  })

  it('logs the frame rate once per second', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    givenPermission('authorized')
    render(<CameraScreen />)
    const handle = onFrame()
    for (let i = 0; i <= 30; i++) handle({ timestamp: 100 + i / 30, dispose: jest.fn() })
    await Promise.resolve()
    expect(log).toHaveBeenCalledWith('[camera] 30.0 fps')
    log.mockRestore()
  })

  it('releases every frame, also when counting fails', () => {
    givenPermission('authorized')
    render(<CameraScreen />)
    jest.spyOn(frameRate, 'countFrame').mockImplementation(() => {
      throw new Error('count failed')
    })
    const dispose = jest.fn()
    expect(() => onFrame()({ timestamp: 1, dispose })).toThrow('count failed')
    expect(dispose).toHaveBeenCalledTimes(1)
  })
})
```
Add `import * as frameRate from './frameRate'` to the imports of this test file. Babel compiles the named import in `CameraScreen.tsx` to a property read on the module, so the spy takes effect. Add `afterEach(() => jest.restoreAllMocks())` so the spy does not leak into other tests. The error still reaches the caller: a bug in the frame processor must stay visible in development. The test checks only that the frame is released first.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter mobile exec jest src/scan/CameraScreen.test.tsx`
Expected: FAIL, `Cannot find module './CameraScreen'`.

- [ ] **Step 3: Implement**

`apps/mobile/src/scan/CameraScreen.tsx`:
```tsx
import { useEffect, useMemo } from 'react'
import { Button, Linking, StyleSheet, Text, View } from 'react-native'
import { Camera, useCameraDevice, useCameraPermission, useFrameOutput } from 'react-native-vision-camera'
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets'
import { countFrame, EMPTY_WINDOW } from './frameRate'

function logFrameRate(fps: number) {
  console.log(`[camera] ${fps.toFixed(1)} fps`)
}

/** The back camera, full screen. An empty frame processor logs the frame rate (issue #2). */
export function CameraScreen() {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back')
  const window = useMemo(() => createSynchronizable(EMPTY_WINDOW), [])

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    onFrame(frame) {
      'worklet'
      try {
        const result = countFrame(window.getBlocking(), frame.timestamp)
        window.setBlocking(result.window)
        if (result.fps !== null) scheduleOnRN(logFrameRate, result.fps)
      } finally {
        frame.dispose()
      }
    },
  })

  useEffect(() => {
    if (canRequestPermission) void requestPermission()
  }, [canRequestPermission, requestPermission])

  if (!hasPermission) {
    if (canRequestPermission) {
      return <View testID="camera-waiting" style={styles.message} />
    }
    return (
      <View testID="camera-denied" style={styles.message}>
        <Text style={styles.text}>Sudoku needs the camera to scan a puzzle.</Text>
        <Button testID="open-settings" title="Open Settings" onPress={() => void Linking.openSettings()} />
      </View>
    )
  }
  if (device == null) {
    return (
      <View testID="camera-missing" style={styles.message}>
        <Text style={styles.text}>This phone has no back camera.</Text>
      </View>
    )
  }
  return <Camera testID="camera" style={StyleSheet.absoluteFill} device={device} isActive outputs={[frameOutput]} />
}

const styles = StyleSheet.create({
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  text: { fontSize: 17, textAlign: 'center' },
})
```
If `testID` is not a prop of VisionCamera's `Camera` type, typecheck fails. Then wrap the camera in `<View testID="camera" style={StyleSheet.absoluteFill}>` and keep the mock's `testID` unchanged. Report which form you used.

- [ ] **Step 4: Show the camera screen from the app**

Navigation is not decided yet (apps/mobile/AGENTS.md), so `App` renders the camera screen directly. `apps/mobile/App.tsx`:
```tsx
import { StatusBar } from 'expo-status-bar'
import { CameraScreen } from './src/scan/CameraScreen'

export default function App() {
  return (
    <>
      <CameraScreen />
      <StatusBar style="light" />
    </>
  )
}
```
`apps/mobile/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native'
import App from './App'

describe('App', () => {
  it('opens on the camera screen', () => {
    render(<App />)
    expect(screen.getByTestId('camera')).toBeTruthy()
  })
})
```
The old test "reads the grid size from @sudoku/core" goes away. The core wiring stays proved by `just bundle` and by core's own tests. Check `just boundaries` still passes.

- [ ] **Step 5: Run every check and commit**

Run: `just typecheck && just lint-ts && just boundaries && just test-ts && just bundle` — all pass, and the test output is clean (no warnings).
```bash
git add apps/mobile/src/scan apps/mobile/App.tsx apps/mobile/App.test.tsx
git commit -m "feat(app): show the back camera full screen and log the frame rate (#2)"
```

---

### Task 4: First development build on the iPhone (developer and agent)

The build needs the connected phone and an interactive signing choice. The agent prepares and checks. The developer runs the build command.

- [ ] **Step 1 (agent): Check that the generated folders stay out of git.** Run `git check-ignore -v apps/mobile/ios apps/mobile/android`. Expected: both are ignored (`apps/mobile/.gitignore`: `/ios`, `/android`).
- [ ] **Step 2 (developer): Build and run on the iPhone.**
```bash
cd apps/mobile && pnpm exec expo run:ios --device
```
Choose the connected iPhone. If Xcode asks for a team, choose your personal team. On the phone, trust the developer profile under Settings → General → VPN & Device Management, then open the app again.
- [ ] **Step 3 (developer): Check on the phone and report.**
  1. The permission prompt shows the text from Global Constraints.
  2. After "Allow", the back camera fills the screen.
  3. The Metro terminal prints `[camera] <n> fps` about once per second. Report three consecutive values.
  4. Send the app to the background, wait 5 s, and open it again. The preview resumes, and the app does not crash (Review Focus 4).
  5. Deny the permission (Settings → Sudoku → Camera off), open the app, and check that the "Open Settings" button opens the app's settings.
- [ ] **Step 4 (agent): Record the results.** Post a comment on issue #2 with the iPhone model, the iOS version, the Xcode version, the three fps values, and the result of checks 1–5. Tick the issue's acceptance criteria that are now met. If a check fails, stop and report. Do not change code to pass a device check without a new task.

---

### Task 5: Prove fast-opencv on the iPhone (ADR-002, first validation row)

**Files:**
- Modify: `apps/mobile/package.json`, `pnpm-lock.yaml`, `apps/mobile/jest.setup.ts`, `apps/mobile/src/scanner/index.ts`, `apps/mobile/App.tsx`
- Create: `apps/mobile/src/scanner/opencvProbe.ts`, `apps/mobile/src/scanner/opencvProbe.test.ts`

**Interfaces:**
- Produces: `probeOpenCV(): boolean`, exported from `src/scanner/index.ts`. It creates a 2 × 3 `CV_8U` Mat, checks its size, and releases it. It returns `true` when the round trip works.

- [ ] **Step 1: Install**

```bash
cd apps/mobile
pnpm add react-native-fast-opencv@1.0.1 --save-exact
```
In `jest.setup.ts`, remove `{ virtual: true }` from the fast-opencv mock.

- [ ] **Step 2: Write the failing test**

`apps/mobile/src/scanner/opencvProbe.test.ts`:
```ts
import { Mat } from 'react-native-fast-opencv'
import { probeOpenCV } from './opencvProbe'

describe('probeOpenCV', () => {
  it('creates, checks and releases one Mat', () => {
    expect(probeOpenCV()).toBe(true)
    const mat = jest.mocked(Mat.create).mock.results[0]?.value as { release: jest.Mock }
    expect(mat.release).toHaveBeenCalledTimes(1)
  })

  it('reports false when the Mat has the wrong size', () => {
    jest.mocked(Mat.create).mockReturnValueOnce({ rows: 0, cols: 0, release: jest.fn() } as never)
    expect(probeOpenCV()).toBe(false)
  })
})
```
Run: `pnpm --filter mobile exec jest src/scanner/opencvProbe.test.ts`
Expected: FAIL, `Cannot find module './opencvProbe'`.

- [ ] **Step 3: Implement**

`apps/mobile/src/scanner/opencvProbe.ts`:
```ts
import { DataTypes, Mat } from 'react-native-fast-opencv'

/** One Mat round trip through fast-opencv. True when the native module works (ADR-002). */
export function probeOpenCV(): boolean {
  const mat = Mat.create(2, 3, DataTypes.CV_8U)
  try {
    return mat.rows === 2 && mat.cols === 3
  } finally {
    mat.release()
  }
}
```
`apps/mobile/src/scanner/index.ts`:
```ts
// The only entry point into the scanner (SUD-05). The interface arrives with M0 issues #3 to #6.
export { probeOpenCV } from './opencvProbe'
```
In `apps/mobile/App.tsx`, log the probe once in development builds:
```tsx
import { StatusBar } from 'expo-status-bar'
import { probeOpenCV } from './src/scanner'
import { CameraScreen } from './src/scan/CameraScreen'

if (__DEV__) console.log(`[scanner] fast-opencv ${probeOpenCV() ? 'works' : 'FAILED'}`)

export default function App() {
  return (
    <>
      <CameraScreen />
      <StatusBar style="light" />
    </>
  )
}
```

- [ ] **Step 4: Run every check and commit**

Run: `just typecheck && just lint-ts && just boundaries && just test-ts && just bundle` — all pass.
```bash
git add apps/mobile/package.json pnpm-lock.yaml apps/mobile/jest.setup.ts apps/mobile/src/scanner apps/mobile/App.tsx
git commit -m "chore(app): add fast-opencv and probe it at start-up (#2)"
```

- [ ] **Step 5 (developer): Rebuild on the iPhone**

Run `pnpm exec expo run:ios --device` again.
- Expected: the build passes and Metro prints `[scanner] fast-opencv works`. The camera still works.
- If the iOS build fails with `RCTCxxBridge`, `CallInvoker` or `SchedulerPriority` errors (fast-opencv #117), stop. Report the first error lines. The fallback is a `pnpm patch` with PR #119, in a new task.

- [ ] **Step 6 (agent): Record and open the pull request**
  1. Add the fast-opencv result to the issue #2 comment from Task 4.
  2. Tick the remaining criteria.
  3. Push the branch.
  4. Open a pull request to `develop` with the PR template: `Closes #2`, the device results, the pinned versions and any deviation from this plan.
  5. A second agent without this session's context reviews it (AGENTS.md rule 8).
