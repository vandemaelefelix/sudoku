import type { Point, Quad } from '@/scanner'
import { invert, unitToQuad } from '@/scan/effects/common/geometry'
import type { Rect } from '@/scan/correction/layout'
import type { Channels } from './timeline'

/**
 * One frame of the transition, in view points. quad: the grid of the dots and the photo. grid: the grid of the cells and the lines.
 * They are the same quad in the warp. In the cross-fade the dots stay on the locked grid, and the cells and lines are on the square.
 * crossFade: true when the Reduce Motion channels fade the layers, also without Reduce Motion (see TransitionPlan).
 */
export type CaptureFrame = { quad: Quad; grid: Quad; channels: Channels; crossFade: boolean }

function lerpPoint(p: Point, q: Point, u: number): Point {
  'worklet'
  return { x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u }
}

export function lerpQuad(a: Quad, b: Quad, u: number): Quad {
  'worklet'
  const [a0, a1, a2, a3] = a
  const [b0, b1, b2, b3] = b
  return [lerpPoint(a0, b0, u), lerpPoint(a1, b1, u), lerpPoint(a2, b2, u), lerpPoint(a3, b3, u)]
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
  const [x0, x1, x2, x3, x4, x5, x6, x7] = back
  const [y0, y1, y2, y3, y4, y5, y6, y7] = to
  // to × back as 3 × 3 matrices; each Homography leaves out its last cell, which is 1.
  const scale = y6 * x2 + y7 * x5 + 1
  if (!(Math.abs(scale) >= 1e-12)) return null
  const h = [
    y0 * x0 + y1 * x3 + y2 * x6,
    y0 * x1 + y1 * x4 + y2 * x7,
    y0 * x2 + y1 * x5 + y2,
    y3 * x0 + y4 * x3 + y5 * x6,
    y3 * x1 + y4 * x4 + y5 * x7,
    y3 * x2 + y4 * x5 + y5,
    y6 * x0 + y7 * x3 + x6,
    y6 * x1 + y7 * x4 + x7,
    scale,
  ]
  const normalised = h.map((v) => v / scale)
  return normalised.every(Number.isFinite) ? normalised : null
}

/** Maps photo pixels (photoWidth × photoHeight, upright) to view points so that the normalised locked quad lands on screenQuad. */
export function photoMatrix(photoWidth: number, photoHeight: number, locked: Quad, screenQuad: Quad): number[] | null {
  'worklet'
  const inPixels = locked.map((p) => ({ x: p.x * photoWidth, y: p.y * photoHeight })) as Quad
  return quadToQuad(inPixels, screenQuad)
}
