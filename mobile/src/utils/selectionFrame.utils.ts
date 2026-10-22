/** A frame in points, from the top-left corner of its grid. */
export type FrameRect = { left: number; top: number; width: number; height: number }

/** The centres of the four grid lines around a cell, in points from the top-left corner of the grid. */
export type CellLines = { left: number; right: number; top: number; bottom: number }

/**
 * The frame of the selected cell (ADR-026, amendment of 2026-10-22). Its stroke of `width` points is centred on each line
 * around the cell, so it covers that line: never a line beside the frame. It stays inside the grid of `side` points.
 */
export function selectionFrame(lines: CellLines, width: number, side: number): FrameRect {
  const half = width / 2
  const left = Math.max(0, lines.left - half)
  const top = Math.max(0, lines.top - half)
  const right = Math.min(side, lines.right + half)
  const bottom = Math.min(side, lines.bottom + half)
  return { left, top, width: right - left, height: bottom - top }
}
