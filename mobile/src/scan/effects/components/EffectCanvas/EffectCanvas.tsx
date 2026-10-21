import { Canvas, createPicture, Picture } from '@shopify/react-native-skia'
import { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { type SharedValue, useFrameCallback, useReducedMotion, useSharedValue } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { countFrame, EMPTY_WINDOW } from '@/scan/utils/tracking.utils'
import type { CaptureSession } from '@/scan/hooks/useCaptureSession'
import {
  advance,
  advanceCapture,
  type Engine,
  formatLockReport,
  type LockReport,
  lockReport,
} from '@/scan/effects/engine'
import { DEFAULT_EFFECT, EFFECTS, effectAt } from '@/scan/effects/registry'
import { makeDrawKit } from '@/scan/effects/kit'
import type { Quad, ViewSize } from '@/utils/geometry.utils'
import { devLog } from '@/utils/log.utils'
import { LOCK_LOG_INTERVAL } from './EffectCanvas.constants'

function logOverlay(id: string, fps: number, overlayMs: number) {
  devLog('fx', `${id} ${fps.toFixed(1)} fps, overlay ${overlayMs.toFixed(2)} ms`)
}

function logLock(report: LockReport) {
  devLog('lock', formatLockReport(report))
}

function logLockWithoutQuad() {
  devLog('lock', 'locked, but frameQuad is null: startCapture not called')
}

/**
 * outline: the smoothed grid in view points, or null. view: the size of the camera view in points.
 * effect: an index into EFFECTS. Only the JS thread writes it, and only when the developer picks an effect.
 * frameQuad: the same grid, normalised to the upright frame.
 * session: the capture session. The overlay steps its clock first in each UI frame, so it draws the grid of this frame. It calls
 * startCapture once per scene, on the JS thread, with frameQuad at lock-on. While the session has a captureFrame, the dots follow
 * its quad, outline is ignored and the overlay does not lock on.
 */
export function EffectCanvas({
  outline,
  view,
  effect,
  frameQuad,
  session,
}: {
  outline: SharedValue<Quad | null>
  view: SharedValue<ViewSize>
  effect: SharedValue<number>
  frameQuad: SharedValue<Quad | null>
  session: Pick<CaptureSession, 'startCapture' | 'stepClock' | 'captureFrame'>
}) {
  // The frame worklet captures these names, as it captured the props before.
  const { startCapture, stepClock, captureFrame } = session
  // Reanimated reads the setting once at app start, so a change takes effect after a restart.
  const reduceMotion = useReducedMotion()
  const { theme } = useUnistyles()
  const ink = theme.components.grid.boxLine
  // A release build runs only the default effect, so it compiles no other shader (ADR-014).
  // A new theme makes a new kit, so the frame worklet captures the new ink (ADR-015, point 10).
  const kit = useMemo(() => makeDrawKit(__DEV__ ? EFFECTS : [DEFAULT_EFFECT], ink), [ink])
  const empty = useMemo(
    () =>
      createPicture(() => {
        'worklet'
      }),
    [],
  )
  const engine = useSharedValue<Engine | null>(null)
  const picture = useSharedValue(empty)
  const timing = useSharedValue(EMPTY_WINDOW)
  const lockLoggedAt = useSharedValue(-1)

  useFrameCallback((frame) => {
    'worklet'
    stepClock(frame.timestamp)
    const size = view.get()
    if (size.width <= 0 || size.height <= 0) return
    const t = frame.timestamp / 1000
    const started = Date.now()
    const index = effect.get()
    const active = effectAt(index)
    const quad = outline.get()
    const captured = captureFrame.get()
    engine.modify((current) => {
      'worklet'
      if (captured != null && current != null)
        return advanceCapture(current, active, captured.quad, t, captured.channels, captured.crossFade)
      return advance(current, active, size, quad, t, reduceMotion)
    }, true)
    const now = engine.get()
    if (now == null) return
    // The tracker fires in the frame of lock-on only, so the quad crosses to the JS thread once.
    if (captured == null && now.lockOn.fired) {
      const locked = frameQuad.get()
      if (locked != null) scheduleOnRN(startCapture, locked, 'auto')
      else if (__DEV__) scheduleOnRN(logLockWithoutQuad)
    }
    if (__DEV__ && captured == null) {
      const last = lockLoggedAt.get()
      if (last < 0 || t - last >= LOCK_LOG_INTERVAL) {
        lockLoggedAt.set(t)
        scheduleOnRN(logLock, lockReport(now))
      }
    }
    picture.set(
      createPicture((canvas) => {
        'worklet'
        active.draw(canvas, now.state, now.scene, kit)
      }),
    )
    if (__DEV__) {
      const result = countFrame(timing.get(), t, Date.now() - started)
      timing.set(result.window)
      if (result.report !== null) scheduleOnRN(logOverlay, active.id, result.report.fps, result.report.detectionMs)
    }
  })

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  )
}
