import type { Rect } from './pixels'
import type { Point, Quad } from './quad'

/** The long side of the downscaled photo for the corner search. The live detector uses 640 too (DETECT_HEIGHT). */
export const DETECT_LONG_SIDE = 640

export function downscaleSize(width: number, height: number): { width: number; height: number } {
  'worklet'
  const scale = DETECT_LONG_SIDE / Math.max(width, height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** OpenCV puts pixel centres on integers. This is the inverse of toGridDetection, which adds 0.5. */
export function toPhotoPixels(quad: Quad, width: number, height: number): Point[] {
  'worklet'
  return quad.map((p) => ({ x: p.x * width - 0.5, y: p.y * height - 0.5 }))
}

/** The quad's bounding box in a width × height image, grown by grow × its size on each side and clamped to the image. */
export function searchRect(quad: Quad, width: number, height: number, grow: number): Rect {
  'worklet'
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  for (const p of quad) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const growX = grow * (maxX - minX)
  const growY = grow * (maxY - minY)
  const x0 = Math.max(0, Math.floor((minX - growX) * width))
  const y0 = Math.max(0, Math.floor((minY - growY) * height))
  const x1 = Math.min(width, Math.ceil((maxX + growX) * width))
  const y1 = Math.min(height, Math.ceil((maxY + growY) * height))
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

/** quad: normalised to the rect. Returns it normalised to the whole width × height image. */
export function fromCrop(quad: Quad, rect: Rect, width: number, height: number): Quad {
  'worklet'
  const map = (p: Point): Point => ({
    x: (p.x * rect.width + rect.x) / width,
    y: (p.y * rect.height + rect.y) / height,
  })
  return [map(quad[0]), map(quad[1]), map(quad[2]), map(quad[3])]
}

/** The largest distance between matching corners of a and b, as a share of b's mean side. Both quads are normalised to one width × height image. */
export function cornerOffset(a: Quad, b: Quad, width: number, height: number): number {
  'worklet'
  let sides = 0
  let largest = 0
  for (let i = 0; i < 4; i++) {
    const next = b[(i + 1) % 4]
    sides += Math.hypot((next.x - b[i].x) * width, (next.y - b[i].y) * height)
    largest = Math.max(largest, Math.hypot((a[i].x - b[i].x) * width, (a[i].y - b[i].y) * height))
  }
  return largest / (sides / 4)
}

/**
 * The 3 × 3 homography, row-major with h[8] = 1, that maps each from[i] to to[i]. Takes 4 points each.
 * Throws when the points give no unique transform, for example three collinear points.
 */
export function perspectiveTransform(from: Point[], to: Point[]): number[] {
  'worklet'
  // Rows of [a | b]: for each pair, h0 x + h1 y + h2 - X (h6 x + h7 y) = X and h3 x + h4 y + h5 - Y (h6 x + h7 y) = Y.
  const rows: number[][] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]
    const { x: u, y: v } = to[i]
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col
    for (let r = col + 1; r < 8; r++) if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r
    if (Math.abs(rows[pivot][col]) < 1e-9) throw new Error('the corners do not give a perspective transform')
    const swap = rows[col]
    rows[col] = rows[pivot]
    rows[pivot] = swap
    for (let r = 0; r < 8; r++) {
      if (r === col) continue
      const factor = rows[r][col] / rows[col][col]
      for (let c = col; c < 9; c++) rows[r][c] -= factor * rows[col][c]
    }
  }
  const h: number[] = []
  for (let r = 0; r < 8; r++) h.push(rows[r][8] / rows[r][r])
  h.push(1)
  return h
}
