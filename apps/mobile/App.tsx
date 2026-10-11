import { checkModelParity, formatParity, probeOpenCV, type ReferenceOutputs } from '@/scanner'
import { SafeAreaProvider } from 'react-native-safe-area-context'
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

export default function App() {
  return (
    <SafeAreaProvider>
      <ScanFlow />
    </SafeAreaProvider>
  )
}
