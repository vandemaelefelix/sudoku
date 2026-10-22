import { useEffect, useRef, useState } from 'react'
import { type SharedValue, useAnimatedReaction, useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import type { CapturePhase } from '@/scan/hooks/useCaptureSession'
import type { FrameDetection } from '@/scan/hooks/useFrameTracking'
import type { CaptureResult, ScanOrigin } from '@/scan/utils/captureResult.utils'
import { formatHeap, formatRecognition, heapStats } from '@/scan/utils/scanMeasure.utils'
import { countFrame, EMPTY_JITTER, EMPTY_WINDOW, type JitterReport, trackJitter } from '@/scan/utils/tracking.utils'
import type { Quad } from '@/utils/geometry.utils'
import { isMeasuring, measureLog } from '@/utils/measure.utils'
import { HEAP_INTERVAL_MS } from './useScanMeasures.constants'

function logFps(fps: number) {
  measureLog('QR-05', `detection ${fps.toFixed(1)} fps`)
}

function logJitter(report: JitterReport) {
  measureLog(
    'QR-06',
    `max corner step ${report.maxStep.toFixed(2)} pt over ${report.frames} frames (${report.seconds.toFixed(1)} s)`,
  )
}

/**
 * The quality logs of one camera screen, in the development variant only (ADR-022). It reads the values that the
 * screen already has and changes none of them, so the scanner and the frame tracking stay as they are.
 * - QR-05: the time to the first grid and the first outline, and the detection frame rate.
 * - QR-06: the largest corner step of the drawn outline in each 5 s window.
 * - QR-07: the time from lock-on to the correction screen, and the recognition timings.
 * - QR-08: the JS heap every 30 s while the camera scans. Native memory and the thermal state need Instruments.
 * The first-outline times count on the JS thread, so they include one hop from the UI thread.
 */
export function useScanMeasures({
  detection,
  outline,
  phase,
  origin,
  result,
}: {
  detection: SharedValue<FrameDetection | null>
  outline: SharedValue<Quad | null>
  phase: CapturePhase
  origin: ScanOrigin
  result: CaptureResult | null
}) {
  const [enabled] = useState(isMeasuring)
  const [openedAt] = useState(Date.now)
  const firsts = useRef({ grid: false, outline: false })
  const frames = useSharedValue(EMPTY_WINDOW)
  const jitter = useSharedValue(EMPTY_JITTER)

  const logFirst = (what: 'grid' | 'outline') => {
    if (firsts.current[what]) return
    firsts.current[what] = true
    const label = what === 'grid' ? 'first grid found' : 'first outline'
    measureLog('QR-05', `${label} ${Date.now() - openedAt} ms after the camera screen opened`)
  }

  useAnimatedReaction(
    () => detection.value,
    (current) => {
      if (!enabled || current == null) return
      if (current.quad != null) scheduleOnRN(logFirst, 'grid')
      const counted = countFrame(frames.value, current.timestamp, 0)
      frames.set(counted.window)
      if (counted.report !== null) scheduleOnRN(logFps, counted.report.fps)
    },
  )

  useAnimatedReaction(
    () => outline.value,
    (shown) => {
      const timestamp = detection.value?.timestamp
      if (!enabled || timestamp == null) return
      if (shown != null) scheduleOnRN(logFirst, 'outline')
      const tracked = trackJitter(jitter.value, shown, timestamp)
      jitter.set(tracked.window)
      if (tracked.report !== null) scheduleOnRN(logJitter, tracked.report)
    },
  )

  const lockedAt = useRef<number | null>(null)
  useEffect(() => {
    if (!enabled || origin !== 'camera') return
    if (phase === 'capturing' && lockedAt.current === null) lockedAt.current = Date.now()
    if (phase === 'review' && lockedAt.current !== null) {
      measureLog('QR-07', `lock-on to the correction screen ${Date.now() - lockedAt.current} ms`)
      lockedAt.current = null
    }
  }, [enabled, phase, origin])

  useEffect(() => {
    if (enabled && result?.ok === true) measureLog('QR-07', formatRecognition(result.timings))
  }, [enabled, result])

  useEffect(() => {
    if (!enabled || phase !== 'live' || origin !== 'camera') return undefined
    const started = Date.now()
    const timer = setInterval(() => {
      const engine = (globalThis as { HermesInternal?: Parameters<typeof heapStats>[0] }).HermesInternal
      measureLog('QR-08', formatHeap(Date.now() - started, heapStats(engine)))
    }, HEAP_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [enabled, phase, origin])
}
