import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import { useScannedStart } from '@/scan/hooks/useScannedStart'
import { CameraScreen } from '@/scan/screens/CameraScreen'
import type { CaptureResult, ScanOrigin } from '@/scan/utils/captureResult.utils'
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
      correctionLayout(
        { width, height },
        { top, bottom, left, right },
        theme.size.titleBlock,
        theme.size.panelEdge,
        theme.size.content,
      ),
    [width, height, top, bottom, left, right, theme.size.titleBlock, theme.size.panelEdge, theme.size.content],
  )
  const play = useScannedStart()
  const { enqueueScan, discardPhoto } = useScanShare()
  const router = useRouter()
  const home = useCallback(() => router.dismissTo('/'), [router])
  // A new key mounts a new CameraScreen: a new capture session, the effect scene, its warm-up and the flattened grid start new.
  const [scene, setScene] = useState(0)
  // True when the new camera screen opens the photo picker at once: the player chose another image after an import without a grid.
  const [pickAtStart, setPickAtStart] = useState(false)

  // A retake drops the scan, so nothing needs its photo any more.
  const retake = useCallback(
    (dropped: CaptureResult | null, next: ScanOrigin = 'camera') => {
      if (dropped?.ok && dropped.photoPath !== undefined) discardPhoto(dropped.photoPath)
      setPickAtStart(next === 'library')
      setScene((current) => current + 1)
    },
    [discardPhoto],
  )

  // Scan another accepts the scan. The photo stays: the unmount of the old screen hands the scan to exit, and the queue step
  // deletes the photo after it reads it.
  const scanAnother = useCallback(() => {
    setPickAtStart(false)
    setScene((current) => current + 1)
  }, [])

  // The player leaves the correction screen by any route except Retake. The scan is final then, so it joins the upload queue.
  // An imported image never uploads (ADR-030, amendment 2026-10-22). Only a development build keeps its photo, so it goes.
  const exit = useCallback(
    (result: CaptureResult | null, finalGrid: FinalGrid) => {
      if (!result?.ok) return
      if (result.imported) {
        if (result.photoPath !== undefined) discardPhoto(result.photoPath)
        return
      }
      void enqueueScan(result.photoPath, result, finalGrid)
    },
    [enqueueScan, discardPhoto],
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
        onScanAnother={scanAnother}
        onPlay={play}
        onHome={home}
        onClose={home}
        onExit={exit}
        pickAtStart={pickAtStart}
        {...(__DEV__ ? { onSave: saveScanCorrection } : {})}
      />
    </Animated.View>
  )
}
