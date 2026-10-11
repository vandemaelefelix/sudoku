import { PaintStyle, Skia, type SkCanvas, type SkPaint } from '@shopify/react-native-skia'
import { project, type Homography } from '@/utils/homography.utils'

const BOX_WIDTH = 2
const CELL_WIDTH = 1

/** Draws the 20 lines of the grid that m maps the unit square onto. grow 0..1: each line grows from its middle. Box lines 2 pt in ink, cell lines 1 pt in the line colour. */
export function drawGridLines(
  canvas: SkCanvas,
  paint: SkPaint,
  m: Homography,
  grow: number,
  ink: string,
  line: string,
): void {
  'worklet'
  if (grow <= 0) return
  const from = 0.5 - grow / 2
  const to = 0.5 + grow / 2
  paint.setStyle(PaintStyle.Stroke)
  // The box lines come last, so a crossing shows the ink.
  for (const box of [false, true]) {
    paint.setColor(Skia.Color(box ? ink : line))
    paint.setStrokeWidth(box ? BOX_WIDTH : CELL_WIDTH)
    for (let i = 0; i <= 9; i++) {
      if ((i % 3 === 0) !== box) continue
      const t = i / 9
      const h0 = project(m, from, t)
      const h1 = project(m, to, t)
      canvas.drawLine(h0.x, h0.y, h1.x, h1.y, paint)
      const v0 = project(m, t, from)
      const v1 = project(m, t, to)
      canvas.drawLine(v0.x, v0.y, v1.x, v1.y, paint)
    }
  }
}
