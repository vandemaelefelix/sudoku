import type { Channels } from '@/scan/utils/transition.utils'
import { largestCornerStep, type Quad, type ViewSize } from '@/utils/geometry.utils'
import { type Homography, invert, unitToQuad } from '@/utils/homography.utils'
import { STEADY_SPEED, MOTION_TIME, STEADY_MOTION, JUMP, MAX_STEP, PRESENCE_TIME } from './scene.constants'

export type GridEvent = 'found' | 'lost' | 'none'

/**
 * The facts about the grid that every effect reads. Effects never change it. Times: seconds. Sizes: view points.
 * quad, m and inverse are null together when there is no usable grid. m maps the unit square to the view, inverse maps the view to the unit square.
 * event is for this frame only. A jump to another grid gives 'found', with lostAt and foundAt both at t.
 * presence and motion: 0..1. motion and steady drive the overlay. steadyAt: the time the scene last became steady. speed and changedAt belong to stepScene.
 * lockProgress: 0..1. lockedAt: the time of lock-on, or -1. The lock-on tracker owns the rule (ADR-019), and the engine copies these two values in after each stepScene.
 * From lock-on, the scene keeps the locked quad and ignores new detections.
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
  lockProgress: number
  lockedAt: number
  speed: number
  changedAt: number
  capture: Channels | null
}

/** Moves value toward target by at most step, so a fade over T seconds uses step = dt / T. */
function toward(value: number, target: number, step: number): number {
  'worklet'
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step)
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
    capture: null,
  }
}

/** Advances the scene to time t. detected: the smoothed grid in view points, or null. After lock-on it is ignored. Mutates and returns scene. */
export function stepScene(scene: Scene, detected: Quad | null, t: number, reduceMotion: boolean): Scene {
  'worklet'
  scene.dt = scene.t < 0 ? 0 : Math.min(MAX_STEP, Math.max(0, t - scene.t))
  scene.t = t
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
  scene.quad = grid
  scene.m = grid == null ? null : m
  scene.inverse = grid == null ? null : inverse
  if (grid != null) scene.lastQuad = grid
  return scene
}
