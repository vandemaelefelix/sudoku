import { type SkCanvas, Skia } from '@shopify/react-native-skia'
import { type Clock, createClock, effectTime } from '../common/clock'
import { gridInverse, IDENTITY } from '../common/shaderMatrix'
import type { Scene } from '../scene'
import type { DrawKit, Effect } from '../types'
import { RIPPLES_SKSL } from './shader'
import { rippleUniforms } from './uniforms'

const ID = 'ripples'

function step(state: Clock): Clock {
  'worklet'
  return state
}

function draw(canvas: SkCanvas, state: Clock, scene: Scene, kit: DrawKit): void {
  'worklet'
  const effect = kit.shaders[ID]
  if (effect == null) return
  // The dot screen shows before any grid. With presence 0 the shader ignores the matrix.
  const inverse = gridInverse(scene) ?? IDENTITY
  kit.shader.setShader(effect.makeShader(rippleUniforms(scene, inverse, effectTime(state, scene))))
  canvas.drawRect(Skia.XYWHRect(0, 0, scene.width, scene.height), kit.shader)
}

export const ripples: Effect<Clock> = {
  id: ID,
  name: 'Ripples',
  family: 'screen',
  sksl: RIPPLES_SKSL,
  create: createClock,
  step,
  draw,
}
