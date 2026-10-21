import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { AppState, Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  FadeOut,
  ReduceMotion,
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
import { useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import type { RecogniseResult } from '@/scanner'
import { kvSettings } from '@/settings/SettingsRepository'
import { type CameraBlock, CameraPermission } from '@/scan/components/CameraPermission'
import { CloseButton } from '@/scan/components/CloseButton'
import { TransitionCanvas } from '@/scan/components/TransitionCanvas'
import { EffectCanvas } from '@/scan/effects/components/EffectCanvas'
import { EffectPicker } from '@/scan/effects/components/EffectPicker'
import { DEFAULT_INDEX } from '@/scan/effects/registry'
import { useCapture } from '@/scan/hooks/useCapture'
import { useCaptureTransition } from '@/scan/hooks/useCaptureTransition'
import { useFrameTracking } from '@/scan/hooks/useFrameTracking'
import { CorrectionScreen, type CorrectionProps } from '@/scan/screens/CorrectionScreen'
import type { CorrectionLayout } from '@/scan/utils/correction.utils'
import type { ViewSize } from '@/utils/geometry.utils'
import { pressedStyles } from '@/theme/pressed.styles'
import { easeOut } from '@/utils/motion.utils'
import { DARK_BAR_DIM, FLASH_PEAK } from './CameraScreen.constants'
import { styles } from './CameraScreen.styles'

/**
 * The live camera, from lock-on the capture transition, and after it the static correction screen.
 * layout: the correction screen layout that the transition ends on. onDone: called once when the transition ends, with an ok result.
 * onRetake: the parent mounts a new CameraScreen, so the scene, its lock-on latch and the transition start new. It gets the result
 * that the player leaves, so the parent can delete its photo.
 * onClose: the close button before the capture. The correction screen has its own exits.
 * review: set by the parent after onDone. The correction screen of the transition stays mounted and becomes the static screen, so
 * its Skia canvases have drawn before they show. The camera and the transition layers unmount.
 */
export function CameraScreen({
  layout,
  onDone,
  onRetake,
  onClose,
  review,
}: {
  layout: CorrectionLayout
  onDone: (result: RecogniseResult) => void
  onRetake: (result: RecogniseResult | null) => void
  onClose: () => void
  review?: Pick<CorrectionProps, 'onPlay' | 'onSave' | 'onExit' | 'onHome'>
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
  const reduceMotion = useReducedMotion()
  const { frameOutput, detection, outline, frameQuad } = useFrameTracking(viewSize)
  const { startCapture, capturing, crossFade, clock, waiting, resultsAt, captureFrame, stepClock } =
    useCaptureTransition({ state, capture, layout, onDone, detection, viewSize, reduceMotion })
  const { theme } = useUnistyles()
  // True once the theme background covers the camera: the bar then takes the theme style, not the light style over the camera.
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

  const blocked = (block: CameraBlock) => (
    <>
      <CameraPermission block={block} />
      <CloseButton onPress={onClose} overCamera={false} />
    </>
  )
  if (!hasPermission) return blocked(canRequestPermission ? 'waiting' : 'denied')
  if (device == null) return blocked('missing')
  return (
    <View
      testID="camera-screen"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        viewSize.set({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })
      }}
    >
      <StatusBar style={darkBar || review ? theme.statusBar : 'light'} />
      {/* When the photo draws, the camera stops. The photo covers the last preview frame. */}
      {!review && (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isActive && capturing?.image == null}
          outputs={[frameOutput, photoOutput]}
          orientationSource="interface"
        />
      )}
      {capturing != null && !review && (
        <TransitionCanvas
          capture={captureFrame}
          view={viewSize}
          image={sharedImage}
          locked={capturing.quad}
          crossFade={crossFade}
          side={layout.grid.width}
        />
      )}
      {!review && (
        <EffectCanvas
          outline={outline}
          view={viewSize}
          effect={effect}
          frameQuad={frameQuad}
          onLock={startCapture}
          capture={captureFrame}
          beforeFrame={stepClock}
        />
      )}
      {capturing != null ? (
        <CorrectionScreen
          result={capturing.result}
          layout={layout}
          onRetake={() => onRetake(capturing.result)}
          {...(review ?? { clock, reduceMotion: crossFade, waiting, resultsAt })}
        />
      ) : (
        <>
          <Animated.View
            exiting={FadeOut.duration(theme.motion.short).easing(easeOut).reduceMotion(ReduceMotion.Never)}
            style={styles.bottom}
            pointerEvents="box-none"
          >
            <Pressable
              testID="shutter"
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              style={({ pressed }) => [styles.shutter, pressed && pressedStyles.pressed]}
              onPress={() => startCapture(frameQuad.get(), 'tap')}
            />
          </Animated.View>
          <Animated.View
            exiting={FadeOut.duration(theme.motion.short).easing(easeOut).reduceMotion(ReduceMotion.Never)}
            style={StyleSheet.absoluteFill}
            pointerEvents="box-none"
          >
            <CloseButton onPress={onClose} overCamera />
          </Animated.View>
          {__DEV__ ? <EffectPicker effect={effect} settings={kvSettings} /> : null}
        </>
      )}
      {capturing != null && !review && (
        <Animated.View testID="capture-flash" pointerEvents="none" style={[styles.flash, flashStyle]} />
      )}
    </View>
  )
}
