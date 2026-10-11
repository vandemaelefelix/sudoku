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
