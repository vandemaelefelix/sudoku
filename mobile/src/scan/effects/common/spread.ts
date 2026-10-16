import type { Point } from '@/utils/geometry.utils'

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
  const pa = points[a]
  const pb = points[b]
  if (pa === undefined || pb === undefined) return
  const dx = pa.x - pb.x
  const dy = pa.y - pb.y
  const distance = Math.hypot(dx, dy)
  if (distance >= radius || distance < 1e-6) return
  const k = ((radius - distance) / radius) * push
  const ux = (dx / distance) * k
  const uy = (dy / distance) * k
  const na = next[a]
  if (movable[a] && na !== undefined) {
    na.x += ux
    na.y += uy
  }
  const nb = next[b]
  if (movable[b] && nb !== undefined) {
    nb.x -= ux
    nb.y -= uy
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
  for (const p of points) {
    next.push({ x: p.x, y: p.y })
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
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
  for (const p of points) {
    const cell = Math.floor((p.y - minY) / radius) * columns + Math.floor((p.x - minX) / radius)
    cellOf.push(cell)
    start[cell + 1] = (start[cell + 1] ?? 0) + 1
  }
  for (let c = 0; c < columns * rows; c++) start[c + 1] = (start[c + 1] ?? 0) + (start[c] ?? 0)
  const fill: number[] = start.slice(0, columns * rows)
  const members: number[] = []
  for (let i = 0; i < n; i++) members.push(0)
  for (let i = 0; i < cellOf.length; i++) {
    const cell = cellOf[i]
    if (cell === undefined) continue
    const slot = fill[cell] ?? 0
    fill[cell] = slot + 1
    members[slot] = i
  }
  // Partners go in ascending index order, so each sum adds up in the same order as a pass over all pairs.
  const partners: number[] = []
  for (let a = 0; a < cellOf.length; a++) {
    const cellA = cellOf[a]
    if (cellA === undefined) continue
    partners.length = 0
    const cx = cellA % columns
    const cy = (cellA - cx) / columns
    for (let y = Math.max(0, cy - 1); y <= Math.min(rows - 1, cy + 1); y++) {
      for (let x = Math.max(0, cx - 1); x <= Math.min(columns - 1, cx + 1); x++) {
        const cell = y * columns + x
        const end = start[cell + 1] ?? 0
        for (let m = start[cell] ?? 0; m < end; m++) {
          const member = members[m]
          if (member !== undefined && member > a) partners.push(member)
        }
      }
    }
    for (let i = 1; i < partners.length; i++) {
      const value = partners[i]
      if (value === undefined) continue
      let j = i - 1
      let previous = partners[j]
      while (previous !== undefined && previous > value) {
        partners[j + 1] = previous
        j--
        previous = partners[j]
      }
      partners[j + 1] = value
    }
    for (const partner of partners) pushPair(points, next, movable, a, partner, radius, push)
  }
  return next
}
