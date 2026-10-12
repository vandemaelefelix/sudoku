import { checkModelParity, formatParity, probeOpenCV, type ReferenceOutputs } from '@/scanner'
import { useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GameScreen } from '@/game/screens/GameScreen'
import { sampleStart } from '@/game/utils/sample.utils'
import { ScanFlow } from '@/scan/screens/ScanFlow'
import { devLog, errorMessage } from '@/utils/log.utils'

/** Logs whether fast-opencv works. A failing probe must never stop the app from starting. */
export function logOpenCVProbe() {
  try {
    devLog('scanner', `fast-opencv ${probeOpenCV() ? 'works' : 'FAILED'}`)
  } catch (error) {
    devLog('scanner', `fast-opencv FAILED: ${errorMessage(error)}`)
  }
}

/** Logs whether the model on this phone matches PyTorch (ADR-005). It never stops the app from starting. */
export function logModelParity(reference: ReferenceOutputs) {
  checkModelParity(reference)
    .then((report) => devLog('scanner', `model parity ${formatParity(report)}`))
    .catch((error: unknown) => devLog('scanner', `model parity FAILED: ${errorMessage(error)}`))
}

if (__DEV__) {
  logOpenCVProbe()
  // Inside the __DEV__ branch, so a release bundle leaves the 450 KB reference file out.
  logModelParity(require('./assets/models/reference-outputs.json'))
}

// Navigation waits for its ADR. A development build opens on the game with the canvas puzzle.
const DEV_START = __DEV__ ? sampleStart() : null

export default function App() {
  const [playing, setPlaying] = useState(DEV_START !== null)
  return (
    <SafeAreaProvider>
      {playing && DEV_START !== null ? <GameScreen start={DEV_START} onBack={() => setPlaying(false)} /> : <ScanFlow />}
    </SafeAreaProvider>
  )
}
