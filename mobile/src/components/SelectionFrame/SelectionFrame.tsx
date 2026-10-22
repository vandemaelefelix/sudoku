import Animated, { LinearTransition } from 'react-native-reanimated'
import { easeOut } from '@/utils/motion.utils'
import type { FrameRect } from '@/utils/selectionFrame.utils'
import { FRAME_SLIDE_MS } from './SelectionFrame.constants'
import { styles } from './SelectionFrame.styles'

// A layout transition follows the system setting, so with Reduce Motion the frame jumps to the new cell.
const SLIDE = LinearTransition.duration(FRAME_SLIDE_MS).easing(easeOut)

type SelectionFrameProps = {
  /** The frame from selectionFrame, in the coordinates of the parent. Null: no cell is selected. */
  rect: FrameRect | null
  /** The stroke width in points. */
  width: number
}

/**
 * The frame of the selected cell, drawn above the grid lines (ADR-026, amendment of 2026-10-22). It slides to a new cell.
 * It appears and goes at once, so a pause or an open hint hides it without motion.
 */
export function SelectionFrame({ rect, width }: SelectionFrameProps) {
  if (rect === null) return null
  return (
    <Animated.View
      testID="selection-frame"
      layout={SLIDE}
      style={[
        styles.frame,
        { left: rect.left, top: rect.top, width: rect.width, height: rect.height, borderWidth: width },
      ]}
    />
  )
}
