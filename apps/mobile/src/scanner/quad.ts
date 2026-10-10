export type Point = { x: number; y: number }

/** Normalised to 0..1 of the upright frame. Order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point]

/** score: the share of the frame that the quad covers, 0..1. */
export type GridDetection = { quad: Quad; score: number }

export const MIN_AREA_FRACTION = 0.1

/** A contour that reaches the frame edge is cut off by it, so it is not the grid. */
export const BORDER_MARGIN = 0.005

export function quadArea(quad: Quad): number {
  'worklet'
  let twice = 0
  for (let i = 0; i < 4; i++) {
    const a = quad[i]
    const b = quad[(i + 1) % 4]
    twice += a.x * b.y - b.x * a.y
  }
  return Math.abs(twice) / 2
}

export function isConvex(quad: Quad): boolean {
  'worklet'
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = quad[i]
    const b = quad[(i + 1) % 4]
    const c = quad[(i + 2) % 4]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (cross === 0) return false
    if (sign === 0) sign = Math.sign(cross)
    else if (Math.sign(cross) !== sign) return false
  }
  return true
}

export function orderCorners(points: Point[]): Quad {
  'worklet'
  const cx = (points[0].x + points[1].x + points[2].x + points[3].x) / 4
  const cy = (points[0].y + points[1].y + points[2].y + points[3].y) / 4
  // y points down, so a rising angle runs clockwise on the screen.
  const sorted = points.toSorted(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  )
  let first = 0
  for (let i = 1; i < 4; i++) {
    if (sorted[i].x + sorted[i].y < sorted[first].x + sorted[first].y) first = i
  }
  return [sorted[first], sorted[(first + 1) % 4], sorted[(first + 2) % 4], sorted[(first + 3) % 4]]
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
