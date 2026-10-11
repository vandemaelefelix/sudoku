import type { Rect, ViewSize } from '@/utils/geometry.utils'
import type { CellResult } from '@/scanner'
import { PaintStyle, Skia, type SkCanvas, type SkPaint } from '@shopify/react-native-skia'
import { project, type Homography } from '@/utils/homography.utils'

export type Insets = { top: number; bottom: number; left: number; right: number }
export type CorrectionLayout = { title: Rect; grid: Rect; panel: Rect }

const MARGIN = 16
const TITLE_TOP = 8
const TITLE_HEIGHT = 52
const GAP = 12
const PANEL_SIDE = 10
const PANEL_HEIGHT = 168

/** Points, not rounded. The transition and the correction screen both read this, so the last frame matches the screen. */
export function correctionLayout(view: ViewSize, insets: Insets): CorrectionLayout {
  'worklet'
  const contentLeft = insets.left + MARGIN
  const contentWidth = view.width - 2 * MARGIN - insets.left - insets.right
  const title: Rect = { x: contentLeft, y: insets.top + TITLE_TOP, width: contentWidth, height: TITLE_HEIGHT }
  const panelTop = view.height - insets.bottom - GAP - PANEL_HEIGHT
  const panel: Rect = {
    x: PANEL_SIDE + insets.left,
    y: panelTop,
    width: view.width - 2 * PANEL_SIDE - insets.left - insets.right,
    height: PANEL_HEIGHT,
  }
  const gridTop = title.y + title.height + GAP
  const side = Math.max(0, Math.min(contentWidth, panelTop - GAP - gridTop))
  const grid: Rect = { x: contentLeft + (contentWidth - side) / 2, y: gridTop, width: side, height: side }
  return { title, grid, panel }
}

/** Provisional: the dev set has not yet fixed a threshold. */
export const REVIEW_CONFIDENCE = 0.9

export type CellLook = { digit: string; style: 'given' | 'entry' | 'empty'; uncertain: boolean }

export function cellLook(cell: CellResult): CellLook {
  'worklet'
  const uncertain = cell.confidence < REVIEW_CONFIDENCE || !cell.validPair
  if (cell.digit === 0 || cell.kind === 'none' || cell.kind === 'notes') return { digit: '', style: 'empty', uncertain }
  return { digit: String(cell.digit), style: cell.kind === 'printed' ? 'given' : 'entry', uncertain }
}

export function cellsToCheck(cells: CellResult[]): number {
  let count = 0
  for (const cell of cells) if (cellLook(cell).uncertain) count++
  return count
}

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
