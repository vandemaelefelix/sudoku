import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import type { Completion } from '@sudoku/core'
import type { Move } from '@/game/utils/session.utils'

function completesAUnitOrNumber({ rows, columns, boxes, digits }: Completion): boolean {
  return rows.length + columns.length + boxes.length + digits.length > 0
}

/** The strongest haptic that fits the move, or null. One move gives one haptic, so two taps never blur together. */
function hapticOf(move: Move | null): (() => Promise<void>) | null {
  if (move === null) return null
  // A tap would reward a wrong number. The warning of the third mistake comes from the mistake dots.
  if (move.mistake) return null
  if (move.completed.grid) return () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  if (completesAUnitOrNumber(move.completed)) return () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  if (move.kind === 'number') return () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  return null
}

/** A haptic for each move: a light tap for a correct number, more for a completion, none for a mistake. Reduce Motion does not stop it. */
export function useMoveHaptics(move: Move | null): void {
  useEffect(() => {
    // A phone without a haptic engine rejects the call. The game goes on without the tap.
    hapticOf(move)?.().catch(() => undefined)
  }, [move])
}
