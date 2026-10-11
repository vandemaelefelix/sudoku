import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics'
import type { SkImage } from '@shopify/react-native-skia'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CameraPhotoOutput, Photo } from 'react-native-vision-camera'
import { createScanner, type Quad, type RecogniseResult, type Scanner } from '../scanner'
import { photoToSkImage } from './transition/photoImage'

/** image: the upright photo for the transition, null until it is ready or when the conversion failed. result: null until recognise settles. */
export type CaptureState =
  | { phase: 'live' }
  | { phase: 'capturing'; quad: Quad | null; image: SkImage | null; result: RecogniseResult | null }

/** 1600 px is enough for a 3x screen. */
const IMAGE_MAX_SIDE = 1600

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

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** capture keeps its identity, because the UI thread holds it from the first frame. A second capture before retake does nothing. */
export function useCapture(photoOutput: Pick<CameraPhotoOutput, 'capturePhoto'>) {
  const [state, setState] = useState<CaptureState>({ phase: 'live' })
  const output = useRef(photoOutput)
  const busy = useRef(false)
  const generation = useRef(0)
  const shownImage = useRef<SkImage | null>(null)

  useEffect(() => {
    output.current = photoOutput
  }, [photoOutput])

  // The model loads at start, so the first scan does not wait for it. A load failure shows at the first capture.
  useEffect(() => {
    createScanner().catch(() => undefined)
  }, [])

  const capture = useCallback((quad: Quad | null) => {
    if (busy.current) return
    busy.current = true
    const attempt = ++generation.current
    // A retake makes the attempt stale. A stale attempt must not write state.
    const current = () => generation.current === attempt
    const update = (change: { image: SkImage } | { result: RecogniseResult }) =>
      setState((previous) => (previous.phase === 'capturing' ? { ...previous, ...change } : previous))
    setState({ phase: 'capturing', quad, image: null, result: null })
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
        if (__DEV__) console.warn(`[scan] photo conversion failed: ${reasonOf(error)}`)
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
        settle(photoMs, { ok: false, reason: reasonOf(error) })
        return
      }
      try {
        await Promise.all([
          scanner.recognise(photo, quad).then(
            (result) => settle(photoMs, result),
            (error) => settle(photoMs, { ok: false, reason: reasonOf(error) }),
          ),
          convert(photo),
        ])
      } finally {
        photo.dispose()
      }
    })()
  }, [])

  const retake = useCallback(() => {
    busy.current = false
    generation.current++
    shownImage.current?.dispose()
    shownImage.current = null
    setState({ phase: 'live' })
  }, [])

  return { state, capture, retake }
}
