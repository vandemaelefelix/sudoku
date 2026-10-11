import { loadTensorflowModel } from 'react-native-fast-tflite'
import manifest from '../../assets/models/manifest.json'
// `just install-model <run>` writes this file. It is not in git (ADR-007, amendment), so a clone without it does not bundle.
import modelFile from '../../assets/models/cell-classifier.tflite'
import { checkManifest, type Classifier, createClassifier } from './classifier'

/** Loads the model on the CPU: fast-tflite 3 has no working Metal delegate (model contract). */
export async function loadClassifier(): Promise<Classifier> {
  const checked = checkManifest(manifest)
  const model = await loadTensorflowModel(modelFile, [])
  return createClassifier(model, checked)
}
