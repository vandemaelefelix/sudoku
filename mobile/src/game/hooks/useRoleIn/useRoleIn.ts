import { useEffect } from 'react'
import { Easing, ReduceMotion, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated'
import { ROLE_FADE_MS } from '@/game/constants/hint.constants'
import type { HintMotion } from '@/game/hooks/useHintMotion'
import type { HintRole } from '@/game/utils/hint.utils'
import { ROLE_MS } from './useRoleIn.constants'

/** progress: 0 to 1, linear. reduced: the role only fades, without a pop, a sweep or a draw. */
export type RoleIn = { progress: SharedValue<number>; reduced: SharedValue<boolean> }

/**
 * The entrance of one hint role in one cell. It plays once, when the role mounts, at the start that the motion gives
 * this cell. So a role that stays on the grid through a rung change does not play again. Without motion, as in a
 * display grid, the role shows at once.
 */
export function useRoleIn(motion: HintMotion | undefined, role: HintRole, cell: number): RoleIn {
  const progress = useSharedValue(motion === undefined ? 1 : 0)
  const reduced = useSharedValue(false)
  useEffect(() => {
    if (motion === undefined) return
    const timings = motion.current
    reduced.set(timings.reduced)
    const duration = timings.reduced ? ROLE_FADE_MS : ROLE_MS[role]
    // Linear time: each role shapes it with its own curve. Never: the timings already follow Reduce Motion.
    const run = withTiming(1, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never })
    progress.set(withDelay(timings[role][cell] ?? 0, run))
  }, [motion, role, cell, progress, reduced])
  return { progress, reduced }
}
