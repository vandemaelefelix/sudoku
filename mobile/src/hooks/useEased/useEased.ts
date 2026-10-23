import { useEffect } from 'react'
import { ReduceMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import { UnistylesRuntime } from 'react-native-unistyles'
import { easeOut } from '@/utils/motion.utils'

/**
 * A value that eases to target each time target changes. The first render starts at target, so a mount does not animate.
 * It ignores Reduce Motion: use it for fades, and drop the movement with useReducedMotion. durationMs defaults to the
 * short motion of the theme.
 */
export function useEased(target: number, durationMs?: number): SharedValue<number> {
  const value = useSharedValue(target)
  useEffect(() => {
    const duration = durationMs ?? UnistylesRuntime.getTheme().motion.short
    value.set(withTiming(target, { duration, easing: easeOut, reduceMotion: ReduceMotion.Never }))
  }, [target, durationMs, value])
  return value
}
