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

/** presence: 0..1, how far the dim has moved to "grid found". motion: 0..1, the corner speed relative to STEADY_SPEED. speed: pt/s, the corner speed measured at the last quad change. changedAt: time of the last change of the quad object. */
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
  speed: number
  changedAt: number
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
  return {
    width: view.width,
    height: view.height,
    dots,
    quad: null,
    lastQuad: null,
    foundAt: -1,
    t: -1,
    presence: 0,
    motion: 1,
    speed: STEADY_SPEED,
    changedAt: -1,
  }
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
  const w0 = wander(d, d.since)
  const u = smooth((t - d.since - d.delay) / FLIGHT)
  const sx = d.fromX + w.x - w0.x
  const sy = d.fromY + w.y - w0.y
  const ex = at.x + w.x * WOBBLE * state.motion
  const ey = at.y + w.y * WOBBLE * state.motion
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
  const start = d.releasing ? d.since : state.foundAt
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

/** Advances the field to time t. quad: the smoothed grid in view points, or null. Mutates and returns state. */
export function stepField(state: FieldState, quad: Quad | null, t: number, reduceMotion: boolean): FieldState {
  'worklet'
  const dt = state.t < 0 ? 0 : Math.min(MAX_STEP, Math.max(0, t - state.t))
  state.t = t
  const m = quad == null ? null : unitToQuad(quad)
  const inverse = m == null ? null : invert(m)
  const grid = m != null && inverse != null ? quad : null
  const previous = state.quad
  // The camera sends a new quad object per detection, so speed is measured only at those changes.
  const changed = grid !== previous
  const step = grid != null && previous != null ? largestCornerStep(grid, previous) : 0
  const jumped = grid != null && previous != null && step > JUMP * diagonal(previous)
  if (grid != null && m != null && (previous == null || jumped)) {
    gather(state, m, t)
    state.speed = STEADY_SPEED
  } else if (grid == null && previous != null) {
    release(state, t)
    state.speed = STEADY_SPEED
  } else if (changed && grid != null && previous != null && t > state.changedAt) {
    state.speed = step / (t - state.changedAt)
  }
  if (changed) state.changedAt = t
  state.motion = toward(state.motion, Math.min(1, state.speed / STEADY_SPEED), dt / MOTION_TIME)
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
