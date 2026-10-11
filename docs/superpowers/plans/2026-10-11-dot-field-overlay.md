# Dot Field Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the green grid outline on the camera screen with the dot field: faint star-like dots that float all the time and gather on the 100 grid intersections when a grid is found (issue #18).

**Architecture:** Pure, worklet-safe modules in `apps/mobile/src/scan/dots/` hold the geometry, the dot layout, the greedy assignment, the push-apart step and the field state machine. A `DotField` component advances the field in a Reanimated frame callback on the UI thread and draws it into one Skia picture. `CameraScreen` passes it the smoothed outline that it already computes. No corner and no dot position goes through the JS thread.

**Tech Stack:** Expo SDK 57, React Native, Reanimated 4.5.1 (`useFrameCallback`, `useReducedMotion`, `SharedValue.modify`), React Native Skia 2.6.2 (`Canvas`, `Picture`, `createPicture`, `Skia.Paint`, `Skia.Path`), Jest with `jest-expo`.

**Spec:** `docs/superpowers/specs/2026-10-11-scan-experience-design.md` (stage 1, Architecture, Accessibility, Testing, Documentation changes). Prototype: Scan flow studies, section 1d.

## Prerequisites

- Issue #3 (live grid detection) is merged into `develop`. This plan builds on its files: `CameraScreen.tsx`, `smoothing.ts`, `previewMapping.ts`, `jitter.ts`, `frameRate.ts`, `GridOutline.tsx` and `src/scanner/quad.ts`.
- Create the worktree from `develop`: branch `feature/18-dot-field`.

## Global Constraints

- Every function that runs on the UI thread starts with the `'worklet'` directive.
- In a worklet module, define a helper **above** the function that calls it. The worklet transform captures a helper when it creates the caller, so function hoisting does not work. A call to a helper defined below fails with "is not a function".
- Worklet code uses no ES2022+ array methods (`at`, `toSorted`, `findLast`), no `Set`, no `Map` and no classes. Use `for` loops, plain arrays and `arr.sort(...)` on an array the function owns.
- Write shared values with `.set()` or `.modify()`, never with `.value =` (oxlint `react/immutability`).
- The overlay gets corners only from `CameraScreen` and types only through `src/scanner/index.ts` (SUD-05). Import `Point` and `Quad` from `'../../scanner'`.
- No corner and no dot position goes through the JS thread. Only the dev timing log uses `scheduleOnRN`.
- Code comments follow the root `AGENTS.md` "Code comments" rules. Do not refer to issues, pull requests or plan tasks in code comments.
- Values from the spec, verbatim:
  - 312 dots on the 402 × 874 pt reference view (12 × 26), each moved by up to 30 % of a cell. Same density per area on other sizes.
  - Wander amplitude 5–9 pt, frequency 0.5–1.1 rad/s, two sine waves per axis.
  - Dot radius 0.75–1.25 pt. Halo diameter 9 × the radius. Twinkle ± 28 % at 1.2–3.4 rad/s.
  - Free dot opacity 32 %. Gathered dot opacity 40 % → 80 % during the flight.
  - Black dim: 30 % while searching. With a grid: 45 % outside, 0 % inside, over 0.4 s.
  - Flight 0.7 s, delay up to 0.35 s (closer starts sooner). Gathered radius 1.25 ×, box corners 1.7 ×.
  - Gathered dots keep 15 % of their wobble while the corners move, 0 % when steady.
  - Free dots stay at least 8 % of the grid size from the grid. They move to their new place in 1.0 s.
  - After the grid is lost (the outline becomes null after `HOLD` = 0.25 s), the gathered dots go free in 0.5 s.
  - Reduce Motion: no wander, no twinkle, no flight. The gathered dots fade in on their intersections in 0.2 s.
  - The overlay takes ≤ 4 ms per frame on the UI thread.
- Commit messages: Conventional Commits with `(#18)`. Do not commit `apps/mobile/ios/`. If `expo run:ios` rewrites `apps/mobile/package.json` or `app.json`, revert that with `git checkout -- apps/mobile/package.json apps/mobile/app.json`.

## Review Focus

1. **A degenerate quad** (three corners on one line) must not put NaN positions on screen. The field treats it as "no grid". Test: Task 1 `unitToQuad` and `invert` return null, Task 5 `stepField` with a collinear quad.
2. **A view that is still 0 × 0 or that changes size** must not crash, and the field rebuilds for the new size. Test: Task 6 "waits for the view size" and "rebuilds the field when the view size changes".
3. **Fewer dots than intersections** (a tiny view) must not crash. The intersections without a dot get none. Test: Task 3 "leaves intersections without a dot when there are too few dots".
4. **A long pause** (the app in the background, or a clock that goes back) must not make the dots jump. The step is clamped to 0.1 s. Test: Task 5 "clamps a long pause".
5. **A jump to another grid in one frame** counts as lost and found, with a new assignment. Test: Task 5 "reassigns when the grid jumps".

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/mobile/src/scan/dots/geometry.ts` | Homography from the unit square to a quad, its inverse, the 100 intersections, box corners, push a point out of the grid margin |
| `apps/mobile/src/scan/dots/layout.ts` | Dot spacing, the deterministic dot layout, wander and twinkle |
| `apps/mobile/src/scan/dots/assign.ts` | Greedy nearest assignment of dots to intersections |
| `apps/mobile/src/scan/dots/spread.ts` | One push-apart step over a set of points |
| `apps/mobile/src/scan/dots/field.ts` | Field state, spec constants, `createField`, `stepField` |
| `apps/mobile/src/scan/dots/draw.ts` | `drawField`: the dim and the star dots into a Skia canvas |
| `apps/mobile/src/scan/dots/DotField.tsx` | The component: frame callback, picture, dev timing log |
| `apps/mobile/src/scan/CameraScreen.tsx` | Uses `DotField` instead of `GridOutline` |
| `apps/mobile/src/scan/GridOutline.tsx` and its test | Deleted |
| `apps/mobile/jest.setup.ts` | Mocks for `useFrameCallback`, `useReducedMotion`, `Picture`, `createPicture`, `Skia`, `FillType` |
| `docs/architecture/00-concepts/scan-pipeline.md`, `docs/architecture/12-glossary.md` | Documentation changes |

Each module has a test file next to it with the same name and `.test.ts` or `.test.tsx`.

---

### Task 1: Geometry

**Files:**
- Create: `apps/mobile/src/scan/dots/geometry.ts`
- Test: `apps/mobile/src/scan/dots/geometry.test.ts`

**Interfaces:**
- Consumes: `Point`, `Quad` from `'../../scanner'` (`Point = { x: number; y: number }`, `Quad = [Point, Point, Point, Point]`, order top-left, top-right, bottom-right, bottom-left).
- Produces:
  - `type Homography = [number, number, number, number, number, number, number, number]`
  - `unitToQuad(quad: Quad): Homography | null`
  - `invert(m: Homography): Homography | null`
  - `project(m: Homography, u: number, v: number): Point`
  - `GRID_POINTS = 10`
  - `intersections(m: Homography): Point[]` (100 points, index = row × 10 + column)
  - `isBoxCorner(index: number): boolean`
  - `pushOutside(p: Point, m: Homography, inverse: Homography, margin: number): Point`

- [ ] **Step 1: Write the failing test**

```ts
import type { Quad } from '../../scanner'
import { intersections, invert, isBoxCorner, project, pushOutside, unitToQuad } from './geometry'

const skewed: Quad = [
  { x: 100, y: 200 },
  { x: 300, y: 190 },
  { x: 330, y: 420 },
  { x: 80, y: 400 },
]

const square: Quad = [
  { x: 100, y: 100 },
  { x: 200, y: 100 },
  { x: 200, y: 200 },
  { x: 100, y: 200 },
]

function close(a: { x: number; y: number }, b: { x: number; y: number }) {
  expect(a.x).toBeCloseTo(b.x, 6)
  expect(a.y).toBeCloseTo(b.y, 6)
}

describe('unitToQuad', () => {
  it('maps the unit square corners onto the quad corners', () => {
    const m = unitToQuad(skewed)!
    close(project(m, 0, 0), skewed[0])
    close(project(m, 1, 0), skewed[1])
    close(project(m, 1, 1), skewed[2])
    close(project(m, 0, 1), skewed[3])
  })

  it('maps the centre of a square to its centre', () => {
    close(project(unitToQuad(square)!, 0.5, 0.5), { x: 150, y: 150 })
  })

  it('refuses a quad whose last three corners lie on one line', () => {
    const flat: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 200 },
    ]
    expect(unitToQuad(flat)).toBeNull()
  })
})

describe('invert', () => {
  it('has no inverse when the first three corners lie on one line', () => {
    const flat: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 0, y: 100 },
    ]
    expect(invert(unitToQuad(flat)!)).toBeNull()
  })

  it('maps the quad corners back to the unit square', () => {
    const m = unitToQuad(skewed)!
    const inverse = invert(m)!
    close(project(inverse, skewed[2].x, skewed[2].y), { x: 1, y: 1 })
    const p = project(m, 0.3, 0.7)
    close(project(inverse, p.x, p.y), { x: 0.3, y: 0.7 })
  })
})

describe('intersections', () => {
  it('gives 100 points in rows, from the top-left corner to the bottom-right corner', () => {
    const points = intersections(unitToQuad(square)!)
    expect(points).toHaveLength(100)
    close(points[0], { x: 100, y: 100 })
    close(points[9], { x: 200, y: 100 })
    close(points[99], { x: 200, y: 200 })
    close(points[10], { x: 100, y: 100 + 100 / 9 })
  })
})

describe('isBoxCorner', () => {
  it('marks the 16 points where the box lines cross', () => {
    const corners = Array.from({ length: 100 }, (_, i) => i).filter(isBoxCorner)
    expect(corners).toHaveLength(16)
    expect(corners).toContain(0)
    expect(corners).toContain(33)
    expect(corners).not.toContain(1)
  })
})

describe('pushOutside', () => {
  const m = unitToQuad(square)!
  const inverse = invert(m)!

  it('keeps a point that is already outside the margin', () => {
    const p = { x: 50, y: 150 }
    expect(pushOutside(p, m, inverse, 0.08)).toBe(p)
  })

  it('moves a point inside the grid to the nearest side of the margin', () => {
    close(pushOutside({ x: 110, y: 150 }, m, inverse, 0.08), { x: 92, y: 150 })
    close(pushOutside({ x: 150, y: 195 }, m, inverse, 0.08), { x: 150, y: 208 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && pnpm exec jest src/scan/dots/geometry`
Expected: FAIL with "Cannot find module './geometry'".

- [ ] **Step 3: Write the implementation**

```ts
import type { Point, Quad } from '../../scanner'

/** Maps grid coordinates (u, v in 0..1) to view points: x = (m0·u + m1·v + m2) / (m6·u + m7·v + 1), y uses m3..m5. */
export type Homography = [number, number, number, number, number, number, number, number]

/** The lines of a sudoku grid in each direction, so 10 × 10 intersections. */
export const GRID_POINTS = 10

/** Null when the last three corners lie on one line. Heckbert's closed form for the unit square. Other degenerate quads give a matrix that `invert` refuses. */
export function unitToQuad(quad: Quad): Homography | null {
  'worklet'
  const p0 = quad[0]
  const p1 = quad[1]
  const p2 = quad[2]
  const p3 = quad[3]
  const dx1 = p1.x - p2.x
  const dx2 = p3.x - p2.x
  const dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y
  const dy2 = p3.y - p2.y
  const dy3 = p0.y - p1.y + p2.y - p3.y
  const den = dx1 * dy2 - dx2 * dy1
  if (Math.abs(den) < 1e-9) return null
  const g = (dx3 * dy2 - dx2 * dy3) / den
  const h = (dx1 * dy3 - dx3 * dy1) / den
  return [p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x, p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y, g, h]
}

export function project(m: Homography, u: number, v: number): Point {
  'worklet'
  const w = m[6] * u + m[7] * v + 1
  return { x: (m[0] * u + m[1] * v + m[2]) / w, y: (m[3] * u + m[4] * v + m[5]) / w }
}

/** Null when the matrix has no inverse. */
export function invert(m: Homography): Homography | null {
  'worklet'
  const a = m[0]
  const b = m[1]
  const c = m[2]
  const d = m[3]
  const e = m[4]
  const f = m[5]
  const g = m[6]
  const h = m[7]
  const det = a * (e - f * h) + b * (f * g - d) + c * (d * h - e * g)
  const last = a * e - b * d
  if (Math.abs(det) < 1e-12 || Math.abs(last) < 1e-12) return null
  return [
    (e - f * h) / last,
    (c * h - b) / last,
    (b * f - c * e) / last,
    (f * g - d) / last,
    (a - c * g) / last,
    (c * d - a * f) / last,
    (d * h - e * g) / last,
    (b * g - a * h) / last,
  ]
}

export function intersections(m: Homography): Point[] {
  'worklet'
  const points: Point[] = []
  for (let row = 0; row < GRID_POINTS; row++) {
    for (let column = 0; column < GRID_POINTS; column++) {
      points.push(project(m, column / (GRID_POINTS - 1), row / (GRID_POINTS - 1)))
    }
  }
  return points
}

/** index: row × 10 + column. True where two 3 × 3 box lines cross. */
export function isBoxCorner(index: number): boolean {
  'worklet'
  return (index % GRID_POINTS) % 3 === 0 && Math.floor(index / GRID_POINTS) % 3 === 0
}

/** margin: in grid coordinates. A point inside the grid plus its margin moves to the nearest side of the margin. */
export function pushOutside(p: Point, m: Homography, inverse: Homography, margin: number): Point {
  'worklet'
  const q = project(inverse, p.x, p.y)
  if (q.x < -margin || q.x > 1 + margin || q.y < -margin || q.y > 1 + margin) return p
  const left = q.x + margin
  const right = 1 + margin - q.x
  const top = q.y + margin
  const bottom = 1 + margin - q.y
  const least = Math.min(left, right, top, bottom)
  if (least === left) return project(m, -margin, q.y)
  if (least === right) return project(m, 1 + margin, q.y)
  if (least === top) return project(m, q.x, -margin)
  return project(m, q.x, 1 + margin)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile && pnpm exec jest src/scan/dots/geometry`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/scan/dots/geometry.ts apps/mobile/src/scan/dots/geometry.test.ts
git commit -m "feat(app): grid geometry for the dot field (#18)"
```

---

### Task 2: Dot layout, wander and twinkle

**Files:**
- Create: `apps/mobile/src/scan/dots/layout.ts`
- Test: `apps/mobile/src/scan/dots/layout.test.ts`

**Interfaces:**
- Consumes: `Point` from `'../../scanner'`, `ViewSize` from `'../previewMapping'` (`{ width: number; height: number }`).
- Produces:
  - `DOT_SPACING = 33.5`, `WANDER_MIN = 5`, `WANDER_MAX = 9`, `TWINKLE = 0.28`
  - `type Dot = { homeX: number; homeY: number; ax: number; ay: number; fx: number; fy: number; px: number; py: number; size: number; tw: number }`
  - `noise(i: number, k: number): number` (0..1, deterministic)
  - `createDots(view: ViewSize): Dot[]`
  - `wander(dot: Dot, t: number): Point` (offset in points, t in seconds)
  - `twinkle(dot: Dot, t: number): number` (opacity factor, 0.72..1.28)

- [ ] **Step 1: Write the failing test**

```ts
import { createDots, DOT_SPACING, twinkle, wander, WANDER_MAX } from './layout'

describe('createDots', () => {
  it('lays out 12 × 26 = 312 dots on the reference view', () => {
    expect(createDots({ width: 402, height: 874 })).toHaveLength(312)
  })

  it('keeps the same density on another size', () => {
    expect(createDots({ width: 804, height: 874 })).toHaveLength(24 * 26)
  })

  it('gives at least one dot on a tiny view', () => {
    expect(createDots({ width: 10, height: 10 })).toHaveLength(1)
  })

  it('keeps every dot in its own cell, moved by at most 30 %', () => {
    const dots = createDots({ width: 402, height: 874 })
    const cellWidth = 402 / 12
    dots.forEach((dot, i) => {
      const centre = ((i % 12) + 0.5) * cellWidth
      expect(Math.abs(dot.homeX - centre)).toBeLessThanOrEqual(0.3 * cellWidth + 1e-9)
    })
  })

  it('gives the same layout every time', () => {
    expect(createDots({ width: 402, height: 874 })).toEqual(createDots({ width: 402, height: 874 }))
  })

  it('keeps sizes, wander and twinkle in the ranges of the design', () => {
    for (const dot of createDots({ width: 402, height: 874 })) {
      expect(dot.size).toBeGreaterThanOrEqual(0.75)
      expect(dot.size).toBeLessThanOrEqual(1.25)
      expect(dot.ax).toBeGreaterThanOrEqual(5)
      expect(dot.ax).toBeLessThanOrEqual(9)
      expect(dot.fx).toBeGreaterThanOrEqual(0.5)
      expect(dot.fx).toBeLessThanOrEqual(1.1)
      expect(dot.tw).toBeGreaterThanOrEqual(1.2)
      expect(dot.tw).toBeLessThanOrEqual(3.4)
    }
  })

  it('uses a spacing of 33.5 pt', () => {
    expect(DOT_SPACING).toBe(33.5)
  })
})

describe('wander', () => {
  it('never moves a dot further than its amplitude on each axis', () => {
    const dot = createDots({ width: 402, height: 874 })[7]
    for (let t = 0; t < 60; t += 0.05) {
      const w = wander(dot, t)
      expect(Math.abs(w.x)).toBeLessThanOrEqual(dot.ax + 1e-9)
      expect(Math.abs(w.y)).toBeLessThanOrEqual(WANDER_MAX + 1e-9)
    }
  })

  it('keeps moving', () => {
    const dot = createDots({ width: 402, height: 874 })[7]
    expect(wander(dot, 1)).not.toEqual(wander(dot, 1.5))
  })
})

describe('twinkle', () => {
  it('changes the opacity by at most 28 %', () => {
    const dot = createDots({ width: 402, height: 874 })[3]
    for (let t = 0; t < 20; t += 0.1) {
      expect(twinkle(dot, t)).toBeGreaterThanOrEqual(0.72 - 1e-9)
      expect(twinkle(dot, t)).toBeLessThanOrEqual(1.28 + 1e-9)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && pnpm exec jest src/scan/dots/layout`
Expected: FAIL with "Cannot find module './layout'".

- [ ] **Step 3: Write the implementation**

```ts
import type { Point } from '../../scanner'
import type { ViewSize } from '../previewMapping'

/** Points between dot homes. The 402 × 874 pt reference view gets 12 × 26 = 312 dots. */
export const DOT_SPACING = 33.5
/** Share of a cell that a home may move from the cell centre. */
const JITTER = 0.3
/** Points. */
export const WANDER_MIN = 5
export const WANDER_MAX = 9
/** Share of the opacity that the twinkle adds or removes. */
export const TWINKLE = 0.28

/** homeX, homeY: points. ax, ay: wander amplitude in points. fx, fy, tw: rad/s. px, py: phases in radians. size: radius in points. */
export type Dot = {
  homeX: number
  homeY: number
  ax: number
  ay: number
  fx: number
  fy: number
  px: number
  py: number
  size: number
  tw: number
}

/** A repeatable value in 0..1 for dot i and property k, so every run draws the same field. */
export function noise(i: number, k: number): number {
  'worklet'
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function createDots(view: ViewSize): Dot[] {
  'worklet'
  const columns = Math.max(1, Math.round(view.width / DOT_SPACING))
  const rows = Math.max(1, Math.round(view.height / DOT_SPACING))
  const cellWidth = view.width / columns
  const cellHeight = view.height / rows
  const dots: Dot[] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const i = dots.length
      dots.push({
        homeX: (column + 0.5 + (noise(i, 1) - 0.5) * 2 * JITTER) * cellWidth,
        homeY: (row + 0.5 + (noise(i, 2) - 0.5) * 2 * JITTER) * cellHeight,
        ax: WANDER_MIN + (WANDER_MAX - WANDER_MIN) * noise(i, 3),
        ay: WANDER_MIN + (WANDER_MAX - WANDER_MIN) * noise(i, 4),
        fx: 0.5 + 0.6 * noise(i, 5),
        fy: 0.5 + 0.6 * noise(i, 6),
        px: noise(i, 7) * 2 * Math.PI,
        py: noise(i, 8) * 2 * Math.PI,
        size: 0.75 + 0.5 * noise(i, 9),
        tw: 1.2 + 2.2 * noise(i, 10),
      })
    }
  }
  return dots
}

/** Two sine waves per axis, weighted 2 : 1, so the offset never passes the amplitude. */
export function wander(dot: Dot, t: number): Point {
  'worklet'
  return {
    x: dot.ax * ((2 / 3) * Math.sin(dot.fx * t + dot.px) + (1 / 3) * Math.sin(2.3 * dot.fx * t + dot.py)),
    y: dot.ay * ((2 / 3) * Math.sin(dot.fy * t + dot.py) + (1 / 3) * Math.sin(1.9 * dot.fy * t + dot.px)),
  }
}

export function twinkle(dot: Dot, t: number): number {
  'worklet'
  return 1 + TWINKLE * Math.sin(dot.tw * t + dot.px * 3)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile && pnpm exec jest src/scan/dots/layout`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/scan/dots/layout.ts apps/mobile/src/scan/dots/layout.test.ts
git commit -m "feat(app): dot layout with wander and twinkle (#18)"
```

---

### Task 3: Greedy nearest assignment

**Files:**
- Create: `apps/mobile/src/scan/dots/assign.ts`
- Test: `apps/mobile/src/scan/dots/assign.test.ts`

**Interfaces:**
- Consumes: `Point` from `'../../scanner'`.
- Produces: `assignNearest(dots: Point[], targets: Point[]): number[]`. The result has one entry per target: the index of its dot, or -1. No dot appears twice.

- [ ] **Step 1: Write the failing test**

```ts
import { assignNearest } from './assign'

describe('assignNearest', () => {
  it('gives every target exactly one dot, and no dot twice', () => {
    const dots = Array.from({ length: 50 }, (_, i) => ({ x: (i % 10) * 10, y: Math.floor(i / 10) * 10 }))
    const targets = Array.from({ length: 20 }, (_, i) => ({ x: 3 + (i % 5) * 9, y: 4 + Math.floor(i / 5) * 9 }))
    const owner = assignNearest(dots, targets)
    expect(owner).toHaveLength(20)
    expect(owner.every((i) => i >= 0)).toBe(true)
    expect(new Set(owner).size).toBe(20)
  })

  it('serves the shortest pair first', () => {
    const dots = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
    const targets = [{ x: 10, y: 0 }, { x: 1, y: 0 }]
    expect(assignNearest(dots, targets)).toEqual([1, 0])
  })

  it('gives each target its nearest dot when the dots do not compete', () => {
    const dots = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }]
    const targets = [{ x: 98, y: 0 }, { x: 2, y: 0 }]
    expect(assignNearest(dots, targets)).toEqual([2, 0])
  })

  it('leaves intersections without a dot when there are too few dots', () => {
    const dots = [{ x: 0, y: 0 }]
    const targets = [{ x: 1, y: 0 }, { x: 5, y: 0 }, { x: 9, y: 0 }]
    expect(assignNearest(dots, targets)).toEqual([0, -1, -1])
  })

  it('still finds a dot when all near candidates are taken', () => {
    const dots = Array.from({ length: 12 }, (_, i) => ({ x: i, y: 0 })).concat([{ x: 500, y: 0 }])
    const targets = Array.from({ length: 13 }, () => ({ x: 0, y: 0 }))
    const owner = assignNearest(dots, targets)
    expect(new Set(owner).size).toBe(13)
    expect(owner).toContain(12)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && pnpm exec jest src/scan/dots/assign`
Expected: FAIL with "Cannot find module './assign'".

- [ ] **Step 3: Write the implementation**

```ts
import type { Point } from '../../scanner'

/** Candidate dots per target. Enough in practice; a full scan covers the rare target whose candidates are all taken. */
const CANDIDATES = 8

type Pair = { distance: number; dot: number; target: number }

function nearestFree(dots: Point[], taken: boolean[], target: Point): number {
  'worklet'
  let best = -1
  let bestDistance = Infinity
  for (let i = 0; i < dots.length; i++) {
    if (taken[i]) continue
    const d = (dots[i].x - target.x) ** 2 + (dots[i].y - target.y) ** 2
    if (d < bestDistance) {
      bestDistance = d
      best = i
    }
  }
  return best
}

/** Greedy: the shortest dot-to-target pair first. Returns the dot of each target, or -1 when no dot is left. */
export function assignNearest(dots: Point[], targets: Point[]): number[] {
  'worklet'
  const pairs: Pair[] = []
  for (let j = 0; j < targets.length; j++) {
    const best: Pair[] = []
    for (let i = 0; i < dots.length; i++) {
      const distance = (dots[i].x - targets[j].x) ** 2 + (dots[i].y - targets[j].y) ** 2
      if (best.length === CANDIDATES && distance >= best[CANDIDATES - 1].distance) continue
      let k = best.length < CANDIDATES ? best.length : CANDIDATES - 1
      best[k] = { distance, dot: i, target: j }
      while (k > 0 && best[k - 1].distance > best[k].distance) {
        const swap = best[k - 1]
        best[k - 1] = best[k]
        best[k] = swap
        k--
      }
    }
    for (let k = 0; k < best.length; k++) pairs.push(best[k])
  }
  pairs.sort((a, b) => a.distance - b.distance)
  const taken: boolean[] = []
  for (let i = 0; i < dots.length; i++) taken.push(false)
  const owner: number[] = []
  for (let j = 0; j < targets.length; j++) owner.push(-1)
  for (let k = 0; k < pairs.length; k++) {
    const pair = pairs[k]
    if (owner[pair.target] >= 0 || taken[pair.dot]) continue
    owner[pair.target] = pair.dot
    taken[pair.dot] = true
  }
  for (let j = 0; j < targets.length; j++) {
    if (owner[j] >= 0) continue
    const dot = nearestFree(dots, taken, targets[j])
    if (dot < 0) continue
    owner[j] = dot
    taken[dot] = true
  }
  return owner
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile && pnpm exec jest src/scan/dots/assign`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/scan/dots/assign.ts apps/mobile/src/scan/dots/assign.test.ts
git commit -m "feat(app): greedy nearest assignment of dots to intersections (#18)"
```

---

### Task 4: Push-apart step

**Files:**
- Create: `apps/mobile/src/scan/dots/spread.ts`
- Test: `apps/mobile/src/scan/dots/spread.test.ts`

**Interfaces:**
- Consumes: `Point` from `'../../scanner'`.
- Produces: `spreadStep(points: Point[], movable: boolean[], radius: number, push: number): Point[]`. Returns new points. A point that is not movable keeps its place but still pushes its neighbours.

- [ ] **Step 1: Write the failing test**

```ts
import { spreadStep } from './spread'

describe('spreadStep', () => {
  it('pushes two close points apart along the line between them', () => {
    const next = spreadStep([{ x: 0, y: 0 }, { x: 10, y: 0 }], [true, true], 20, 2)
    expect(next[0]).toEqual({ x: -1, y: 0 })
    expect(next[1]).toEqual({ x: 11, y: 0 })
  })

  it('leaves points that are further apart than the radius', () => {
    const points = [{ x: 0, y: 0 }, { x: 30, y: 0 }]
    expect(spreadStep(points, [true, true], 20, 2)).toEqual(points)
  })

  it('does not move a fixed point, but it still pushes', () => {
    const next = spreadStep([{ x: 0, y: 0 }, { x: 10, y: 0 }], [false, true], 20, 2)
    expect(next[0]).toEqual({ x: 0, y: 0 })
    expect(next[1]).toEqual({ x: 11, y: 0 })
  })

  it('does not change its input', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    spreadStep(points, [true, true], 20, 2)
    expect(points).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }])
  })

  it('ignores two points on the same spot', () => {
    const next = spreadStep([{ x: 5, y: 5 }, { x: 5, y: 5 }], [true, true], 20, 2)
    expect(next).toEqual([{ x: 5, y: 5 }, { x: 5, y: 5 }])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && pnpm exec jest src/scan/dots/spread`
Expected: FAIL with "Cannot find module './spread'".

- [ ] **Step 3: Write the implementation**

```ts
import type { Point } from '../../scanner'

/** radius, push: points. Two points closer than the radius push each other apart by up to `push` each. */
export function spreadStep(points: Point[], movable: boolean[], radius: number, push: number): Point[] {
  'worklet'
  const next: Point[] = []
  for (let i = 0; i < points.length; i++) next.push({ x: points[i].x, y: points[i].y })
  for (let a = 0; a < points.length; a++) {
    for (let b = a + 1; b < points.length; b++) {
      const dx = points[a].x - points[b].x
      const dy = points[a].y - points[b].y
      const distance = Math.hypot(dx, dy)
      if (distance >= radius || distance < 1e-6) continue
      const k = ((radius - distance) / radius) * push
      const ux = (dx / distance) * k
      const uy = (dy / distance) * k
      if (movable[a]) {
        next[a].x += ux
        next[a].y += uy
      }
      if (movable[b]) {
        next[b].x -= ux
        next[b].y -= uy
      }
    }
  }
  return next
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile && pnpm exec jest src/scan/dots/spread`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/scan/dots/spread.ts apps/mobile/src/scan/dots/spread.test.ts
git commit -m "feat(app): push-apart step for the free dots (#18)"
```

---

### Task 5: Field state machine

**Files:**
- Create: `apps/mobile/src/scan/dots/field.ts`
- Test: `apps/mobile/src/scan/dots/field.test.ts`

**Interfaces:**
- Consumes: everything that Tasks 1–4 produce; `ViewSize` from `'../previewMapping'`; `Quad` from `'../../scanner'`.
- Produces:
  - Constants: `DIM_SEARCH = 0.3`, `DIM_OUTSIDE = 0.45`, `DIM_FADE = 0.4`, `FREE_ALPHA = 0.32`, `GATHER_ALPHA_START = 0.4`, `GATHER_ALPHA_END = 0.8`, `FLIGHT = 0.7`, `MAX_DELAY = 0.35`, `GROW = 1.25`, `GROW_BOX = 1.7`, `WOBBLE = 0.15`, `MARGIN = 0.08`, `SPREAD_TIME = 1.0`, `RELEASE_TIME = 0.5`, `REDUCED_FADE = 0.2`, `STEADY_SPEED = 30`, `MOTION_TIME = 0.3`, `JUMP = 0.25`, `MAX_STEP = 0.1`
  - `type FieldDot = Dot & { origX: number; origY: number; target: number; delay: number; since: number; releasing: boolean; fromX: number; fromY: number; x: number; y: number; radius: number; alpha: number }`
  - `type FieldState = { width: number; height: number; dots: FieldDot[]; quad: Quad | null; lastQuad: Quad | null; foundAt: number; t: number; presence: number; motion: number }`
  - `createField(view: ViewSize): FieldState`
  - `stepField(state: FieldState, quad: Quad | null, t: number, reduceMotion: boolean): FieldState` (mutates and returns `state`; `t` in seconds; `quad` in view points)

- [ ] **Step 1: Write the failing test**

```ts
import type { Quad } from '../../scanner'
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

function gridAt(x: number, y: number, size = 300): Quad {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ]
}

/** Advances the field at 60 fps from t0 to t1 with the same quad. */
function run(state: FieldState, quad: Quad | null, t0: number, t1: number, reduce = false) {
  for (let t = t0; t <= t1 + 1e-9; t += 1 / 60) stepField(state, quad, t, reduce)
  return state
}

const gathered = (state: FieldState) => state.dots.filter((d) => d.target >= 0)

describe('stepField', () => {
  it('lets all dots float while there is no grid', () => {
    const state = run(createField(VIEW), null, 0, 2)
    expect(gathered(state)).toHaveLength(0)
    expect(state.dots.every((d) => d.alpha <= FREE_ALPHA * 1.28 + 1e-9)).toBe(true)
    expect(state.presence).toBe(0)
  })

  it('sends one dot to each of the 100 intersections when a grid appears', () => {
    const state = run(createField(VIEW), null, 0, 1)
    stepField(state, gridAt(50, 300), 1, false)
    const targets = gathered(state).map((d) => d.target)
    expect(targets).toHaveLength(100)
    expect(new Set(targets).size).toBe(100)
  })

  it('puts every gathered dot on its intersection after the flight', () => {
    const grid = gridAt(50, 300)
    const state = run(createField(VIEW), null, 0, 1)
    run(state, grid, 1, 1 + MAX_DELAY + FLIGHT + 1)
    const points = intersections(unitToQuad(grid)!)
    for (const d of gathered(state)) {
      expect(Math.hypot(d.x - points[d.target].x, d.y - points[d.target].y)).toBeLessThan(0.01)
      expect(d.alpha).toBeCloseTo(GATHER_ALPHA_END, 6)
    }
  })

  it('keeps 15 % of the wobble while the grid moves', () => {
    const state = run(createField(VIEW), null, 0, 1)
    for (let t = 1; t < 3; t += 1 / 60) stepField(state, gridAt(50 + 60 * (t - 1), 300), t, false)
    expect(state.motion).toBeGreaterThan(0.9)
    const points = intersections(unitToQuad(state.quad!)!)
    const offsets = gathered(state).map((d) => Math.hypot(d.x - points[d.target].x, d.y - points[d.target].y))
    expect(Math.max(...offsets)).toBeGreaterThan(0.1)
    expect(Math.max(...offsets)).toBeLessThanOrEqual(0.15 * 9 * Math.SQRT2 + 1e-6)
  })

  it('keeps every free dot out of the grid and its margin', () => {
    const grid = gridAt(50, 300)
    const state = run(createField(VIEW), null, 0, 1)
    run(state, grid, 1, 1 + SPREAD_TIME + 0.5)
    const inverse = invert(unitToQuad(grid)!)!
    for (const d of state.dots.filter((dot) => dot.target < 0)) {
      const q = project(inverse, d.x, d.y)
      const inside = q.x > -0.08 + 1e-6 && q.x < 1.08 - 1e-6 && q.y > -0.08 + 1e-6 && q.y < 1.08 - 1e-6
      expect(inside).toBe(false)
    }
  })

  it('dims the view outside the grid once a grid is found', () => {
    const state = run(createField(VIEW), null, 0, 1)
    run(state, gridAt(50, 300), 1, 2)
    expect(state.presence).toBe(1)
  })

  it('frees the gathered dots when the grid is lost', () => {
    const state = run(createField(VIEW), null, 0, 1)
    run(state, gridAt(50, 300), 1, 3)
    stepField(state, null, 3 + 1 / 60, false)
    expect(gathered(state)).toHaveLength(0)
    run(state, null, 3 + 2 / 60, 3 + RELEASE_TIME + 0.1)
    expect(state.dots.every((d) => !d.releasing)).toBe(true)
  })

  it('reassigns when the grid jumps', () => {
    const state = run(createField(VIEW), null, 0, 1)
    run(state, gridAt(50, 100, 200), 1, 3)
    stepField(state, gridAt(50, 550, 200), 3 + 1 / 60, false)
    expect(state.foundAt).toBeCloseTo(3 + 1 / 60, 9)
    expect(gathered(state)).toHaveLength(100)
  })

  it('treats a quad with three corners on one line as no grid', () => {
    const flat: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 0, y: 100 },
    ]
    const state = run(createField(VIEW), flat, 0, 1)
    expect(gathered(state)).toHaveLength(0)
    expect(state.dots.every((d) => Number.isFinite(d.x) && Number.isFinite(d.y))).toBe(true)
  })

  it('clamps a long pause', () => {
    const state = run(createField(VIEW), null, 0, 1)
    stepField(state, gridAt(50, 300), 1, false)
    stepField(state, gridAt(50, 300), 30, false)
    expect(state.presence).toBeLessThan(1)
    expect(state.dots.every((d) => Number.isFinite(d.x))).toBe(true)
  })

  it('places the gathered dots without a flight under Reduce Motion', () => {
    const grid = gridAt(50, 300)
    const state = run(createField(VIEW), null, 0, 1, true)
    stepField(state, grid, 1, true)
    const points = intersections(unitToQuad(grid)!)
    for (const d of gathered(state)) {
      expect(Math.hypot(d.x - points[d.target].x, d.y - points[d.target].y)).toBeLessThan(0.01)
      expect(d.alpha).toBe(0)
    }
    run(state, grid, 1 + 1 / 60, 1.3, true)
    expect(gathered(state).every((d) => d.alpha === GATHER_ALPHA_END)).toBe(true)
  })

  it('does not move the free dots under Reduce Motion', () => {
    const state = createField(VIEW)
    stepField(state, null, 0, true)
    const before = state.dots.map((d) => ({ x: d.x, y: d.y }))
    stepField(state, null, 5, true)
    expect(state.dots.map((d) => ({ x: d.x, y: d.y }))).toEqual(before)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && pnpm exec jest src/scan/dots/field`
Expected: FAIL with "Cannot find module './field'".

- [ ] **Step 3: Write the implementation**

```ts
import type { Point, Quad } from '../../scanner'
import type { ViewSize } from '../previewMapping'
import { assignNearest } from './assign'
import { type Homography, intersections, invert, isBoxCorner, project, pushOutside, unitToQuad } from './geometry'
import { createDots, type Dot, DOT_SPACING, twinkle, wander } from './layout'
import { spreadStep } from './spread'

// Stage 1 of the scan experience design. Opacities are 0..1, times are seconds, sizes are points.
export const DIM_SEARCH = 0.3
export const DIM_OUTSIDE = 0.45
export const DIM_FADE = 0.4
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
/** pt/s. Corners slower than this count as steady. Provisional until the lock-on rule sets the threshold (scan-pipeline concept). */
export const STEADY_SPEED = 30
export const MOTION_TIME = 0.3
/** A corner step in one frame larger than this share of the grid diagonal means another grid. */
export const JUMP = 0.25
/** The longest step the field takes, so a pause does not make the dots jump. */
export const MAX_STEP = 0.1
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

/** presence: 0..1, how far the dim has moved to "grid found". motion: 0..1, the corner speed relative to STEADY_SPEED. */
export type FieldState = {
  width: number
  height: number
  dots: FieldDot[]
  quad: Quad | null
  lastQuad: Quad | null
  foundAt: number
  t: number
  presence: number
  motion: number
}

function smooth(x: number): number {
  'worklet'
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
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

function diagonal(quad: Quad): number {
  'worklet'
  return Math.hypot(quad[2].x - quad[0].x, quad[2].y - quad[0].y)
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
  return { width: view.width, height: view.height, dots, quad: null, lastQuad: null, foundAt: -1, t: -1, presence: 0, motion: 1 }
}

function gather(state: FieldState, m: Homography, t: number) {
  'worklet'
  const targets = intersections(m)
  const positions: Point[] = []
  for (let i = 0; i < state.dots.length; i++) positions.push({ x: state.dots[i].x, y: state.dots[i].y })
  const owner = assignNearest(positions, targets)
  for (let i = 0; i < state.dots.length; i++) {
    const d = state.dots[i]
    d.target = -1
    d.releasing = false
    d.homeX = d.origX
    d.homeY = d.origY
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
    d.since = t
    d.delay = longest > 0 ? (Math.hypot(p.x - targets[j].x, p.y - targets[j].y) / longest) * MAX_DELAY : 0
  }
  state.foundAt = t
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
}

function spreadHomes(state: FieldState, quad: Quad, m: Homography, inverse: Homography) {
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
      x: Math.min(state.width, Math.max(0, next[k].x)),
      y: Math.min(state.height, Math.max(0, next[k].y)),
    }
    const home = pushOutside(inView, m, inverse, MARGIN)
    state.dots[free[k]].homeX = home.x
    state.dots[free[k]].homeY = home.y
  }
}

function placeGathered(state: FieldState, d: FieldDot, t: number, m: Homography, reduceMotion: boolean) {
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
  const u = smooth((t - d.since - d.delay) / FLIGHT)
  const fx = d.homeX + w.x
  const fy = d.homeY + w.y
  const ex = at.x + w.x * WOBBLE * state.motion
  const ey = at.y + w.y * WOBBLE * state.motion
  const arc = Math.sin(u * Math.PI) * ARC * (d.px / (2 * Math.PI) - 0.5)
  d.x = fx + (ex - fx) * u - (ey - fy) * arc
  d.y = fy + (ey - fy) * u + (ex - fx) * arc
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
    const share = reduceMotion ? 1 : smooth((t - state.foundAt) / SPREAD_TIME)
    x += (out.x - x) * share
    y += (out.y - y) * share
  }
  if (d.releasing) {
    const u = reduceMotion ? 1 : smooth((t - d.since) / RELEASE_TIME)
    x = d.fromX + (x - d.fromX) * u
    y = d.fromY + (y - d.fromY) * u
    if (u >= 1) d.releasing = false
  }
  d.x = x
  d.y = y
  d.radius = d.size
  d.alpha = FREE_ALPHA * (reduceMotion ? 1 : twinkle(d, t))
}

/** Advances the field to time t. quad: the smoothed grid in view points, or null. Mutates and returns state. */
export function stepField(state: FieldState, quad: Quad | null, t: number, reduceMotion: boolean): FieldState {
  'worklet'
  const dt = state.t < 0 ? 0 : Math.min(MAX_STEP, Math.max(0, t - state.t))
  state.t = t
  const m = quad == null ? null : unitToQuad(quad)
  const inverse = m == null ? null : invert(m)
  const grid = m != null && inverse != null ? quad : null
  const previous = state.quad
  const step = grid != null && previous != null ? largestCornerStep(grid, previous) : 0
  const jumped = grid != null && previous != null && step > JUMP * diagonal(previous)
  if (grid != null && m != null && (previous == null || jumped)) gather(state, m, t)
  else if (grid == null && previous != null) release(state, t)
  const speed = grid != null && previous != null && !jumped && dt > 0 ? step / dt : STEADY_SPEED
  state.motion = toward(state.motion, Math.min(1, speed / STEADY_SPEED), dt / MOTION_TIME)
  state.presence = toward(state.presence, grid != null ? 1 : 0, dt / DIM_FADE)
  state.quad = grid
  if (grid != null) state.lastQuad = grid
  const usable = grid != null && m != null && inverse != null
  if (usable && !reduceMotion && t - state.foundAt < SPREAD_TIME) spreadHomes(state, grid, m, inverse)
  for (let i = 0; i < state.dots.length; i++) {
    const d = state.dots[i]
    if (d.target >= 0 && usable) placeGathered(state, d, t, m, reduceMotion)
    else placeFree(state, d, t, usable ? m : null, usable ? inverse : null, reduceMotion)
  }
  return state
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile && pnpm exec jest src/scan/dots/field`
Expected: PASS, 12 tests.

If "keeps 15 % of the wobble" fails on the upper bound, check the test bound, not the code: the wobble offset is at most `WOBBLE × √(ax² + ay²) ≤ 0.15 × 9 × √2`.

- [ ] **Step 5: Run the type check and the linter**

Run: `just typecheck && just lint`
Expected: both pass. TypeScript narrows `m` and `inverse` through `usable` only if you keep the `usable &&` checks. If it does not narrow, repeat `m != null && inverse != null` in the condition. Do not use `!`.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/scan/dots/field.ts apps/mobile/src/scan/dots/field.test.ts
git commit -m "feat(app): dot field state machine (#18)"
```

---

### Task 6: Drawing and the DotField component

**Files:**
- Create: `apps/mobile/src/scan/dots/draw.ts`
- Create: `apps/mobile/src/scan/dots/DotField.tsx`
- Modify: `apps/mobile/jest.setup.ts` (the Reanimated and Skia mocks)
- Test: `apps/mobile/src/scan/dots/draw.test.ts`, `apps/mobile/src/scan/dots/DotField.test.tsx`

**Interfaces:**
- Consumes: `FieldState`, `createField`, `stepField`, `DIM_SEARCH`, `DIM_OUTSIDE` from `./field`; `countFrame`, `EMPTY_WINDOW` from `../frameRate` (`countFrame(window, timestamp, ms) → { window, report: { fps, detectionMs } | null }`); `ViewSize` from `../previewMapping`.
- Produces:
  - `HALO: ReadonlyArray<readonly [number, number]>` (radius multiple, opacity share)
  - `drawField(canvas: SkCanvas, state: FieldState): void`
  - `DotField({ outline, view }: { outline: SharedValue<Quad | null>; view: SharedValue<ViewSize> }): JSX.Element`

- [ ] **Step 1: Extend the Jest mocks**

In `apps/mobile/jest.setup.ts`, replace the Reanimated mock and the Skia mock with these. Keep the comment above the Skia mock.

```ts
jest.mock('react-native-reanimated', () => {
  const { useRef } = jest.requireActual('react')
  return {
    ...jest.requireActual('react-native-reanimated/mock'),
    // The library mock makes a new holder on every render and has no modify().
    useSharedValue: <T,>(initial: T) => {
      const holder = useRef<{ value: T } | null>(null)
      if (holder.current == null) {
        const mockShared = {
          value: initial,
          get: () => mockShared.value,
          set: (next: T | ((mockPrevious: T) => T)) => {
            mockShared.value = typeof next === 'function' ? (next as (mockPrevious: T) => T)(mockShared.value) : next
          },
          modify: (modifier?: (mockPrevious: T) => T) => {
            if (modifier) mockShared.value = modifier(mockShared.value)
          },
        }
        holder.current = mockShared
      }
      return holder.current
    },
    useAnimatedReaction: jest.fn(),
    useFrameCallback: jest.fn(() => ({ setActive: jest.fn(), isActive: true, callbackId: 1 })),
    useReducedMotion: jest.fn(() => false),
  }
})

// Skia's own Jest setup needs CanvasKit. Views are enough for these tests.
jest.mock('@shopify/react-native-skia', () => {
  const { View } = jest.requireActual('react-native')
  const { createElement } = jest.requireActual('react')
  const path = () => {
    const calls: unknown[][] = []
    const self = {
      calls,
      moveTo: (...args: unknown[]) => (calls.push(['moveTo', ...args]), self),
      lineTo: (...args: unknown[]) => (calls.push(['lineTo', ...args]), self),
      close: () => (calls.push(['close']), self),
      setFillType: (fill: unknown) => (calls.push(['setFillType', fill]), self),
    }
    return self
  }
  return {
    Canvas: ({ children, ...props }: { children?: unknown }) =>
      createElement(View, { testID: 'skia-canvas', ...props }, children),
    Points: (props: object) => createElement(View, { testID: 'skia-points', ...props }),
    Picture: (props: object) => createElement(View, { testID: 'skia-picture', ...props }),
    createPicture: jest.fn(() => ({})),
    FillType: { Winding: 0, EvenOdd: 1 },
    Skia: {
      Color: (color: string) => color,
      Paint: () => ({ setAntiAlias: jest.fn(), setColor: jest.fn(), setAlphaf: jest.fn() }),
      Path: { Make: path },
    },
  }
})
```

- [ ] **Step 2: Write the failing drawing test**

`apps/mobile/src/scan/dots/draw.test.ts`:

```ts
import type { Quad } from '../../scanner'
import { drawField, HALO } from './draw'
import { createField, DIM_OUTSIDE, DIM_SEARCH, stepField } from './field'

function fakeCanvas() {
  return { drawCircle: jest.fn(), drawPath: jest.fn() }
}

const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

describe('drawField', () => {
  it('draws every dot as a core with two halos', () => {
    const state = createField({ width: 402, height: 874 })
    const canvas = fakeCanvas()
    drawField(canvas as never, state)
    expect(canvas.drawCircle).toHaveBeenCalledTimes(312 * HALO.length)
  })

  it('makes the outer halo 9 × the dot diameter', () => {
    expect(Math.max(...HALO.map(([scale]) => scale))).toBe(4.5)
  })

  it('dims the whole view while searching', () => {
    const state = createField({ width: 402, height: 874 })
    const canvas = fakeCanvas()
    drawField(canvas as never, state)
    expect(canvas.drawPath).toHaveBeenCalledTimes(1)
    const paint = canvas.drawPath.mock.calls[0][1]
    expect(paint.setAlphaf).toHaveBeenCalledWith(DIM_SEARCH)
  })

  it('dims only outside the grid once the grid is found', () => {
    const state = createField({ width: 402, height: 874 })
    for (let t = 0; t <= 1; t += 1 / 60) stepField(state, grid, t, false)
    const canvas = fakeCanvas()
    drawField(canvas as never, state)
    expect(canvas.drawPath).toHaveBeenCalledTimes(1)
    const [path, paint] = canvas.drawPath.mock.calls[0]
    expect(path.calls).toContainEqual(['setFillType', 1])
    expect(paint.setAlphaf).toHaveBeenCalledWith(DIM_OUTSIDE)
  })
})
```

The mock paint is shared between draws, so the dim test reads `setAlphaf` calls on the paint passed to `drawPath`. That works because `drawField` sets the dim opacity on that paint before the dots change it. If you create separate paints, each assertion still holds.

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd apps/mobile && pnpm exec jest src/scan/dots/draw`
Expected: FAIL with "Cannot find module './draw'".

- [ ] **Step 4: Write `draw.ts`**

```ts
import { FillType, type SkCanvas, Skia } from '@shopify/react-native-skia'
import type { Quad } from '../../scanner'
import { DIM_OUTSIDE, DIM_SEARCH, type FieldState } from './field'

/** [radius multiple, share of the dot opacity], outer halo first. The outer halo makes the star 9 × its diameter. */
export const HALO: ReadonlyArray<readonly [number, number]> = [
  [4.5, 0.06],
  [2, 0.3],
  [1, 1],
]

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

/** Draws the dim and the dots of one frame. Runs on the UI thread inside createPicture. */
export function drawField(canvas: SkCanvas, state: FieldState): void {
  'worklet'
  const dim = Skia.Paint()
  dim.setAntiAlias(true)
  dim.setColor(Skia.Color('#000000'))
  if (state.presence > 0 && state.lastQuad != null) {
    const search = DIM_SEARCH * (1 - state.presence)
    if (search > 0) {
      const full = Skia.Paint()
      full.setColor(Skia.Color('#000000'))
      full.setAlphaf(search)
      canvas.drawPath(viewPath(state.width, state.height), full)
    }
    dim.setAlphaf(DIM_OUTSIDE * state.presence)
    canvas.drawPath(withHole(state.width, state.height, state.lastQuad), dim)
  } else {
    dim.setAlphaf(DIM_SEARCH)
    canvas.drawPath(viewPath(state.width, state.height), dim)
  }
  const dot = Skia.Paint()
  dot.setAntiAlias(true)
  dot.setColor(Skia.Color('#FFFFFF'))
  for (let i = 0; i < state.dots.length; i++) {
    const d = state.dots[i]
    for (let k = 0; k < HALO.length; k++) {
      dot.setAlphaf(Math.min(1, d.alpha * HALO[k][1]))
      canvas.drawCircle(d.x, d.y, d.radius * HALO[k][0], dot)
    }
  }
}
```

Before you continue, read `node_modules/@shopify/react-native-skia/lib/typescript/src/skia/types/Path/Path.d.ts`. Check that `moveTo`, `lineTo`, `close` and `setFillType` return `SkPath`, so the chains above type-check. Also check that `Skia.Path.Make()` exists in `.../skia/types/Path/PathFactory.d.ts`.

- [ ] **Step 5: Run the drawing test to verify it passes**

Run: `cd apps/mobile && pnpm exec jest src/scan/dots/draw`
Expected: PASS, 4 tests. In "dims only outside the grid", the partly faded search dim is drawn too while `presence < 1`. The test runs a full second (`presence = 1`), so `drawPath` runs once.

- [ ] **Step 6: Write the failing component test**

`apps/mobile/src/scan/dots/DotField.test.tsx`:

```tsx
import { createPicture } from '@shopify/react-native-skia'
import { render, screen } from '@testing-library/react-native'
import { type SharedValue, useFrameCallback } from 'react-native-reanimated'
import type { Quad } from '../../scanner'
import type { ViewSize } from '../previewMapping'
import { DotField } from './DotField'

const frameCallback = jest.mocked(useFrameCallback)
const picture = jest.mocked(createPicture)

function shared<T>(value: T) {
  return { value, get: () => value, set: jest.fn() } as unknown as SharedValue<T>
}

/** Runs the last registered frame callback at time t (seconds). */
function tick(t: number) {
  const callback = frameCallback.mock.calls.at(-1)![0]
  callback({ timestamp: t * 1000, timeSincePreviousFrame: 16, timeSinceFirstFrame: t * 1000 })
}

/** Draws the last picture into a fake canvas and counts its circles. */
function circlesDrawn() {
  const draw = picture.mock.calls.at(-1)![0]
  const canvas = { drawCircle: jest.fn(), drawPath: jest.fn() }
  draw(canvas as never)
  return canvas.drawCircle.mock.calls.length
}

beforeEach(() => jest.clearAllMocks())

describe('DotField', () => {
  it('draws on a canvas that ignores touches', () => {
    render(<DotField outline={shared<Quad | null>(null)} view={shared<ViewSize>({ width: 402, height: 874 })} />)
    expect(screen.getByTestId('skia-canvas').props.pointerEvents).toBe('none')
    expect(screen.getByTestId('skia-picture')).toBeTruthy()
  })

  it('waits for the view size', () => {
    const { rerender } = render(
      <DotField outline={shared<Quad | null>(null)} view={shared<ViewSize>({ width: 0, height: 0 })} />,
    )
    tick(1)
    rerender(<DotField outline={shared<Quad | null>(null)} view={shared<ViewSize>({ width: 0, height: 0 })} />)
    expect(circlesDrawn()).toBe(0)
  })

  it('draws the field after the first frame', () => {
    const outline = shared<Quad | null>(null)
    const view = shared<ViewSize>({ width: 402, height: 874 })
    const { rerender } = render(<DotField outline={outline} view={view} />)
    tick(1)
    rerender(<DotField outline={outline} view={view} />)
    expect(circlesDrawn()).toBe(312 * 3)
  })

  it('rebuilds the field when the view size changes', () => {
    const outline = shared<Quad | null>(null)
    const view = { value: { width: 402, height: 874 } } as SharedValue<ViewSize>
    const { rerender } = render(<DotField outline={outline} view={view} />)
    tick(1)
    Object.assign(view, { value: { width: 804, height: 874 } })
    tick(1.1)
    rerender(<DotField outline={outline} view={view} />)
    expect(circlesDrawn()).toBe(24 * 26 * 3)
  })
})
```

The `useSharedValue` mock from Step 1 keeps its value across renders. The library's `useDerivedValue` mock runs the processor on each render, so the test re-renders after `tick` to get a new picture.

- [ ] **Step 7: Run the component test to verify it fails**

Run: `cd apps/mobile && pnpm exec jest src/scan/dots/DotField`
Expected: FAIL with "Cannot find module './DotField'".

- [ ] **Step 8: Write `DotField.tsx`**

```tsx
import { Canvas, createPicture, Picture } from '@shopify/react-native-skia'
import { StyleSheet } from 'react-native'
import {
  type SharedValue,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import type { Quad } from '../../scanner'
import { countFrame, EMPTY_WINDOW } from '../frameRate'
import type { ViewSize } from '../previewMapping'
import { drawField } from './draw'
import { createField, type FieldState, stepField } from './field'

function logStep(fps: number, stepMs: number) {
  if (__DEV__) console.log(`[dots] ${fps.toFixed(1)} fps, step ${stepMs.toFixed(2)} ms`)
}

/** outline: the smoothed grid in view points, or null. view: the size of the camera view in points. */
export function DotField({ outline, view }: { outline: SharedValue<Quad | null>; view: SharedValue<ViewSize> }) {
  const reduceMotion = useReducedMotion()
  const field = useSharedValue<FieldState | null>(null)
  const timing = useSharedValue(EMPTY_WINDOW)

  useFrameCallback((frame) => {
    'worklet'
    const size = view.value
    if (size.width <= 0 || size.height <= 0) return
    const t = frame.timestamp / 1000
    const started = Date.now()
    field.modify((state) => {
      'worklet'
      const current =
        state == null || state.width !== size.width || state.height !== size.height ? createField(size) : state
      return stepField(current, outline.value, t, reduceMotion)
    }, true)
    if (__DEV__) {
      const result = countFrame(timing.value, t, Date.now() - started)
      timing.set(result.window)
      if (result.report !== null) scheduleOnRN(logStep, result.report.fps, result.report.detectionMs)
    }
  })

  const picture = useDerivedValue(() =>
    createPicture((canvas) => {
      'worklet'
      const state = field.value
      if (state != null) drawField(canvas, state)
    }),
  )

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  )
}
```

`Date.now()` has a resolution of 1 ms. The log reports the mean over one second, so the rounding averages out. That is precise enough for the 4 ms budget.

- [ ] **Step 9: Run the component test, the type check and the linter**

Run: `cd apps/mobile && pnpm exec jest && cd ../.. && just typecheck && just lint`
Expected: every Jest test passes, also the existing `CameraScreen` tests with the new `useSharedValue` mock. Typecheck and lint pass.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/jest.setup.ts apps/mobile/src/scan/dots/draw.ts apps/mobile/src/scan/dots/draw.test.ts apps/mobile/src/scan/dots/DotField.tsx apps/mobile/src/scan/dots/DotField.test.tsx
git commit -m "feat(app): draw the dot field in Skia on the UI thread (#18)"
```

---

### Task 7: Use the dot field on the camera screen

**Files:**
- Modify: `apps/mobile/src/scan/CameraScreen.tsx` (the `GridOutline` import and element)
- Modify: `apps/mobile/src/scan/CameraScreen.test.tsx` (the `GridOutline` mock and the two outline tests)
- Delete: `apps/mobile/src/scan/GridOutline.tsx`, `apps/mobile/src/scan/GridOutline.test.tsx`
- Modify: `apps/mobile/jest.setup.ts` (remove the `Points` mock if nothing uses it any more)

**Interfaces:**
- Consumes: `DotField` from `./dots/DotField`.
- Produces: nothing new. `CameraScreen` keeps its `outline` shared value (view points) and its `viewSize` shared value.

- [ ] **Step 1: Change the test first**

In `CameraScreen.test.tsx`:

1. Replace `import { GridOutline } from './GridOutline'` with `import { DotField } from './dots/DotField'`.
2. Replace `jest.mock('./GridOutline', () => ({ GridOutline: jest.fn(() => null) }))` with `jest.mock('./dots/DotField', () => ({ DotField: jest.fn(() => null) }))`.
3. Replace `const outline = jest.mocked(GridOutline)` with `const dotField = jest.mocked(DotField)`.
4. In "turns a detection into an outline in view points" and "removes the outline when the grid is gone for longer than the hold time", replace `outline.mock.calls` with `dotField.mock.calls`.
5. Add this test to the `describe('CameraScreen')` block:

```tsx
  it('gives the dot field the camera view size', () => {
    givenPermission('authorized')
    render(<CameraScreen />)
    fireEvent(screen.getByTestId('camera-screen'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 874 } },
    })
    expect(dotField.mock.calls.at(-1)![0].view.value).toEqual({ width: 402, height: 874 })
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && pnpm exec jest src/scan/CameraScreen`
Expected: FAIL. `DotField` is never rendered, so `dotField.mock.calls.at(-1)` is undefined.

- [ ] **Step 3: Change `CameraScreen.tsx`**

1. Replace `import { GridOutline } from './GridOutline'` with `import { DotField } from './dots/DotField'`.
2. Replace `<GridOutline outline={outline} />` with `<DotField outline={outline} view={viewSize} />`.
3. Delete `src/scan/GridOutline.tsx` and `src/scan/GridOutline.test.tsx`.
4. If no other file uses the Skia `Points` mock, remove the `Points:` line from `jest.setup.ts`. Search first: `rg "Points" apps/mobile/src`.

- [ ] **Step 4: Run all checks**

Run: `just test-ts && just typecheck && just lint && just boundaries && just bundle`
Expected: all pass. `just boundaries` confirms that `src/scan/dots/` reaches the scanner only through `src/scanner/index.ts`.

- [ ] **Step 5: Commit**

```bash
git add -A apps/mobile/src/scan apps/mobile/jest.setup.ts
git commit -m "feat(app): show the dot field instead of the green outline (#18)"
```

---

### Task 8: Documentation

**Files:**
- Modify: `docs/architecture/00-concepts/scan-pipeline.md` (block diagram, Stages table)
- Modify: `docs/architecture/12-glossary.md`

- [ ] **Step 1: Update the scan-pipeline concept**

1. In the block diagram, change the node `o["Outline in Skia"]` to `o["Dot field in Skia"]`.
2. In the Stages table, add this row after "Corner smoothing":

```markdown
| Dot field | Scan UI, UI thread | ≤ 4 ms per frame | Floating dots that gather on the 100 intersections projected from the smoothed corners. See the [scan experience design](../../superpowers/specs/2026-10-11-scan-experience-design.md) |
```

- [ ] **Step 2: Add the glossary terms**

Add these rows to the table in `docs/architecture/12-glossary.md`:

```markdown
| Dot field | The live overlay on the camera screen: faint dots that float, and gather on the grid intersections when a grid is found |
| Free dot | A dot of the dot field that floats. It stays out of the grid and its margin |
| Gathered dot | A dot of the dot field that sits on one grid intersection and follows it |
```

- [ ] **Step 3: Check the links**

Run: `just docs-check`
Expected: "0 broken link(s)".

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/00-concepts/scan-pipeline.md docs/architecture/12-glossary.md
git commit -m "docs: add the dot field to the scan pipeline and the glossary (#18)"
```

---

### Task 9: Device check and issue update

This task needs the iPhone. The developer connects it and runs the app.

**Files:** none, unless a value changes (then the spec and `field.ts` in one commit).

- [ ] **Step 1: Build and start**

Run from `apps/mobile`: `pnpm exec expo run:ios --device` and then `just app` for Metro. After the build, run `git checkout -- apps/mobile/package.json apps/mobile/app.json` if Expo changed them.

- [ ] **Step 2: Check the timing**

Open the camera screen. Point it at a sudoku for 60 s. Read the Metro log.
Expected: `[dots] 60.0 fps, step ≤ 4.00 ms` on every line, and `[camera] 30.0 fps` stays.

- [ ] **Step 3: Check the behaviour against the prototype**

With the developer, check each item against the Scan flow studies prototype, section 1d:

1. While searching, the dots float and twinkle under a light dim.
2. When a grid appears, 100 dots fly to the intersections. The closer ones arrive first.
3. The free dots leave the grid area and fill the gaps.
4. When the phone holds still, the gathered dots stop their wobble.
5. When the grid leaves the view, the dots go free within about 0.75 s (0.25 s hold + 0.5 s).
6. A second, smaller grid on the page gets no dots.
7. With Settings → Accessibility → Motion → Reduce Motion on, the dots do not move, and the gathered dots fade in.

If a value from the spec looks wrong on the device (for example the dot size), change it in `field.ts` or `layout.ts` and in the spec in the same commit. Use `fix(app): ...` with `(#18)`.

- [ ] **Step 4: Write the results in the issue**

Post a comment on issue #18 with the iPhone model, the measured `[dots]` step time and frame rate, and the result of each check in Step 3. Tick the acceptance criteria that are met.
