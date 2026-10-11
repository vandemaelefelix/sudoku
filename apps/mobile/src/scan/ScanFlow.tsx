import { StatusBar } from 'expo-status-bar'
import { useCallback, useMemo, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { RecogniseResult } from '../scanner'
import { CameraScreen } from './CameraScreen'
import { CorrectionScreen } from './correction/CorrectionScreen'
import { correctionLayout } from './correction/layout'

type Phase = { phase: 'live' } | { phase: 'review'; result: RecogniseResult }

/** Holds the scan phase. No router: the capture transition needs the camera and the correction screen on one screen. */
export function ScanFlow() {
  const { width, height } = useWindowDimensions()
  const { top, bottom, left, right } = useSafeAreaInsets()
  const layout = useMemo(
    () => correctionLayout({ width, height }, { top, bottom, left, right }),
    [width, height, top, bottom, left, right],
  )
  const [phase, setPhase] = useState<Phase>({ phase: 'live' })
  // A new key mounts a new CameraScreen: the effect scene keeps its lock-on latch and the flattened grid otherwise.
  const [scene, setScene] = useState(0)

  const retake = useCallback(() => {
    setScene((current) => current + 1)
    setPhase({ phase: 'live' })
  }, [])
  const done = useCallback((result: RecogniseResult) => setPhase({ phase: 'review', result }), [])

  if (phase.phase === 'review') {
    return (
      <>
        <StatusBar style="dark" />
        <CorrectionScreen result={phase.result} layout={layout} onRetake={retake} />
      </>
    )
  }
  // Only the first scene arms at once. After a Retake the same puzzle is often still in view.
  return <CameraScreen key={scene} layout={layout} onDone={done} onRetake={retake} armed={scene === 0} />
}
