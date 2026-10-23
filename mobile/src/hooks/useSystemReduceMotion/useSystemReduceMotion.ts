import { useEffect, useRef, type RefObject } from 'react'
import { AccessibilityInfo } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'

/**
 * A ref that follows the Reduce Motion setting of the system. Reanimated reads the setting only at app start, so the
 * hook also listens to the system. onEnable runs when the player turns the setting on. A ref, not state: a change of the
 * setting renders nothing.
 */
export function useSystemReduceMotion(onEnable?: () => void): RefObject<boolean> {
  const reduceMotion = useRef(useReducedMotion())
  useEffect(() => {
    const follow = (enabled: boolean) => {
      reduceMotion.current = enabled
      if (enabled) onEnable?.()
    }
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => mounted && follow(enabled))
      .catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', follow)
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [onEnable])
  return reduceMotion
}
