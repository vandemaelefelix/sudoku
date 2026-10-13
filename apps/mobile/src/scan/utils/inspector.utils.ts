import type { Point, Quad, Rect } from '@/utils/geometry.utils'
import { project, unitToQuad } from '@/utils/homography.utils'

/** correct: the correction grid. photo: the capture with the detected corners. cutout: the flattened grid with the cell cuts. overlay: the capture with the 9 × 9 grid and the digits the model read. */
export type InspectorView = 'correct' | 'photo' | 'cutout' | 'overlay'

export type Segment = { from: Point; to: Point }

/** The rect of an image of imageWidth × imageHeight, drawn as large as fits in the region and centred in it. */
export function fitRect(imageWidth: number, imageHeight: number, region: Rect): Rect {
  const scale = Math.min(region.width / imageWidth, region.height / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale
  return { x: region.x + (region.width - width) / 2, y: region.y + (region.height - height) / 2, width, height }
}

/** The quad (normalised to the photo) in the points of the rect the photo is drawn in. */
export function quadInRect(quad: Quad, rect: Rect): Quad {
  const at = (p: Point): Point => ({ x: rect.x + p.x * rect.width, y: rect.y + p.y * rect.height })
  return [at(quad[0]), at(quad[1]), at(quad[2]), at(quad[3])]
}

/**
 * The 10 column lines and the 10 row lines of the 9 × 9 grid inside the quad, and the centre of each of the 81 cells.
 * A perspective transform keeps lines straight, so each line is one segment. Null when the quad is degenerate.
 */
export function projectGrid(quad: Quad): { lines: Segment[]; centres: Point[] } | null {
  const m = unitToQuad(quad)
  if (m === null) return null
  const lines: Segment[] = []
  for (let i = 0; i <= 9; i++) {
    lines.push({ from: project(m, i / 9, 0), to: project(m, i / 9, 1) })
    lines.push({ from: project(m, 0, i / 9), to: project(m, 1, i / 9) })
  }
  const centres: Point[] = []
  for (let row = 0; row < 9; row++)
    for (let col = 0; col < 9; col++) centres.push(project(m, (col + 0.5) / 9, (row + 0.5) / 9))
  return { lines, centres }
}

/** The inner square of a cell that the model reads, in cell units of the 64 px cell: 6 px off each side (model contract). */
export const MODEL_CROP = { start: 6, size: 52, cell: 64 }
