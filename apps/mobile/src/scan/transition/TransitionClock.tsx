import { type SharedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import type { Quad } from '../../scanner'
import {
  advanceClock,
  GATE_RESULTS,
  type Gates,
  SPINNER_DELAY,
  sweepShift,
  transitionAt,
  transitionEnd,
} from './timeline'
import { type CaptureFrame, lerpQuad } from './warp'

/**
 * from: the locked grid in view points. to: the grid square of the correction screen. version: changes with each new plan.
 * crossFade: no warp. The dots stay on the locked grid, the cells and lines draw on the square, and the Reduce Motion channels fade
 * the layers.
 */
export type TransitionPlan = { from: Quad; to: Quad; crossFade: boolean; version: number }

/** Seconds. A stall of the UI thread must not skip a part of the transition. */
const MAX_CLOCK_STEP = 0.05

/**
 * Advances the transition clock once per UI frame and publishes the moving grid with its channels. Nothing changes while a gate
 * holds the clock, so then it writes nothing and no picture is drawn again.
 *
 * Precondition: render this before EffectCanvas, as a sibling, and give neither of them memo. Reanimated runs frame callbacks in
 * the order of registration. Each render registers both inline callbacks again, in tree order. So EffectCanvas reads the grid of
 * this frame, not the grid of the last frame.
 */
export function TransitionClock({
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
}) {
  const lastFrame = useSharedValue(-1)
  const held = useSharedValue(0)
  const shownVersion = useSharedValue(-1)
  const ended = useSharedValue(false)
  useFrameCallback((frame) => {
    'worklet'
    const path = plan.get()
    if (path == null) return
    const now = frame.timestamp / 1000
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
  })
  return null
}
