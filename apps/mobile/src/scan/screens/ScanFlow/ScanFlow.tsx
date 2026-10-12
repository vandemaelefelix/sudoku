import { StatusBar } from 'expo-status-bar'
import { useCallback, useMemo, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import type { RecogniseResult } from '@/scanner'
import { useScannedStart } from '@/scan/hooks/useScannedStart'
import { CameraScreen } from '@/scan/screens/CameraScreen'
import { CorrectionScreen } from '@/scan/screens/CorrectionScreen'
import { correctionLayout } from '@/scan/utils/correction.utils'

type Phase = { phase: 'live' } | { phase: 'review'; result: RecogniseResult }

/** Holds the scan phase. No router: the capture transition needs the camera and the correction screen on one screen. */
export function ScanFlow() {
  const { theme } = useUnistyles()
  const { width, height } = useWindowDimensions()
  const { top, bottom, left, right } = useSafeAreaInsets()
  const layout = useMemo(
    () => correctionLayout({ width, height }, { top, bottom, left, right }),
    [width, height, top, bottom, left, right],
  )
  const [phase, setPhase] = useState<Phase>({ phase: 'live' })
  const play = useScannedStart()
  // A new key mounts a new CameraScreen: the effect scene, its warm-up and the flattened grid start new.
  const [scene, setScene] = useState(0)

  const retake = useCallback(() => {
    setScene((current) => current + 1)
    setPhase({ phase: 'live' })
  }, [])
  const done = useCallback((result: RecogniseResult) => setPhase({ phase: 'review', result }), [])

  if (phase.phase === 'review') {
    return (
      <>
        <StatusBar style={theme.statusBar} />
        <CorrectionScreen result={phase.result} layout={layout} onRetake={retake} onPlay={play} />
      </>
    )
  }
  return <CameraScreen key={scene} layout={layout} onDone={done} onRetake={retake} />
}
