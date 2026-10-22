import type { Rect, ViewSize } from '@/utils/geometry.utils'
import type { CellResult } from '@/scanner'
import { PaintStyle, Skia, type SkCanvas, type SkPaint } from '@shopify/react-native-skia'
import { project, type Homography } from '@/utils/homography.utils'
import type { CellLines } from '@/utils/selectionFrame.utils'
import { PANEL_HEIGHT, REVIEW_CONFIDENCE } from '@/scan/constants/correction.constants'
import type { Theme } from '@/theme/theme.types'

export type Insets = { top: number; bottom: number; left: number; right: number }
/**
 * bar: Retake, the title and the dev menu. title: the large title block under the bar, 0 high in a theme without one.
 * panel: the bottom panel at its smallest, down to the bottom edge. panelInset: the extra side padding of the panel
 * content, so the content keeps the width of the bar and the grid. 0 on an iPhone.
 */
export type CorrectionLayout = { bar: Rect; title: Rect; grid: Rect; panel: Rect; panelInset: number }

const MARGIN = 16
const BAR_HEIGHT = 48
const GAP = 12
const GRID_TOP_GAP = 28

/**
 * Points, not rounded. The transition and the correction screen both read this, so the last frame matches the screen.
 * titleBlock: the theme token size.titleBlock. panelEdge: the theme token size.panelEdge, which adds to the panel height.
 * content: the theme token size.content, the widest content. An iPad centres the content in it.
 */
export function correctionLayout(
  view: ViewSize,
  insets: Insets,
  titleBlock = 0,
  panelEdge = 0,
  content = Infinity,
): CorrectionLayout {
  'worklet'
  const fullWidth = view.width - 2 * MARGIN - insets.left - insets.right
  const contentWidth = Math.min(fullWidth, content)
  const panelInset = (fullWidth - contentWidth) / 2
  const contentLeft = insets.left + MARGIN + panelInset
  const bar: Rect = { x: contentLeft, y: insets.top, width: contentWidth, height: BAR_HEIGHT }
  const title: Rect = { x: contentLeft, y: bar.y + bar.height, width: contentWidth, height: titleBlock }
  const panelHeight = PANEL_HEIGHT + panelEdge + insets.bottom
  const panelTop = view.height - panelHeight
  const panel: Rect = { x: 0, y: panelTop, width: view.width, height: panelHeight }
  const gridTop = title.y + title.height + (titleBlock > 0 ? GAP : GRID_TOP_GAP)
  const side = Math.max(0, Math.min(contentWidth, panelTop - GAP - gridTop))
  const grid: Rect = { x: contentLeft + (contentWidth - side) / 2, y: gridTop, width: side, height: side }
  return { bar, title, grid, panel, panelInset }
}

/** given and entry hold a digit. notes: the paper cell has pencil marks, the game loads it empty. */
export type CellStyle = 'given' | 'entry' | 'notes' | 'empty'

export type CellLook = { digit: string; style: CellStyle; uncertain: boolean }

/** threshold: the ring threshold. A cell below it, or with a digit and a kind that do not fit, gets a ring. */
export function cellLook(cell: CellResult, threshold: number = REVIEW_CONFIDENCE): CellLook {
  'worklet'
  const uncertain = cell.confidence < threshold || !cell.validPair
  if (cell.kind === 'notes' && cell.digit === 0) return { digit: '', style: 'notes', uncertain }
  if (cell.digit === 0 || cell.kind === 'none' || cell.kind === 'notes') return { digit: '', style: 'empty', uncertain }
  return { digit: String(cell.digit), style: cell.kind === 'printed' ? 'given' : 'entry', uncertain }
}

/** True for a look that shows a digit. */
export function hasDigit(look: CellLook): boolean {
  return look.style === 'given' || look.style === 'entry'
}

export function cellsToCheck(looks: readonly CellLook[]): number {
  return looks.filter((look) => look.uncertain).length
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

/**
 * The centres of the four lines around a cell of the correction grid, in points from its top-left corner. The lines run
 * from half the frame width inside one edge to the same inside the other, as drawGridLines draws them on the screen.
 */
export function correctionCellLines(cell: number, side: number, frameWidth: number): CellLines {
  const inset = frameWidth / 2
  const step = (side - 2 * inset) / 9
  const row = Math.floor(cell / 9)
  const column = cell % 9
  return {
    left: inset + column * step,
    right: inset + (column + 1) * step,
    top: inset + row * step,
    bottom: inset + (row + 1) * step,
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
