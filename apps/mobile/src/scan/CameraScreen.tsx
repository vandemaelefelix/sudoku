import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useState } from 'react'
import { AppState, Button, Linking, StyleSheet, Text, View } from 'react-native'
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated'
import { Camera, useCameraDevice, useCameraPermission, useFrameOutput } from 'react-native-vision-camera'
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets'
import { type Quad, useGridDetector } from '../scanner'
import { countFrame, EMPTY_WINDOW } from './frameRate'
import { DEFAULT_INDEX } from './effects'
import { EffectCanvas } from './effects/EffectCanvas'
import { EMPTY_JITTER, type JitterReport, trackJitter } from './jitter'
import { toPreview, uprightAspect, type ViewSize } from './previewMapping'
import { type Smoothing, smoothQuad } from './smoothing'

/** One frame's result, from the camera thread to the UI thread. timestamp: seconds, camera clock. aspect: of the upright frame. */
export type FrameDetection = { quad: Quad | null; timestamp: number; aspect: number }

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

export function CameraScreen() {
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
        const result = countFrame(frameWindow.getBlocking(), frame.timestamp, Date.now() - started)
        frameWindow.setBlocking(result.window)
        if (__DEV__ && result.report !== null) scheduleOnRN(logFrameRate, result.report.fps, result.report.detectionMs)
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
      const shown = smoothed == null ? null : toPreview(smoothed.quad, current.aspect, viewSize.value)
      outline.set(shown)
      if (MEASURE_JITTER) {
        const result = trackJitter(jitter.value, shown, current.timestamp)
        jitter.set(result.window)
        if (result.report !== null) scheduleOnRN(logJitter, result.report)
      }
    },
  )

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setIsActive(state === 'active'))
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
      <StatusBar style="light" />
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        outputs={[frameOutput]}
        orientationSource="interface"
      />
      <EffectCanvas outline={outline} view={viewSize} effect={effect} />
    </View>
  )
}

const styles = StyleSheet.create({
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  text: { fontSize: 17, textAlign: 'center' },
})
