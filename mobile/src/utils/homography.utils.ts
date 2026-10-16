import type { Point, Quad } from './geometry.utils'

/** Maps grid coordinates (u, v in 0..1) to view points: x = (m0·u + m1·v + m2) / (m6·u + m7·v + 1), y uses m3..m5. */
export type Homography = [number, number, number, number, number, number, number, number]

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
  if (!(Math.abs(den) >= 1e-9)) return null
  const g = (dx3 * dy2 - dx2 * dy3) / den
  const h = (dx1 * dy3 - dx3 * dy1) / den
  const m: Homography = [
    p1.x - p0.x + g * p1.x,
    p3.x - p0.x + h * p3.x,
    p0.x,
    p1.y - p0.y + g * p1.y,
    p3.y - p0.y + h * p3.y,
    p0.y,
    g,
    h,
  ]
  // A NaN or an Infinity in any corner shows in the sum.
  return Number.isFinite(m[0] + m[1] + m[2] + m[3] + m[4] + m[5] + m[6] + m[7]) ? m : null
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
  if (!(Math.abs(det) >= 1e-12) || !(Math.abs(last) >= 1e-12)) return null
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
