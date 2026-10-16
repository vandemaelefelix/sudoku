import { memo } from 'react'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { ringsAt, shiftOf, type SweepTiming } from '@/scan/utils/transition.utils'
import { RING_INSET } from './CorrectionRing.constants'
import { styles } from './CorrectionRing.styles'

/** active: the cell is open in the panel, so its ring turns solid. */
type CorrectionRingProps = SweepTiming & { n: number; size: number; left: number; top: number; active?: boolean }

/** The dashed ring around an uncertain cell. n: the cell index, row-major. */
export const CorrectionRing = memo(function CorrectionRing({
  n,
  size,
  left,
  top,
  active = false,
  clock,
  resultsAt,
  reduceMotion,
}: CorrectionRingProps) {
  const style = useAnimatedStyle(() => {
    if (!clock) return { opacity: 1 }
    const t = clock.value
    return { opacity: ringsAt(t, reduceMotion, shiftOf(t, resultsAt, reduceMotion)) }
  })
  return (
    <Animated.View
      testID={`correction-ring-${n}`}
      pointerEvents="none"
      style={[
        styles.ring,
        active && styles.active,
        {
          left: left + RING_INSET,
          top: top + RING_INSET,
          width: size - 2 * RING_INSET,
          height: size - 2 * RING_INSET,
        },
        style,
      ]}
    />
  )
})
