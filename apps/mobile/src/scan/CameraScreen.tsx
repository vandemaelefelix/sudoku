import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Button, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated'
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  usePhotoOutput,
} from 'react-native-vision-camera'
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets'
import { kvSettings } from '../settings/SettingsRepository'
import { type Quad, type RecogniseResult, useGridDetector } from '../scanner'
import { useColors } from '../theme/colors'
import { CorrectionScreen } from './correction/CorrectionScreen'
import type { CorrectionLayout } from './correction/layout'
import { countFrame, EMPTY_WINDOW } from './frameRate'
import { DEFAULT_INDEX } from './effects'
import { EffectCanvas } from './effects/EffectCanvas'
import { EffectPicker } from './effects/EffectPicker'
import { EMPTY_JITTER, type JitterReport, trackJitter } from './jitter'
import { toPreview, uprightAspect, type ViewSize } from './previewMapping'
import { type Smoothing, smoothQuad } from './smoothing'
import {
  advanceClock,
  GATE_RESULTS,
  type Gates,
  SPINNER_DELAY,
  transitionAt,
  transitionEnd,
} from './transition/timeline'
import { type CaptureFrame, TransitionCanvas } from './transition/TransitionCanvas'
import { lerpQuad, rectQuad } from './transition/warp'
import { useCapture } from './useCapture'

/** One frame's result, from the camera thread to the UI thread. timestamp: seconds, camera clock. aspect: of the upright frame. */
export type FrameDetection = { quad: Quad | null; timestamp: number; aspect: number }

/**
 * The path of the grid in view points: from the locked grid in the preview to the grid square of the correction screen.
 * crossFade: no warp. The grid stays on the square, and the Reduce Motion channels fade the layers.
 */
type TransitionPlan = { from: Quad; to: Quad; crossFade: boolean }

/** Seconds. A stall of the UI thread must not skip a part of the transition. */
const MAX_CLOCK_STEP = 0.05
const FLASH_PEAK = 0.25

const MEASURE_JITTER = __DEV__

function logFrameRate(fps: number, detectionMs: number) {
  console.log(`[camera] ${fps.toFixed(1)} fps, detection ${detectionMs.toFixed(1)} ms`)
}

function warnDetector(message: string) {
  console.warn(`[camera] grid detection failed: ${message}`)
}

function logJitter(report: JitterReport) {
  console.log(
    `[outline] max corner step ${report.maxStep.toFixed(2)} pt over ${report.frames} frames (${report.seconds.toFixed(1)} s)`,
  )
}

/**
 * Advances the transition clock once per UI frame and publishes the moving grid with its channels.
 * This is a component before EffectCanvas, not a hook of CameraScreen. Frame callbacks run in the order of registration, and
 * React registers the effects of siblings in tree order. So the dots read the grid of this frame, not the grid of the last frame.
 */
function TransitionClock({
  plan,
  gates,
  clock,
  waiting,
  capture,
  onEnd,
}: {
  plan: SharedValue<TransitionPlan | null>
  gates: SharedValue<Gates>
  clock: SharedValue<number>
  waiting: SharedValue<boolean>
  capture: SharedValue<CaptureFrame | null>
  onEnd: () => void
}) {
  const lastFrame = useSharedValue(-1)
  const held = useSharedValue(0)
  const ended = useSharedValue(false)
  useFrameCallback((frame) => {
    'worklet'
    const path = plan.get()
    if (path == null) return
    const now = frame.timestamp / 1000
    const previous = lastFrame.get()
    lastFrame.set(now)
    const dt = previous < 0 ? 0 : Math.min(MAX_CLOCK_STEP, Math.max(0, now - previous))
    const open = gates.get()
    const t = advanceClock(clock.get(), dt, open, path.crossFade)
    clock.set(t)
    const resultsGate = path.crossFade ? 0 : GATE_RESULTS
    held.set(!open.results && t >= resultsGate ? held.get() + dt : 0)
    waiting.set(held.get() > SPINNER_DELAY)
    const channels = transitionAt(t, path.crossFade)
    capture.set({ quad: path.crossFade ? path.to : lerpQuad(path.from, path.to, channels.flatten), channels })
    if (t >= transitionEnd(path.crossFade) && !ended.get()) {
      ended.set(true)
      scheduleOnRN(onEnd)
    }
  })
  return null
}

/**
 * The live camera, and from lock-on the capture transition into the correction screen.
 * layout: the correction screen layout that the transition ends on. onDone: called once when the transition ends, with an ok result.
 * onRetake: the parent mounts a new CameraScreen, so the scene, its lock-on latch and the transition start new.
 */
export function CameraScreen({
  layout,
  onDone,
  onRetake,
}: {
  layout: CorrectionLayout
  onDone: (result: RecogniseResult) => void
  onRetake: () => void
}) {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back')
  const [isActive, setIsActive] = useState(AppState.currentState === 'active')
  const frameWindow = useMemo(() => createSynchronizable(EMPTY_WINDOW), [])
  const lastWarned = useMemo(() => createSynchronizable(''), [])
  const detectGrid = useGridDetector()
  const detection = useSharedValue<FrameDetection | null>(null)
  const viewSize = useSharedValue<ViewSize>({ width: 0, height: 0 })
  const smoothing = useSharedValue<Smoothing | null>(null)
  const jitter = useSharedValue(EMPTY_JITTER)
  const outline = useSharedValue<Quad | null>(null)
  const effect = useSharedValue(DEFAULT_INDEX)
  const frameQuad = useSharedValue<Quad | null>(null)
  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.UHD_16_9,
    // 'speed' throws on a device without it (VisionCamera, PhotoOutputOptions).
    qualityPrioritization: device?.supportsSpeedQualityPrioritization === true ? 'speed' : 'balanced',
  })
  const { state, capture } = useCapture(photoOutput)
  const colors = useColors()
  const reduceMotion = useReducedMotion()
  const clock = useSharedValue(0)
  const waiting = useSharedValue(false)
  const plan = useSharedValue<TransitionPlan | null>(null)
  const gates = useSharedValue<Gates>({ photo: false, results: false })
  const captureFrame = useSharedValue<CaptureFrame | null>(null)
  const [lockedView, setLockedView] = useState<Quad | null>(null)
  const lockedAt = useRef<number | null>(null)
  const latestResult = useRef<RecogniseResult | null>(null)

  // capture keeps its identity, so this does too: the UI thread holds it as onLock from the first frame.
  const startCapture = useCallback(
    (quad: Quad | null) => {
      if (lockedAt.current != null) return
      lockedAt.current = Date.now()
      // The frame aspect at lock-on: the photo has the field of view of the frames.
      const aspect = detection.get()?.aspect ?? 0
      setLockedView(quad == null ? null : toPreview(quad, aspect, viewSize.get()))
      capture(quad)
    },
    [capture, detection, viewSize],
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
    plan.set({ from: lockedView ?? to, to, crossFade })
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
    if (__DEV__ && lockedAt.current != null) console.log(`[scan] transition done in ${Date.now() - lockedAt.current} ms`)
    onDone(done)
  }, [onDone])

  const flashStyle = useAnimatedStyle(() => ({ opacity: FLASH_PEAK * (captureFrame.value?.channels.flash ?? 0) }))

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
          const message = error instanceof Error ? error.message : String(error)
          if (__DEV__ && lastWarned.getBlocking() !== message) {
            lastWarned.setBlocking(message)
            scheduleOnRN(warnDetector, message)
          }
        }
        const counted = countFrame(frameWindow.getBlocking(), frame.timestamp, Date.now() - started)
        frameWindow.setBlocking(counted.window)
        if (__DEV__ && counted.report !== null) scheduleOnRN(logFrameRate, counted.report.fps, counted.report.detectionMs)
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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setIsActive(next === 'active'))
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    if (canRequestPermission) void requestPermission()
  }, [canRequestPermission, requestPermission])

  if (!hasPermission) {
    if (canRequestPermission) {
      return (
        <View testID="camera-waiting" style={styles.message}>
          <StatusBar style="dark" />
        </View>
      )
    }
    return (
      <View testID="camera-denied" style={styles.message}>
        <StatusBar style="dark" />
        <Text style={styles.text}>Sudoku needs the camera to scan a puzzle.</Text>
        <Button testID="open-settings" title="Open Settings" onPress={() => void Linking.openSettings()} />
      </View>
    )
  }
  if (device == null) {
    return (
      <View testID="camera-missing" style={styles.message}>
        <StatusBar style="dark" />
        <Text style={styles.text}>This phone has no back camera.</Text>
      </View>
    )
  }
  return (
    <View
      testID="camera-screen"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        viewSize.set({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })
      }}
    >
      <StatusBar style={capturing == null ? 'light' : 'dark'} />
      {/* When the photo draws, the camera stops. The photo covers the last preview frame. */}
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive && capturing?.image == null}
        outputs={[frameOutput, photoOutput]}
        orientationSource="interface"
      />
      {capturing != null && (
        <TransitionCanvas
          capture={captureFrame}
          view={viewSize}
          image={capturing.image}
          locked={capturing.quad}
          crossFade={crossFade}
          side={layout.grid.width}
          colors={colors}
        />
      )}
      <TransitionClock plan={plan} gates={gates} clock={clock} waiting={waiting} capture={captureFrame} onEnd={finish} />
      <EffectCanvas
        outline={outline}
        view={viewSize}
        effect={effect}
        frameQuad={frameQuad}
        onLock={startCapture}
        capture={captureFrame}
      />
      {capturing != null ? (
        <CorrectionScreen
          result={capturing.result}
          layout={layout}
          onRetake={onRetake}
          clock={clock}
          reduceMotion={crossFade}
          waiting={waiting}
        />
      ) : (
        <>
          <View style={styles.bottom} pointerEvents="box-none">
            <Pressable
              testID="shutter"
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              style={styles.shutter}
              onPress={() => startCapture(frameQuad.get())}
            />
          </View>
          {__DEV__ ? <EffectPicker effect={effect} settings={kvSettings} /> : null}
        </>
      )}
      {capturing != null && <Animated.View testID="capture-flash" pointerEvents="none" style={[styles.flash, flashStyle]} />}
    </View>
  )
}

const styles = StyleSheet.create({
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  text: { fontSize: 17, textAlign: 'center' },
  flash: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'white' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 48, alignItems: 'center' },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'white',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
})
