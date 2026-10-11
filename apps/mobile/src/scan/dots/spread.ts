import type { Point } from '../../scanner'

/** radius, push: points. Two points closer than the radius push each other apart by up to `push` each. */
export function spreadStep(points: Point[], movable: boolean[], radius: number, push: number): Point[] {
  'worklet'
  const next: Point[] = []
  for (let i = 0; i < points.length; i++) next.push({ x: points[i].x, y: points[i].y })
  for (let a = 0; a < points.length; a++) {
    for (let b = a + 1; b < points.length; b++) {
      const dx = points[a].x - points[b].x
      const dy = points[a].y - points[b].y
      const distance = Math.hypot(dx, dy)
      if (distance >= radius || distance < 1e-6) continue
      const k = ((radius - distance) / radius) * push
      const ux = (dx / distance) * k
      const uy = (dy / distance) * k
      if (movable[a]) {
        next[a].x += ux
        next[a].y += uy
      }
      if (movable[b]) {
        next[b].x -= ux
        next[b].y -= uy
      }
    }
  }
  return next
}
