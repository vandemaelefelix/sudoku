import { createLockOn, type LockOn, type LockStatus, lockStatus, stepLockOn } from '@/scan/utils/lockOn.utils'
import type { Channels } from '@/scan/utils/transition.utils'
import { createScene, type Scene, stepScene } from './scene'
import type { AnyEffect } from './types'
import type { Quad, ViewSize } from '@/utils/geometry.utils'
import { invert, unitToQuad } from '@/utils/homography.utils'
import { MAX_STEP } from './scene.constants'

/** id: the effect that state belongs to. lockOn: the lock-on tracker. The effects do not see it: they read the lock-on progress from the scene. */
export type Engine = { id: string; scene: Scene; state: unknown; lockOn: LockOn }

/** Gives the grid of the frame that stepScene made to the tracker, and the progress and the lock time back to the scene. */
export function trackLock(lockOn: LockOn, scene: Scene): void {
  'worklet'
  stepLockOn(lockOn, { grid: scene.quad, found: scene.event === 'found', t: scene.t, viewWidth: scene.width })
  scene.lockProgress = lockOn.progress
  scene.lockedAt = lockOn.lockedAt
}

/**
 * One frame on the UI thread: the scene, then the lock-on tracker, then the active effect.
 * A new view size gives a new scene, a new tracker and a new effect state. Another effect id gives a new effect state, and the scene stays.
 * The id decides, not the registry index: a Fast Refresh can give an index to another effect.
 */
export function advance(
  engine: Engine | null,
  effect: AnyEffect,
  view: ViewSize,
  quad: Quad | null,
  t: number,
  reduceMotion: boolean,
): Engine {
  'worklet'
  if (engine == null || engine.scene.width !== view.width || engine.scene.height !== view.height) {
    const scene = stepScene(createScene(view), quad, t, reduceMotion)
    const lockOn = createLockOn()
    trackLock(lockOn, scene)
    return { id: effect.id, scene, state: effect.step(effect.create(scene), scene), lockOn }
  }
  const scene = stepScene(engine.scene, quad, t, reduceMotion)
  trackLock(engine.lockOn, scene)
  const state = engine.id === effect.id ? engine.state : effect.create(scene)
  return { id: effect.id, scene, state: effect.step(state, scene), lockOn: engine.lockOn }
}

/**
 * One frame of the capture phase. quad: the grid in view points as the transition moves it; it replaces the locked quad.
 * The tracker stays as it was at lock-on, and its fired flag clears. The latch, the motion and the presence of the scene stay as they were at lock-on. crossFade: the transition fades the layers
 * with the Reduce Motion channels. Mutates the scene.
 */
export function advanceCapture(
  engine: Engine,
  effect: AnyEffect,
  quad: Quad,
  t: number,
  channels: Channels,
  crossFade: boolean,
): Engine {
  'worklet'
  const scene = engine.scene
  // The cross-fade replaces the motion, so the effects draw as under Reduce Motion (scan-pipeline concept).
  if (crossFade) scene.reduceMotion = true
  scene.dt = scene.t < 0 ? 0 : Math.min(MAX_STEP, Math.max(0, t - scene.t))
  scene.t = t
  const m = unitToQuad(quad)
  const inverse = m == null ? null : invert(m)
  // A degenerate quad keeps the last usable one, so the dots do not fall back to the live phase.
  if (m != null && inverse != null) {
    scene.quad = quad
    scene.lastQuad = quad
    scene.m = m
    scene.inverse = inverse
  }
  scene.capture = channels
  scene.event = 'none'
  engine.lockOn.fired = false
  const state = engine.id === effect.id ? engine.state : effect.create(scene)
  return { id: effect.id, scene, state: effect.step(state, scene), lockOn: engine.lockOn }
}

/** The lock-on rules of this frame: the tracker status and the facts that the scene owns. motion: 0..1. speed: points per second. */
export type LockReport = LockStatus & { grid: boolean; steady: boolean; motion: number; speed: number }

export function lockReport(engine: Engine): LockReport {
  'worklet'
  const { scene } = engine
  return {
    ...lockStatus(engine.lockOn, scene.t),
    grid: scene.quad != null,
    steady: scene.steady,
    motion: scene.motion,
    speed: scene.speed,
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
