import type { Point } from '@/scanner'

function pushPair(
  points: Point[],
  next: Point[],
  movable: boolean[],
  a: number,
  b: number,
  radius: number,
  push: number,
) {
  'worklet'
  const dx = points[a].x - points[b].x
  const dy = points[a].y - points[b].y
  const distance = Math.hypot(dx, dy)
  if (distance >= radius || distance < 1e-6) return
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

/** Above this many cells per point the points are too spread out for a grid to pay off. */
const MAX_CELLS_PER_POINT = 8

/** radius, push: points. Two points closer than the radius push each other apart by up to `push` each. */
export function spreadStep(points: Point[], movable: boolean[], radius: number, push: number): Point[] {
  'worklet'
  const n = points.length
  const next: Point[] = []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < n; i++) {
    next.push({ x: points[i].x, y: points[i].y })
    minX = Math.min(minX, points[i].x)
    minY = Math.min(minY, points[i].y)
    maxX = Math.max(maxX, points[i].x)
    maxY = Math.max(maxY, points[i].y)
  }
  const columns = Math.floor((maxX - minX) / radius) + 1
  const rows = Math.floor((maxY - minY) / radius) + 1
  // A NaN or infinite point, or a huge extent, has no usable cell. Comparing all pairs gives the same result.
  if (!(columns * rows <= MAX_CELLS_PER_POINT * n + 16)) {
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pushPair(points, next, movable, a, b, radius, push)
    return next
  }
  const cellOf: number[] = []
  const start: number[] = []
  for (let c = 0; c <= columns * rows; c++) start.push(0)
  for (let i = 0; i < n; i++) {
    const cell = Math.floor((points[i].y - minY) / radius) * columns + Math.floor((points[i].x - minX) / radius)
    cellOf.push(cell)
    start[cell + 1]++
  }
  for (let c = 0; c < columns * rows; c++) start[c + 1] += start[c]
  const fill: number[] = start.slice(0, columns * rows)
  const members: number[] = []
  for (let i = 0; i < n; i++) members.push(0)
  for (let i = 0; i < n; i++) members[fill[cellOf[i]]++] = i
  // Partners go in ascending index order, so each sum adds up in the same order as a pass over all pairs.
  const partners: number[] = []
  for (let a = 0; a < n; a++) {
    partners.length = 0
    const cx = cellOf[a] % columns
    const cy = (cellOf[a] - cx) / columns
    for (let y = Math.max(0, cy - 1); y <= Math.min(rows - 1, cy + 1); y++) {
      for (let x = Math.max(0, cx - 1); x <= Math.min(columns - 1, cx + 1); x++) {
        const cell = y * columns + x
        for (let m = start[cell]; m < start[cell + 1]; m++) if (members[m] > a) partners.push(members[m])
      }
    }
    for (let i = 1; i < partners.length; i++) {
      const value = partners[i]
      let j = i - 1
      while (j >= 0 && partners[j] > value) {
        partners[j + 1] = partners[j]
        j--
      }
      partners[j + 1] = value
    }
    for (let i = 0; i < partners.length; i++) pushPair(points, next, movable, a, partners[i], radius, push)
  }
  return next
}
