import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import type { RecogniseResult } from '@/scanner'
import { useScannedStart } from '@/scan/hooks/useScannedStart'
import { CameraScreen } from '@/scan/screens/CameraScreen'
import { correctionLayout, type CellLook } from '@/scan/utils/correction.utils'
import { saveScanCorrection } from '@/scan/utils/correctionStore'
import { useScanShare } from '@/scanShare/useScanShare'
import { easeOut } from '@/utils/motion.utils'
import { styles } from './ScanFlow.styles'

type Phase = { phase: 'live' } | { phase: 'review'; result: RecogniseResult }

/** Holds the scan phase. No router: the capture transition needs the camera and the correction screen on one screen. */
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
  const [phase, setPhase] = useState<Phase>({ phase: 'live' })
  // A new key mounts a new CameraScreen: the effect scene, its warm-up and the flattened grid start new.
  const [scene, setScene] = useState(0)

  // A retake drops the scan, so nothing needs its photo any more.
  const retake = useCallback(
    (dropped: RecogniseResult | null) => {
      if (dropped?.ok && dropped.photoPath !== undefined) discardPhoto(dropped.photoPath)
      setScene((current) => current + 1)
      setPhase({ phase: 'live' })
    },
    [discardPhoto],
  )
  const done = useCallback((result: RecogniseResult) => setPhase({ phase: 'review', result }), [])

  const review = phase.phase === 'review' ? phase.result : null
  const save = useCallback((looks: readonly CellLook[]) => saveScanCorrection(review, looks), [review])

  // The player leaves the correction screen by any route except Retake. The scan is final then, so it joins the upload queue.
  const exit = useCallback(
    (looks: readonly CellLook[]) => {
      if (review?.ok) void enqueueScan(review.photoPath, review, looks)
    },
    [review, enqueueScan],
  )

  const reviewProps = useMemo(
    () =>
      review === null ? undefined : { onPlay: play, onHome: home, onExit: exit, ...(__DEV__ ? { onSave: save } : {}) },
    [review, play, home, exit, save],
  )

  // The camera screen keeps its correction screen after the transition: the review shows the same screen, not a new one.
  // A retake crossfades from the review to the new camera. The first scene comes in with the route.
  const fade = theme.motion.medium
  return (
    <Animated.View
      key={scene}
      style={styles.scene}
      {...(scene > 0 ? { entering: FadeIn.duration(fade).easing(easeOut).reduceMotion(ReduceMotion.Never) } : {})}
      exiting={FadeOut.duration(fade).easing(easeOut).reduceMotion(ReduceMotion.Never)}
    >
      <CameraScreen layout={layout} onDone={done} onRetake={retake} {...(reviewProps ? { review: reviewProps } : {})} />
    </Animated.View>
  )
}
