import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { UnistylesRuntime } from 'react-native-unistyles'
import { GRID_CELLS, type Game } from '@sudoku/core'
import { NO_PULSE } from '@/constants/pulse.constants'
import { useSystemReduceMotion } from '@/hooks/useSystemReduceMotion'
import { pulseDelays, pulseDuration, pulseLook, type PulseLook, type PulseMove } from '@/utils/pulse.utils'

/** delays: one per cell in ms, or NO_PULSE. elapsed: ms since the move of the last pulse. look: the theme tokens of that pulse. */
export type Pulse = {
  delays: SharedValue<readonly number[]>
  elapsed: SharedValue<number>
  look: SharedValue<PulseLook>
}

const STILL: readonly number[] = Array.from({ length: GRID_CELLS }, () => NO_PULSE)

/**
 * Starts a pulse for each move that completes something. The pulse runs on the UI thread and renders nothing.
 * It follows Reduce Motion live. Turning it on stops a running pulse.
 */
export function usePulse(board: Game, move: PulseMove | null): Pulse {
  const delays = useSharedValue<readonly number[]>(STILL)
  const elapsed = useSharedValue(0)
  const look = useSharedValue<PulseLook>(pulseLook(UnistylesRuntime.getTheme()))
  const stop = useCallback(() => {
    cancelAnimation(elapsed)
    delays.set(STILL)
  }, [delays, elapsed])
  const reduceMotion = useSystemReduceMotion(stop)
  // A select changes the board but keeps the move. A grid that mounts late must not replay the move before it.
  const pulsedMove = useRef(move?.id ?? 0)
  useEffect(() => {
    if (move === null || move.id === pulsedMove.current) return
    pulsedMove.current = move.id
    if (reduceMotion.current) return
    // Read at the start of each pulse: a theme switch renders no grid, so no hook could pass the new theme here.
    const nextLook = pulseLook(UnistylesRuntime.getTheme())
    const next = pulseDelays(board, move, nextLook.stepMs)
    if (next === null) return
    const end = pulseDuration(next, nextLook)
    cancelAnimation(elapsed)
    elapsed.set(0)
    look.set(nextLook)
    delays.set(next)
    // Linear time: each cell applies its own delay and curve. Never: this hook already follows Reduce Motion live.
    elapsed.set(withTiming(end, { duration: end, easing: Easing.linear, reduceMotion: ReduceMotion.Never }))
  }, [board, move, reduceMotion, delays, elapsed, look])
  return useMemo(() => ({ delays, elapsed, look }), [delays, elapsed, look])
}
