import type { Homography } from '@/scan/effects/common/geometry'
import { lockTime } from '@/scan/effects/common/lock'
import { prototypePixel, prototypeScale, toColumnMajor } from '@/scan/effects/common/shaderMatrix'
import type { Scene } from '@/scan/effects/scene'

/** The 15 floats of RIPPLES_SKSL, in its uniform order. inverse: view points to the unit square. time: from effectTime. */
export function rippleUniforms(scene: Scene, inverse: Homography, time: number): number[] {
  'worklet'
  const uniforms = toColumnMajor(inverse)
  uniforms.push(
    prototypePixel(scene.width),
    time,
    scene.presence,
    scene.lockProgress,
    scene.reduceMotion ? -1 : lockTime(scene),
    prototypeScale(scene.width),
  )
  return uniforms
}
