import { useEffect } from 'react'
import { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { easeOut } from '@/utils/motion.utils'
import { RISE_OFFSET } from './useSheetRise.constants'

/**
 * The rise of the game-over sheet and the finish card. onLanded runs on the JS thread when the rise ends, or at once
 * with Reduce Motion. It must keep its identity, or the rise starts again.
 * rise is 1 at the start and 0 at the end. Pass it to useLeave, which sinks the sheet again.
 */
export function useSheetRise(onLanded: () => void) {
  const { theme } = useUnistyles()
  const reduceMotion = useReducedMotion()
  // With Reduce Motion the sheet starts at its end.
  const rise = useSharedValue(reduceMotion ? 0 : 1)
  useEffect(() => {
    if (reduceMotion) {
      onLanded()
      return
    }
    rise.set(
      withTiming(0, { duration: theme.motion.medium, easing: easeOut }, (finished) => {
        if (finished) scheduleOnRN(onLanded)
      }),
    )
  }, [onLanded, reduceMotion, rise, theme.motion.medium])
  // The scrim fades with the rise, so the board does not go dark before the sheet arrives.
  const fadeStyle = useAnimatedStyle(() => ({ opacity: 1 - rise.value }))
  const riseStyle = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value * RISE_OFFSET }] }))
  return { rise, fadeStyle, riseStyle }
}
