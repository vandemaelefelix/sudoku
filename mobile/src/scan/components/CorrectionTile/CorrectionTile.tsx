import Animated, { LinearTransition } from 'react-native-reanimated'
import { easeOut } from '@/utils/motion.utils'
import { TILE_SLIDE_MS } from './CorrectionTile.constants'
import { styles } from './CorrectionTile.styles'

// A layout transition follows the system setting, so with Reduce Motion the tile jumps to the new cell.
const SLIDE = LinearTransition.duration(TILE_SLIDE_MS).easing(easeOut)

/** The square of a cell on the screen, in points. */
export type TileRect = { left: number; top: number; size: number }

/**
 * The tile of the open cell (ADR-026). It lies under the cells, so the digit stays on top, and under the line canvas,
 * so no grid line doubles. It slides to a new cell, and appears and goes at once.
 */
export function CorrectionTile({ rect }: { rect: TileRect | null }) {
  if (rect === null) return null
  return (
    <Animated.View
      testID="correction-tile"
      layout={SLIDE}
      style={[styles.tile, { left: rect.left, top: rect.top, width: rect.size, height: rect.size }]}
    />
  )
}
