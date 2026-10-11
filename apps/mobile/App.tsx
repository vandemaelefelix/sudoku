import { checkModelParity, formatParity, probeOpenCV, type ReferenceOutputs } from './src/scanner'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ScanFlow } from './src/scan/ScanFlow'

/** Logs whether fast-opencv works. A failing probe must never stop the app from starting. */
export function logOpenCVProbe() {
  try {
    console.log(`[scanner] fast-opencv ${probeOpenCV() ? 'works' : 'FAILED'}`)
  } catch (error) {
    console.log(`[scanner] fast-opencv FAILED: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Logs whether the model on this phone matches PyTorch (ADR-005). It never stops the app from starting. */
export function logModelParity(reference: ReferenceOutputs) {
  checkModelParity(reference)
    .then((report) => console.log(`[scanner] model parity ${formatParity(report)}`))
    .catch((error: unknown) =>
      console.log(`[scanner] model parity FAILED: ${error instanceof Error ? error.message : String(error)}`),
    )
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
