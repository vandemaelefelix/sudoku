import { useEffect, useMemo, useRef } from 'react'
import { AccessibilityInfo } from 'react-native'
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { UnistylesRuntime } from 'react-native-unistyles'
import { GRID_CELLS } from '@sudoku/core'
import { NO_PULSE } from '@/constants/pulse.constants'
import type { Pulse } from '@/hooks/usePulse'
import { pulseDuration, pulseLook, type PulseLook } from '@/utils/pulse.utils'
import { solvedDelays } from '@/scan/utils/solvedPulse.utils'

const STILL: readonly number[] = Array.from({ length: GRID_CELLS }, () => NO_PULSE)

/**
 * The pulse of a solved scan: it starts when `active` turns true, from the centre cell, with the theme tokens of the game pulse.
 * Reduce Motion keeps it still. The hook reads the live setting like usePulse does, because Reanimated reads it at app start only.
 */
export function useSolvedPulse(active: boolean): Pulse {
  const delays = useSharedValue<readonly number[]>(STILL)
  const elapsed = useSharedValue(0)
  const look = useSharedValue<PulseLook>(pulseLook(UnistylesRuntime.getTheme()))
  const reduceMotion = useRef(useReducedMotion())
  useEffect(() => {
    let mounted = true
    const follow = (enabled: boolean) => {
      reduceMotion.current = enabled
      if (!enabled) return
      cancelAnimation(elapsed)
      delays.set(STILL)
    }
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => mounted && follow(enabled))
      .catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', follow)
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [delays, elapsed])
  useEffect(() => {
    if (!active) {
      cancelAnimation(elapsed)
      delays.set(STILL)
      return
    }
    if (reduceMotion.current) return
    const next = pulseLook(UnistylesRuntime.getTheme())
    const nextDelays = solvedDelays(next.stepMs)
    const end = pulseDuration(nextDelays, next)
    cancelAnimation(elapsed)
    elapsed.set(0)
    look.set(next)
    delays.set(nextDelays)
    elapsed.set(withTiming(end, { duration: end, easing: Easing.linear, reduceMotion: ReduceMotion.Never }))
  }, [active, delays, elapsed, look])
  return useMemo(() => ({ delays, elapsed, look }), [delays, elapsed, look])
}
