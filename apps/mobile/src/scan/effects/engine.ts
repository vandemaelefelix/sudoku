import type { Quad } from '../../scanner'
import type { ViewSize } from '../previewMapping'
import { createScene, type Scene, stepScene } from './scene'
import type { AnyEffect } from './types'

/** id: the effect that state belongs to. */
export type Engine = { id: string; scene: Scene; state: unknown }

/**
 * One frame on the UI thread: the scene first, then the active effect.
 * A new view size gives a new scene and a new effect state. Another effect id gives a new effect state, and the scene stays.
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
    return { id: effect.id, scene, state: effect.step(effect.create(scene), scene) }
  }
  const scene = stepScene(engine.scene, quad, t, reduceMotion)
  const state = engine.id === effect.id ? engine.state : effect.create(scene)
  return { id: effect.id, scene, state: effect.step(state, scene) }
}
