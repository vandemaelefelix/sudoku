import type { Channels } from '@/scan/utils/transition.utils'
import { createScene, type Scene, stepScene } from './scene'
import type { AnyEffect } from './types'
import type { Quad, ViewSize } from '@/utils/geometry.utils'
import { invert, unitToQuad } from '@/utils/homography.utils'
import { MAX_STEP } from './scene.constants'

/** id: the effect that state belongs to. */
export type Engine = { id: string; scene: Scene; state: unknown }

/**
 * One frame on the UI thread: the scene first, then the active effect.
 * A new view size gives a new scene and a new effect state. Another effect id gives a new effect state, and the scene stays.
 * The id decides, not the registry index: a Fast Refresh can give an index to another effect.
 * armed: applies only to a new scene, see createScene.
 */
export function advance(
  engine: Engine | null,
  effect: AnyEffect,
  view: ViewSize,
  quad: Quad | null,
  t: number,
  reduceMotion: boolean,
  armed = true,
): Engine {
  'worklet'
  if (engine == null || engine.scene.width !== view.width || engine.scene.height !== view.height) {
    const scene = stepScene(createScene(view, armed), quad, t, reduceMotion)
    return { id: effect.id, scene, state: effect.step(effect.create(scene), scene) }
  }
  const scene = stepScene(engine.scene, quad, t, reduceMotion)
  const state = engine.id === effect.id ? engine.state : effect.create(scene)
  return { id: effect.id, scene, state: effect.step(state, scene) }
}

/**
 * One frame of the capture phase. quad: the grid in view points as the transition moves it; it replaces the locked quad.
 * The latch, the motion and the presence of the scene stay as they were at lock-on. crossFade: the transition fades the layers
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
  const state = engine.id === effect.id ? engine.state : effect.create(scene)
  return { id: effect.id, scene, state: effect.step(state, scene) }
}
