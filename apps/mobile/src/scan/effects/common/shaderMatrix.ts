import type { Scene } from '@/scan/effects/scene'
import { type Homography, invert, unitToQuad } from './geometry'

/** Points. The width of the phone that the prototype draws. */
export const PROTOTYPE_WIDTH = 220

export const IDENTITY: Homography = [1, 0, 0, 0, 1, 0, 0, 0]

/** The factor from prototype points to view points. */
export function prototypeScale(width: number): number {
  'worklet'
  return width / PROTOTYPE_WIDTH
}

/** View points per prototype pixel. The prototype shaders ran at pixel density 2. */
export function prototypePixel(width: number): number {
  'worklet'
  return prototypeScale(width) / 2
}

/** The 9 floats of an SkSL float3x3 uniform. Skia reads a matrix uniform column by column. */
export function toColumnMajor(m: Homography): number[] {
  'worklet'
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], 1]
}

/** The view-to-grid matrix of the current grid, or of the last grid while an effect fades out after a loss. Null before any grid. */
export function gridInverse(scene: Scene): Homography | null {
  'worklet'
  if (scene.inverse != null) return scene.inverse
  if (scene.lastQuad == null) return null
  const m = unitToQuad(scene.lastQuad)
  return m == null ? null : invert(m)
}
