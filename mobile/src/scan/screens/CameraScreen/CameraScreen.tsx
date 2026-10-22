import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AppState, Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  FadeOut,
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
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
import { kvSettings } from '@/settings/SettingsRepository'
import { type CameraBlock, CameraPermission } from '@/scan/components/CameraPermission'
import { CloseButton } from '@/scan/components/CloseButton'
import { LibraryButton } from '@/scan/components/LibraryButton'
import { TransitionCanvas } from '@/scan/components/TransitionCanvas'
import { EffectCanvas } from '@/scan/effects/components/EffectCanvas'
import { EffectPicker } from '@/scan/effects/components/EffectPicker'
import { DEFAULT_INDEX } from '@/scan/effects/registry'
import { useCaptureSession } from '@/scan/hooks/useCaptureSession'
import { useFrameTracking } from '@/scan/hooks/useFrameTracking'
import { useImageImport } from '@/scan/hooks/useImageImport'
import { useScanMeasures } from '@/scan/hooks/useScanMeasures'
import { CorrectionScreen, type CorrectionProps } from '@/scan/screens/CorrectionScreen'
import type { CaptureResult, ScanOrigin } from '@/scan/utils/captureResult.utils'
import type { CorrectionLayout } from '@/scan/utils/correction.utils'
import type { FinalGrid } from '@/utils/finalGrid.utils'
import type { ViewSize } from '@/utils/geometry.utils'
import { pressedStyles } from '@/theme/pressed.styles'
import { easeOut } from '@/utils/motion.utils'
import { DARK_BAR_DIM, FLASH_PEAK, PICK_FAILED } from './CameraScreen.constants'
import { styles } from './CameraScreen.styles'

/**
 * The live camera, from lock-on the capture transition, and after it the static correction screen. The capture session holds the
 * state of all three: every layer reads it.
 * layout: the correction screen layout that the transition ends on. onClose: the close button before the capture. The correction
 * screen has its own exits.
 * onRetake: the parent mounts a new CameraScreen, so the capture session, the scene, its lock-on latch and the transition start new.
 * It gets the result that the player leaves, so the parent can delete its photo. next is library when the player chose another
 * image after an import without a grid: the parent then mounts the new screen with pickAtStart.
 * pickAtStart: the photo picker opens when the screen mounts.
 * The library button opens the photo picker. The import needs no camera, so the denied and missing screens offer it too.
 * onScanAnother: the same new CameraScreen after the player accepted the scan. The parent keeps the photo, because onExit hands
 * the scan to the upload queue when the correction screen unmounts.
 * onExit and onSave get the result of the scan with its final grid. The correction screen of the transition stays mounted
 * and becomes the static screen at the end, so its Skia canvases have drawn before they show. The camera and the transition layers
 * unmount.
 */
export function CameraScreen({
  layout,
  onRetake,
  onScanAnother,
  onPlay,
  onHome,
  onClose,
  onExit,
  onSave,
  pickAtStart = false,
}: {
  layout: CorrectionLayout
  onRetake: (result: CaptureResult | null, next?: ScanOrigin) => void
  onScanAnother: () => void
  onPlay: NonNullable<CorrectionProps['onPlay']>
  onHome: () => void
  onClose: () => void
  onExit: (result: CaptureResult | null, finalGrid: FinalGrid) => void
  onSave?: (result: CaptureResult | null, finalGrid: FinalGrid) => Promise<boolean>
  pickAtStart?: boolean
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
  const { frameOutput, detection, outline, frameQuad } = useFrameTracking(viewSize)
  const session = useCaptureSession({ photoOutput, layout, detection, viewSize })
  const { phase, origin, result, captureFrame } = session
  useScanMeasures({ detection, outline, phase, origin, result })
  const library = useImageImport()
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

  const { choose } = library
  const { startImport } = session
  const chooseImage = useCallback(async () => {
    const pick = await choose()
    if (pick.kind === 'picked') startImport(pick.uri)
    else if (pick.kind === 'failed') Alert.alert(PICK_FAILED.title, PICK_FAILED.message)
  }, [choose, startImport])

  const pickedAtStart = useRef(false)
  useEffect(() => {
    if (!pickAtStart || pickedAtStart.current) return
    pickedAtStart.current = true
    void chooseImage()
  }, [pickAtStart, chooseImage])

  // The camera runs only for a live scan. The picker covers it, and an import has no use for it.
  const cameraOn = isActive && !session.photoShown && !library.picking && origin === 'camera'
  let block: CameraBlock | null = null
  if (!hasPermission) block = canRequestPermission ? 'waiting' : 'denied'
  else if (device == null) block = 'missing'
  if (block != null && phase === 'live') {
    return (
      <>
        <CameraPermission block={block} onChooseImage={() => void chooseImage()} />
        <CloseButton onPress={onClose} overCamera={false} />
      </>
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
      <StatusBar style={darkBar || phase === 'review' ? theme.statusBar : 'light'} />
      {/* When the photo draws, the camera stops. The photo covers the last preview frame. */}
      {phase !== 'review' && device != null && block == null && (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={cameraOn}
          outputs={[frameOutput, photoOutput]}
          orientationSource="interface"
        />
      )}
      {phase === 'capturing' && <TransitionCanvas session={session} view={viewSize} side={layout.grid.width} />}
      {phase !== 'review' && (
        <EffectCanvas outline={outline} view={viewSize} effect={effect} frameQuad={frameQuad} session={session} />
      )}
      {phase !== 'live' ? (
        <CorrectionScreen
          session={session}
          layout={layout}
          onRetake={() => onRetake(result)}
          onChooseImage={() => onRetake(result, 'library')}
          onScanAnother={onScanAnother}
          onPlay={onPlay}
          onHome={onHome}
          onExit={(finalGrid) => onExit(result, finalGrid)}
          {...(onSave ? { onSave: (finalGrid: FinalGrid) => onSave(result, finalGrid) } : {})}
        />
      ) : (
        <>
          <Animated.View
            exiting={FadeOut.duration(theme.motion.short).easing(easeOut).reduceMotion(ReduceMotion.Never)}
            style={styles.bottom}
            pointerEvents="box-none"
          >
            <View style={styles.library}>
              <LibraryButton onPress={() => void chooseImage()} disabled={library.picking} />
            </View>
            <Pressable
              testID="shutter"
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              style={({ pressed }) => [styles.shutter, pressed && pressedStyles.pressed]}
              onPress={() => session.startCapture(frameQuad.get(), 'shutter')}
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
      {phase === 'capturing' && (
        <Animated.View testID="capture-flash" pointerEvents="none" style={[styles.flash, flashStyle]} />
      )}
    </View>
  )
}
