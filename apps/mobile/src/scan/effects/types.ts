import type { SkCanvas, SkImage, SkPaint, SkRect, SkRuntimeEffect } from '@shopify/react-native-skia'
import type { Scene } from './scene'

export type EffectFamily = 'path' | 'shader' | 'screen' | 'simulation'

/**
 * Resources that the engine makes once on the JS thread, so draw never makes them per frame.
 * draw sets the colour, alpha and shader of a paint before each use. shaders: the compiled sksl of each effect by id, or null when it did not compile.
 */
export type DrawKit = {
  sprite: SkImage
  spriteRect: SkRect
  fill: SkPaint
  stroke: SkPaint
  atlas: SkPaint
  shader: SkPaint
  shaders: { [id: string]: SkRuntimeEffect | null }
}

/**
 * One way to draw the live overlay. Every function is a worklet. id is stable: the saved choice uses it.
 * create runs on the first frame, on a view size change and on a switch to the effect. step may change the state and returns it.
 * sksl: a runtime shader source that the engine compiles once into kit.shaders[id].
 * The methods use method syntax on purpose: it lets an Effect<FieldState> stand in an AnyEffect list.
 */
export type Effect<S> = {
  id: string
  name: string
  family: EffectFamily
  sksl?: string
  create(scene: Scene): S
  step(state: S, scene: Scene): S
  draw(canvas: SkCanvas, state: S, scene: Scene, kit: DrawKit): void
}

export type AnyEffect = Effect<unknown>
