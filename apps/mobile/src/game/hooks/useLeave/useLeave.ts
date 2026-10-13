import { useCallback, useEffect, useRef } from 'react'
import { useReducedMotion, withTiming, type SharedValue } from 'react-native-reanimated'
import { UnistylesRuntime } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { easeIn, easeOut } from '@/utils/motion.utils'

/** A callback of a sheet button. A promise says that the screen may stay: a failed restart keeps the old screen. */
export type LeaveCallback = () => void | Promise<void>

/**
 * The exit of a sheet or a card before a new game shows. rise is the rise value of the sheet: 0 in place, 1 hidden.
 * leaveThen sinks the sheet, then calls next. Each later tap does nothing, so a second tap cannot start a second game.
 * When next returns a promise and the sheet is still there after it, the sheet rises again and takes taps again.
 * guard calls next at once, unless a leave runs. Reduce Motion skips the sink.
 */
export function useLeave(rise: SharedValue<number>) {
  const reduceMotion = useReducedMotion()
  const leaving = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const comeBack = useCallback(() => {
    if (!mounted.current) return
    leaving.current = false
    const duration = UnistylesRuntime.getTheme().motion.medium
    rise.set(reduceMotion ? 0 : withTiming(0, { duration, easing: easeOut }))
  }, [reduceMotion, rise])
  const call = useCallback(
    (next: LeaveCallback) => {
      const done = next()
      if (done) done.then(comeBack, comeBack)
    },
    [comeBack],
  )
  const leaveThen = useCallback(
    (next: LeaveCallback) => {
      if (leaving.current) return
      leaving.current = true
      if (reduceMotion) {
        call(next)
        return
      }
      const duration = UnistylesRuntime.getTheme().motion.short
      rise.set(
        withTiming(1, { duration, easing: easeIn }, (finished) => {
          if (finished) scheduleOnRN(call, next)
        }),
      )
    },
    [call, reduceMotion, rise],
  )
  const guard = useCallback((next: () => void) => {
    if (!leaving.current) next()
  }, [])
  return { leaveThen, guard }
}
