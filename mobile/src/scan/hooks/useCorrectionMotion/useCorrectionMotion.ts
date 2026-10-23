import {
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { panelAt, resultsGateReached, shiftOf, transitionAt, type SweepTiming } from '@/scan/utils/transition.utils'
import { easeOut } from '@/utils/motion.utils'
import { FAILURE_SLIDE_MS, PANEL_HIDDEN, WAITING_FADE_MS } from './useCorrectionMotion.constants'

/**
 * The animated styles that the transition drives, and motion: the state changes of the panel may play their swap. motion is false
 * in the cross-fade and with Reduce Motion. Without a clock (the review) every layer shows.
 * waiting: the results gate held longer than SPINNER_DELAY. panelHeight: points, for the slide from off screen.
 */
export function useCorrectionMotion({
  timing,
  waiting,
  failed,
  panelHeight,
}: {
  timing: SweepTiming
  waiting: SharedValue<boolean> | undefined
  failed: boolean
  panelHeight: number
}) {
  const { clock, resultsAt, crossFade } = timing
  const systemReduceMotion = useReducedMotion()
  const motion = !(crossFade || systemReduceMotion)

  const titleStyle = useAnimatedStyle(() => ({ opacity: clock ? transitionAt(clock.value, crossFade).title : 1 }))
  // A failure keeps the results gate closed, so the clock never reaches the panel ramp. The failure panel slides in on its own
  // timing instead, from the moment the clock reaches the results gate (any held clock in the cross-fade).
  const failureSlide = useSharedValue(0)
  useAnimatedReaction(
    () => failed && resultsGateReached(clock?.value, crossFade),
    (go, previous) => {
      if (go === previous) return
      failureSlide.set(go ? withTiming(1, { duration: FAILURE_SLIDE_MS, easing: easeOut }) : 0)
    },
  )
  const panelStyle = useAnimatedStyle(() => {
    let slide = 1
    if (clock) {
      const t = clock.value
      slide = failed ? failureSlide.value : panelAt(t, crossFade, shiftOf(t, resultsAt, crossFade))
    }
    return { transform: [{ translateY: (1 - slide) * PANEL_HIDDEN * panelHeight }] }
  })
  const waitingStyle = useAnimatedStyle(() => ({
    opacity: withTiming(waiting?.value ? 1 : 0, { duration: WAITING_FADE_MS, easing: easeOut }),
  }))
  return { motion, titleStyle, panelStyle, waitingStyle }
}
