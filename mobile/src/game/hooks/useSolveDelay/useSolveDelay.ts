import { useEffect, useState } from 'react'
import { useReducedMotion } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { pulseLook, solvePulseDuration } from '@/utils/pulse.utils'

/** True when the game is won and its solve pulse is over. With Reduce Motion on, no pulse plays, so it is true at once. */
export function useSolveDelay(won: boolean): boolean {
  const { theme } = useUnistyles()
  const reduceMotion = useReducedMotion()
  const [pulseOver, setPulseOver] = useState(false)
  const waitMs = solvePulseDuration(pulseLook(theme))

  useEffect(() => {
    if (!won || reduceMotion) return
    const timer = setTimeout(() => setPulseOver(true), waitMs)
    return () => clearTimeout(timer)
  }, [won, reduceMotion, waitMs])

  return won && (reduceMotion || pulseOver)
}
