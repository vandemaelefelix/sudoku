import { type SkCanvas, Skia } from '@shopify/react-native-skia'
import { type Clock, createClock, effectTime } from '@/scan/effects/common/clock'
import { gridInverse } from '@/scan/effects/common/shaderMatrix'
import type { Scene } from '@/scan/effects/scene'
import type { DrawKit, Effect } from '@/scan/effects/types'
import { LATTICE_SKSL } from './shader'
import { latticeUniforms } from './uniforms'

const ID = 'grid-lattice'

function step(state: Clock): Clock {
  'worklet'
  return state
}

function draw(canvas: SkCanvas, state: Clock, scene: Scene, kit: DrawKit): void {
  'worklet'
  const effect = kit.shaders[ID]
  const inverse = gridInverse(scene)
  if (effect == null || inverse == null || scene.presence <= 0) return
  kit.shader.setShader(effect.makeShader(latticeUniforms(scene, inverse, effectTime(state, scene))))
  canvas.drawRect(Skia.XYWHRect(0, 0, scene.width, scene.height), kit.shader)
}

export const gridLattice: Effect<Clock> = {
  id: ID,
  name: 'Grid lattice',
  family: 'shader',
  sksl: LATTICE_SKSL,
  create: createClock,
  step,
  draw,
}
