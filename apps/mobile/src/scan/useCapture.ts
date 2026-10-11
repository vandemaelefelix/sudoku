import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CameraPhotoOutput } from 'react-native-vision-camera'
import { createScanner, type Quad, type RecogniseResult } from '../scanner'

export type CaptureState = { phase: 'live' } | { phase: 'recognising' } | { phase: 'result'; result: RecogniseResult }

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
    setState({ phase: 'recognising' })
    const started = Date.now()
    impactAsync(ImpactFeedbackStyle.Light).catch(() => undefined)
    void (async () => {
      let photoMs = 0
      let result: RecogniseResult
      try {
        const scanner = await createScanner()
        // The haptic is the feedback. The developer chose no shutter sound.
        const photo = await output.current.capturePhoto({ enableShutterSound: false }, {})
        photoMs = Date.now() - started
        try {
          result = await scanner.recognise(photo, quad)
        } finally {
          photo.dispose()
        }
      } catch (error) {
        result = { ok: false, reason: reasonOf(error) }
      }
      if (__DEV__) console.log(formatScanLog(photoMs, Date.now() - started, result))
      setState({ phase: 'result', result })
    })()
  }, [])

  const retake = useCallback(() => {
    busy.current = false
    setState({ phase: 'live' })
  }, [])

  return { state, capture, retake }
}
