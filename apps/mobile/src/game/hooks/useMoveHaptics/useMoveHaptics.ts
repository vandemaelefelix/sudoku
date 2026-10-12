import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import type { Move } from '@/game/utils/session.utils'

/** A light tap for each placed number. */
export function useMoveHaptics(move: Move | null): void {
  useEffect(() => {
    if (move?.kind !== 'number') return
    // A phone without a haptic engine rejects the call. The game goes on without the tap.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
  }, [move])
}
