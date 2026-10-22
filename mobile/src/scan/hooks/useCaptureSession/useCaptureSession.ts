import type { SkImage } from '@shopify/react-native-skia'
import type { Image } from 'react-native-nitro-image'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { type SharedValue, useReducedMotion, useSharedValue } from 'react-native-reanimated'
import type { CameraPhotoOutput, Photo } from 'react-native-vision-camera'
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets'
import { createScanner, type Scanner } from '@/scanner'
import { GATE_RESULTS, SPINNER_DELAY } from '@/scan/constants/transition.constants'
import type { FrameDetection } from '@/scan/hooks/useFrameTracking'
import { type CaptureResult, formatScanLog, type ScanOrigin, toCaptureResult } from '@/scan/utils/captureResult.utils'
import type { CorrectionLayout } from '@/scan/utils/correction.utils'
import { claimLock, createLockLatch, type LockSource } from '@/scan/utils/lockOn.utils'
import { deletePickedImage, saveUprightPhoto, stillPhoto } from '@/scan/utils/photoFile'
import { photoToSkImage } from '@/scan/utils/photoImage.utils'
import { sameAspect, toPreview, uprightAspect } from '@/scan/utils/preview.utils'
import {
  advanceClock,
  type Channels,
  type Gates,
  sweepShift,
  transitionAt,
  transitionEnd,
} from '@/scan/utils/transition.utils'
import { shareStore } from '@/scanShare/shareStore'
import { useHaptics } from '@/settings/hooks/useHaptics'
import { lerpQuad, type Quad, rectQuad, type ViewSize } from '@/utils/geometry.utils'
import { devLog, devWarn, errorMessage } from '@/utils/log.utils'
import { IMAGE_MAX_SIDE, MAX_CLOCK_STEP } from './useCaptureSession.constants'

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

/** live: the camera. capturing: lock-on to the end of the transition. review: the static correction screen. */
export type CapturePhase = 'live' | 'capturing' | 'review'

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
 * attempt is done, also when the latch refuses the import. An import has no locked quad, so the transition cross-fades.
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
 * lockedView: quad in view points, or null. image: null until it is ready. imageFailed: no image will come, because the photo or its
 * conversion failed.
 */
type Attempt = {
  phase: CapturePhase
  origin: ScanOrigin
  quad: Quad | null
  lockedView: Quad | null
  image: SkImage | null
  imageFailed: boolean
  result: CaptureResult | null
}

type Change =
  | { type: 'start'; quad: Quad | null; lockedView: Quad | null; origin: ScanOrigin }
  | { type: 'image'; image: SkImage }
  | { type: 'imageFailed' }
  | { type: 'dropQuad' }
  | { type: 'result'; result: CaptureResult }
  | { type: 'end' }

const LIVE: Attempt = {
  phase: 'live',
  origin: 'camera',
  quad: null,
  lockedView: null,
  image: null,
  imageFailed: false,
  result: null,
}

function reduce(attempt: Attempt, change: Change): Attempt {
  if (change.type === 'start') {
    return { ...LIVE, phase: 'capturing', origin: change.origin, quad: change.quad, lockedView: change.lockedView }
  }
  if (attempt.phase === 'live') return attempt
  switch (change.type) {
    case 'image':
      return { ...attempt, image: change.image }
    case 'imageFailed':
      return { ...attempt, imageFailed: true }
    case 'dropQuad':
      // lockedView stays: the dots of the cross-fade stay on the grid that the player locked.
      return { ...attempt, quad: null }
    case 'result':
      return { ...attempt, result: change.result }
    case 'end':
      return attempt.phase === 'capturing' ? { ...attempt, phase: 'review' } : attempt
  }
}

// Without a locked grid or a photo, nothing can flatten (scan-pipeline concept).
function crossFadeOf(attempt: Attempt, reduceMotion: boolean): boolean {
  return (
    attempt.phase !== 'live' &&
    (reduceMotion || attempt.quad == null || attempt.lockedView == null || attempt.imageFailed)
  )
}

function gatesOf(attempt: Attempt): Gates {
  const live = attempt.phase === 'live'
  return {
    photo: !live && (attempt.image != null || attempt.quad == null || attempt.imageFailed),
    results: attempt.result?.ok === true,
  }
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
  const [attempt, change] = useReducer(reduce, LIVE)
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

  const crossFade = crossFadeOf(attempt, reduceMotion)
  const { photo: photoReady, results: resultsReady } = gatesOf(attempt)
  const started = attempt.phase !== 'live'

  useEffect(() => {
    output.current = photoOutput
  }, [photoOutput])

  useEffect(() => {
    latest.current = attempt
  }, [attempt])

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

  // One capture attempt. An unmount makes the attempt stale. A stale attempt must not change the state.
  const begin = useCallback(() => {
    const attemptId = ++generation.current
    const current = () => generation.current === attemptId
    const began = Date.now()

    const settle = (photoMs: number, result: CaptureResult) => {
      if (__DEV__) console.log(formatScanLog(photoMs, Date.now() - began, result))
      if (current()) change({ type: 'result', result })
    }
    const convert = async (photo: Pick<Photo, 'toImageAsync'>) => {
      try {
        const converted = await photoToSkImage(photo, IMAGE_MAX_SIDE)
        if (current()) {
          shownImage.current = converted
          change({ type: 'image', image: converted })
        } else {
          converted.dispose()
        }
      } catch (error) {
        devWarn('scan', `photo conversion failed: ${errorMessage(error)}`)
        if (current()) change({ type: 'imageFailed' })
      }
    }
    return { current, began, settle, convert }
  }, [])

  const run = useCallback(
    (quad: Quad | null, frameAspect: number) => {
      const { current, began, settle, convert } = begin()

      void (async () => {
        let photo: Photo
        let photoMs = 0
        let scanner: Scanner
        try {
          scanner = await createScanner()
          // The haptic is the feedback. No shutter sound (ADR-002).
          photo = await output.current.capturePhoto({ enableShutterSound: false }, {})
          photoMs = Date.now() - began
        } catch (error) {
          if (current()) change({ type: 'imageFailed' })
          settle(photoMs, { ok: false, reason: errorMessage(error) })
          return
        }
        // The quad is normalised to the frame. It fits the photo only when both have the same field of view (ADR-002). Without it,
        // recognise searches the whole photo and the transition cross-fades.
        let locked = quad
        if (quad != null && !sameAspect(uprightAspect(photo.width, photo.height, photo.orientation), frameAspect)) {
          locked = null
          devWarn('scan', 'the photo and the frame differ in aspect, so the locked quad does not fit the photo')
          if (current()) change({ type: 'dropQuad' })
        }
        // Development builds keep the photo for the dev menu. Every build keeps it while sharing is on: the scan upload crops it (ADR-030).
        const saved =
          __DEV__ || shareStore.get()
            ? saveUprightPhoto(photo).catch((error) => {
                devWarn('scan', `the photo is not saved: ${errorMessage(error)}`)
                return null
              })
            : Promise.resolve(null)
        try {
          await Promise.all([
            scanner.recognise(photo, locked).then(
              async (result) => {
                const photoPath = await saved
                settle(photoMs, toCaptureResult(result, photoPath))
              },
              (error) => settle(photoMs, { ok: false, reason: errorMessage(error) }),
            ),
            convert(photo),
          ])
        } finally {
          photo.dispose()
        }
      })()
    },
    [begin],
  )

  const runImport = useCallback(
    (uri: string) => {
      const { current, settle, convert } = begin()
      const still = stillPhoto(uri)

      void (async () => {
        try {
          let picked: Image
          let scanner: Scanner
          try {
            scanner = await createScanner()
            picked = await still.toImageAsync()
          } catch (error) {
            if (current()) change({ type: 'imageFailed' })
            settle(0, { ok: false, reason: errorMessage(error) })
            return
          }
          // An imported image never uploads (ADR-030, amendment 2026-10-22). Only development builds keep it, for the dev menu.
          const saved = __DEV__
            ? saveUprightPhoto(still).catch((error) => {
                devWarn('scan', `the image is not saved: ${errorMessage(error)}`)
                return null
              })
            : Promise.resolve(null)
          try {
            await Promise.all([
              scanner.recogniseStill(picked).then(
                async (result) => {
                  const captured = toCaptureResult(result, await saved)
                  settle(0, captured.ok ? { ...captured, imported: true } : captured)
                },
                (error) => settle(0, { ok: false, reason: errorMessage(error) }),
              ),
              convert(still),
            ])
          } finally {
            picked.dispose()
          }
        } finally {
          deletePickedImage(uri)
        }
      })()
    },
    [begin],
  )

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
      run(quad, aspect)
    },
    [run, detection, viewSize, play],
  )

  const startImport = useCallback(
    (uri: string) => {
      if (!claimLock(latch.current, 'import', Date.now())) {
        deletePickedImage(uri)
        return
      }
      play('tap')
      change({ type: 'start', quad: null, lockedView: null, origin: 'library' })
      runImport(uri)
    },
    [runImport, play],
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
