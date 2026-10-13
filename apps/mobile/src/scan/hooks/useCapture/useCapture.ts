import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics'
import type { SkImage } from '@shopify/react-native-skia'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSharedValue } from 'react-native-reanimated'
import type { CameraPhotoOutput, Photo } from 'react-native-vision-camera'
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets'
import { createScanner, type RecogniseResult, type Scanner } from '@/scanner'
import { sameAspect, uprightAspect } from '@/scan/utils/preview.utils'
import { flatToSkImage, saveFlatPng } from '@/scan/utils/flatImage.utils'
import { saveUprightPhoto } from '@/scan/utils/photoFile'
import { photoToSkImage } from '@/scan/utils/transition.utils'
import type { Quad } from '@/utils/geometry.utils'
import { devWarn, errorMessage } from '@/utils/log.utils'
import { IMAGE_MAX_SIDE } from './useCapture.constants'

/**
 * image: the upright photo for the transition, null until it is ready. imageFailed: no image will come, because the photo or its
 * conversion failed. result: null until recognise settles.
 */
export type CaptureState =
  | { phase: 'live' }
  | {
      phase: 'capturing'
      quad: Quad | null
      image: SkImage | null
      imageFailed: boolean
      result: RecogniseResult | null
    }

/** photoMs: from capture to the photo. totalMs: from capture to the result. */
export function formatScanLog(photoMs: number, totalMs: number, result: RecogniseResult): string {
  if (!result.ok) return `[scan] failed after ${totalMs} ms: ${result.reason}`
  const t = result.timings
  const offset = result.cornerOffset == null ? '' : `, offset ${(result.cornerOffset * 100).toFixed(1)} %`
  return (
    `[scan] photo ${photoMs} ms, image ${t.imageMs} ms, detect ${t.detectMs} ms (${result.corners}${offset}), ` +
    `flatten ${t.flattenMs} ms, classify ${t.classifyMs} ms, total ${totalMs} ms`
  )
}

type OkResult = Extract<RecogniseResult, { ok: true }>

/**
 * The flattened grid never enters React state as bytes. A development build took 2.6 s to render a result with this 1 MB array
 * on an iPhone 17 Pro, and the transition waited for it. The result keeps it as a Skia image instead: the check state of the
 * correction screen cuts the cell crops from it. Development builds also keep it in a file, to save it with the corrections.
 */
function withFlat(result: OkResult, photoPath: string | null): OkResult {
  const { flat, ...rest } = result
  let kept: OkResult = rest
  if (flat != null) {
    try {
      const flatImage = flatToSkImage(flat)
      if (flatImage != null) kept = { ...rest, flatImage }
    } catch (error) {
      devWarn('scan', `the flattened grid has no image: ${errorMessage(error)}`)
    }
  }
  if (!__DEV__ || photoPath == null) return kept
  let flatPath: string | undefined
  try {
    flatPath = flat == null ? undefined : saveFlatPng(flat)
  } catch (error) {
    devWarn('scan', `the flattened grid is not saved: ${errorMessage(error)}`)
  }
  return flatPath == null ? { ...kept, photoPath } : { ...kept, photoPath, flatPath }
}

/**
 * capture keeps its identity, because the UI thread holds it from the first frame. A second capture does nothing: a retake mounts a
 * new camera screen with a new hook. sharedImage: the same image as state.image, for the UI thread. Only the UI thread reads it.
 */
export function useCapture(photoOutput: Pick<CameraPhotoOutput, 'capturePhoto'>) {
  const [state, setState] = useState<CaptureState>({ phase: 'live' })
  const output = useRef(photoOutput)
  const busy = useRef(false)
  const generation = useRef(0)
  const shownImage = useRef<SkImage | null>(null)
  const sharedImage = useSharedValue<SkImage | null>(null)

  useEffect(() => {
    output.current = photoOutput
  }, [photoOutput])

  // The model loads at start, so the first scan does not wait for it. A load failure shows at the first capture.
  useEffect(() => {
    createScanner().catch(() => undefined)
  }, [])

  // A retake unmounts the camera screen. The UI thread can draw the image for one more frame, because its frame callbacks stop
  // later. So the UI thread lets go of the image first, and the JS thread disposes it after that.
  useEffect(
    () => () => {
      generation.current++
      const image = shownImage.current
      shownImage.current = null
      if (image == null) return
      const dispose = () => image.dispose()
      scheduleOnUI(() => {
        'worklet'
        sharedImage.set(null)
        scheduleOnRN(dispose)
      })
    },
    [sharedImage],
  )

  const capture = useCallback((quad: Quad | null, frameAspect: number) => {
    if (busy.current) return
    busy.current = true
    const attempt = ++generation.current
    // An unmount makes the attempt stale. A stale attempt must not write state.
    const current = () => generation.current === attempt
    const update = (
      change: { image: SkImage } | { imageFailed: true } | { result: RecogniseResult } | { quad: null },
    ) => setState((previous) => (previous.phase === 'capturing' ? { ...previous, ...change } : previous))
    setState({ phase: 'capturing', quad, image: null, imageFailed: false, result: null })
    const started = Date.now()
    impactAsync(ImpactFeedbackStyle.Light).catch(() => undefined)

    const settle = (photoMs: number, result: RecogniseResult) => {
      if (__DEV__) console.log(formatScanLog(photoMs, Date.now() - started, result))
      if (current()) update({ result })
    }
    const convert = async (photo: Photo) => {
      try {
        const image = await photoToSkImage(photo, IMAGE_MAX_SIDE)
        if (current()) {
          shownImage.current = image
          update({ image })
        } else {
          image.dispose()
        }
      } catch (error) {
        devWarn('scan', `photo conversion failed: ${errorMessage(error)}`)
        if (current()) update({ imageFailed: true })
      }
    }

    void (async () => {
      let photo: Photo
      let photoMs = 0
      let scanner: Scanner
      try {
        scanner = await createScanner()
        // The haptic is the feedback. No shutter sound (ADR-002).
        photo = await output.current.capturePhoto({ enableShutterSound: false }, {})
        photoMs = Date.now() - started
      } catch (error) {
        if (current()) update({ imageFailed: true })
        settle(photoMs, { ok: false, reason: errorMessage(error) })
        return
      }
      // The quad is normalised to the frame. It fits the photo only when both have the same field of view (ADR-002). Without it,
      // recognise searches the whole photo and the transition cross-fades.
      let locked = quad
      if (quad != null && !sameAspect(uprightAspect(photo.width, photo.height, photo.orientation), frameAspect)) {
        locked = null
        devWarn('scan', 'the photo and the frame differ in aspect, so the locked quad does not fit the photo')
        if (current()) update({ quad: null })
      }
      // Development builds only: the correction screen shows this photo and can save it with the corrections.
      const saved = __DEV__
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
              settle(photoMs, result.ok ? withFlat(result, photoPath) : result)
            },
            (error) => settle(photoMs, { ok: false, reason: errorMessage(error) }),
          ),
          convert(photo),
        ])
      } finally {
        photo.dispose()
      }
    })()
  }, [])

  const image = state.phase === 'capturing' ? state.image : null
  useEffect(() => {
    if (image != null) sharedImage.set(image)
  }, [image, sharedImage])

  return { state, capture, sharedImage }
}
