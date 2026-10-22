import { useEffect, useMemo } from 'react'
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import { UnistylesRuntime } from 'react-native-unistyles'
import { columnOf, rowOf } from '@/game/utils/grid.utils'
import { easeOut } from '@/utils/motion.utils'
import { LINE_CELLS, TILE_SLIDE_MS } from './useSelectionTile.constants'

/**
 * The tile of the selected cell (ADR-026). row and column: where it lies, in cells, fractional while it slides.
 * step: the points from one cell to the next inside a box, 0 before the grid has its size. boxExtra: the points that a
 * box line adds to a step. shown: 1 while a cell is selected, else 0.
 */
export type SelectionTile = {
  row: SharedValue<number>
  column: SharedValue<number>
  step: SharedValue<number>
  boxExtra: SharedValue<number>
  shown: SharedValue<number>
}

/**
 * Moves the tile to the selected cell on the UI thread, so the slide renders no cell. The timing follows the system
 * Reduce Motion, so with it on the tile jumps. The tile appears and goes at once: a pause or a hint hides it without a slide.
 */
export function useSelectionTile(cell: number | null, side: number): SelectionTile {
  const row = useSharedValue(0)
  const column = useSharedValue(0)
  const step = useSharedValue(0)
  const boxExtra = useSharedValue(0)
  const shown = useSharedValue(0)
  useEffect(() => {
    // The lines are the gaps between the cells (ADR-015). Every look has the same line widths, so a theme switch needs no update.
    const { outer, box, cell: line } = UnistylesRuntime.getTheme().shape.gridLine
    const cellSize = (side - 2 * outer - 2 * box - (LINE_CELLS - 3) * line) / LINE_CELLS
    step.set(side > 0 ? cellSize + line : 0)
    boxExtra.set(box - line)
  }, [side, step, boxExtra])
  useEffect(() => {
    if (cell === null) {
      shown.set(0)
      return
    }
    if (shown.get() === 0) {
      row.set(rowOf(cell))
      column.set(columnOf(cell))
      shown.set(1)
      return
    }
    const timing = { duration: TILE_SLIDE_MS, easing: easeOut }
    row.set(withTiming(rowOf(cell), timing))
    column.set(withTiming(columnOf(cell), timing))
  }, [cell, row, column, shown])
  return useMemo(() => ({ row, column, step, boxExtra, shown }), [row, column, step, boxExtra, shown])
}
