import type { Quad } from '@/scanner'
import { invert, unitToQuad } from '@/scan/effects/common/geometry'
import type { Rect } from '@/scan/correction/layout'
import type { Channels } from './timeline'

/**
 * One frame of the transition, in view points. quad: the grid of the dots and the photo. grid: the grid of the cells and the lines.
 * They are the same quad in the warp. In the cross-fade the dots stay on the locked grid, and the cells and lines are on the square.
 * crossFade: true when the Reduce Motion channels fade the layers, also without Reduce Motion (see TransitionPlan).
 */
export type CaptureFrame = { quad: Quad; grid: Quad; channels: Channels; crossFade: boolean }

export function lerpQuad(a: Quad, b: Quad, u: number): Quad {
  'worklet'
  return a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * u, y: p.y + (b[i].y - p.y) * u })) as Quad
}

/** The square of a Rect as a Quad, in quad corner order. */
export function rectQuad(rect: Rect): Quad {
  'worklet'
  const right = rect.x + rect.width
  const bottom = rect.y + rect.height
  return [
    { x: rect.x, y: rect.y },
    { x: right, y: rect.y },
    { x: right, y: bottom },
    { x: rect.x, y: bottom },
  ]
}

/** 9 numbers, row-major, the homography that maps quad a onto quad b. Null when a quad is degenerate. */
export function quadToQuad(a: Quad, b: Quad): number[] | null {
  'worklet'
  const from = unitToQuad(a)
  const to = unitToQuad(b)
  if (from === null || to === null) return null
  const back = invert(from)
  if (back === null) return null
  const x = [back[0], back[1], back[2], back[3], back[4], back[5], back[6], back[7], 1]
  const y = [to[0], to[1], to[2], to[3], to[4], to[5], to[6], to[7], 1]
  const h: number[] = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      h.push(y[row * 3] * x[col] + y[row * 3 + 1] * x[3 + col] + y[row * 3 + 2] * x[6 + col])
    }
  }
  const scale = h[8]
  if (!(Math.abs(scale) >= 1e-12)) return null
  const normalised = h.map((v) => v / scale)
  return normalised.every(Number.isFinite) ? normalised : null
}

/** Maps photo pixels (photoWidth × photoHeight, upright) to view points so that the normalised locked quad lands on screenQuad. */
export function photoMatrix(photoWidth: number, photoHeight: number, locked: Quad, screenQuad: Quad): number[] | null {
  'worklet'
  const inPixels = locked.map((p) => ({ x: p.x * photoWidth, y: p.y * photoHeight })) as Quad
  return quadToQuad(inPixels, screenQuad)
}
