import type { Quad } from '../../scanner'
import { type Homography, invert, unitToQuad } from './common/geometry'
import type { ViewSize } from '../previewMapping'

// Times are seconds. Speeds are points per second.
/** Corners slower than this count as slow. The lock-on threshold. Tuned on the device, see the scan-pipeline concept. */
export const STEADY_SPEED = 30
export const MOTION_TIME = 0.3
/** The scene is steady while motion is below this value. The lock-on threshold. Tuned on the device, see the scan-pipeline concept. */
export const STEADY_MOTION = 0.5
/** Seconds the grid must stay steady before the scan locks on. Tuned on the device: 0.7 s needed no change, see the scan-pipeline concept. */
export const LOCK_DWELL = 0.7
/** A corner step in one frame larger than this share of the grid diagonal means another grid. */
export const JUMP = 0.25
/** The longest step the scene takes, so a pause does not make an effect jump. */
export const MAX_STEP = 0.1
/** Seconds for presence to go from 0 to 1, or back. */
export const PRESENCE_TIME = 0.4

export type GridEvent = 'found' | 'lost' | 'none'

/**
 * The facts about the grid that every effect reads. Effects never change it. Times: seconds. Sizes: view points.
 * quad, m and inverse are null together when there is no usable grid. m maps the unit square to the view, inverse maps the view to the unit square.
 * event is for this frame only. A jump to another grid gives 'found', with lostAt and foundAt both at t.
 * presence and motion: 0..1. steadyAt: the time the scene last became steady. speed and changedAt belong to stepScene.
 * lockProgress: 0..1, see LOCK_DWELL. lockedAt: the time of lock-on, or -1. From lock-on, the scene keeps the locked quad and ignores new detections.
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
  lockProgress: number
  lockedAt: number
  speed: number
  changedAt: number
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

export function diagonal(quad: Quad): number {
  'worklet'
  return Math.hypot(quad[2].x - quad[0].x, quad[2].y - quad[0].y)
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
    lockProgress: 0,
    lockedAt: -1,
    speed: STEADY_SPEED,
    changedAt: -1,
  }
}

/** Advances the scene to time t. detected: the smoothed grid in view points, or null. After lock-on it is ignored. Mutates and returns scene. */
export function stepScene(scene: Scene, detected: Quad | null, t: number, reduceMotion: boolean): Scene {
  'worklet'
  scene.dt = scene.t < 0 ? 0 : Math.min(MAX_STEP, Math.max(0, t - scene.t))
  scene.t = t
  scene.reduceMotion = reduceMotion
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
  if (scene.lockedAt < 0) {
    // foundAt also moves on a jump, so a switch to another grid starts the dwell again.
    const since = Math.max(scene.steadyAt, scene.foundAt)
    scene.lockProgress = steady ? Math.min(1, Math.max(0, (t - since) / LOCK_DWELL)) : 0
    if (scene.lockProgress >= 1) scene.lockedAt = t
  }
  scene.quad = grid
  scene.m = grid == null ? null : m
  scene.inverse = grid == null ? null : inverse
  if (grid != null) scene.lastQuad = grid
  return scene
}
