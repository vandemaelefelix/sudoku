import type { SkImage } from '@shopify/react-native-skia'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { type SharedValue, useReducedMotion, useSharedValue } from 'react-native-reanimated'
import type { CameraPhotoOutput } from 'react-native-vision-camera'
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets'
import { createScanner } from '@/scanner'
import { GATE_RESULTS, SPINNER_DELAY } from '@/scan/constants/transition.constants'
import type { FrameDetection } from '@/scan/hooks/useFrameTracking'
import type { CaptureResult, ScanOrigin } from '@/scan/utils/captureResult.utils'
import type { CorrectionLayout } from '@/scan/utils/correction.utils'
import { claimLock, createLockLatch, type LockSource } from '@/scan/utils/lockOn.utils'
import { deletePickedImage } from '@/scan/utils/photoFile'
import { toPreview } from '@/scan/utils/preview.utils'
import {
  advanceClock,
  type Channels,
  type Gates,
  sweepShift,
  transitionAt,
  transitionEnd,
} from '@/scan/utils/transition.utils'
import { useHaptics } from '@/settings/hooks/useHaptics'
import { lerpQuad, type Quad, rectQuad, type ViewSize } from '@/utils/geometry.utils'
import { devLog } from '@/utils/log.utils'
import { type CapturePhase, crossFadeOf, gatesOf, LIVE, reduceAttempt } from './captureAttempt'
import { type RunContext, runCapture, runImport } from './captureRun'
import { MAX_CLOCK_STEP } from './useCaptureSession.constants'

/**
 * One frame of the transition, in view points. quad: the grid of the dots and the photo. grid: the grid of the cells and the lines.
 * They are the same quad in the warp. In the cross-fade the dots stay on the locked grid, and the cells and lines are on the square.
 * crossFade: true when the Reduce Motion channels fade the layers, also without Reduce Motion.
 */
export type CaptureFrame = { quad: Quad; grid: Quad; channels: Channels; crossFade: boolean }

/**
 * from: the locked grid in view points. to: the grid square of the correction screen. version: changes with each new plan, so the
 * clock publishes the frame again while it holds at a gate.
 */
type TransitionPlan = { from: Quad; to: Quad; crossFade: boolean; version: number }

/**
 * Everything a layer of the capture reads. Read it, do not copy it into other props.
 *
 * JS thread, changes per render:
 * - phase, result (null until recognise settles), quad (the locked grid, normalised to the upright frame, or null).
 * - origin: camera, or library for an image from the photo library.
 * - photoShown: the photo is an image, so the camera can stop.
 * - crossFade: the transition has no movement (scan-pipeline concept, "Cross-fade path").
 *
 * UI thread, shared values that the clock writes:
 * - clock: seconds since lock-on. waiting: the results gate held longer than SPINNER_DELAY.
 * - resultsAt: the clock value when the results gate opened, or -1. The clock writes it once.
 * - captureFrame: the moving grid and the channels, or null before the first step. image: the upright photo.
 *
 * startCapture keeps its identity: the UI thread holds it from the first frame. Its source decides the haptic: thud for the
 * automatic lock-on, which the player did not tap, and tap for the shutter. The first source to call it starts the capture and
 * the lock latch refuses the other one, so a second call does nothing. A retake mounts a new camera screen with a new session.
 *
 * startImport: the same for an image from the photo library. uri: the cache copy of the picker. The session deletes it when the
 * attempt is done, also when the latch refuses the import or the screen has unmounted. An import has no locked quad and no photo
 * image, so the transition cross-fades.
 *
 * stepClock: a worklet. The overlay calls it first in each UI frame, so the overlay draws the grid of this frame.
 */
export type CaptureSession = {
  phase: CapturePhase
  origin: ScanOrigin
  result: CaptureResult | null
  quad: Quad | null
  photoShown: boolean
  crossFade: boolean
  startCapture: (quad: Quad | null, source?: LockSource) => void
  startImport: (uri: string) => void
  stepClock: (timestamp: number) => void
  clock: SharedValue<number>
  waiting: SharedValue<boolean>
  resultsAt: SharedValue<number>
  captureFrame: SharedValue<CaptureFrame | null>
  image: SharedValue<SkImage | null>
}

/**
 * The capture session: the state from lock-on to the review of the correction screen (scan-pipeline concept, "The transition").
 * It owns the capture attempt, the photo and results gates, the transition clock, the plan with the cross-fade rule, the phase and
 * the lifetime of the photo image. The flattened grid image lives in the result and goes with the session.
 */
export function useCaptureSession({
  photoOutput,
  layout,
  detection,
  viewSize,
}: {
  photoOutput: Pick<CameraPhotoOutput, 'capturePhoto'>
  layout: CorrectionLayout
  detection: SharedValue<FrameDetection | null>
  viewSize: SharedValue<ViewSize>
}): CaptureSession {
  const [attempt, change] = useReducer(reduceAttempt, LIVE)
  const reduceMotion = useReducedMotion()
  const { play } = useHaptics()
  const output = useRef(photoOutput)
  const generation = useRef(0)
  const latch = useRef(createLockLatch())
  const latest = useRef(attempt)
  const planVersion = useRef(0)
  const shownImage = useRef<SkImage | null>(null)
  const clock = useSharedValue(0)
  const waiting = useSharedValue(false)
  const resultsAt = useSharedValue(-1)
  const plan = useSharedValue<TransitionPlan | null>(null)
  const gates = useSharedValue<Gates>({ photo: false, results: false })
  const captureFrame = useSharedValue<CaptureFrame | null>(null)
  const image = useSharedValue<SkImage | null>(null)
  const lastFrame = useSharedValue(-1)
  const held = useSharedValue(0)
  const shownVersion = useSharedValue(-1)
  const ended = useSharedValue(false)
  const mounted = useRef(true)

  const crossFade = crossFadeOf(attempt, reduceMotion)
  const { photo: photoReady, results: resultsReady } = gatesOf(attempt)
  const started = attempt.phase !== 'live'

  useEffect(() => {
    output.current = photoOutput
  }, [photoOutput])

  useEffect(() => {
    latest.current = attempt
  }, [attempt])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // The model loads at start, so the first scan does not wait for it. A load failure shows at the first capture.
  useEffect(() => {
    createScanner().catch(() => undefined)
  }, [])

  // A retake unmounts the camera screen. The UI thread can draw the image for one more frame, because its frame callbacks stop
  // later. So the UI thread lets go of the image first, and the JS thread disposes it after that.
  useEffect(
    () => () => {
      generation.current++
      const shown = shownImage.current
      shownImage.current = null
      if (shown == null) return
      const dispose = () => shown.dispose()
      scheduleOnUI(() => {
        'worklet'
        image.set(null)
        scheduleOnRN(dispose)
      })
    },
    [image],
  )

  useEffect(() => {
    if (attempt.image != null) image.set(attempt.image)
  }, [attempt.image, image])

  useEffect(() => {
    if (!started) return
    const to = rectQuad(layout.grid)
    planVersion.current++
    plan.set({ from: attempt.lockedView ?? to, to, crossFade, version: planVersion.current })
  }, [started, crossFade, attempt.lockedView, layout.grid, plan])

  useEffect(() => {
    gates.set({ photo: photoReady, results: resultsReady })
  }, [photoReady, resultsReady, gates])

  // One capture attempt. A newer attempt or an unmount makes it stale. A stale attempt must not change the state.
  const begin = useCallback((): RunContext => {
    const attemptId = ++generation.current
    return {
      current: () => generation.current === attemptId,
      change,
      keepImage: (kept) => {
        shownImage.current = kept
      },
    }
  }, [])

  const startCapture = useCallback(
    (quad: Quad | null, source: LockSource = 'auto') => {
      if (!claimLock(latch.current, source, Date.now())) return
      play(source === 'shutter' ? 'tap' : 'thud')
      // The frame aspect at lock-on: the photo has the field of view of the frames.
      const aspect = detection.get()?.aspect ?? 0
      change({
        type: 'start',
        quad,
        lockedView: quad == null ? null : toPreview(quad, aspect, viewSize.get()),
        origin: 'camera',
      })
      // The haptic is the feedback. No shutter sound (ADR-002).
      const takePhoto = () => output.current.capturePhoto({ enableShutterSound: false }, {})
      void runCapture(begin(), takePhoto, quad, aspect)
    },
    [begin, detection, viewSize, play],
  )

  const startImport = useCallback(
    (uri: string) => {
      // The picker can close after the screen unmounted. A dead session must not start a scan.
      if (!mounted.current || !claimLock(latch.current, 'import', Date.now())) {
        deletePickedImage(uri)
        return
      }
      play('tap')
      change({ type: 'start', quad: null, lockedView: null, origin: 'library' })
      void runImport(begin(), uri)
    },
    [begin, play],
  )

  const finish = useCallback(() => {
    const done = latest.current
    if (done.phase !== 'capturing' || done.result?.ok !== true) return
    if (latch.current.source != null) devLog('scan', `transition done in ${Date.now() - latch.current.at} ms`)
    change({ type: 'end' })
  }, [])

  const stepClock = (timestamp: number) => {
    'worklet'
    const path = plan.get()
    if (path == null) return
    const now = timestamp / 1000
    const previous = lastFrame.get()
    lastFrame.set(now)
    const dt = previous < 0 ? 0 : Math.min(MAX_CLOCK_STEP, Math.max(0, now - previous))
    const open = gates.get()
    const before = clock.get()
    // The first step with an open results gate fixes the arrival time, which later steps keep.
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
      captureFrame.set({ quad: path.crossFade ? path.from : grid, grid, channels, crossFade: path.crossFade })
    }
    // The end needs an ok result, so the latch waits for the open results gate.
    if (open.results && t >= transitionEnd(path.crossFade, shift) && !ended.get()) {
      ended.set(true)
      scheduleOnRN(finish)
    }
  }

  return {
    phase: attempt.phase,
    origin: attempt.origin,
    result: attempt.result,
    quad: attempt.quad,
    photoShown: attempt.image != null,
    crossFade,
    startCapture,
    startImport,
    stepClock,
    clock,
    waiting,
    resultsAt,
    captureFrame,
    image,
  }
}
