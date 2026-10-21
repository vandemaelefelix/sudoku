import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import { useScannedStart } from '@/scan/hooks/useScannedStart'
import { CameraScreen } from '@/scan/screens/CameraScreen'
import type { CaptureResult } from '@/scan/utils/captureResult.utils'
import { correctionLayout } from '@/scan/utils/correction.utils'
import { saveScanCorrection } from '@/scan/utils/correctionStore'
import { useScanShare } from '@/scanShare/useScanShare'
import type { FinalGrid } from '@/utils/finalGrid.utils'
import { easeOut } from '@/utils/motion.utils'
import { styles } from './ScanFlow.styles'

/** Holds the scene and the actions that leave the scan. No router: the capture transition needs the camera and the correction screen on one screen. */
export function ScanFlow() {
  const { theme } = useUnistyles()
  const { width, height } = useWindowDimensions()
  const { top, bottom, left, right } = useSafeAreaInsets()
  const layout = useMemo(
    () =>
      correctionLayout({ width, height }, { top, bottom, left, right }, theme.size.titleBlock, theme.size.panelEdge),
    [width, height, top, bottom, left, right, theme.size.titleBlock, theme.size.panelEdge],
  )
  const play = useScannedStart()
  const { enqueueScan, discardPhoto } = useScanShare()
  const router = useRouter()
  const home = useCallback(() => router.dismissTo('/'), [router])
  // A new key mounts a new CameraScreen: a new capture session, the effect scene, its warm-up and the flattened grid start new.
  const [scene, setScene] = useState(0)

  // A retake drops the scan, so nothing needs its photo any more.
  const retake = useCallback(
    (dropped: CaptureResult | null) => {
      if (dropped?.ok && dropped.photoPath !== undefined) discardPhoto(dropped.photoPath)
      setScene((current) => current + 1)
    },
    [discardPhoto],
  )

  // The player leaves the correction screen by any route except Retake. The scan is final then, so it joins the upload queue.
  const exit = useCallback(
    (result: CaptureResult | null, finalGrid: FinalGrid) => {
      if (result?.ok) void enqueueScan(result.photoPath, result, finalGrid)
    },
    [enqueueScan],
  )

  // A retake crossfades from the review to the new camera. The first scene comes in with the route.
  const fade = theme.motion.medium
  return (
    <Animated.View
      key={scene}
      style={styles.scene}
      {...(scene > 0 ? { entering: FadeIn.duration(fade).easing(easeOut).reduceMotion(ReduceMotion.Never) } : {})}
      exiting={FadeOut.duration(fade).easing(easeOut).reduceMotion(ReduceMotion.Never)}
    >
      <CameraScreen
        layout={layout}
        onRetake={retake}
        onPlay={play}
        onHome={home}
        onClose={home}
        onExit={exit}
        {...(__DEV__ ? { onSave: saveScanCorrection } : {})}
      />
    </Animated.View>
  )
}
