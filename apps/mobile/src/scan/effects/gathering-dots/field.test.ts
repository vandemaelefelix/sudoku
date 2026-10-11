import type { Quad } from '../../../scanner'
import { type Channels, TRANSITION_END, transitionAt } from '../../transition/timeline'
import { intersections, invert, project, pushOutside, unitToQuad } from '../common/geometry'
import { spreadStep } from '../common/spread'
import { createScene, type Scene, stepScene } from '../scene'
import {
  createField,
  FLIGHT,
  FREE_ALPHA,
  GATHER_ALPHA_END,
  LOCK_BRIGHTEN,
  MARGIN,
  MAX_DELAY,
  NEAR,
  RELEASE_TIME,
  selectSpreadDots,
  SPREAD_PUSH,
  SPREAD_RADIUS,
  SPREAD_TIME,
  spreadHomes,
  stepField,
  type FieldState,
} from './field'

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

/** Gathers a grid, then pans it for 3 s with a new quad object every 2nd frame. Returns the largest free-dot move and the margin check. */
function pan() {
  const w = run(world(), null, 0, 1)
  // The grid creeps at 35 pt/s while the dots gather. A still grid would lock the scene, and a locked scene ignores the pan.
  for (let t = 1; t <= 2.5 + 1e-9; t += 1 / 60) frame(w, gridAt(50 + 35 * (t - 1), 300), t)
  let quad: Quad | null = null
  let before = positions(w)
  let most = 0
  let inMargin = 0
  let i = 0
  for (let t = 2.5; t < 5.5; t += 1 / 60, i++) {
    const x = 50 + 35 * 1.5 + 60 * (t - 2.5)
    if (i % 2 === 0) quad = gridAt(x, 300)
    frame(w, quad, t)
    const after = positions(w)
    for (let k = 0; k < after.length; k++) {
      if (w.field.dots[k].target >= 0) continue
      most = Math.max(most, Math.hypot(after[k].x - before[k].x, after[k].y - before[k].y))
    }
    before = after
    const inverse = invert(unitToQuad(quad!)!)!
    for (const d of w.field.dots.filter((dot) => dot.target < 0)) {
      const q = project(inverse, d.x, d.y)
      if (q.x > -0.08 + 1e-6 && q.x < 1.08 - 1e-6 && q.y > -0.08 + 1e-6 && q.y < 1.08 - 1e-6) inMargin++
    }
  }
  return { most, inMargin }
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
      expect(d.alpha).toBeCloseTo(GATHER_ALPHA_END * (1 + LOCK_BRIGHTEN), 6)
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
    run(w, gridAt(50, 300), 1, 1.5)
    frame(w, null, 1.5 + 1 / 60)
    expect(gathered(w)).toHaveLength(0)
    expect(w.field.holding).toBe(false)
    run(w, null, 1.5 + 2 / 60, 1.5 + RELEASE_TIME + 0.1)
    expect(w.field.dots.every((d) => !d.releasing)).toBe(true)
  })

  it('reassigns when the grid jumps', () => {
    const w = run(world(), null, 0, 1)
    run(w, gridAt(50, 100, 200), 1, 1.5)
    frame(w, gridAt(50, 550, 200), 1.5 + 1 / 60)
    expect(w.field.gatheredAt).toBeCloseTo(1.5 + 1 / 60, 9)
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
    const bright = GATHER_ALPHA_END * (1 + LOCK_BRIGHTEN * w.scene.lockProgress)
    expect(gathered(w).every((d) => d.alpha === bright)).toBe(true)
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

  describe('while the grid pans at 60 pt/s', () => {
    it('does not jump a free dot', () => {
      expect(pan().most).toBeLessThan(6)
    })

    it('keeps free dots out of the margin', () => {
      expect(pan().inMargin).toBe(0)
    })
  })

  describe('spreading the homes', () => {
    const grid = gridAt(50, 300)
    const m = unitToQuad(grid)!
    const centre = project(m, 0.5, 0.5)
    const reach = Math.hypot(grid[2].x - grid[0].x, grid[2].y - grid[0].y) * NEAR

    it('spreads only the free dots near the grid', () => {
      const state = createField(VIEW)
      // A grid of 300 pt reaches the whole view, so the test uses a small grid in a corner.
      const small = gridAt(20, 40, 100)
      const at = project(unitToQuad(small)!, 0.5, 0.5)
      const chosen = selectSpreadDots(state, at, Math.hypot(100, 100) * NEAR)
      expect(chosen.length).toBeGreaterThan(0)
      expect(chosen.length).toBeLessThan(state.dots.length / 3)
    })

    it('keeps the same spread result as a full pass', () => {
      const state = createField(VIEW)
      // Gathered dots do not spread, so the test needs some.
      for (let i = 0; i < 100; i++) state.dots[i * 2].target = i
      const free = state.dots.map((_, i) => i).filter((i) => state.dots[i].target < 0)
      const homes = free.map((i) => ({ x: state.dots[i].homeX, y: state.dots[i].homeY }))
      const movable = homes.map((h) => Math.hypot(h.x - centre.x, h.y - centre.y) < reach)
      const next = spreadStep(homes, movable, SPREAD_RADIUS, SPREAD_PUSH)
      const inverse = invert(m)!
      const expected = new Map<number, { x: number; y: number }>()
      free.forEach((i, k) => {
        if (!movable[k]) return
        const leaves = next[k].x < 0 || next[k].x > VIEW.width || next[k].y < 0 || next[k].y > VIEW.height
        expected.set(i, pushOutside(leaves ? homes[k] : next[k], m, inverse, MARGIN))
      })
      expect(expected.size).toBeGreaterThan(10)

      spreadHomes(state, createScene(VIEW), grid, m, inverse)

      for (const [i, home] of expected) {
        expect(state.dots[i].homeX).toBe(home.x)
        expect(state.dots[i].homeY).toBe(home.y)
      }
    })
  })
})

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

const STILL: Channels = {
  flash: 0,
  pulse: 0,
  flatten: 0,
  freeDrift: 0,
  dim: 0,
  ink: 0,
  cells: 0,
  lines: 0,
  photo: 1,
  shrink: 0,
  title: 0,
  rings: 0,
  panel: 0,
}

/** One capture frame, as advanceCapture runs it: the scene keeps its quad and carries the channels. */
function captureFrame(w: World, t: number, channels: Partial<Channels>) {
  w.scene.t = t
  w.scene.capture = { ...STILL, ...channels }
  stepField(w.field, w.scene)
  return w
}

const locked = () => run(world(), gridAt(50, 300), 0, 2.5)
const free = (w: World) => w.field.dots.filter((d) => d.target < 0)

describe('the capture phase', () => {
  const centre = { x: 200, y: 450 }

  it('puts every gathered dot exactly on its intersection, at full opacity', () => {
    const w = captureFrame(locked(), 2.6, {})
    const targets = intersections(unitToQuad(gridAt(50, 300))!)
    for (const d of gathered(w)) {
      expect(d.x).toBeCloseTo(targets[d.target].x, 6)
      expect(d.y).toBeCloseTo(targets[d.target].y, 6)
      expect(d.alpha).toBe(1)
    }
  })

  it('makes a dot still in flight jump to the end of its flight', () => {
    const w = run(world(), gridAt(50, 300), 0, 0.2)
    captureFrame(w, 0.21, {})
    const targets = intersections(unitToQuad(gridAt(50, 300))!)
    const d = gathered(w)[0]
    expect(d.x).toBeCloseTo(targets[d.target].x, 6)
    expect(d.y).toBeCloseTo(targets[d.target].y, 6)
    expect(d.radius).toBeGreaterThan(d.size)
  })

  it('grows a gathered dot to 1.6 × its radius at the top of the pulse', () => {
    const w = locked()
    const radii = gathered(w).map((d) => d.radius)
    captureFrame(w, 2.6, { pulse: 1 })
    gathered(w).forEach((d, i) => expect(d.radius).toBeCloseTo(1.6 * radii[i], 6))
  })

  it('shrinks the gathered dots to nothing at the end of the transition', () => {
    const w = captureFrame(locked(), 4, transitionAt(TRANSITION_END, false))
    for (const d of gathered(w)) {
      expect(d.radius).toBe(0)
      expect(d.alpha).toBe(0)
    }
  })

  it('moves every free dot 40 pt away from the grid centre and fades it at freeDrift 1', () => {
    const w = captureFrame(locked(), 2.6, {})
    const start = free(w).map((d) => Math.hypot(d.x - centre.x, d.y - centre.y))
    captureFrame(w, 2.7, { freeDrift: 1 })
    free(w).forEach((d, i) => {
      expect(Math.hypot(d.x - centre.x, d.y - centre.y)).toBeCloseTo(start[i] + 40, 4)
      expect(d.alpha).toBe(0)
    })
  })

  it('starts the drift from where each free dot was in the first capture frame', () => {
    const w = locked()
    const before = free(w).map((d) => ({ x: d.x, y: d.y }))
    captureFrame(w, 2.6, {})
    captureFrame(w, 3.4, {})
    free(w).forEach((d, i) => {
      expect(d.x).toBeCloseTo(before[i].x, 6)
      expect(d.y).toBeCloseTo(before[i].y, 6)
    })
  })

  it('follows the moving quad', () => {
    const w = captureFrame(locked(), 2.6, {})
    const moved = gridAt(20, 100, 360)
    w.scene.quad = moved
    w.scene.m = unitToQuad(moved)
    w.scene.inverse = invert(w.scene.m!)
    captureFrame(w, 2.7, {})
    const targets = intersections(w.scene.m!)
    for (const d of gathered(w)) {
      expect(d.x).toBeCloseTo(targets[d.target].x, 6)
      expect(d.y).toBeCloseTo(targets[d.target].y, 6)
    }
  })
})
