import type { Quad } from '@/utils/geometry.utils'
import { quadToQuad } from '@/utils/homography.utils'
import type { Channels } from './timeline'

/**
 * One frame of the transition, in view points. quad: the grid of the dots and the photo. grid: the grid of the cells and the lines.
 * They are the same quad in the warp. In the cross-fade the dots stay on the locked grid, and the cells and lines are on the square.
 * crossFade: true when the Reduce Motion channels fade the layers, also without Reduce Motion (see TransitionPlan).
 */
export type CaptureFrame = { quad: Quad; grid: Quad; channels: Channels; crossFade: boolean }

/** Maps photo pixels (photoWidth × photoHeight, upright) to view points so that the normalised locked quad lands on screenQuad. */
export function photoMatrix(photoWidth: number, photoHeight: number, locked: Quad, screenQuad: Quad): number[] | null {
  'worklet'
  const inPixels = locked.map((p) => ({ x: p.x * photoWidth, y: p.y * photoHeight })) as Quad
  return quadToQuad(inPixels, screenQuad)
}
