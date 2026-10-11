import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { AppState, Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated'
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera'
import { scheduleOnRN } from 'react-native-worklets'
import type { RecogniseResult } from '@/scanner'
import { kvSettings } from '@/settings/SettingsRepository'
import { useColors } from '@/theme/colors'
import { CameraPermission } from '@/scan/components/CameraPermission'
import { TransitionCanvas } from '@/scan/components/TransitionCanvas'
import { EffectCanvas } from '@/scan/effects/components/EffectCanvas'
import { EffectPicker } from '@/scan/effects/components/EffectPicker'
import { DEFAULT_INDEX } from '@/scan/effects/registry'
import { useCapture } from '@/scan/hooks/useCapture'
import { useCaptureTransition } from '@/scan/hooks/useCaptureTransition'
import { useFrameTracking } from '@/scan/hooks/useFrameTracking'
import { CorrectionScreen } from '@/scan/screens/CorrectionScreen'
import type { CorrectionLayout } from '@/scan/utils/correction.utils'
import type { ViewSize } from '@/utils/geometry.utils'
import { DARK_BAR_DIM, FLASH_PEAK } from './CameraScreen.constants'
import { styles } from './CameraScreen.styles'

/**
 * The live camera, and from lock-on the capture transition into the correction screen.
 * layout: the correction screen layout that the transition ends on. onDone: called once when the transition ends, with an ok result.
 * onRetake: the parent mounts a new CameraScreen, so the scene, its lock-on latch and the transition start new.
 * armed: false for a CameraScreen after a Retake, so auto lock-on waits for a change of view (scan-pipeline concept).
 */
export function CameraScreen({
  layout,
  onDone,
  onRetake,
  armed = true,
}: {
  layout: CorrectionLayout
  onDone: (result: RecogniseResult) => void
  onRetake: () => void
  armed?: boolean
}) {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back')
  const [isActive, setIsActive] = useState(AppState.currentState === 'active')
  const viewSize = useSharedValue<ViewSize>({ width: 0, height: 0 })
  const effect = useSharedValue(DEFAULT_INDEX)
  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.UHD_16_9,
    // 'speed' throws on a device without it (VisionCamera, PhotoOutputOptions).
    qualityPrioritization: device?.supportsSpeedQualityPrioritization === true ? 'speed' : 'balanced',
  })
  const { state, capture, sharedImage } = useCapture(photoOutput)
  const colors = useColors()
  const reduceMotion = useReducedMotion()
  const { frameOutput, detection, outline, frameQuad } = useFrameTracking(viewSize)
  const { startCapture, capturing, crossFade, clock, waiting, resultsAt, captureFrame, stepClock } =
    useCaptureTransition({ state, capture, layout, onDone, detection, viewSize, reduceMotion })
  const [darkBar, setDarkBar] = useState(false)

  const flashStyle = useAnimatedStyle(() => ({ opacity: FLASH_PEAK * (captureFrame.value?.channels.flash ?? 0) }))

  useAnimatedReaction(
    () => (captureFrame.value?.channels.dim ?? 0) > DARK_BAR_DIM,
    (dark, previous) => {
      if (dark !== previous) scheduleOnRN(setDarkBar, dark)
    },
  )

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setIsActive(next === 'active'))
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    if (canRequestPermission) void requestPermission()
  }, [canRequestPermission, requestPermission])

  if (!hasPermission) return <CameraPermission block={canRequestPermission ? 'waiting' : 'denied'} />
  if (device == null) return <CameraPermission block="missing" />
  return (
    <View
      testID="camera-screen"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        viewSize.set({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })
      }}
    >
      <StatusBar style={darkBar ? 'dark' : 'light'} />
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
          image={sharedImage}
          locked={capturing.quad}
          crossFade={crossFade}
          side={layout.grid.width}
          colors={colors}
        />
      )}
      <EffectCanvas
        outline={outline}
        view={viewSize}
        effect={effect}
        frameQuad={frameQuad}
        onLock={startCapture}
        capture={captureFrame}
        beforeFrame={stepClock}
        armed={armed}
      />
      {capturing != null ? (
        <CorrectionScreen
          result={capturing.result}
          layout={layout}
          onRetake={onRetake}
          clock={clock}
          reduceMotion={crossFade}
          waiting={waiting}
          resultsAt={resultsAt}
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
      {capturing != null && (
        <Animated.View testID="capture-flash" pointerEvents="none" style={[styles.flash, flashStyle]} />
      )}
    </View>
  )
}
