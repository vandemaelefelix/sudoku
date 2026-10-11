import type { Quad } from '../../scanner'
import type { ViewSize } from '../previewMapping'
import { createScene, type Scene, stepScene } from './scene'
import type { AnyEffect } from './types'

/** index: the effect index that state belongs to. */
export type Engine = { index: number; scene: Scene; state: unknown }

/**
 * One frame on the UI thread: the scene first, then the active effect. effect: effectAt(index).
 * A new view size gives a new scene and a new effect state. A new index gives a new effect state, and the scene stays.
 */
export function advance(
  engine: Engine | null,
  index: number,
  effect: AnyEffect,
  view: ViewSize,
  quad: Quad | null,
  t: number,
  reduceMotion: boolean,
): Engine {
  'worklet'
  if (engine == null || engine.scene.width !== view.width || engine.scene.height !== view.height) {
    const scene = stepScene(createScene(view), quad, t, reduceMotion)
    return { index, scene, state: effect.step(effect.create(scene), scene) }
  }
  const scene = stepScene(engine.scene, quad, t, reduceMotion)
  const state = engine.index === index ? engine.state : effect.create(scene)
  return { index, scene, state: effect.step(state, scene) }
}
