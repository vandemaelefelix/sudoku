import { checkModelParity, formatParity, probeOpenCV, type ReferenceOutputs } from '@/scanner'
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

/**
 * Runs in a development build only. The require stays inside the __DEV__ branch: Metro then removes the
 * branch from a release bundle, with the 450 KB reference file. An early return keeps the require.
 */
export function runDevChecks(): void {
  if (__DEV__) {
    logOpenCVProbe()
    logModelParity(require('./assets/models/reference-outputs.json'))
  }
}
