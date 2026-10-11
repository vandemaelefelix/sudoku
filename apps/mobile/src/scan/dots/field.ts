import type { Point, Quad } from '../../scanner'
import { diagonal, type Scene } from '../effects/scene'
import type { ViewSize } from '../previewMapping'
import { assignNearest } from '../effects/common/assign'
import { type Homography, intersections, isBoxCorner, project, pushOutside } from '../effects/common/geometry'
import { createDots, type Dot, DOT_SPACING, twinkle, wander } from '../effects/common/layout'
import { spreadStep } from '../effects/common/spread'

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
/** Motion above which the homes keep spreading after the first SPREAD_TIME. */
const SPREAD_MOTION = 0.5
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
  const dots: FieldDot[] = createDots(view).map((dot) => {
    'worklet'
    return {
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
    }
  })
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
    // A clamp to the view would pull a home that the grid pushed out of the view back into the grid, and it would jump to another side.
    const leaves = next[k].x < 0 || next[k].x > scene.width || next[k].y < 0 || next[k].y > scene.height
    const home = pushOutside(leaves ? homes[k] : next[k], m, inverse, MARGIN)
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
  if (m != null && inverse != null) {
    // The home keeps the side it was pushed to. Without this write-back, the nearest side flips when the grid sweeps over the home.
    const home = pushOutside({ x: d.homeX, y: d.homeY }, m, inverse, MARGIN)
    d.homeX = home.x
    d.homeY = home.y
  }
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
  const usable = quad != null && m != null && inverse != null
  if (usable) {
    if (scene.event === 'found' || !state.holding) gather(state, m, t)
  } else if (state.holding) {
    release(state, t)
  }
  // While the grid moves, homes that it sweeps along keep spreading, so they do not pile on the margin.
  const spreading = t - state.gatheredAt < SPREAD_TIME || scene.motion > SPREAD_MOTION
  if (usable && !scene.reduceMotion && spreading) spreadHomes(state, scene, quad, m, inverse)
  for (let i = 0; i < state.dots.length; i++) {
    const d = state.dots[i]
    if (d.target >= 0 && m != null) placeGathered(d, t, m, scene.motion, scene.reduceMotion)
    else placeFree(state, d, t, m, inverse, scene.reduceMotion)
  }
  return state
}
