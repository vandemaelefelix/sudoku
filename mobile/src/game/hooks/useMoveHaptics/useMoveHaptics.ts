import { useEffect } from 'react'
import type { Completion } from '@sudoku/core'
import type { Move } from '@/game/utils/session.utils'
import { useHaptics } from '@/preferences/hooks/useHaptics'
import type { HapticName } from '@/utils/haptics.utils'

function completesAUnitOrNumber({ rows, columns, boxes, digits }: Completion): boolean {
  return rows.length + columns.length + boxes.length + digits.length > 0
}

/** The strongest haptic that fits the move, or null. One move gives one haptic, so two taps never blur together. */
export function hapticOf(move: Move | null, lost: boolean): HapticName | null {
  if (move === null) return null
  // A tap would reward a wrong number. The mistake that ends the game is the error.
  if (move.mistake) return lost ? 'error' : 'warning'
  if (move.completed.grid) return 'success'
  if (completesAUnitOrNumber(move.completed)) return 'thud'
  if (move.kind === 'number') return 'tap'
  if (move.kind === 'hint') return 'soft'
  return 'tick'
}

/** One haptic for each move, as hapticOf picks it. Reduce Motion does not stop it. */
export function useMoveHaptics(move: Move | null, lost: boolean): void {
  const { play } = useHaptics()
  useEffect(() => {
    const haptic = hapticOf(move, lost)
    if (haptic !== null) play(haptic)
    // lost changes only in the render of the move that ends the game, so the effect runs once for that move.
  }, [move, lost, play])
}
