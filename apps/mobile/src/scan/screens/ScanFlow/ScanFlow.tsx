import { StatusBar } from 'expo-status-bar'
import { useCallback, useMemo, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import type { RecogniseResult } from '@/scanner'
import { useScannedStart } from '@/scan/hooks/useScannedStart'
import { CameraScreen } from '@/scan/screens/CameraScreen'
import { CorrectionScreen } from '@/scan/screens/CorrectionScreen'
import { correctionLayout, type CellLook } from '@/scan/utils/correction.utils'
import { saveScanCorrection } from '@/scan/utils/correctionStore'

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
  const [phase, setPhase] = useState<Phase>({ phase: 'live' })
  // A new key mounts a new CameraScreen: the effect scene, its warm-up and the flattened grid start new.
  const [scene, setScene] = useState(0)

  const retake = useCallback(() => {
    setScene((current) => current + 1)
    setPhase({ phase: 'live' })
  }, [])
  const done = useCallback((result: RecogniseResult) => setPhase({ phase: 'review', result }), [])

  const review = phase.phase === 'review' ? phase.result : null
  const save = useCallback((looks: readonly CellLook[]) => saveScanCorrection(review, looks), [review])

  if (phase.phase === 'review') {
    return (
      <>
        <StatusBar style={theme.statusBar} />
        <CorrectionScreen
          result={phase.result}
          layout={layout}
          onRetake={retake}
          onPlay={play}
          {...(__DEV__ ? { onSave: save } : {})}
        />
      </>
    )
  }
  return <CameraScreen key={scene} layout={layout} onDone={done} onRetake={retake} />
}
