import { useEffect, useRef } from 'react'
import { type SharedValue, useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import {
  type CaptureFrame,
  frameAt,
  frameStep,
  type Gates,
  stepClockState,
  type TransitionPlan,
} from '@/scan/utils/transition.utils'
import { type Quad, type Rect, rectQuad } from '@/utils/geometry.utils'

/**
 * started: the attempt left the live state. lockedView: the locked grid in view points, or null. grid: the grid square of the
 * correction screen, where the transition ends. gates: see Gates. onEnd: runs once on the JS thread, when the clock reaches the end
 * with the results gate open.
 */
type TransitionClockInput = {
  started: boolean
  crossFade: boolean
  lockedView: Quad | null
  grid: Rect
  gates: Gates
  onEnd(): void
}

/**
 * The transition clock (scan-pipeline concept, "The transition"). It runs on the UI thread and holds at the gates.
 * clock: seconds since lock-on. waiting: the results gate held longer than SPINNER_DELAY. resultsAt: the clock value when the
 * results gate opened, or -1. The clock writes it once. captureFrame: the moving grid and the channels, or null before the first
 * step. stepClock: a worklet. The overlay calls it first in each UI frame, so the overlay draws the grid of this frame.
 */
export function useTransitionClock({ started, crossFade, lockedView, grid, gates, onEnd }: TransitionClockInput): {
  clock: SharedValue<number>
  waiting: SharedValue<boolean>
  resultsAt: SharedValue<number>
  captureFrame: SharedValue<CaptureFrame | null>
  stepClock: (timestamp: number) => void
} {
  const planVersion = useRef(0)
  const clock = useSharedValue(0)
  const waiting = useSharedValue(false)
  const resultsAt = useSharedValue(-1)
  const plan = useSharedValue<TransitionPlan | null>(null)
  const open = useSharedValue<Gates>({ photo: false, results: false })
  const captureFrame = useSharedValue<CaptureFrame | null>(null)
  const lastFrame = useSharedValue(-1)
  const held = useSharedValue(0)
  const shownVersion = useSharedValue(-1)
  const ended = useSharedValue(false)

  useEffect(() => {
    if (!started) return
    const to = rectQuad(grid)
    planVersion.current++
    plan.set({ from: lockedView ?? to, to, crossFade, version: planVersion.current })
  }, [started, crossFade, lockedView, grid, plan])

  useEffect(() => {
    open.set({ photo: gates.photo, results: gates.results })
  }, [gates.photo, gates.results, open])

  const stepClock = (timestamp: number) => {
    'worklet'
    const path = plan.get()
    if (path == null) return
    const now = timestamp / 1000
    const dt = frameStep(now, lastFrame.get())
    lastFrame.set(now)
    const before = clock.get()
    const step = stepClockState(
      { clock: before, resultsAt: resultsAt.get(), held: held.get() },
      dt,
      open.get(),
      path.crossFade,
    )
    if (step.resultsAt !== resultsAt.get()) resultsAt.set(step.resultsAt)
    held.set(step.held)
    if (step.late !== waiting.get()) waiting.set(step.late)
    if (step.clock !== before || path.version !== shownVersion.get()) {
      clock.set(step.clock)
      shownVersion.set(path.version)
      captureFrame.set(frameAt(step.clock, step.shift, path))
    }
    if (step.done && !ended.get()) {
      ended.set(true)
      scheduleOnRN(onEnd)
    }
  }

  return { clock, waiting, resultsAt, captureFrame, stepClock }
}
