export type Point = { x: number; y: number }
/** Corners in order TL, TR, BR, BL. */
export type Quad = [Point, Point, Point, Point]
export type Rect = { x: number; y: number; width: number; height: number }
export type ViewSize = { width: number; height: number }

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

/** The largest distance between matching corners of a and b, in the unit of the points. The lock-on drift, the jitter report and the corner offset of the scanner all measure it. */
export function largestCornerStep(a: Quad, b: Quad): number {
  'worklet'
  const [a0, a1, a2, a3] = a
  const [b0, b1, b2, b3] = b
  return Math.max(
    0,
    Math.hypot(a0.x - b0.x, a0.y - b0.y),
    Math.hypot(a1.x - b1.x, a1.y - b1.y),
    Math.hypot(a2.x - b2.x, a2.y - b2.y),
    Math.hypot(a3.x - b3.x, a3.y - b3.y),
  )
}
