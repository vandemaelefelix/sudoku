// The only entry point into the scanner (SUD-05).
export { probeOpenCV } from './opencvProbe'
export {
  type CellResult,
  type Classifier,
  type Kind,
  ModelContractError,
  type RawOutputs,
  SUPPORTED_CONTRACTS,
} from './classifier'
export { loadClassifier } from './model'
export { checkModelParity, formatParity, type ParityReport, type ReferenceOutputs } from './parity'
export { INPUT_LENGTH, preprocessCells } from './preprocess'
export type { GridDetection, Point, Quad } from './quad'
export { type CornerSource, type RecogniseResult, type RecogniseTimings } from './recognise'
export { createScanner, type Scanner } from './scanner'
export { type GridDetector, useGridDetector } from './useGridDetector'
