import { useCallback, useEffect, useRef, useState } from 'react'
import { type SharedValue, useSharedValue } from 'react-native-reanimated'
import type { RecogniseResult } from '@/scanner'
import type { CaptureState } from '@/scan/hooks/useCapture'
import type { FrameDetection } from '@/scan/hooks/useFrameTracking'
import { useTransitionClock } from '@/scan/hooks/useTransitionClock'
import type { CorrectionLayout } from '@/scan/utils/correction.utils'
import { toPreview } from '@/scan/utils/preview.utils'
import { useHaptics } from '@/settings/hooks/useHaptics'
import type { CaptureFrame, Gates, TransitionPlan } from '@/scan/utils/transition.utils'
import { type Quad, rectQuad, type ViewSize } from '@/utils/geometry.utils'
import type { HapticName } from '@/utils/haptics.utils'
import { devLog } from '@/utils/log.utils'

/**
 * Lock-on and the capture transition into the correction screen.
 * startCapture: keeps its identity while capture does, because the UI thread holds it as onLock from the first frame.
 * Its haptic is thud for the automatic lock-on, which the player did not tap, and tap for the shutter.
 * stepClock: the transition clock step, for the overlay to call first in each UI frame. onDone: called once with an ok result.
 */
export function useCaptureTransition({
  state,
  capture,
  layout,
  onDone,
  detection,
  viewSize,
  reduceMotion,
}: {
  state: CaptureState
  capture: (quad: Quad | null, frameAspect: number) => void
  layout: CorrectionLayout
  onDone: (result: RecogniseResult) => void
  detection: SharedValue<FrameDetection | null>
  viewSize: SharedValue<ViewSize>
  reduceMotion: boolean
}) {
  const clock = useSharedValue(0)
  const waiting = useSharedValue(false)
  const resultsAt = useSharedValue(-1)
  const plan = useSharedValue<TransitionPlan | null>(null)
  const gates = useSharedValue<Gates>({ photo: false, results: false })
  const captureFrame = useSharedValue<CaptureFrame | null>(null)
  const [lockedView, setLockedView] = useState<Quad | null>(null)
  const lockedAt = useRef<number | null>(null)
  const latestResult = useRef<RecogniseResult | null>(null)
  const planVersion = useRef(0)

  const { play } = useHaptics()
  const startCapture = useCallback(
    (quad: Quad | null, haptic: HapticName = 'thud') => {
      if (lockedAt.current != null) return
      lockedAt.current = Date.now()
      play(haptic)
      // The frame aspect at lock-on: the photo has the field of view of the frames.
      const aspect = detection.get()?.aspect ?? 0
      setLockedView(quad == null ? null : toPreview(quad, aspect, viewSize.get()))
      capture(quad, aspect)
    },
    [capture, detection, viewSize, play],
  )

  const capturing = state.phase === 'capturing' ? state : null
  const isCapturing = capturing != null
  // Without a locked grid or a photo, nothing can flatten (scan-pipeline concept).
  const crossFade =
    capturing != null && (reduceMotion || capturing.quad == null || lockedView == null || capturing.imageFailed)
  const photoReady = capturing != null && (capturing.image != null || capturing.quad == null || capturing.imageFailed)
  const resultsReady = capturing?.result?.ok === true
  const result = capturing?.result ?? null

  useEffect(() => {
    if (!isCapturing) return
    const to = rectQuad(layout.grid)
    planVersion.current++
    plan.set({ from: lockedView ?? to, to, crossFade, version: planVersion.current })
  }, [isCapturing, crossFade, lockedView, layout.grid, plan])

  useEffect(() => {
    gates.set({ photo: photoReady, results: resultsReady })
  }, [photoReady, resultsReady, gates])

  useEffect(() => {
    latestResult.current = result
  }, [result])

  const finish = useCallback(() => {
    const done = latestResult.current
    if (done == null || !done.ok) return
    if (lockedAt.current != null) devLog('scan', `transition done in ${Date.now() - lockedAt.current} ms`)
    onDone(done)
  }, [onDone])

  const stepClock = useTransitionClock({
    plan,
    gates,
    clock,
    waiting,
    resultsAt,
    capture: captureFrame,
    onEnd: finish,
  })

  return { startCapture, capturing, crossFade, clock, waiting, resultsAt, captureFrame, stepClock }
}
