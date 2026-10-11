import type { Point, Quad } from '@/utils/geometry.utils'

/** score: the share of the frame that the quad covers, 0..1. */
export type GridDetection = { quad: Quad; score: number }

export const MIN_AREA_FRACTION = 0.1

/** A quad that touches the frame edge is cut off by it, so it is not the grid. */
export const BORDER_MARGIN = 0.005

function turnPoint(p: Point): Point {
  'worklet'
  return { x: 1 - p.x, y: 1 - p.y }
}

/** Turns the quad by 180 degrees about the frame centre. The result starts again at the top-left corner. */
export function turnHalf(quad: Quad): Quad {
  'worklet'
  return [turnPoint(quad[2]), turnPoint(quad[3]), turnPoint(quad[0]), turnPoint(quad[1])]
}

function edgeCross(a: Point, b: Point): number {
  'worklet'
  return a.x * b.y - b.x * a.y
}

export function quadArea(quad: Quad): number {
  'worklet'
  const [p0, p1, p2, p3] = quad
  const twice = edgeCross(p0, p1) + edgeCross(p1, p2) + edgeCross(p2, p3) + edgeCross(p3, p0)
  return Math.abs(twice) / 2
}

function turnCross(a: Point, b: Point, c: Point): number {
  'worklet'
  return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
}

export function isConvex(quad: Quad): boolean {
  'worklet'
  const [p0, p1, p2, p3] = quad
  let sign = 0
  for (const cross of [turnCross(p0, p1, p2), turnCross(p1, p2, p3), turnCross(p2, p3, p0), turnCross(p3, p0, p1)]) {
    if (cross === 0) return false
    if (sign === 0) sign = Math.sign(cross)
    else if (Math.sign(cross) !== sign) return false
  }
  return true
}

/** Starts the ring at corner k of q, 0..3. */
function rotateQuad(q: Quad, k: number): Quad {
  'worklet'
  const [a, b, c, d] = q
  if (k === 1) return [b, c, d, a]
  if (k === 2) return [c, d, a, b]
  if (k === 3) return [d, a, b, c]
  return q
}

/** Throws a RangeError for fewer than 4 points. */
export function orderCorners(points: Point[]): Quad {
  'worklet'
  const [p0, p1, p2, p3] = points
  if (p0 === undefined || p1 === undefined || p2 === undefined || p3 === undefined) {
    throw new RangeError(`orderCorners takes 4 points, got ${points.length}`)
  }
  const cx = (p0.x + p1.x + p2.x + p3.x) / 4
  const cy = (p0.y + p1.y + p2.y + p3.y) / 4
  // y points down, so a rising angle runs clockwise on the screen.
  const sorted = points.slice()
  sorted.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx))
  const [s0, s1, s2, s3] = sorted
  if (s0 === undefined || s1 === undefined || s2 === undefined || s3 === undefined) {
    throw new RangeError(`orderCorners takes 4 points, got ${points.length}`)
  }
  const ring: Quad = [s0, s1, s2, s3]
  let first = 0
  let best = s0.x + s0.y
  for (const [i, p] of ring.entries()) {
    if (p.x + p.y < best) {
      best = p.x + p.y
      first = i
    }
  }
  return rotateQuad(ring, first)
}

/** points: pixel coordinates in a width × height image. Null when they are not a plausible grid. */
export function toGridDetection(points: Point[], width: number, height: number): GridDetection | null {
  'worklet'
  if (points.length !== 4) return null
  // +0.5 moves a pixel index to the centre of its pixel.
  const quad = orderCorners(points.map((p) => ({ x: (p.x + 0.5) / width, y: (p.y + 0.5) / height })))
  if (!isConvex(quad)) return null
  const score = quadArea(quad)
  if (score < MIN_AREA_FRACTION) return null
  const touchesBorder = quad.some(
    (p) => p.x < BORDER_MARGIN || p.x > 1 - BORDER_MARGIN || p.y < BORDER_MARGIN || p.y > 1 - BORDER_MARGIN,
  )
  return touchesBorder ? null : { quad, score }
}
