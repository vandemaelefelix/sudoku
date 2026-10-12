import type { Channels } from '@/scan/utils/transition.utils'
import type { Quad, ViewSize } from '@/utils/geometry.utils'
import { type Homography, invert, unitToQuad } from '@/utils/homography.utils'
import {
  STEADY_SPEED,
  MOTION_TIME,
  STEADY_MOTION,
  LOCK_DWELL,
  DRIFT_WINDOW,
  DRIFT_LIMIT,
  DRIFT_MIN_SPAN,
  WARMUP,
  MIN_GRID_WIDTH,
  GRID_WIDTH_HYSTERESIS,
  JUMP,
  MAX_STEP,
  PRESENCE_TIME,
} from './scene.constants'

export type GridEvent = 'found' | 'lost' | 'none'

/**
 * The facts about the grid that every effect reads. Effects never change it. Times: seconds. Sizes: view points.
 * quad, m and inverse are null together when there is no usable grid. m maps the unit square to the view, inverse maps the view to the unit square.
 * event is for this frame only. A jump to another grid gives 'found', with lostAt and foundAt both at t.
 * presence and motion: 0..1. motion and steady drive the overlay. steadyAt: the time the scene last became steady. speed and changedAt belong to stepScene.
 * drift: the largest net corner move over the last DRIFT_WINDOW, in points per second, measured in every frame. 0 until the track spans DRIFT_MIN_SPAN.
 * track: the detections of the last DRIFT_WINDOW, oldest first.
 * movedAt: the last time the drift was above DRIFT_LIMIT, or -1. Lock-on reads the drift, not steady, because a hand never holds a phone still (ADR-019).
 * lockProgress: 0..1, see LOCK_DWELL. lockedAt: the time of lock-on, or -1. From lock-on, the scene keeps the locked quad and ignores new detections.
 * startedAt: the time of the first frame, or -1.
 * bigSince: the time the grid became at least MIN_GRID_WIDTH wide, or -1 while there is no such grid. See GRID_WIDTH_HYSTERESIS.
 * capture: the transition channels in the capture phase, where advanceCapture moves the quad; null in the live phase.
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
  drift: number
  track: { quad: Quad; t: number }[]
  movedAt: number
  lockProgress: number
  lockedAt: number
  startedAt: number
  bigSince: number
  speed: number
  changedAt: number
  capture: Channels | null
}

/** Moves value toward target by at most step, so a fade over T seconds uses step = dt / T. */
function toward(value: number, target: number, step: number): number {
  'worklet'
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step)
}

function largestCornerStep(a: Quad, b: Quad): number {
  'worklet'
  const [a0, a1, a2, a3] = a
  const [b0, b1, b2, b3] = b
  return Math.max(
    0,
    Math.hypot(a0.x - b0.x, a0.y - b0.y),
    Math.hypot(a1.x - b1.x, a1.y - b1.y),
    Math.hypot(a2.x - b2.x, a2.y - b2.y),
    Math.hypot(a3.x - b3.x, a3.y - b3.y),
  )
}

export function diagonal(quad: Quad): number {
  'worklet'
  return Math.hypot(quad[2].x - quad[0].x, quad[2].y - quad[0].y)
}

/** The mean length of the top and bottom edges, in view points. */
function gridWidth(quad: Quad): number {
  'worklet'
  return (
    (Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y) +
      Math.hypot(quad[2].x - quad[3].x, quad[2].y - quad[3].y)) /
    2
  )
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
    drift: 0,
    track: [],
    movedAt: -1,
    lockProgress: 0,
    lockedAt: -1,
    startedAt: -1,
    bigSince: -1,
    speed: STEADY_SPEED,
    changedAt: -1,
    capture: null,
  }
}

/** Advances the scene to time t. detected: the smoothed grid in view points, or null. After lock-on it is ignored. Mutates and returns scene. */
export function stepScene(scene: Scene, detected: Quad | null, t: number, reduceMotion: boolean): Scene {
  'worklet'
  scene.dt = scene.t < 0 ? 0 : Math.min(MAX_STEP, Math.max(0, t - scene.t))
  scene.t = t
  if (scene.startedAt < 0) scene.startedAt = t
  scene.reduceMotion = reduceMotion
  scene.capture = null
  const quad = scene.lockedAt >= 0 ? scene.quad : detected
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
  // A new grid starts a new track, so a jump never counts as a move. The oldest entry is the newest detection that is at least DRIFT_WINDOW old.
  if (grid == null || scene.event === 'found') {
    scene.track = grid == null ? [] : [{ quad: grid, t }]
    scene.drift = 0
  } else {
    if (changed) scene.track.push({ quad: grid, t })
    const track = scene.track
    while (track.length > 1 && t - track[1]!.t >= DRIFT_WINDOW) track.shift()
    const oldest = track[0]
    const span = oldest == null ? 0 : t - oldest.t
    scene.drift = oldest != null && span >= DRIFT_MIN_SPAN ? largestCornerStep(grid, oldest.quad) / span : 0
  }
  const moving = scene.drift > DRIFT_LIMIT
  if (moving) scene.movedAt = t
  if (grid == null) {
    scene.bigSince = -1
  } else {
    const limit = scene.bigSince >= 0 ? MIN_GRID_WIDTH - GRID_WIDTH_HYSTERESIS : MIN_GRID_WIDTH
    const big = gridWidth(grid) >= limit * scene.width
    if (!big) scene.bigSince = -1
    else if (scene.bigSince < 0) scene.bigSince = t
  }
  if (scene.lockedAt < 0) {
    // foundAt also moves on a jump, so a switch to another grid starts the dwell again. movedAt does the same after a pan.
    const since = Math.max(scene.foundAt, scene.movedAt, scene.startedAt + WARMUP, scene.bigSince)
    const ready = !moving && scene.bigSince >= 0
    scene.lockProgress = ready ? Math.min(1, Math.max(0, (t - since) / LOCK_DWELL)) : 0
    if (scene.lockProgress >= 1) scene.lockedAt = t
  }
  scene.quad = grid
  scene.m = grid == null ? null : m
  scene.inverse = grid == null ? null : inverse
  if (grid != null) scene.lastQuad = grid
  return scene
}

/** The lock-on rules of this frame. width: the grid width as a share of the view width, 0 without a grid. motion, progress: 0..1. speed, drift: points per second. */
export type LockReport = {
  grid: boolean
  steady: boolean
  motion: number
  speed: number
  drift: number
  moving: boolean
  width: number
  big: boolean
  warm: boolean
  progress: number
  locked: boolean
}

export function lockReport(scene: Scene): LockReport {
  'worklet'
  return {
    grid: scene.quad != null,
    steady: scene.steady,
    motion: scene.motion,
    speed: scene.speed,
    drift: scene.drift,
    moving: scene.drift > DRIFT_LIMIT,
    width: scene.quad == null || scene.width <= 0 ? 0 : gridWidth(scene.quad) / scene.width,
    big: scene.bigSince >= 0,
    warm: scene.startedAt >= 0 && scene.t - scene.startedAt >= WARMUP,
    progress: scene.lockProgress,
    locked: scene.lockedAt >= 0,
  }
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no'
}

export function formatLockReport(report: LockReport): string {
  return (
    `grid ${yesNo(report.grid)}, ` +
    `steady ${yesNo(report.steady)} (motion ${report.motion.toFixed(2)}, speed ${report.speed.toFixed(1)} pt/s), ` +
    `drift ${report.drift.toFixed(1)} pt/s moving ${yesNo(report.moving)}, ` +
    `width ${report.width.toFixed(2)} big ${yesNo(report.big)}, warm ${yesNo(report.warm)}, ` +
    `progress ${report.progress.toFixed(2)}, locked ${yesNo(report.locked)}`
  )
}
