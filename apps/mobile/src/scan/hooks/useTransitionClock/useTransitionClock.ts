import { type SharedValue, useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import {
  advanceClock,
  type CaptureFrame,
  type Gates,
  sweepShift,
  transitionAt,
  transitionEnd,
  type TransitionPlan,
} from '@/scan/utils/transition.utils'
import { lerpQuad } from '@/utils/geometry.utils'
import { GATE_RESULTS, SPINNER_DELAY } from '@/scan/constants/transition.constants'
import { MAX_CLOCK_STEP } from './useTransitionClock.constants'

/**
 * Returns the step of the transition clock: a worklet that advances the clock once per UI frame and publishes the moving grid with
 * its channels. timestamp: milliseconds, the frame clock. Nothing changes while a gate holds the clock, so then it writes nothing.
 * The overlay calls it first in its own frame callback, so the overlay always draws the grid of this frame.
 */
export function useTransitionClock({
  plan,
  gates,
  clock,
  waiting,
  resultsAt,
  capture,
  onEnd,
}: {
  plan: SharedValue<TransitionPlan | null>
  gates: SharedValue<Gates>
  clock: SharedValue<number>
  waiting: SharedValue<boolean>
  /** The clock value when the results gate opened, or -1 before. This writes it once. */
  resultsAt: SharedValue<number>
  capture: SharedValue<CaptureFrame | null>
  onEnd: () => void
}): (timestamp: number) => void {
  const lastFrame = useSharedValue(-1)
  const held = useSharedValue(0)
  const shownVersion = useSharedValue(-1)
  const ended = useSharedValue(false)
  return (timestamp: number) => {
    'worklet'
    const path = plan.get()
    if (path == null) return
    const now = timestamp / 1000
    const previous = lastFrame.get()
    lastFrame.set(now)
    const dt = previous < 0 ? 0 : Math.min(MAX_CLOCK_STEP, Math.max(0, now - previous))
    const open = gates.get()
    const before = clock.get()
    if (open.results && resultsAt.get() < 0) resultsAt.set(before)
    const shift = sweepShift(resultsAt.get(), before, path.crossFade)
    const t = advanceClock(before, dt, open, path.crossFade, shift)
    const resultsGate = path.crossFade ? 0 : GATE_RESULTS
    held.set(!open.results && t >= resultsGate ? held.get() + dt : 0)
    const late = held.get() > SPINNER_DELAY
    if (late !== waiting.get()) waiting.set(late)
    if (t !== before || path.version !== shownVersion.get()) {
      clock.set(t)
      shownVersion.set(path.version)
      const channels = transitionAt(t, path.crossFade, shift)
      const grid = path.crossFade ? path.to : lerpQuad(path.from, path.to, channels.flatten)
      capture.set({ quad: path.crossFade ? path.from : grid, grid, channels, crossFade: path.crossFade })
    }
    // onEnd finishes only with an ok result, so the latch waits for the open results gate.
    if (open.results && t >= transitionEnd(path.crossFade, shift) && !ended.get()) {
      ended.set(true)
      scheduleOnRN(onEnd)
    }
  }
}
