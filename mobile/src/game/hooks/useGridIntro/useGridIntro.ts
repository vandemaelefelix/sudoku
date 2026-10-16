import { useEffect, useState } from 'react'
import {
  Easing,
  ReduceMotion,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { UnistylesRuntime } from 'react-native-unistyles'
import { introDuration, introLook, type IntroLook } from '@/game/utils/intro.utils'

/** elapsed: ms since the grid mounted. look: the timing of the entrance. Read both with the intro.utils worklets. */
export type Intro = { elapsed: SharedValue<number>; look: IntroLook }

/**
 * The entrance of the game grid: it runs once, when the grid mounts. The grid mounts with the screen, so the sweep
 * runs while the route slides in. It runs on the UI thread and renders nothing.
 */
export function useGridIntro(): Intro {
  const elapsed = useSharedValue(0)
  const reduced = useReducedMotion()
  // Read once at mount: the grid reads no theme hook (ADR-015), and a theme switch must not replay the entrance.
  const [intro] = useState<Intro>(() => ({ elapsed, look: introLook(UnistylesRuntime.getTheme(), reduced) }))
  useEffect(() => {
    const end = introDuration(intro.look)
    // Linear time: each cell applies its own delay and curve. Never: the look already follows Reduce Motion.
    intro.elapsed.set(withTiming(end, { duration: end, easing: Easing.linear, reduceMotion: ReduceMotion.Never }))
  }, [intro])
  return intro
}
