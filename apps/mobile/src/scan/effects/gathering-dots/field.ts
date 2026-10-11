import type { Point, Quad } from '@/scanner'
import type { ViewSize } from '@/scan/previewMapping'
import type { Channels } from '@/scan/transition/timeline'
import { assignNearest } from '@/scan/effects/common/assign'
import { type Homography, intersections, isBoxCorner, project, pushOutside } from '@/scan/effects/common/geometry'
import { createDots, type Dot, DOT_SPACING, twinkle, wander } from '@/scan/effects/common/layout'
import { spreadStep } from '@/scan/effects/common/spread'
import { diagonal, type Scene } from '@/scan/effects/scene'

// Stage 1 of the scan experience design. Opacities are 0..1, times are seconds, sizes are points.
export const DIM = 0.3
export const FREE_ALPHA = 0.32
export const GATHER_ALPHA_START = 0.4
export const GATHER_ALPHA_END = 0.8
export const FLIGHT = 0.7
export const MAX_DELAY = 0.35
export const GROW = 1.25
export const GROW_BOX = 1.7
/** The share of its wobble that a gathered dot keeps while the corners move. */
export const WOBBLE = 0.15
/** The share by which lock-on brightens a gathered dot: GATHER_ALPHA_END 0.8 goes to 1. */
export const LOCK_BRIGHTEN = 0.25
/** Grid coordinates. */
export const MARGIN = 0.08
export const SPREAD_TIME = 1.0
export const RELEASE_TIME = 0.5
export const REDUCED_FADE = 0.2
/** Motion above which the homes keep spreading after the first SPREAD_TIME. */
const SPREAD_MOTION = 0.5
export const SPREAD_RADIUS = 1.3 * DOT_SPACING
export const SPREAD_PUSH = 0.05 * DOT_SPACING
/** Grid diagonals from the grid centre within which free dots spread. */
export const NEAR = 1.5
/** The share of the dot-to-target vector by which a flight bends sideways. */
const ARC = 0.18
/** The capture transition (scan-pipeline concept). The radius of a gathered dot at the top of the pulse is 1 + PULSE_GROW times its radius. */
export const PULSE_GROW = 0.6
/** The radius of an ink dot as a share of the white dot: the ink dots fit the crossings of the lines. */
export const INK_RADIUS = 0.8
/** Points that a free dot moves away from the grid centre at freeDrift 1. */
export const FREE_DRIFT = 40

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

/**
 * holding: the dots are gathered on a grid. gatheredAt: the time of the last gather, which starts the spread of the free dots.
 * capturing: the capture phase has started. Its first frame stores the position of each dot in fromX and fromY.
 */
export type FieldState = {
  dots: FieldDot[]
  holding: boolean
  gatheredAt: number
  capturing: boolean
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
  return { dots, holding: false, gatheredAt: -1, capturing: false }
}

function gather(state: FieldState, m: Homography, t: number) {
  'worklet'
  const targets = intersections(m)
  const positions: Point[] = []
  for (const d of state.dots) positions.push({ x: d.x, y: d.y })
  const owner = assignNearest(positions, targets)
  // Each flight starts where the dot is drawn, so a re-gather does not jump.
  for (const d of state.dots) {
    d.target = -1
    d.releasing = false
    d.fromX = d.x
    d.fromY = d.y
    d.since = t
  }
  let longest = 0
  for (let j = 0; j < owner.length; j++) {
    const dot = owner[j]
    if (dot === undefined) continue
    const p = positions[dot]
    const target = targets[j]
    if (p === undefined || target === undefined) continue
    longest = Math.max(longest, Math.hypot(p.x - target.x, p.y - target.y))
  }
  for (let j = 0; j < owner.length; j++) {
    const dot = owner[j]
    if (dot === undefined) continue
    const d = state.dots[dot]
    const p = positions[dot]
    const target = targets[j]
    if (d === undefined || p === undefined || target === undefined) continue
    d.target = j
    d.delay = longest > 0 ? (Math.hypot(p.x - target.x, p.y - target.y) / longest) * MAX_DELAY : 0
  }
  state.holding = true
  state.gatheredAt = t
}

function release(state: FieldState, t: number) {
  'worklet'
  for (const d of state.dots) {
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

/** Indices of the free dots that can change a movable home: the movable ones, and the ones that are less than SPREAD_RADIUS outside the reach. In dot order, so the sums in spreadStep stay the same as over all free dots. */
export function selectSpreadDots(state: FieldState, centre: Point, reach: number): number[] {
  'worklet'
  const chosen: number[] = []
  const limit = reach + SPREAD_RADIUS
  for (let i = 0; i < state.dots.length; i++) {
    const d = state.dots[i]
    if (d === undefined) continue
    if (d.target >= 0) continue
    if (Math.hypot(d.homeX - centre.x, d.homeY - centre.y) < limit) chosen.push(i)
  }
  return chosen
}

export function spreadHomes(state: FieldState, scene: Scene, quad: Quad, m: Homography, inverse: Homography) {
  'worklet'
  const centre = project(m, 0.5, 0.5)
  const reach = diagonal(quad) * NEAR
  const chosen = selectSpreadDots(state, centre, reach)
  const dots: FieldDot[] = []
  const homes: Point[] = []
  const movable: boolean[] = []
  for (const index of chosen) {
    const d = state.dots[index]
    if (d === undefined) continue
    dots.push(d)
    homes.push({ x: d.homeX, y: d.homeY })
    movable.push(Math.hypot(d.homeX - centre.x, d.homeY - centre.y) < reach)
  }
  const next = spreadStep(homes, movable, SPREAD_RADIUS, SPREAD_PUSH)
  for (let k = 0; k < dots.length; k++) {
    const d = dots[k]
    if (d === undefined) continue
    const from = homes[k]
    const to = next[k]
    if (!movable[k] || from === undefined || to === undefined) continue
    // A clamp to the view would pull a home that the grid pushed out of the view back into the grid, and it would jump to another side.
    const leaves = to.x < 0 || to.x > scene.width || to.y < 0 || to.y > scene.height
    const home = pushOutside(leaves ? from : to, m, inverse, MARGIN)
    d.homeX = home.x
    d.homeY = home.y
  }
}

function placeGathered(d: FieldDot, t: number, m: Homography, motion: number, lock: number, reduceMotion: boolean) {
  'worklet'
  const at = project(m, (d.target % 10) / 9, Math.floor(d.target / 10) / 9)
  const grow = isBoxCorner(d.target) ? GROW_BOX : GROW
  if (reduceMotion) {
    d.x = at.x
    d.y = at.y
    d.radius = d.size * grow
    d.alpha = GATHER_ALPHA_END * (1 + LOCK_BRIGHTEN * lock) * Math.min(1, Math.max(0, (t - d.since) / REDUCED_FADE))
    return
  }
  const w = wander(d, t)
  const w0 = wander(d, d.since)
  const u = smooth((t - d.since - d.delay) / FLIGHT)
  const sx = d.fromX + w.x - w0.x
  const sy = d.fromY + w.y - w0.y
  const settle = WOBBLE * motion * (1 - lock)
  const ex = at.x + w.x * settle
  const ey = at.y + w.y * settle
  const arc = Math.sin(u * Math.PI) * ARC * (d.px / (2 * Math.PI) - 0.5)
  d.x = sx + (ex - sx) * u - (ey - sy) * arc
  d.y = sy + (ey - sy) * u + (ex - sx) * arc
  d.radius = d.size * (1 + (grow - 1) * u)
  const flicker = u >= 1 ? 1 : twinkle(d, t) + (1 - twinkle(d, t)) * lock
  d.alpha = (GATHER_ALPHA_START + (GATHER_ALPHA_END - GATHER_ALPHA_START) * u) * flicker * (1 + LOCK_BRIGHTEN * lock)
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
 * The capture phase: the gathered dots ride the quad into the crossings of the correction screen, and the free dots leave.
 * A dot still in flight lands at once, because the flatten moves the grid faster than a flight.
 */
function stepCapture(state: FieldState, scene: Scene, capture: Channels): FieldState {
  'worklet'
  const m = scene.m
  if (!state.capturing) {
    for (const d of state.dots) {
      d.fromX = d.x
      d.fromY = d.y
    }
    state.capturing = true
  }
  const centre = m == null ? null : project(m, 0.5, 0.5)
  const scale = (1 + PULSE_GROW * capture.pulse) * (1 - capture.shrink) * (1 + (INK_RADIUS - 1) * capture.ink)
  for (const d of state.dots) {
    if (d.target >= 0 && m != null) {
      const at = project(m, (d.target % 10) / 9, Math.floor(d.target / 10) / 9)
      d.x = at.x
      d.y = at.y
      d.radius = d.size * (isBoxCorner(d.target) ? GROW_BOX : GROW) * scale
      d.alpha = 1 - capture.shrink
      continue
    }
    let x = d.fromX
    let y = d.fromY
    // Under Reduce Motion the free dots fade in place.
    if (centre != null && !scene.reduceMotion) {
      const dx = x - centre.x
      const dy = y - centre.y
      const length = Math.hypot(dx, dy) || 1
      x += (dx / length) * FREE_DRIFT * capture.freeDrift
      y += (dy / length) * FREE_DRIFT * capture.freeDrift
    }
    d.x = x
    d.y = y
    d.radius = d.size
    d.alpha = FREE_ALPHA * (scene.reduceMotion ? 1 : twinkle(d, scene.t)) * (1 - capture.freeDrift)
  }
  return state
}

/**
 * Advances the dots to scene.t. Run stepScene or advanceCapture first. Mutates and returns state.
 * The dots gather on 'found', and also on the first frame with a grid when the field is new, so a switch to this effect while a grid is in view gathers at once.
 */
export function stepField(state: FieldState, scene: Scene): FieldState {
  'worklet'
  if (scene.capture != null) return stepCapture(state, scene, scene.capture)
  state.capturing = false
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
  for (const d of state.dots) {
    if (d.target >= 0 && m != null) placeGathered(d, t, m, scene.motion, scene.lockProgress, scene.reduceMotion)
    else placeFree(state, d, t, m, inverse, scene.reduceMotion)
  }
  return state
}
