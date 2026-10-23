import { useEffect, type ReactNode } from 'react'
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import {
  FLASH_IN_MS,
  FLASH_OUT_MS,
  HINT_PEAK,
  SHAKE_STEP_MS,
  SHAKE_STEPS,
  UNDO_PEAK,
} from '@/game/constants/mark.constants'
import { easeOut } from '@/utils/motion.utils'
import { styles } from './Cell.styles'

/** The digit of a mistake shakes once. Reduce Motion keeps it still: the colour of the digit already tells. */
export function MistakeShake({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion()
  const offset = useSharedValue(0)
  useEffect(() => {
    if (reduceMotion) return
    const steps = SHAKE_STEPS.map((to) => withTiming(to, { duration: SHAKE_STEP_MS, easing: easeOut }))
    offset.set(withSequence(...steps))
  }, [offset, reduceMotion])
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }))
  return <Animated.View style={style}>{children}</Animated.View>
}

/** A glow that rises and fades once over the cell: accent for a hint, quiet for an undo. A fade moves nothing, so Reduce Motion keeps it. */
export function CellFlash({ kind }: { kind: 'hint' | 'undo' }) {
  const opacity = useSharedValue(0)
  useEffect(() => {
    const peak = kind === 'hint' ? HINT_PEAK : UNDO_PEAK
    opacity.set(
      withSequence(
        withTiming(peak, { duration: FLASH_IN_MS, easing: easeOut, reduceMotion: ReduceMotion.Never }),
        withTiming(0, { duration: FLASH_OUT_MS, easing: easeOut, reduceMotion: ReduceMotion.Never }),
      ),
    )
  }, [kind, opacity])
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }))
  return (
    <Animated.View
      testID={`cell-flash-${kind}`}
      style={[styles.flash, kind === 'hint' ? styles.flashHint : styles.flashUndo, style]}
    />
  )
}
