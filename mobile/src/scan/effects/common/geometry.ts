import type { Point } from '@/utils/geometry.utils'
import { type Homography, project } from '@/utils/homography.utils'
import { GRID_POINTS } from './common.constants'

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
