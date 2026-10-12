import { useEffect, useMemo, useRef } from 'react'
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { GRID_CELLS, type Game } from '@sudoku/core'
import { NO_PULSE } from '@/game/constants/pulse.constants'
import { pulseDelays, pulseDuration } from '@/game/utils/pulse.utils'
import type { Move } from '@/game/utils/session.utils'

/** delays: one per cell in ms, or NO_PULSE. elapsed: ms since the move of the last pulse. */
export type Pulse = { delays: SharedValue<readonly number[]>; elapsed: SharedValue<number> }

const STILL: readonly number[] = Array.from({ length: GRID_CELLS }, () => NO_PULSE)

/**
 * Starts a pulse for each move that completes something. The pulse runs on the UI thread and renders nothing.
 * Reduce Motion is read when the app starts. withTiming also skips to the end when the setting changes later.
 */
export function usePulse(board: Game, move: Move | null): Pulse {
  const reduceMotion = useReducedMotion()
  const delays = useSharedValue<readonly number[]>(STILL)
  const elapsed = useSharedValue(0)
  // A select changes the board but keeps the move. A grid that mounts late must not replay the move before it.
  const pulsedMove = useRef(move?.id ?? 0)
  useEffect(() => {
    if (move === null || move.id === pulsedMove.current) return
    pulsedMove.current = move.id
    if (reduceMotion) return
    const next = pulseDelays(board, move)
    if (next === null) return
    const end = pulseDuration(next)
    cancelAnimation(elapsed)
    elapsed.set(0)
    delays.set(next)
    // Linear time: each cell applies its own delay and curve.
    elapsed.set(withTiming(end, { duration: end, easing: Easing.linear }))
  }, [board, move, reduceMotion, delays, elapsed])
  return useMemo(() => ({ delays, elapsed }), [delays, elapsed])
}
