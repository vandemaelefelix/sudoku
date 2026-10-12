import type { Rect, ViewSize } from '@/utils/geometry.utils'
import type { CellResult } from '@/scanner'
import { PaintStyle, Skia, type SkCanvas, type SkPaint } from '@shopify/react-native-skia'
import { project, type Homography } from '@/utils/homography.utils'
import { REVIEW_CONFIDENCE } from '@/scan/constants/correction.constants'
import type { Theme } from '@/theme/theme.types'

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

/** The colours and widths (points) of the grid lines. frame: the outer square. box: the lines between the 3 × 3 boxes. */
export type GridLineStyle = {
  frame: string
  box: string
  cell: string
  frameWidth: number
  boxWidth: number
  cellWidth: number
}

export function gridLineStyle(theme: Theme): GridLineStyle {
  const { grid } = theme.components
  const { gridLine } = theme.shape
  return {
    frame: grid.frame,
    box: grid.boxLine,
    cell: grid.cellLine,
    frameWidth: gridLine.outer,
    boxWidth: gridLine.box,
    cellWidth: gridLine.cell,
  }
}

/** 0: a cell line, 1: a box line, 2: a frame line. i: the line index, 0..9. */
function lineKind(i: number): number {
  'worklet'
  if (i === 0 || i === 9) return 2
  return i % 3 === 0 ? 1 : 0
}

/** Draws the 20 lines of the grid that m maps the unit square onto. grow 0..1: each line grows from its middle. */
export function drawGridLines(
  canvas: SkCanvas,
  paint: SkPaint,
  m: Homography,
  grow: number,
  style: GridLineStyle,
): void {
  'worklet'
  if (grow <= 0) return
  const from = 0.5 - grow / 2
  const to = 0.5 + grow / 2
  paint.setStyle(PaintStyle.Stroke)
  // The frame comes last and the cell lines first, so a crossing shows the stronger line.
  for (let kind = 0; kind <= 2; kind++) {
    paint.setColor(Skia.Color(kind === 2 ? style.frame : kind === 1 ? style.box : style.cell))
    paint.setStrokeWidth(kind === 2 ? style.frameWidth : kind === 1 ? style.boxWidth : style.cellWidth)
    for (let i = 0; i <= 9; i++) {
      if (lineKind(i) !== kind) continue
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
