import { useEffect, useMemo } from 'react'
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import { columnOf, rowOf } from '@/game/utils/grid.utils'
import { easeOut } from '@/utils/motion.utils'
import { LINE_CELLS, TILE_SLIDE_MS } from './useSelectionTile.constants'

/**
 * The tile of the selected cell (ADR-026). row and column: where it lies, in cells, fractional while it slides.
 * pitch: the points from one cell to the next. shown: 1 while a cell is selected, else 0.
 */
export type SelectionTile = {
  row: SharedValue<number>
  column: SharedValue<number>
  pitch: SharedValue<number>
  shown: SharedValue<number>
}

/**
 * Moves the tile to the selected cell on the UI thread, so the slide renders no cell. The timing follows the system
 * Reduce Motion, so with it on the tile jumps. The tile appears and goes at once: a pause or a hint hides it without a slide.
 */
export function useSelectionTile(cell: number | null, side: number): SelectionTile {
  const row = useSharedValue(0)
  const column = useSharedValue(0)
  const pitch = useSharedValue(0)
  const shown = useSharedValue(0)
  useEffect(() => {
    pitch.set(side / LINE_CELLS)
  }, [side, pitch])
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
  return useMemo(() => ({ row, column, pitch, shown }), [row, column, pitch, shown])
}
