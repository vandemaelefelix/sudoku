import { View } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import type { SelectionTile } from '@/game/hooks/useSelectionTile'
import { columnOf, rowOf } from '@/utils/grid.utils'
import { styles } from './Cell.styles'

/**
 * This cell's part of the selection tile, above its fill and under its digit (ADR-026). Every cell draws the tile moved
 * by its distance from the cell, cut to its own square. So the tile slides as one, and never covers a grid line.
 */
export function TileLayer({ cell, tile }: { cell: number; tile: SelectionTile }) {
  const row = rowOf(cell)
  const column = columnOf(cell)
  const style = useAnimatedStyle(() => {
    const step = tile.step.get()
    const boxExtra = tile.boxExtra.get()
    // The point where cell line x starts: one step per cell, and the extra width of each box line before it.
    const at = (x: number) => x * step + Math.floor(x / 3) * boxExtra
    return {
      // Before the grid has its size, every cell would draw the tile at offset 0.
      opacity: step > 0 ? tile.shown.get() : 0,
      transform: [{ translateX: at(tile.column.get()) - at(column) }, { translateY: at(tile.row.get()) - at(row) }],
    }
  })
  return (
    <View style={styles.tileClip} pointerEvents="none">
      <Animated.View testID={`cell-${cell}-tile`} style={[styles.tile, style]} />
    </View>
  )
}
