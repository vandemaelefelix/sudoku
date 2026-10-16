import { useMemo } from 'react'
import { type SharedValue, useAnimatedReaction, useSharedValue } from 'react-native-reanimated'
import { useFrameOutput } from 'react-native-vision-camera'
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets'
import { useGridDetector } from '@/scanner'
import { toPreview, uprightAspect } from '@/scan/utils/preview.utils'
import {
  countFrame,
  EMPTY_JITTER,
  EMPTY_WINDOW,
  type JitterReport,
  type Smoothing,
  smoothQuad,
  trackJitter,
} from '@/scan/utils/tracking.utils'
import type { Quad, ViewSize } from '@/utils/geometry.utils'
import { devLog, devWarn, errorMessage } from '@/utils/log.utils'
import { MEASURE_JITTER } from './useFrameTracking.constants'

/** One frame's result, from the camera thread to the UI thread. timestamp: seconds, camera clock. aspect: of the upright frame. */
export type FrameDetection = { quad: Quad | null; timestamp: number; aspect: number }

function logFrameRate(fps: number, detectionMs: number) {
  devLog('camera', `${fps.toFixed(1)} fps, detection ${detectionMs.toFixed(1)} ms`)
}

function warnDetector(message: string) {
  devWarn('camera', `grid detection failed: ${message}`)
}

function logJitter(report: JitterReport) {
  devLog(
    'outline',
    `max corner step ${report.maxStep.toFixed(2)} pt over ${report.frames} frames (${report.seconds.toFixed(1)} s)`,
  )
}

/**
 * The frame output that finds the grid in every camera frame, and the smoothed grid on the UI thread.
 * detection: the last frame's raw result. outline: the smoothed grid in view points. frameQuad: the same grid, normalised to the
 * upright frame.
 */
export function useFrameTracking(viewSize: SharedValue<ViewSize>) {
  const frameWindow = useMemo(() => createSynchronizable(EMPTY_WINDOW), [])
  const lastWarned = useMemo(() => createSynchronizable(''), [])
  const detectGrid = useGridDetector()
  const detection = useSharedValue<FrameDetection | null>(null)
  const smoothing = useSharedValue<Smoothing | null>(null)
  const jitter = useSharedValue(EMPTY_JITTER)
  const outline = useSharedValue<Quad | null>(null)
  const frameQuad = useSharedValue<Quad | null>(null)

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    onFrame(frame) {
      'worklet'
      try {
        const started = Date.now()
        let grid = null
        try {
          grid = detectGrid == null ? null : detectGrid(frame)
        } catch (error) {
          const message = errorMessage(error)
          if (__DEV__ && lastWarned.getBlocking() !== message) {
            lastWarned.setBlocking(message)
            scheduleOnRN(warnDetector, message)
          }
        }
        const counted = countFrame(frameWindow.getBlocking(), frame.timestamp, Date.now() - started)
        frameWindow.setBlocking(counted.window)
        if (__DEV__ && counted.report !== null)
          scheduleOnRN(logFrameRate, counted.report.fps, counted.report.detectionMs)
        detection.set({
          quad: grid == null ? null : grid.quad,
          timestamp: frame.timestamp,
          aspect: uprightAspect(frame.width, frame.height, frame.orientation),
        })
      } finally {
        frame.dispose()
      }
    },
  })

  useAnimatedReaction(
    () => detection.value,
    (current) => {
      if (current == null) return
      const smoothed = smoothQuad(smoothing.value, current.quad, current.timestamp)
      smoothing.set(smoothed)
      frameQuad.set(smoothed == null ? null : smoothed.quad)
      const shown = smoothed == null ? null : toPreview(smoothed.quad, current.aspect, viewSize.value)
      outline.set(shown)
      if (MEASURE_JITTER) {
        const tracked = trackJitter(jitter.value, shown, current.timestamp)
        jitter.set(tracked.window)
        if (tracked.report !== null) scheduleOnRN(logJitter, tracked.report)
      }
    },
  )

  return { frameOutput, detection, outline, frameQuad }
}
