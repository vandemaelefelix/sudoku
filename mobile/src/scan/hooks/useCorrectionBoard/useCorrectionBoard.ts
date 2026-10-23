import { Skia, createPicture, type SkPicture } from '@shopify/react-native-skia'
import { useMemo } from 'react'
import { useUnistyles } from 'react-native-unistyles'
import { boardLinesMatrix, drawGridLines, gridLineStyle } from '@/scan/utils/correction.utils'

/**
 * The two pictures of the grid, for a square of `side` points. The cell fill lies under the cells and the lines lie over them, so the
 * fill of an open or conflicting cell never covers a grid line. The pictures are made again when the theme changes (ADR-015, point 10).
 */
export function useCorrectionBoard(side: number): { board: SkPicture; lines: SkPicture } {
  const { theme } = useUnistyles()
  return useMemo(() => {
    const lineStyle = gridLineStyle(theme)
    // The transition canvas fills the cells with the same token, so nothing jumps at the handoff.
    const cellFill = theme.components.cell.fill
    const bounds = { x: 0, y: 0, width: side, height: side }
    return {
      board: createPicture((canvas) => {
        const fill = Skia.Paint()
        fill.setColor(Skia.Color(cellFill))
        canvas.drawRect(Skia.XYWHRect(0, 0, side, side), fill)
      }, bounds),
      lines: createPicture(
        (canvas) => drawGridLines(canvas, Skia.Paint(), boardLinesMatrix(side, lineStyle.frameWidth), 1, lineStyle),
        bounds,
      ),
    }
  }, [side, theme])
}
