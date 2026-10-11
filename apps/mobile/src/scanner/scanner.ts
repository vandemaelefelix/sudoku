import type { Photo } from 'react-native-vision-camera'
import { createWorkletRuntime, runOnRuntimeAsync, type WorkletRuntime } from 'react-native-worklets'
import { ModelContractError } from './classifier'
import { loadClassifier } from './model'
import type { Quad } from './quad'
import { recognise, type RecogniseResult } from './recognise'

/** recognise never rejects: a failure is a result with ok false. */
export type Scanner = { recognise(photo: Photo, quad: Quad | null): Promise<RecogniseResult> }

let runtime: WorkletRuntime | null = null
let scanner: Promise<Scanner> | null = null

/** The scanner runtime: one per app, made at the first scan (scan-pipeline concept, "Capture thread"). */
function scannerRuntime(): WorkletRuntime {
  if (runtime == null) runtime = createWorkletRuntime({ name: 'scanner' })
  return runtime
}

/**
 * Loads the model once per app. A model that breaks the contract rejects every call with the same ModelContractError. Any other
 * load failure can be transient, so the next call tries again.
 */
export function createScanner(): Promise<Scanner> {
  if (scanner == null) {
    const loading = loadScanner()
    scanner = loading
    loading.catch((error: unknown) => {
      if (!(error instanceof ModelContractError) && scanner === loading) scanner = null
    })
  }
  return scanner
}

async function loadScanner(): Promise<Scanner> {
  const { model, manifest } = await loadClassifier()
  const outputs = manifest.outputs
  return {
    recognise: (photo, quad) =>
      runOnRuntimeAsync(scannerRuntime(), recognise, photo, quad, model, outputs).catch(
        (error: unknown): RecogniseResult => ({
          ok: false,
          reason: error instanceof Error ? error.message : String(error),
        }),
      ),
  }
}
