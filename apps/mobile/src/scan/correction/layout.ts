import type { ViewSize } from '../previewMapping'

export type Rect = { x: number; y: number; width: number; height: number }
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
