import type { Point, Quad } from '../../scanner'

/** Maps grid coordinates (u, v in 0..1) to view points: x = (m0·u + m1·v + m2) / (m6·u + m7·v + 1), y uses m3..m5. */
export type Homography = [number, number, number, number, number, number, number, number]

/** The lines of a sudoku grid in each direction, so 10 × 10 intersections. */
export const GRID_POINTS = 10

/** Null when the last three corners lie on one line. Heckbert's closed form for the unit square. Other degenerate quads give a matrix that `invert` refuses. */
export function unitToQuad(quad: Quad): Homography | null {
  'worklet'
  const p0 = quad[0]
  const p1 = quad[1]
  const p2 = quad[2]
  const p3 = quad[3]
  const dx1 = p1.x - p2.x
  const dx2 = p3.x - p2.x
  const dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y
  const dy2 = p3.y - p2.y
  const dy3 = p0.y - p1.y + p2.y - p3.y
  const den = dx1 * dy2 - dx2 * dy1
  if (Math.abs(den) < 1e-9) return null
  const g = (dx3 * dy2 - dx2 * dy3) / den
  const h = (dx1 * dy3 - dx3 * dy1) / den
  return [p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x, p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y, g, h]
}

export function project(m: Homography, u: number, v: number): Point {
  'worklet'
  const w = m[6] * u + m[7] * v + 1
  return { x: (m[0] * u + m[1] * v + m[2]) / w, y: (m[3] * u + m[4] * v + m[5]) / w }
}

/** Null when the matrix has no inverse. */
export function invert(m: Homography): Homography | null {
  'worklet'
  const a = m[0]
  const b = m[1]
  const c = m[2]
  const d = m[3]
  const e = m[4]
  const f = m[5]
  const g = m[6]
  const h = m[7]
  const det = a * (e - f * h) + b * (f * g - d) + c * (d * h - e * g)
  const last = a * e - b * d
  if (Math.abs(det) < 1e-12 || Math.abs(last) < 1e-12) return null
  return [
    (e - f * h) / last,
    (c * h - b) / last,
    (b * f - c * e) / last,
    (f * g - d) / last,
    (a - c * g) / last,
    (c * d - a * f) / last,
    (d * h - e * g) / last,
    (b * g - a * h) / last,
  ]
}

export function intersections(m: Homography): Point[] {
  'worklet'
  const points: Point[] = []
  for (let row = 0; row < GRID_POINTS; row++) {
    for (let column = 0; column < GRID_POINTS; column++) {
      points.push(project(m, column / (GRID_POINTS - 1), row / (GRID_POINTS - 1)))
    }
  }
  return points
}

/** index: row × 10 + column. True where two 3 × 3 box lines cross. */
export function isBoxCorner(index: number): boolean {
  'worklet'
  return (index % GRID_POINTS) % 3 === 0 && Math.floor(index / GRID_POINTS) % 3 === 0
}

/** margin: in grid coordinates. A point inside the grid plus its margin moves to the nearest side of the margin. */
export function pushOutside(p: Point, m: Homography, inverse: Homography, margin: number): Point {
  'worklet'
  const q = project(inverse, p.x, p.y)
  if (q.x < -margin || q.x > 1 + margin || q.y < -margin || q.y > 1 + margin) return p
  const left = q.x + margin
  const right = 1 + margin - q.x
  const top = q.y + margin
  const bottom = 1 + margin - q.y
  const least = Math.min(left, right, top, bottom)
  if (least === left) return project(m, -margin, q.y)
  if (least === right) return project(m, 1 + margin, q.y)
  if (least === top) return project(m, q.x, -margin)
  return project(m, q.x, 1 + margin)
}
