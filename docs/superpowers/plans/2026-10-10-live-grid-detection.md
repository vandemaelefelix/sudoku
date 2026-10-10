# Live Grid Detection Implementation Plan (issue #3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Find the sudoku grid in every camera frame and draw a steady outline over it. Detection reaches ≥ 30 fps on the iPhone, and on a still page each outline corner moves less than 2 screen points per frame. GitHub issue #3.

**Architecture:** The scanner gets a frame-processor detector. `react-native-vision-camera-resizer` turns each frame upright and scales it to 360 × 640 RGB on the GPU. fast-opencv then converts the image to grayscale, blurs it, applies an adaptive threshold and finds the largest plausible 4-corner contour. A pure TypeScript step orders, normalises and checks the corners. The Scan UI writes each result to a Reanimated shared value. The UI thread smooths the corners with a One Euro filter, maps them onto the preview, and Skia draws the outline. No corner passes through the JS thread.

**Tech Stack:** Expo SDK 57.0.27, React Native 0.86.3, react-native-vision-camera 5.2.3, react-native-vision-camera-resizer 5.2.3 (new), react-native-fast-opencv 1.0.1, react-native-worklets 0.10.1, react-native-reanimated 4.5.1, @shopify/react-native-skia 2.6.2, jest-expo 57, React Native Testing Library.

**Spec (read these first):**
- `AGENTS.md` and `apps/mobile/AGENTS.md` (working rules, writing style, code comment rules)
- Issue #3: `gh issue view 3`. The acceptance criteria are the spec.
- `docs/architecture/00-concepts/scan-pipeline.md` (the live stage, threads and coordinates)
- `docs/architecture/adr/adr-002-react-native-and-scanner-engine.md` (the validation table)
- `docs/architecture/adr/adr-004-two-stage-scan-pipeline.md`
- `docs/architecture/05-building-block-view.md` §5.4 (the scanner interface)
- `docs/architecture/10-quality-requirements.md` (QR-05, QR-06, QR-08)

## Verified facts (from research before this plan)

- **The resizer turns frames upright.** `react-native-vision-camera-resizer` 5.2.3 reads `frame.orientation` and `frame.isMirrored` and applies both on the GPU (`ios/HybridResizer.swift`, `ResizerKernels.metal`). The note in the issue and in the concept ("does not rotate") is out of date. The resizer does not make grayscale. Its output is RGB or BGR only.
- Resizer API: `useResizer({ width, height, channelOrder, dataType, scaleMode, pixelLayout })` returns `{ state: 'loading' | 'ready' | 'error', resizer, error }`. `resizer.resize(frame)` returns a `GPUFrame` with `width`, `height`, `getPixelBuffer(): ArrayBuffer` and `dispose()`. On iOS the frame must have `pixelFormat: 'yuv'`. The camera screen already uses it. `scaleMode: 'stretch'` maps the whole frame onto the output.
- `useFrameOutput` delivers HD 16:9 frames by default (`CommonResolutions.HD_16_9`). Upright, that is 9:16, so 360 × 640 does not distort the image.
- fast-opencv 1.0.1 API (V1): `OpenCV.<function>(...)`, plus the factories `Mat`, `Size`, `PointVector`, `PointVectorOfVectors`. `Mat.createFromBuffer('uint8', rows, cols, 3, Uint8Array)` **copies** the buffer, so the `GPUFrame` can be disposed right after. `contours.get(i)` and `points.get(i)` return **new** wrapped objects. Release each one. `contourArea()` and `arcLength()` return `{ value }`. Every OpenCV object is a JSI host object, so worklets can capture it.
- Reanimated 4.5.1: assigning `sharedValue.value` on a worker runtime (the camera thread) calls `setAsync` on the UI-thread host. That is the "shared value, not the JS thread" handoff.
- VisionCamera 5 `<Camera resizeMode>` defaults to `'cover'`. The preview fills the view and crops the frame.
- Jest: the Reanimated mock (`react-native-reanimated/mock`) has `useSharedValue` (a new object on every render), `useDerivedValue` (runs once) and a no-op `useAnimatedReaction`. Skia's own Jest setup needs CanvasKit, so this plan mocks Skia by hand.
- One Euro filter, simulated at 30 fps with `MIN_CUTOFF = 1`, `BETA = 20` and `DERIVATIVE_CUTOFF = 1` in normalised units:
  - Noise of ± 0.004: the output moves at most 0.0009 per frame. That is 0.4 pt on a 400 pt wide view.
  - A ramp at 0.6 per second: the output lags 0.006 behind.
  - A jump of 0.1: the output is within 0.005 after 3 frames (100 ms).

## Global Constraints

- Branch `feature/3-live-grid-detection`. The pull request targets `develop`. Commits are Conventional Commits ending with `(#3)`. Do not push to `main` or `develop`.
- Do not create, edit or commit `apps/mobile/ios/` or `apps/mobile/android/` (ADR-002, CNG).
- Add the resizer with `pnpm add react-native-vision-camera-resizer@5.2.3 --save-exact` from `apps/mobile/`. Do not add any other package.
- The app reaches the scanner only through `src/scanner/index.ts` (SUD-05). The Scan UI (`src/scan/`) imports scanner types and hooks from `../scanner` only. `just boundaries` checks this.
- Frames stay on the device (SUD-02). Do not write frames, pixels or images to disk or to the network.
- Release every OpenCV object with `release()` on every path, including errors (ADR-002, memory row). Dispose every `Frame` and every `GPUFrame`.
- No corner value passes through the JS thread. Only the dev log lines use `scheduleOnRN`.
- Coordinates from the scanner are normalised and upright: `x` and `y` in `[0, 1]` of the upright frame. The corner order is top-left, top-right, bottom-right, bottom-left.
- CI runs on Linux without Xcode. `just typecheck`, `just lint`, `just boundaries`, `just test-ts` and `just bundle` must pass without a native build.
- Code comments follow the "Code comments" rules in `AGENTS.md`. Do not refer to issues or plan tasks in code.
- Prose follows the writing rules in `AGENTS.md`.

## Review Focus

1. **A frame without a grid** (a wall, a page of text with hundreds of small contours, a 5-corner shape that is larger than the grid). Expected: `null`, no outline, no crash. Pinned in Task 2 (`findGrid` tests: no contours, small contours, a larger 5-corner contour).
2. **An OpenCV call throws in the middle of a frame.** Expected: every object created so far is released, and the frame and the `GPUFrame` are disposed. A leak here grows memory on every frame (QR-08). Pinned in Task 2 (release tests for three failing steps, the `GPUFrame` dispose test).
3. **Detection misses a few frames** (motion blur, glare, a finger). Expected: the outline holds for 0.25 s and then disappears. When the grid comes back, the outline snaps to it and does not slide across the screen from the old place. Pinned in Task 3.
4. **The resizer is still loading or fails to load.** Expected: the camera runs, no outline shows, and a failure prints one warning. Pinned in Task 2 (hook tests) and Task 5 (camera screen without a detector).
5. **The view has no size yet** (before the first layout), or the frame is sideways. Expected: no outline with `NaN` points before layout, and a correct mapping for every frame orientation. Pinned in Task 4.

## File Structure

```
apps/mobile/
├── package.json                    # + react-native-vision-camera-resizer 5.2.3
├── jest.setup.ts                   # + mocks: resizer, Reanimated, Skia
└── src/
    ├── scanner/
    │   ├── index.ts                # + useGridDetector, types (SUD-05)
    │   ├── quad.ts                 # Point, Quad, GridDetection; order, check, normalise corners
    │   ├── quad.test.ts
    │   ├── findGrid.ts             # fast-opencv pipeline on one RGB image, releases everything
    │   ├── findGrid.test.ts        # with a fake fast-opencv that tracks release()
    │   ├── useGridDetector.ts      # resizer + findGrid as one frame-processor worklet
    │   └── useGridDetector.test.tsx
    └── scan/
        ├── smoothing.ts            # One Euro filter over the quad, hold and reset rules
        ├── smoothing.test.ts
        ├── previewMapping.ts       # upright aspect, normalised quad → preview points ('cover')
        ├── previewMapping.test.ts
        ├── jitter.ts               # QR-06 meter: largest corner step per 5 s
        ├── jitter.test.ts
        ├── GridOutline.tsx         # Skia polygon over the preview
        ├── GridOutline.test.tsx
        ├── frameRate.ts            # + mean detection time per window
        ├── frameRate.test.ts
        ├── CameraScreen.tsx        # detect → shared value → UI thread → outline
        └── CameraScreen.test.tsx
docs/architecture/
├── 05-building-block-view.md       # §5.4: useGridDetector
├── 00-concepts/scan-pipeline.md    # resizer facts, smoothing answer
├── adr/adr-002-…md                 # measured results
└── 12-glossary.md                  # Frame resizer, One Euro filter, Outline
```

---

### Task 1: Quad geometry

**Files:**
- Create: `apps/mobile/src/scanner/quad.ts`, `apps/mobile/src/scanner/quad.test.ts`

**Interfaces:**
- Produces (all functions are worklets):
  - `type Point = { x: number; y: number }`
  - `type Quad = [Point, Point, Point, Point]` (top-left, top-right, bottom-right, bottom-left)
  - `type GridDetection = { quad: Quad; score: number }` (`score`: the share of the frame that the quad covers, 0 to 1)
  - `MIN_AREA_FRACTION = 0.1`, `BORDER_MARGIN = 0.005`
  - `quadArea(quad: Quad): number`, `isConvex(quad: Quad): boolean`, `orderCorners(points: Point[]): Quad`
  - `toGridDetection(points: Point[], width: number, height: number): GridDetection | null` (`points` in pixels of a `width × height` image)

- [ ] **Step 1: Write the failing test**

`apps/mobile/src/scanner/quad.test.ts`:
```ts
import { isConvex, orderCorners, type Point, type Quad, quadArea, toGridDetection } from './quad'

const square: Quad = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.8, y: 0.8 },
  { x: 0.2, y: 0.8 },
]

function turn(points: Point[], degrees: number): Point[] {
  const angle = (degrees * Math.PI) / 180
  return points.map((p) => ({
    x: 0.5 + (p.x - 0.5) * Math.cos(angle) - (p.y - 0.5) * Math.sin(angle),
    y: 0.5 + (p.x - 0.5) * Math.sin(angle) + (p.y - 0.5) * Math.cos(angle),
  }))
}

describe('orderCorners', () => {
  it('orders shuffled corners from the top-left, clockwise', () => {
    expect(orderCorners([square[2], square[0], square[3], square[1]])).toEqual(square)
  })

  it('keeps the order for a grid turned by 20 degrees', () => {
    const turned = turn(square, 20)
    expect(orderCorners([turned[3], turned[1], turned[0], turned[2]])).toEqual(turned)
  })

  it('runs clockwise from one corner of a grid turned by 45 degrees', () => {
    const diamond = turn(square, 45)
    const ordered = orderCorners([diamond[2], diamond[0], diamond[1], diamond[3]])
    const start = diamond.indexOf(ordered[0])
    expect(ordered).toEqual([0, 1, 2, 3].map((i) => diamond[(start + i) % 4]))
  })
})

describe('quadArea', () => {
  it('gives the area of a square', () => {
    expect(quadArea(square)).toBeCloseTo(0.36, 10)
  })
})

describe('isConvex', () => {
  it('accepts a square', () => {
    expect(isConvex(square)).toBe(true)
  })

  it('rejects a quad with one corner pushed inwards', () => {
    expect(isConvex([square[0], square[1], { x: 0.4, y: 0.4 }, square[3]])).toBe(false)
  })

  it('rejects three corners on one line', () => {
    expect(isConvex([square[0], { x: 0.5, y: 0.2 }, square[1], square[3]])).toBe(false)
  })
})

describe('toGridDetection', () => {
  const width = 360
  const height = 640
  const pixels: Point[] = [
    { x: 287.5, y: 511.5 },
    { x: 71.5, y: 127.5 },
    { x: 71.5, y: 511.5 },
    { x: 287.5, y: 127.5 },
  ]

  it('normalises pixel corners to the frame and orders them', () => {
    const detection = toGridDetection(pixels, width, height)
    expect(detection).not.toBeNull()
    detection!.quad.forEach((corner, i) => {
      expect(corner.x).toBeCloseTo(square[i].x, 10)
      expect(corner.y).toBeCloseTo(square[i].y, 10)
    })
    expect(detection!.score).toBeCloseTo(0.36, 10)
  })

  it('needs exactly four corners', () => {
    expect(toGridDetection(pixels.slice(0, 3), width, height)).toBeNull()
    expect(toGridDetection([...pixels, { x: 180, y: 100 }], width, height)).toBeNull()
  })

  it('rejects a quad that covers less than a tenth of the frame', () => {
    const small = [
      { x: 0, y: 0 },
      { x: 107, y: 0 },
      { x: 107, y: 191 },
      { x: 0, y: 191 },
    ].map((p) => ({ x: p.x + 100, y: p.y + 200 }))
    expect(toGridDetection(small, width, height)).toBeNull()
  })

  it('rejects a concave quad', () => {
    const concave = [pixels[1], pixels[3], { x: 150, y: 250 }, pixels[2]]
    expect(toGridDetection(concave, width, height)).toBeNull()
  })

  it('rejects a quad that touches the frame border', () => {
    const touching = [{ x: 0, y: 127.5 }, pixels[3], pixels[0], pixels[2]]
    expect(toGridDetection(touching, width, height)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm --filter mobile exec jest src/scanner/quad.test.ts`
Expected: FAIL, `Cannot find module './quad'`.

- [ ] **Step 3: Implement**

`apps/mobile/src/scanner/quad.ts`:
```ts
export type Point = { x: number; y: number }

/** Normalised to 0..1 of the upright frame. Order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point]

/** score: the share of the frame that the quad covers, 0..1. */
export type GridDetection = { quad: Quad; score: number }

export const MIN_AREA_FRACTION = 0.1

/** A contour that reaches the frame edge is cut off by it, so it is not the grid. */
export const BORDER_MARGIN = 0.005

export function quadArea(quad: Quad): number {
  'worklet'
  let twice = 0
  for (let i = 0; i < 4; i++) {
    const a = quad[i]
    const b = quad[(i + 1) % 4]
    twice += a.x * b.y - b.x * a.y
  }
  return Math.abs(twice) / 2
}

export function isConvex(quad: Quad): boolean {
  'worklet'
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = quad[i]
    const b = quad[(i + 1) % 4]
    const c = quad[(i + 2) % 4]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (cross === 0) return false
    if (sign === 0) sign = Math.sign(cross)
    else if (Math.sign(cross) !== sign) return false
  }
  return true
}

export function orderCorners(points: Point[]): Quad {
  'worklet'
  const cx = (points[0].x + points[1].x + points[2].x + points[3].x) / 4
  const cy = (points[0].y + points[1].y + points[2].y + points[3].y) / 4
  // y points down, so a rising angle runs clockwise on the screen.
  const sorted = points
    .slice()
    .sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx))
  let first = 0
  for (let i = 1; i < 4; i++) {
    if (sorted[i].x + sorted[i].y < sorted[first].x + sorted[first].y) first = i
  }
  return [sorted[first], sorted[(first + 1) % 4], sorted[(first + 2) % 4], sorted[(first + 3) % 4]]
}

/** points: pixel coordinates in a width × height image. Null when they are not a plausible grid. */
export function toGridDetection(points: Point[], width: number, height: number): GridDetection | null {
  'worklet'
  if (points.length !== 4) return null
  // +0.5 moves a pixel index to the centre of its pixel.
  const quad = orderCorners(points.map((p) => ({ x: (p.x + 0.5) / width, y: (p.y + 0.5) / height })))
  if (!isConvex(quad)) return null
  const score = quadArea(quad)
  if (score < MIN_AREA_FRACTION) return null
  const touchesBorder = quad.some(
    (p) => p.x < BORDER_MARGIN || p.x > 1 - BORDER_MARGIN || p.y < BORDER_MARGIN || p.y > 1 - BORDER_MARGIN,
  )
  return touchesBorder ? null : { quad, score }
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm --filter mobile exec jest src/scanner/quad.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/scanner/quad.ts apps/mobile/src/scanner/quad.test.ts
git commit -m "feat(scanner): order, check and normalise the grid corners (#3)"
```

---

### Task 2: Grid detector in the frame processor

**Files:**
- Modify: `apps/mobile/package.json`, `pnpm-lock.yaml`, `apps/mobile/jest.setup.ts`, `apps/mobile/src/scanner/index.ts`
- Create: `apps/mobile/src/scanner/findGrid.ts`, `apps/mobile/src/scanner/findGrid.test.ts`, `apps/mobile/src/scanner/useGridDetector.ts`, `apps/mobile/src/scanner/useGridDetector.test.tsx`
- Modify docs: `docs/architecture/05-building-block-view.md` (§5.4), `docs/architecture/00-concepts/scan-pipeline.md` (row "Frame to OpenCV"), `docs/architecture/12-glossary.md`

**Interfaces:**
- Consumes: `toGridDetection`, `MIN_AREA_FRACTION`, `Point`, `GridDetection` from Task 1 (`./quad`).
- Produces:
  - `findGrid(pixels: Uint8Array, width: number, height: number): GridDetection | null` (worklet; `pixels` is interleaved RGB, uint8, `width × height`)
  - `DETECT_WIDTH = 360`, `DETECT_HEIGHT = 640`
  - `type GridDetector = (frame: Frame) => GridDetection | null` (a worklet)
  - `useGridDetector(): GridDetector | undefined` (undefined while the resizer loads, and when it fails)
  - `src/scanner/index.ts` exports `probeOpenCV`, `useGridDetector`, and the types `GridDetection`, `GridDetector`, `Point`, `Quad`.

- [ ] **Step 1: Install the resizer and mock it**

```bash
cd apps/mobile
pnpm add react-native-vision-camera-resizer@5.2.3 --save-exact
```
Append to `apps/mobile/jest.setup.ts`:
```ts
jest.mock('react-native-vision-camera-resizer', () => ({
  useResizer: jest.fn(() => ({ state: 'loading', resizer: undefined, error: undefined })),
}))
```

- [ ] **Step 2: Write the failing test for `findGrid`**

`apps/mobile/src/scanner/findGrid.test.ts`:
```ts
import { Mat } from 'react-native-fast-opencv'
import { findGrid } from './findGrid'

type Pt = { x: number; y: number }

// A fake fast-opencv. It records every object it creates, so the tests can check release().
jest.mock('react-native-fast-opencv', () => {
  class Tracked {
    released = false
    constructor() {
      mockCreated.push(this)
    }
    release() {
      this.released = true
    }
  }
  class FakePoint extends Tracked {
    constructor(
      public x: number,
      public y: number,
    ) {
      super()
    }
  }
  class FakePointVector extends Tracked {
    constructor(public points: Pt[] = []) {
      super()
    }
    get length() {
      return this.points.length
    }
    get(index: number) {
      return new FakePoint(this.points[index].x, this.points[index].y)
    }
  }
  class FakeContours extends Tracked {
    items: Pt[][] = []
    get length() {
      return this.items.length
    }
    get(index: number) {
      return new FakePointVector(this.items[index])
    }
  }
  const area = (points: Pt[]) =>
    Math.abs(
      points.reduce((sum, a, i) => {
        const b = points[(i + 1) % points.length]
        return sum + a.x * b.y - b.x * a.y
      }, 0),
    ) / 2
  const perimeter = (points: Pt[]) =>
    points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length]
      return sum + Math.hypot(b.x - a.x, b.y - a.y)
    }, 0)
  const step = (name: string) => {
    if (mockFailure === name) throw new Error(`${name} failed`)
  }
  return {
    AdaptiveThresholdTypes: { ADAPTIVE_THRESH_GAUSSIAN_C: 1 },
    ColorConversionCodes: { COLOR_RGB2GRAY: 7 },
    ContourApproximationModes: { CHAIN_APPROX_SIMPLE: 2 },
    DataTypes: { CV_8U: 0 },
    RetrievalModes: { RETR_EXTERNAL: 0 },
    ThresholdTypes: { THRESH_BINARY_INV: 1 },
    Mat: {
      create: jest.fn(() => new Tracked()),
      createFromBuffer: jest.fn(() => new Tracked()),
    },
    Size: { create: () => new Tracked() },
    PointVector: { create: () => new FakePointVector() },
    PointVectorOfVectors: { create: () => new FakeContours() },
    OpenCV: {
      cvtColor: () => step('cvtColor'),
      GaussianBlur: () => step('GaussianBlur'),
      adaptiveThreshold: () => step('adaptiveThreshold'),
      findContours: (_image: unknown, contours: FakeContours) => {
        step('findContours')
        contours.items = mockContours
      },
      contourArea: (contour: FakePointVector) => ({ value: area(contour.points) }),
      arcLength: (contour: FakePointVector) => ({ value: perimeter(contour.points) }),
      approxPolyDP: (contour: FakePointVector, corners: FakePointVector) => {
        corners.points = contour.points
      },
    },
  }
})

const mockCreated: { released: boolean }[] = []
let mockContours: Pt[][] = []
let mockFailure: string | null = null

const width = 360
const height = 640
const pixels = new Uint8Array(width * height * 3)

function rect(left: number, top: number, right: number, bottom: number): Pt[] {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ]
}

beforeEach(() => {
  mockCreated.length = 0
  mockContours = []
  mockFailure = null
  jest.clearAllMocks()
})

describe('findGrid', () => {
  it('returns the normalised quad of a large square contour', () => {
    mockContours = [rect(72, 128, 288, 512)]
    const detection = findGrid(pixels, width, height)
    expect(detection).not.toBeNull()
    expect(detection!.quad[0].x).toBeCloseTo(72.5 / width, 10)
    expect(detection!.quad[0].y).toBeCloseTo(128.5 / height, 10)
    expect(detection!.quad[2].x).toBeCloseTo(288.5 / width, 10)
    expect(detection!.quad[2].y).toBeCloseTo(512.5 / height, 10)
    expect(detection!.score).toBeCloseTo(0.36, 2)
  })

  it('reads the pixels as a height × width RGB image', () => {
    findGrid(pixels, width, height)
    expect(Mat.createFromBuffer).toHaveBeenCalledWith('uint8', height, width, 3, pixels)
  })

  it('picks the largest four-corner contour', () => {
    mockContours = [rect(100, 200, 260, 400), rect(40, 100, 320, 540)]
    expect(findGrid(pixels, width, height)!.quad[0].x).toBeCloseTo(40.5 / width, 10)
  })

  it('skips a larger contour that does not have four corners', () => {
    const pentagon = [
      { x: 20, y: 60 },
      { x: 340, y: 60 },
      { x: 340, y: 600 },
      { x: 180, y: 620 },
      { x: 20, y: 600 },
    ]
    mockContours = [pentagon, rect(72, 128, 288, 512)]
    expect(findGrid(pixels, width, height)!.quad[0].x).toBeCloseTo(72.5 / width, 10)
  })

  it('ignores contours smaller than a tenth of the frame', () => {
    mockContours = [rect(100, 200, 200, 300)]
    expect(findGrid(pixels, width, height)).toBeNull()
  })

  it('returns null when the frame has no contours', () => {
    expect(findGrid(pixels, width, height)).toBeNull()
  })

  it('releases every OpenCV object after a detection', () => {
    mockContours = [rect(100, 200, 200, 300), rect(72, 128, 288, 512)]
    findGrid(pixels, width, height)
    expect(mockCreated.length).toBeGreaterThan(5)
    expect(mockCreated.every((object) => object.released)).toBe(true)
  })

  it('releases every OpenCV object when no grid is found', () => {
    mockContours = [rect(100, 200, 200, 300)]
    findGrid(pixels, width, height)
    expect(mockCreated.every((object) => object.released)).toBe(true)
  })

  it.each(['cvtColor', 'adaptiveThreshold', 'findContours'])(
    'releases every OpenCV object when %s fails',
    (name) => {
      mockContours = [rect(72, 128, 288, 512)]
      mockFailure = name
      expect(() => findGrid(pixels, width, height)).toThrow(`${name} failed`)
      expect(mockCreated.length).toBeGreaterThan(0)
      expect(mockCreated.every((object) => object.released)).toBe(true)
    },
  )
})
```

- [ ] **Step 3: Run the test to see it fail**

Run: `pnpm --filter mobile exec jest src/scanner/findGrid.test.ts`
Expected: FAIL, `Cannot find module './findGrid'`.

- [ ] **Step 4: Implement `findGrid`**

`apps/mobile/src/scanner/findGrid.ts`:
```ts
import {
  AdaptiveThresholdTypes,
  ColorConversionCodes,
  ContourApproximationModes,
  DataTypes,
  Mat,
  OpenCV,
  PointVector,
  PointVectorOfVectors,
  RetrievalModes,
  Size,
  ThresholdTypes,
} from 'react-native-fast-opencv'
import { type GridDetection, MIN_AREA_FRACTION, type Point, toGridDetection } from './quad'

const BLUR_SIZE = 5
const THRESHOLD_BLOCK = 11
const THRESHOLD_C = 2
/** The largest distance between a contour and its polygon, as a share of the contour length. */
const APPROX_EPSILON = 0.02

type Releasable = { release(): void }

/**
 * pixels: interleaved RGB, uint8, width × height. Returns the largest plausible 4-corner contour.
 * Releases every OpenCV object before it returns or throws.
 */
export function findGrid(pixels: Uint8Array, width: number, height: number): GridDetection | null {
  'worklet'
  // Garbage collection in the worklet runtime can lag, so each object is released here (ADR-002).
  const owned: Releasable[] = []
  function own<T extends Releasable>(object: T): T {
    owned.push(object)
    return object
  }
  try {
    const rgb = own(Mat.createFromBuffer('uint8', height, width, 3, pixels))
    const gray = own(Mat.create(height, width, DataTypes.CV_8U))
    OpenCV.cvtColor(rgb, gray, ColorConversionCodes.COLOR_RGB2GRAY)
    OpenCV.GaussianBlur(gray, gray, own(Size.create(BLUR_SIZE, BLUR_SIZE)), 0)
    const binary = own(Mat.create(height, width, DataTypes.CV_8U))
    OpenCV.adaptiveThreshold(
      gray,
      binary,
      255,
      AdaptiveThresholdTypes.ADAPTIVE_THRESH_GAUSSIAN_C,
      ThresholdTypes.THRESH_BINARY_INV,
      THRESHOLD_BLOCK,
      THRESHOLD_C,
    )
    const contours = own(PointVectorOfVectors.create())
    OpenCV.findContours(binary, contours, RetrievalModes.RETR_EXTERNAL, ContourApproximationModes.CHAIN_APPROX_SIMPLE)

    const minArea = MIN_AREA_FRACTION * width * height
    const candidates: { contour: PointVector; area: number }[] = []
    for (let i = 0; i < contours.length; i++) {
      const contour = own(contours.get(i))
      const area = OpenCV.contourArea(contour).value
      if (area >= minArea) candidates.push({ contour, area })
    }
    candidates.sort((a, b) => b.area - a.area)

    for (const { contour } of candidates) {
      const corners = own(PointVector.create())
      OpenCV.approxPolyDP(contour, corners, APPROX_EPSILON * OpenCV.arcLength(contour, true).value, true)
      if (corners.length !== 4) continue
      const points: Point[] = []
      for (let i = 0; i < 4; i++) {
        const corner = own(corners.get(i))
        points.push({ x: corner.x, y: corner.y })
      }
      const detection = toGridDetection(points, width, height)
      if (detection != null) return detection
    }
    return null
  } finally {
    for (const object of owned) object.release()
  }
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm --filter mobile exec jest src/scanner/findGrid.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 6: Write the failing test for `useGridDetector`**

`apps/mobile/src/scanner/useGridDetector.test.tsx`:
```tsx
import { renderHook } from '@testing-library/react-native'
import type { Frame } from 'react-native-vision-camera'
import { useResizer } from 'react-native-vision-camera-resizer'
import { findGrid } from './findGrid'
import { DETECT_HEIGHT, DETECT_WIDTH, useGridDetector } from './useGridDetector'

jest.mock('./findGrid', () => ({ findGrid: jest.fn(() => null) }))

const resizerState = jest.mocked(useResizer)
const find = jest.mocked(findGrid)
const frame = { timestamp: 1 } as unknown as Frame

function givenState(state: 'loading' | 'error') {
  resizerState.mockReturnValue(
    (state === 'loading'
      ? { state, resizer: undefined, error: undefined }
      : { state, resizer: undefined, error: new Error('no Metal device') }) as ReturnType<typeof useResizer>,
  )
}

function givenResizer() {
  const resized = {
    width: DETECT_WIDTH,
    height: DETECT_HEIGHT,
    getPixelBuffer: jest.fn(() => new ArrayBuffer(DETECT_WIDTH * DETECT_HEIGHT * 3)),
    dispose: jest.fn(),
  }
  const resizer = { resize: jest.fn(() => resized) }
  resizerState.mockReturnValue({ state: 'ready', resizer, error: undefined } as unknown as ReturnType<
    typeof useResizer
  >)
  return { resizer, resized }
}

beforeEach(() => jest.clearAllMocks())

describe('useGridDetector', () => {
  it('asks for an upright 360 × 640 RGB image of the whole frame', () => {
    givenState('loading')
    renderHook(() => useGridDetector())
    expect(resizerState).toHaveBeenCalledWith({
      width: 360,
      height: 640,
      channelOrder: 'rgb',
      dataType: 'uint8',
      scaleMode: 'stretch',
      pixelLayout: 'interleaved',
    })
  })

  it('has no detector while the resizer loads', () => {
    givenState('loading')
    const { result } = renderHook(() => useGridDetector())
    expect(result.current).toBeUndefined()
  })

  it('finds the grid in the resized frame and disposes it', () => {
    const { resizer, resized } = givenResizer()
    const detection = { quad: [], score: 0.4 } as never
    find.mockReturnValueOnce(detection)
    const { result } = renderHook(() => useGridDetector())
    expect(result.current!(frame)).toBe(detection)
    expect(resizer.resize).toHaveBeenCalledWith(frame)
    const [pixels, width, height] = find.mock.calls[0]
    expect(pixels).toBeInstanceOf(Uint8Array)
    expect(pixels.length).toBe(360 * 640 * 3)
    expect([width, height]).toEqual([360, 640])
    expect(resized.dispose).toHaveBeenCalledTimes(1)
  })

  it('disposes the resized frame when detection fails', () => {
    const { resized } = givenResizer()
    find.mockImplementationOnce(() => {
      throw new Error('opencv failed')
    })
    const { result } = renderHook(() => useGridDetector())
    expect(() => result.current!(frame)).toThrow('opencv failed')
    expect(resized.dispose).toHaveBeenCalledTimes(1)
  })

  it('warns once when the resizer fails', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    givenState('error')
    const { result, rerender } = renderHook(() => useGridDetector())
    rerender({})
    expect(result.current).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('[scanner] the frame resizer failed: no Metal device')
    warn.mockRestore()
  })
})
```
The error state returns the same `Error` object on every render, so the effect runs once.

- [ ] **Step 7: Run the test to see it fail**

Run: `pnpm --filter mobile exec jest src/scanner/useGridDetector.test.tsx`
Expected: FAIL, `Cannot find module './useGridDetector'`.

- [ ] **Step 8: Implement the hook and export it**

`apps/mobile/src/scanner/useGridDetector.ts`:
```ts
import { useEffect, useMemo } from 'react'
import type { Frame } from 'react-native-vision-camera'
import { useResizer } from 'react-native-vision-camera-resizer'
import { findGrid } from './findGrid'
import type { GridDetection } from './quad'

// 9:16 is the upright shape of the HD 16:9 frames that useFrameOutput delivers by default.
export const DETECT_WIDTH = 360
export const DETECT_HEIGHT = 640

/** A worklet for the frame processor. */
export type GridDetector = (frame: Frame) => GridDetection | null

/** Undefined while the frame resizer loads, and when it fails to load. */
export function useGridDetector(): GridDetector | undefined {
  // The resizer turns the frame upright on the GPU. 'stretch' keeps the whole frame, so 0..1 covers it all.
  const { resizer, error } = useResizer({
    width: DETECT_WIDTH,
    height: DETECT_HEIGHT,
    channelOrder: 'rgb',
    dataType: 'uint8',
    scaleMode: 'stretch',
    pixelLayout: 'interleaved',
  })

  useEffect(() => {
    if (error != null) console.warn(`[scanner] the frame resizer failed: ${error.message}`)
  }, [error])

  return useMemo(() => {
    if (resizer == null) return undefined
    return (frame: Frame) => {
      'worklet'
      const resized = resizer.resize(frame)
      try {
        return findGrid(new Uint8Array(resized.getPixelBuffer()), resized.width, resized.height)
      } finally {
        resized.dispose()
      }
    }
  }, [resizer])
}
```
`apps/mobile/src/scanner/index.ts`:
```ts
// The only entry point into the scanner (SUD-05).
export { probeOpenCV } from './opencvProbe'
export type { GridDetection, Point, Quad } from './quad'
export { type GridDetector, useGridDetector } from './useGridDetector'
```

- [ ] **Step 9: Run the tests to see them pass**

Run: `pnpm --filter mobile exec jest src/scanner`
Expected: PASS, all scanner tests (quad, findGrid, useGridDetector, opencvProbe).

- [ ] **Step 10: Update the docs**

In `docs/architecture/05-building-block-view.md` §5.4, replace these two lines:
```ts
// Live, called from a frame processor for every frame
detectGrid(frame: Frame): { quad: Quad; score: number } | null
```
with:
```ts
// Live. The hook gives the frame processor a detector once the frame resizer is ready.
// score: the share of the frame that the quad covers, 0..1.
useGridDetector(): ((frame: Frame) => { quad: Quad; score: number } | null) | undefined
```
In `docs/architecture/00-concepts/scan-pipeline.md`, replace the "Frame to OpenCV" row of the "Threads and coordinates" table with:
```markdown
| Frame to OpenCV | `react-native-vision-camera-resizer` turns each frame upright and scales the whole frame to 360 × 640 RGB on the GPU. It applies the frame orientation and mirroring. It does not make grayscale, so fast-opencv does that |
```
Append to the table in `docs/architecture/12-glossary.md`:
```markdown
| Frame resizer | `react-native-vision-camera-resizer`. It turns a camera frame upright and scales it on the GPU before fast-opencv sees it |
```

- [ ] **Step 11: Run the checks**

Run: `just typecheck && just lint && just test-ts && just bundle && just docs-check`
Expected: all pass.

- [ ] **Step 12: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml apps/mobile/jest.setup.ts apps/mobile/src/scanner docs/architecture/05-building-block-view.md docs/architecture/00-concepts/scan-pipeline.md docs/architecture/12-glossary.md
git commit -m "feat(scanner): detect the grid quad in the frame processor (#3)"
```

---

### Task 3: Corner smoothing

**Files:**
- Create: `apps/mobile/src/scan/smoothing.ts`, `apps/mobile/src/scan/smoothing.test.ts`
- Modify docs: `docs/architecture/12-glossary.md`

**Interfaces:**
- Consumes: `Quad`, `Point` from `../scanner` (Task 2).
- Produces:
  - `MIN_CUTOFF = 1`, `BETA = 20`, `DERIVATIVE_CUTOFF = 1`, `HOLD = 0.25`
  - `type Smoothing = { quad: Quad; velocity: Quad; timestamp: number }`
  - `smoothQuad(state: Smoothing | null, quad: Quad | null, timestamp: number): Smoothing | null` (worklet; `timestamp` in seconds, the frame clock)

- [ ] **Step 1: Write the failing test**

`apps/mobile/src/scan/smoothing.test.ts`:
```ts
import type { Quad } from '../scanner'
import { HOLD, type Smoothing, smoothQuad } from './smoothing'

const FRAME = 1 / 30

function at(x: number): Quad {
  return [
    { x, y: 0.3 },
    { x: x + 0.4, y: 0.3 },
    { x: x + 0.4, y: 0.6 },
    { x, y: 0.6 },
  ]
}

function run(inputs: Array<Quad | null>, start = 10): Array<Smoothing | null> {
  let state: Smoothing | null = null
  return inputs.map((quad, i) => {
    state = smoothQuad(state, quad, start + i * FRAME)
    return state
  })
}

describe('smoothQuad', () => {
  it('shows the first detection as it is', () => {
    expect(run([at(0.2)])[0]!.quad).toEqual(at(0.2))
  })

  it('keeps a still but noisy outline steady', () => {
    const inputs = Array.from({ length: 150 }, (_, i) => at(0.2 + (i % 2 === 0 ? 0.004 : -0.004)))
    const xs = run(inputs).map((state) => state!.quad[0].x)
    const steps = xs.slice(31).map((x, i) => Math.abs(x - xs[30 + i]))
    expect(Math.max(...steps)).toBeLessThan(0.002)
  })

  it('follows a moving grid closely', () => {
    const inputs = Array.from({ length: 16 }, (_, i) => at(0.2 + 0.6 * i * FRAME))
    const last = run(inputs)[15]!
    expect(Math.abs(last.quad[0].x - (0.2 + 0.6 * 15 * FRAME))).toBeLessThan(0.015)
  })

  it('catches up within 100 ms after a jump', () => {
    const inputs = [...Array.from({ length: 10 }, () => at(0.3)), at(0.4), at(0.4), at(0.4)]
    expect(Math.abs(run(inputs)[12]!.quad[0].x - 0.4)).toBeLessThan(0.01)
  })

  it('holds the outline through a short gap', () => {
    const first = smoothQuad(null, at(0.2), 10)
    expect(smoothQuad(first, null, 10 + HOLD - 0.01)).toBe(first)
  })

  it('hides the outline after a longer gap', () => {
    const first = smoothQuad(null, at(0.2), 10)
    expect(smoothQuad(first, null, 10 + HOLD + 0.01)).toBeNull()
  })

  it('snaps to the grid when it comes back after a gap', () => {
    const first = smoothQuad(null, at(0.2), 10)
    expect(smoothQuad(first, at(0.5), 10 + HOLD + 0.01)!.quad).toEqual(at(0.5))
  })

  it('starts again when the clock goes back', () => {
    const first = smoothQuad(null, at(0.2), 10)
    expect(smoothQuad(first, at(0.5), 5)).toEqual({ quad: at(0.5), velocity: expect.any(Array), timestamp: 5 })
  })
})
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm --filter mobile exec jest src/scan/smoothing.test.ts`
Expected: FAIL, `Cannot find module './smoothing'`.

- [ ] **Step 3: Implement**

`apps/mobile/src/scan/smoothing.ts`:
```ts
import type { Point, Quad } from '../scanner'

// One Euro filter (Casiez et al., CHI 2012): strong smoothing when still, little lag when moving.
// Units: normalised frame coordinates and seconds. Tuned against QR-06.

/** Hz. The cutoff of a still corner. Lower is steadier. */
export const MIN_CUTOFF = 1
/** Hz per (normalised unit per second). Higher follows fast moves with less lag. */
export const BETA = 20
/** Hz. The cutoff of the speed estimate. */
export const DERIVATIVE_CUTOFF = 1
/** Seconds. The outline stays this long after the last detection. */
export const HOLD = 0.25

/** velocity: per corner, in normalised units per second. timestamp: the last detection. */
export type Smoothing = { quad: Quad; velocity: Quad; timestamp: number }

const STILL: Quad = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
]

function alpha(cutoff: number, dt: number): number {
  'worklet'
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dt)
}

/** Null means: no outline. */
export function smoothQuad(state: Smoothing | null, quad: Quad | null, timestamp: number): Smoothing | null {
  'worklet'
  if (quad == null) {
    return state != null && timestamp - state.timestamp <= HOLD ? state : null
  }
  if (state == null || timestamp <= state.timestamp || timestamp - state.timestamp > HOLD) {
    return { quad, velocity: STILL, timestamp }
  }
  const dt = timestamp - state.timestamp
  const derivativeAlpha = alpha(DERIVATIVE_CUTOFF, dt)
  const next: Point[] = []
  const velocity: Point[] = []
  for (let i = 0; i < 4; i++) {
    const previous = state.quad[i]
    const vx = state.velocity[i].x + derivativeAlpha * ((quad[i].x - previous.x) / dt - state.velocity[i].x)
    const vy = state.velocity[i].y + derivativeAlpha * ((quad[i].y - previous.y) / dt - state.velocity[i].y)
    next.push({
      x: previous.x + alpha(MIN_CUTOFF + BETA * Math.abs(vx), dt) * (quad[i].x - previous.x),
      y: previous.y + alpha(MIN_CUTOFF + BETA * Math.abs(vy), dt) * (quad[i].y - previous.y),
    })
    velocity.push({ x: vx, y: vy })
  }
  return { quad: next as Quad, velocity: velocity as Quad, timestamp }
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm --filter mobile exec jest src/scan/smoothing.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Add the glossary term**

Append to the table in `docs/architecture/12-glossary.md`:
```markdown
| One Euro filter | A smoothing filter whose cutoff rises with speed. It keeps a still outline steady and lets a moving outline follow with little lag. Used for corner smoothing |
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/scan/smoothing.ts apps/mobile/src/scan/smoothing.test.ts docs/architecture/12-glossary.md
git commit -m "feat(scan): smooth the grid corners with a One Euro filter (#3)"
```

---

### Task 4: Preview mapping, jitter meter and the outline

**Files:**
- Modify: `apps/mobile/jest.setup.ts`
- Create: `apps/mobile/src/scan/previewMapping.ts`, `apps/mobile/src/scan/previewMapping.test.ts`, `apps/mobile/src/scan/jitter.ts`, `apps/mobile/src/scan/jitter.test.ts`, `apps/mobile/src/scan/GridOutline.tsx`, `apps/mobile/src/scan/GridOutline.test.tsx`
- Modify docs: `docs/architecture/12-glossary.md`

**Interfaces:**
- Consumes: `Quad`, `Point` from `../scanner`.
- Produces (functions are worklets):
  - `type ViewSize = { width: number; height: number }`
  - `uprightAspect(width: number, height: number, orientation: CameraOrientation): number` (width ÷ height of the upright frame)
  - `toPreview(quad: Quad, aspect: number, view: ViewSize): Quad | null` (view points; null before the view has a size)
  - `JITTER_WINDOW = 5`, `type JitterWindow`, `EMPTY_JITTER`, `type JitterReport = { maxStep: number; frames: number; seconds: number }`
  - `trackJitter(window: JitterWindow, quad: Quad | null, timestamp: number): { window: JitterWindow; report: JitterReport | null }`
  - `outlinePoints(quad: Quad | null): Point[]`, `OUTLINE_COLOR = '#34C759'`, `OUTLINE_WIDTH = 4`
  - `GridOutline({ outline }: { outline: SharedValue<Quad | null> })` (a full-screen Skia canvas)

- [ ] **Step 1: Mock Reanimated and Skia**

Append to `apps/mobile/jest.setup.ts`:
```ts
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useAnimatedReaction: jest.fn(),
}))

// Skia's own Jest setup needs CanvasKit. Views are enough for these tests.
jest.mock('@shopify/react-native-skia', () => {
  const { View } = jest.requireActual('react-native')
  const { createElement } = jest.requireActual('react')
  return {
    Canvas: ({ children, ...props }: { children?: unknown }) =>
      createElement(View, { testID: 'skia-canvas', ...props }, children),
    Points: (props: object) => createElement(View, { testID: 'skia-points', ...props }),
  }
})
```

- [ ] **Step 2: Write the failing tests**

`apps/mobile/src/scan/previewMapping.test.ts`:
```ts
import type { Quad } from '../scanner'
import { toPreview, uprightAspect } from './previewMapping'

const corners: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]

describe('uprightAspect', () => {
  it('swaps the sides of a frame that lies sideways', () => {
    expect(uprightAspect(1920, 1080, 'right')).toBeCloseTo(0.5625, 10)
    expect(uprightAspect(1920, 1080, 'left')).toBeCloseTo(0.5625, 10)
  })

  it('keeps the sides of an upright or upside-down frame', () => {
    expect(uprightAspect(1080, 1920, 'up')).toBeCloseTo(0.5625, 10)
    expect(uprightAspect(1080, 1920, 'down')).toBeCloseTo(0.5625, 10)
  })
})

describe('toPreview', () => {
  it('scales the frame to a view of the same shape', () => {
    expect(toPreview(corners, 0.5625, { width: 360, height: 640 })).toEqual([
      { x: 0, y: 0 },
      { x: 360, y: 0 },
      { x: 360, y: 640 },
      { x: 0, y: 640 },
    ])
  })

  it('crops the sides when the view is narrower than the frame', () => {
    const quad = toPreview(corners, 0.5625, { width: 400, height: 800 })!
    expect(quad[0].x).toBeCloseTo(-25, 10)
    expect(quad[0].y).toBeCloseTo(0, 10)
    expect(quad[2].x).toBeCloseTo(425, 10)
    expect(quad[2].y).toBeCloseTo(800, 10)
  })

  it('crops the top and bottom when the view is wider than the frame', () => {
    const quad = toPreview(corners, 0.5625, { width: 600, height: 800 })!
    expect(quad[0].x).toBeCloseTo(0, 10)
    expect(quad[0].y).toBeCloseTo(-400 / 3, 10)
    expect(quad[2].y).toBeCloseTo(800 + 400 / 3, 10)
  })

  it('maps the centre of the frame to the centre of the view', () => {
    const centre: Quad = [corners[0], corners[1], { x: 0.5, y: 0.5 }, corners[3]]
    expect(toPreview(centre, 0.5625, { width: 400, height: 800 })![2]).toEqual({ x: 200, y: 400 })
  })

  it('has no outline before the view has a size', () => {
    expect(toPreview(corners, 0.5625, { width: 0, height: 0 })).toBeNull()
  })

  it('has no outline when the frame shape is unknown', () => {
    expect(toPreview(corners, Number.NaN, { width: 400, height: 800 })).toBeNull()
  })
})
```
`apps/mobile/src/scan/jitter.test.ts`:
```ts
import type { Quad } from '../scanner'
import { EMPTY_JITTER, type JitterReport, type JitterWindow, trackJitter } from './jitter'

function at(x: number): Quad {
  return [
    { x, y: 100 },
    { x: x + 200, y: 100 },
    { x: x + 200, y: 300 },
    { x, y: 300 },
  ]
}

function feed(inputs: Array<[Quad | null, number]>): JitterReport[] {
  let window: JitterWindow = EMPTY_JITTER
  const reports: JitterReport[] = []
  for (const [quad, timestamp] of inputs) {
    const result = trackJitter(window, quad, timestamp)
    window = result.window
    if (result.report !== null) reports.push(result.report)
  }
  return reports
}

describe('trackJitter', () => {
  it('reports the largest corner step after 5 s of outline', () => {
    const inputs = Array.from({ length: 151 }, (_, i): [Quad, number] => [at(100 + (i === 70 ? 1.5 : 0)), i / 30])
    const reports = feed(inputs)
    expect(reports).toHaveLength(1)
    expect(reports[0].maxStep).toBeCloseTo(1.5, 10)
    expect(reports[0].frames).toBe(150)
    expect(reports[0].seconds).toBeCloseTo(5, 10)
  })

  it('starts again when the outline disappears', () => {
    const before = Array.from({ length: 100 }, (_, i): [Quad, number] => [at(100), i / 30])
    const after = Array.from({ length: 100 }, (_, i): [Quad, number] => [at(100), 4 + i / 30])
    expect(feed([...before, [null, 3.5], ...after])).toEqual([])
  })

  it('starts again when the clock goes back', () => {
    const before = Array.from({ length: 100 }, (_, i): [Quad, number] => [at(100), 10 + i / 30])
    const after = Array.from({ length: 100 }, (_, i): [Quad, number] => [at(100), 1 + i / 30])
    expect(feed([...before, ...after])).toEqual([])
  })
})
```
`apps/mobile/src/scan/GridOutline.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native'
import type { SharedValue } from 'react-native-reanimated'
import type { Quad } from '../scanner'
import { GridOutline, OUTLINE_WIDTH, outlinePoints } from './GridOutline'

const quad: Quad = [
  { x: 10, y: 20 },
  { x: 110, y: 20 },
  { x: 110, y: 120 },
  { x: 10, y: 120 },
]

describe('outlinePoints', () => {
  it('closes the polygon at the first corner', () => {
    expect(outlinePoints(quad)).toEqual([...quad, quad[0]])
  })

  it('draws nothing without a quad', () => {
    expect(outlinePoints(null)).toEqual([])
  })
})

describe('GridOutline', () => {
  it('draws the quad as a stroked polygon that ignores touches', () => {
    render(<GridOutline outline={{ value: quad } as unknown as SharedValue<Quad | null>} />)
    expect(screen.getByTestId('skia-canvas').props.pointerEvents).toBe('none')
    const points = screen.getByTestId('skia-points').props
    expect(points.points.value).toEqual([...quad, quad[0]])
    expect(points.mode).toBe('polygon')
    expect(points.style).toBe('stroke')
    expect(points.strokeWidth).toBe(OUTLINE_WIDTH)
  })
})
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `pnpm --filter mobile exec jest src/scan/previewMapping.test.ts src/scan/jitter.test.ts src/scan/GridOutline.test.tsx`
Expected: FAIL, `Cannot find module` for each of the three files.

- [ ] **Step 4: Implement**

`apps/mobile/src/scan/previewMapping.ts`:
```ts
import type { CameraOrientation } from 'react-native-vision-camera'
import type { Quad } from '../scanner'

export type ViewSize = { width: number; height: number }

/** width ÷ height of the frame after it is turned upright. */
export function uprightAspect(width: number, height: number, orientation: CameraOrientation): number {
  'worklet'
  return orientation === 'left' || orientation === 'right' ? height / width : width / height
}

/**
 * Maps a normalised quad to view points. The preview fills the view and crops the frame
 * ('cover', the VisionCamera default). Null before the view has a size.
 */
export function toPreview(quad: Quad, aspect: number, view: ViewSize): Quad | null {
  'worklet'
  if (view.width <= 0 || view.height <= 0 || !(aspect > 0)) return null
  const height = Math.max(view.height, view.width / aspect)
  const width = height * aspect
  const left = (view.width - width) / 2
  const top = (view.height - height) / 2
  return quad.map((p) => ({ x: left + p.x * width, y: top + p.y * height })) as Quad
}
```
`apps/mobile/src/scan/jitter.ts`:
```ts
import type { Quad } from '../scanner'

/** Seconds of outline without a gap per report (QR-06). */
export const JITTER_WINDOW = 5

export type JitterWindow = { start: number; previous: Quad | null; maxStep: number; frames: number }

export const EMPTY_JITTER: JitterWindow = { start: -1, previous: null, maxStep: 0, frames: 0 }

/** maxStep: the largest distance, in view points, that one corner moved between two frames. */
export type JitterReport = { maxStep: number; frames: number; seconds: number }

/** quad: the drawn outline in view points. A gap in the outline starts a new window. */
export function trackJitter(
  window: JitterWindow,
  quad: Quad | null,
  timestamp: number,
): { window: JitterWindow; report: JitterReport | null } {
  'worklet'
  if (quad == null || window.previous == null || timestamp < window.start) {
    return { window: { start: timestamp, previous: quad, maxStep: 0, frames: 0 }, report: null }
  }
  let step = 0
  for (let i = 0; i < 4; i++) {
    step = Math.max(step, Math.hypot(quad[i].x - window.previous[i].x, quad[i].y - window.previous[i].y))
  }
  const maxStep = Math.max(window.maxStep, step)
  const frames = window.frames + 1
  const seconds = timestamp - window.start
  if (seconds >= JITTER_WINDOW) {
    return { window: { start: timestamp, previous: quad, maxStep: 0, frames: 0 }, report: { maxStep, frames, seconds } }
  }
  return { window: { start: window.start, previous: quad, maxStep, frames }, report: null }
}
```
`apps/mobile/src/scan/GridOutline.tsx`:
```tsx
import { Canvas, Points } from '@shopify/react-native-skia'
import { StyleSheet } from 'react-native'
import { type SharedValue, useDerivedValue } from 'react-native-reanimated'
import type { Point, Quad } from '../scanner'

export const OUTLINE_COLOR = '#34C759'
export const OUTLINE_WIDTH = 4

export function outlinePoints(quad: Quad | null): Point[] {
  'worklet'
  return quad == null ? [] : [quad[0], quad[1], quad[2], quad[3], quad[0]]
}

/** outline: in view points. Skia reads it on the UI thread. */
export function GridOutline({ outline }: { outline: SharedValue<Quad | null> }) {
  const points = useDerivedValue(() => outlinePoints(outline.value))
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Points
        points={points}
        mode="polygon"
        color={OUTLINE_COLOR}
        style="stroke"
        strokeWidth={OUTLINE_WIDTH}
        strokeJoin="round"
      />
    </Canvas>
  )
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm --filter mobile exec jest src/scan/previewMapping.test.ts src/scan/jitter.test.ts src/scan/GridOutline.test.tsx`
Expected: PASS, 14 tests.

- [ ] **Step 6: Add the glossary term**

Append to the table in `docs/architecture/12-glossary.md`:
```markdown
| Outline | The four-sided line that Skia draws over the camera preview, on the smoothed quad |
```

- [ ] **Step 7: Run the checks and commit**

Run: `just typecheck && just lint && just test-ts`
Expected: all pass.
```bash
git add apps/mobile/jest.setup.ts apps/mobile/src/scan/previewMapping.ts apps/mobile/src/scan/previewMapping.test.ts apps/mobile/src/scan/jitter.ts apps/mobile/src/scan/jitter.test.ts apps/mobile/src/scan/GridOutline.tsx apps/mobile/src/scan/GridOutline.test.tsx docs/architecture/12-glossary.md
git commit -m "feat(scan): map the quad onto the preview and draw the outline in Skia (#3)"
```

---

### Task 5: Wire the camera screen

**Files:**
- Modify: `apps/mobile/src/scan/frameRate.ts`, `apps/mobile/src/scan/frameRate.test.ts`, `apps/mobile/src/scan/CameraScreen.tsx`, `apps/mobile/src/scan/CameraScreen.test.tsx`

**Interfaces:**
- Consumes: `useGridDetector`, `Quad` (Task 2); `smoothQuad`, `Smoothing` (Task 3); `uprightAspect`, `toPreview`, `ViewSize`, `trackJitter`, `EMPTY_JITTER`, `JitterReport`, `GridOutline` (Task 4).
- Produces:
  - `countFrame(window: FrameWindow, timestamp: number, detectionMs: number): { window: FrameWindow; report: { fps: number; detectionMs: number } | null }` (this replaces the `fps` field)
  - `type FrameDetection = { quad: Quad | null; timestamp: number; aspect: number }`, exported from `CameraScreen.tsx`
  - Dev log lines: `[camera] 30.0 fps, detection 6.2 ms` and `[outline] max corner step 0.80 pt over 150 frames (5.0 s)`

- [ ] **Step 1: Change the frame meter tests**

In `apps/mobile/src/scan/frameRate.test.ts`, replace the `feed` function with:
```ts
function feed(timestamps: number[], detectionMs = 0): Array<number | null> {
  let window: FrameWindow = EMPTY_WINDOW
  return timestamps.map((t) => {
    const result = countFrame(window, t, detectionMs)
    window = result.window
    return result.report?.fps ?? null
  })
}
```
Add this test at the end of the `describe` block:
```ts
  it('reports the mean detection time of the window', () => {
    let window: FrameWindow = EMPTY_WINDOW
    const reports = Array.from({ length: 31 }, (_, i) => {
      const result = countFrame(window, 10 + i / 30, i % 2 === 0 ? 4 : 8)
      window = result.window
      return result.report
    })
    expect(reports[30]!.detectionMs).toBeCloseTo(6, 1)
  })
```
Run: `pnpm --filter mobile exec jest src/scan/frameRate.test.ts`
Expected: FAIL (`report` is undefined).

- [ ] **Step 2: Change the frame meter**

Replace `apps/mobile/src/scan/frameRate.ts` with:
```ts
// Counts camera frames in windows of at least one second. Runs as a worklet on the camera thread.

/** detectionMs: the sum over the frames of the window. */
export type FrameWindow = { start: number; last: number; frames: number; detectionMs: number }

export const EMPTY_WINDOW: FrameWindow = { start: -1, last: -1, frames: 0, detectionMs: 0 }

/** The longest time in seconds between two frames inside one window. A longer gap means a pause. */
export const MAX_GAP = 0.5

/** detectionMs: the grid detection time of this frame. The report gives the mean of the window. */
export function countFrame(
  window: FrameWindow,
  timestamp: number,
  detectionMs: number,
): { window: FrameWindow; report: { fps: number; detectionMs: number } | null } {
  'worklet'
  if (window.start < 0 || timestamp < window.last || timestamp - window.last > MAX_GAP) {
    return { window: { start: timestamp, last: timestamp, frames: 0, detectionMs: 0 }, report: null }
  }
  const frames = window.frames + 1
  const total = window.detectionMs + detectionMs
  const elapsed = timestamp - window.start
  if (elapsed >= 1) {
    return {
      window: { start: timestamp, last: timestamp, frames: 0, detectionMs: 0 },
      report: { fps: frames / elapsed, detectionMs: total / frames },
    }
  }
  return { window: { start: window.start, last: timestamp, frames, detectionMs: total }, report: null }
}
```
Run: `pnpm --filter mobile exec jest src/scan/frameRate.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 3: Change the camera screen tests**

In `apps/mobile/src/scan/CameraScreen.test.tsx`:

1. Add these imports and mocks after the existing imports:
```tsx
import { useAnimatedReaction } from 'react-native-reanimated'
import { type GridDetector, type Quad, useGridDetector } from '../scanner'
import type { FrameDetection } from './CameraScreen'
import { GridOutline } from './GridOutline'

jest.mock('../scanner', () => ({
  ...jest.requireActual('../scanner'),
  useGridDetector: jest.fn(() => undefined),
}))

jest.mock('./GridOutline', () => ({ GridOutline: jest.fn(() => null) }))
```
2. Replace the `FrameConfig` type and the `onFrame` function with:
```tsx
type FakeFrame = {
  timestamp: number
  width: number
  height: number
  orientation: 'up' | 'right' | 'down' | 'left'
  dispose: () => void
}
type FrameConfig = { onFrame: (frame: FakeFrame) => void }

function onFrame() {
  const config = frameOutput.mock.calls.at(-1)?.[0] as unknown as FrameConfig
  return config.onFrame
}

function frameAt(timestamp: number, dispose: () => void = jest.fn()): FakeFrame {
  return { timestamp, width: 1920, height: 1080, orientation: 'right', dispose }
}

const detector = jest.mocked(useGridDetector)
const reaction = jest.mocked(useAnimatedReaction)
const outline = jest.mocked(GridOutline)

const quad: Quad = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.8, y: 0.8 },
  { x: 0.2, y: 0.8 },
]

/** The last render's reaction: its input (the published detection) and its handler. */
function lastReaction() {
  const [prepare, react] = reaction.mock.calls.at(-1)! as unknown as [
    () => FrameDetection | null,
    (current: FrameDetection | null) => void,
  ]
  return { prepare, react }
}
```
3. In the existing `beforeEach`, add `detector.mockReturnValue(undefined)`. A mocked return value survives `jest.clearAllMocks()`, so a throwing detector from one test would break the next.

4. In the test `logs the frame rate once per second`, replace the two lines that build and feed the frames with:
```tsx
    const disposers = Array.from({ length: 31 }, () => jest.fn())
    disposers.forEach((dispose, i) => handle(frameAt(100 + i / 30, dispose)))
```
and replace the expected log line with `'[camera] 30.0 fps, detection 0.0 ms'`.

5. In the test `releases every frame, also when counting fails`, replace `onFrame()({ timestamp: 1, dispose })` with `onFrame()(frameAt(1, dispose))`.

6. Add these tests at the end of the `describe('CameraScreen')` block:
```tsx
  it('publishes the detection of every frame for the UI thread', () => {
    givenPermission('authorized')
    const detectGrid = jest.fn(() => ({ quad, score: 0.36 }))
    detector.mockReturnValue(detectGrid as unknown as GridDetector)
    render(<CameraScreen />)
    const frame = frameAt(5)
    onFrame()(frame)
    expect(detectGrid).toHaveBeenCalledWith(frame)
    expect(lastReaction().prepare()).toEqual({ quad, timestamp: 5, aspect: 1080 / 1920 })
  })

  it('publishes an empty detection while the detector loads', () => {
    givenPermission('authorized')
    detector.mockReturnValue(undefined)
    render(<CameraScreen />)
    onFrame()(frameAt(5))
    expect(lastReaction().prepare()).toEqual({ quad: null, timestamp: 5, aspect: 1080 / 1920 })
  })

  it('disposes the frame when detection fails', () => {
    givenPermission('authorized')
    detector.mockReturnValue((() => {
      throw new Error('detect failed')
    }) as unknown as GridDetector)
    render(<CameraScreen />)
    const dispose = jest.fn()
    expect(() => onFrame()(frameAt(5, dispose))).toThrow('detect failed')
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('turns a detection into an outline in view points', () => {
    givenPermission('authorized')
    render(<CameraScreen />)
    fireEvent(screen.getByTestId('camera-screen'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 640 } },
    })
    lastReaction().react({ quad, timestamp: 5, aspect: 0.5625 })
    const shown = outline.mock.calls.at(-1)![0].outline.value
    expect(shown).toEqual([
      { x: 72, y: 128 },
      { x: 288, y: 128 },
      { x: 288, y: 512 },
      { x: 72, y: 512 },
    ])
  })

  it('removes the outline when the grid is gone for longer than the hold time', () => {
    givenPermission('authorized')
    render(<CameraScreen />)
    fireEvent(screen.getByTestId('camera-screen'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 640 } },
    })
    const { react } = lastReaction()
    react({ quad, timestamp: 5, aspect: 0.5625 })
    react({ quad: null, timestamp: 6, aspect: 0.5625 })
    expect(outline.mock.calls.at(-1)![0].outline.value).toBeNull()
  })
```
The `layout` event causes no re-render, because it only writes a shared value. So `lastReaction()` and the last `GridOutline` props come from the same render.

Run: `pnpm --filter mobile exec jest src/scan/CameraScreen.test.tsx`
Expected: FAIL (no `camera-screen` test ID, no reaction, the old log line).

- [ ] **Step 4: Wire the camera screen**

Replace `apps/mobile/src/scan/CameraScreen.tsx` with:
```tsx
import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useState } from 'react'
import { AppState, Button, Linking, StyleSheet, Text, View } from 'react-native'
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated'
import { Camera, useCameraDevice, useCameraPermission, useFrameOutput } from 'react-native-vision-camera'
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets'
import { type Quad, useGridDetector } from '../scanner'
import { countFrame, EMPTY_WINDOW } from './frameRate'
import { GridOutline } from './GridOutline'
import { EMPTY_JITTER, type JitterReport, trackJitter } from './jitter'
import { toPreview, uprightAspect, type ViewSize } from './previewMapping'
import { type Smoothing, smoothQuad } from './smoothing'

/** One frame's result, from the camera thread to the UI thread. aspect: of the upright frame. */
export type FrameDetection = { quad: Quad | null; timestamp: number; aspect: number }

const MEASURE_JITTER = __DEV__

function logFrameRate(fps: number, detectionMs: number) {
  if (__DEV__) console.log(`[camera] ${fps.toFixed(1)} fps, detection ${detectionMs.toFixed(1)} ms`)
}

function logJitter(report: JitterReport) {
  console.log(
    `[outline] max corner step ${report.maxStep.toFixed(2)} pt over ${report.frames} frames (${report.seconds.toFixed(1)} s)`,
  )
}

export function CameraScreen() {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back')
  const [isActive, setIsActive] = useState(AppState.currentState === 'active')
  const window = useMemo(() => createSynchronizable(EMPTY_WINDOW), [])
  const detectGrid = useGridDetector()
  const detection = useSharedValue<FrameDetection | null>(null)
  const viewSize = useSharedValue<ViewSize>({ width: 0, height: 0 })
  const smoothing = useSharedValue<Smoothing | null>(null)
  const jitter = useSharedValue(EMPTY_JITTER)
  const outline = useSharedValue<Quad | null>(null)

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    onFrame(frame) {
      'worklet'
      try {
        const started = Date.now()
        const grid = detectGrid == null ? null : detectGrid(frame)
        const result = countFrame(window.getBlocking(), frame.timestamp, Date.now() - started)
        window.setBlocking(result.window)
        if (result.report !== null) scheduleOnRN(logFrameRate, result.report.fps, result.report.detectionMs)
        detection.value = {
          quad: grid == null ? null : grid.quad,
          timestamp: frame.timestamp,
          aspect: uprightAspect(frame.width, frame.height, frame.orientation),
        }
      } finally {
        frame.dispose()
      }
    },
  })

  useAnimatedReaction(
    () => detection.value,
    (current) => {
      if (current == null) return
      const smoothed = smoothQuad(smoothing.value, current.quad, current.timestamp)
      smoothing.value = smoothed
      const shown = smoothed == null ? null : toPreview(smoothed.quad, current.aspect, viewSize.value)
      outline.value = shown
      if (MEASURE_JITTER) {
        const result = trackJitter(jitter.value, shown, current.timestamp)
        jitter.value = result.window
        if (result.report !== null) scheduleOnRN(logJitter, result.report)
      }
    },
  )

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setIsActive(state === 'active'))
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    if (canRequestPermission) void requestPermission()
  }, [canRequestPermission, requestPermission])

  if (!hasPermission) {
    if (canRequestPermission) {
      return (
        <View testID="camera-waiting" style={styles.message}>
          <StatusBar style="dark" />
        </View>
      )
    }
    return (
      <View testID="camera-denied" style={styles.message}>
        <StatusBar style="dark" />
        <Text style={styles.text}>Sudoku needs the camera to scan a puzzle.</Text>
        <Button testID="open-settings" title="Open Settings" onPress={() => void Linking.openSettings()} />
      </View>
    )
  }
  if (device == null) {
    return (
      <View testID="camera-missing" style={styles.message}>
        <StatusBar style="dark" />
        <Text style={styles.text}>This phone has no back camera.</Text>
      </View>
    )
  }
  return (
    <View
      testID="camera-screen"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        viewSize.value = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height }
      }}
    >
      <StatusBar style="light" />
      <Camera style={StyleSheet.absoluteFill} device={device} isActive={isActive} outputs={[frameOutput]} />
      <GridOutline outline={outline} />
    </View>
  )
}

const styles = StyleSheet.create({
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  text: { fontSize: 17, textAlign: 'center' },
})
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm --filter mobile exec jest`
Expected: PASS, every app test, including `App.test.tsx`.

- [ ] **Step 6: Run the checks and commit**

Run: `just typecheck && just lint && just boundaries && just test-ts && just bundle`
Expected: all pass.
```bash
git add apps/mobile/src/scan/frameRate.ts apps/mobile/src/scan/frameRate.test.ts apps/mobile/src/scan/CameraScreen.tsx apps/mobile/src/scan/CameraScreen.test.tsx
git commit -m "feat(scan): draw a smoothed live outline on the detected grid (#3)"
```

---

### Task 6: Measure on the iPhone and record the results (developer and agent)

The build needs the connected phone. The checks need a printed sudoku. The agent builds, reads the logs and writes the results. The developer holds the phone and reports what the screen shows.

**Files:**
- Modify docs: `docs/architecture/adr/adr-002-react-native-and-scanner-engine.md`, `docs/architecture/00-concepts/scan-pipeline.md`
- Modify (only when tuning): the constants named in Step 4

- [ ] **Step 1 (agent): Build and install.** The resizer is a new native module, so the app needs a new native build.
  1. Stop every Metro server that runs from another worktree. Port 8081 must be free: `lsof -i :8081` prints nothing.
  2. Find the iPhone: `xcrun devicectl list devices`. Note its identifier.
  3. From `apps/mobile/` in this worktree, run:
     ```bash
     DEVELOPER_DIR=/Applications/Xcode-27.0.0.app/Contents/Developer pnpm exec expo run:ios --device <identifier>
     ```
  4. Run `git status`. If Expo changed `apps/mobile/package.json` or `apps/mobile/app.json`, restore them with `git checkout -- apps/mobile/package.json apps/mobile/app.json`. Do not commit `apps/mobile/ios/`.
  5. Start Metro with its output in a log file. Read the `[camera]` and `[outline]` lines from that file.
- [ ] **Step 2 (developer): Run the checks.** Use a printed sudoku on a flat table in even light. Record each number.

  | # | Check | How | Pass |
  | --- | --- | --- | --- |
  | a | Frame rate (QR-05, ADR-002) | Point at the grid for 60 s | Every `[camera]` line ≥ 29.0 fps, mean ≥ 29.5 fps. Record the mean detection ms |
  | b | Outline appears (QR-05) | Point away, then at the grid | The outline is on the grid within about 300 ms |
  | c | Outline sits on the grid | Look at the four corners | Each outline corner is on the outer grid corner |
  | d | Still page (QR-06) | Hold the phone still over the page for 10 s | An `[outline]` line shows a max corner step < 2 pt |
  | e | Follows a move (ADR-002) | Slide the page slowly, then fast | The outline follows without a visible lag. It does not jump to other shapes |
  | f | No grid | Point at a wall, then at a page of text | No outline, or an outline that disappears within 0.25 s |
  | g | Background | Send the app to the background, wait 5 s, open it | The preview and the outline come back. No crash |
  | h | Memory and heat (QR-08) | Open `apps/mobile/ios/Sudoku.xcworkspace` in Xcode. Choose Debug ▸ Attach to Process ▸ Sudoku. Scan for 5 minutes and watch the Memory gauge | The memory at 5 min is at most 10 MB above the memory at 1 min. iOS shows no temperature warning. The `[camera]` lines in the last minute still pass check a |

- [ ] **Step 3 (agent): Read the logs.** Compute the mean, the minimum fps and the mean detection ms over the 60 s of check a. Take the `[outline]` lines of check d. Check that no `[scanner]` warning and no OpenCV error appear in the log.
- [ ] **Step 4 (agent and developer): Tune only when a check fails.** Change one constant at a time, rebuild the JS (Metro reloads it), and repeat the failed check. Record each change and its result in the ledger.

  | Failed check | Constant | File | Direction |
  | --- | --- | --- | --- |
  | d (jitter) | `MIN_CUTOFF` | `src/scan/smoothing.ts` | Lower: 1 → 0.5 |
  | e (lag) | `BETA` | `src/scan/smoothing.ts` | Higher: 20 → 40 |
  | b, c, f (wrong shape or no outline) | `THRESHOLD_BLOCK`, `THRESHOLD_C`, `BLUR_SIZE`, `APPROX_EPSILON` | `src/scanner/findGrid.ts` | Block 11 → 15 or 21. C 2 → 4. Blur 5 → 3. Epsilon 0.02 → 0.03 |
  | f (outline flickers on text) | `MIN_AREA_FRACTION` | `src/scanner/quad.ts` | Higher: 0.1 → 0.15 |
  | a (fps) | `DETECT_WIDTH`, `DETECT_HEIGHT` | `src/scanner/useGridDetector.ts` | Smaller: 360 × 640 → 270 × 480 |

  After a change, run `just test-ts`. If a unit test pins the old value, update the test so that it pins the new behaviour, and keep its intent. If check a still fails at 270 × 480, stop and report. ADR-002 decision 4 then moves the detection step to a Swift plugin, and that needs its own issue.
- [ ] **Step 5 (agent): Write the results in issue #3.** Post a comment with:
  - the iPhone model, the iOS version and the Xcode version;
  - check a: mean fps, minimum fps, mean detection ms;
  - check d: the max corner step of each `[outline]` line;
  - check h: the memory at 1 min and at 5 min, and the heat result;
  - checks b, c, e, f, g: pass or fail, with a note;
  - every constant that changed in Step 4, with its old and new value.

  Then tick the acceptance criteria that passed: read the body with `gh issue view 3 --json body -q .body`, change `- [ ]` to `- [x]` for each passed criterion, and save it with `gh issue edit 3 --body-file <file>`.
- [ ] **Step 6 (agent): Update the architecture docs.**
  1. In ADR-002, add a "Result, live detection" paragraph after the fast-opencv result. Use the same form: the date, a link to the issue #3 comment, the device, and the numbers of checks a, d and h. Write that the corners reach the UI thread through a Reanimated 4.5.1 shared value, written from the VisionCamera 5.2.3 frame processor on `react-native-worklets` 0.10.1. Mark the rows "Live 4-corner detection", "Outline drawn in Skia", "Memory" and "Thread handoff" as passed, with the date, like the fast-opencv row. Leave the ADR status as Proposed. Issue #7 accepts it.
  2. In the scan-pipeline concept, change the "Corner smoothing" row of the Stages table. Its Notes become: `One Euro filter per corner coordinate: MIN_CUTOFF <value> Hz, BETA <value>, DERIVATIVE_CUTOFF 1 Hz. The outline holds 0.25 s after the last detection`. Use the final values.
  3. In the concept's "Open questions" table, delete the row "Smoothing filter and its parameters". Keep the lock-on row. Issue #6 answers it.
  4. Run `just docs-check`. Expected: pass.
- [ ] **Step 7: Commit**

```bash
git add docs/architecture/adr/adr-002-react-native-and-scanner-engine.md docs/architecture/00-concepts/scan-pipeline.md
git commit -m "docs: record the live detection results in ADR-002 (#3)"
```
If Step 4 changed constants, commit those first, in their own commit: `fix(scan): tune <constant> on the iPhone (#3)`.
