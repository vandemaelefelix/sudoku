import { CELLS, INPUT_LENGTH, INPUT_SIZE } from './preprocess'

// docs/architecture/00-concepts/model-contract.md: outputs, classes, valid pairs and versioning.

/** SUD-09: the contract major versions this scanner implements. */
export const SUPPORTED_CONTRACTS: readonly number[] = [2]
export const DIGIT_CLASSES = 10
export const KIND_CLASSES = ['none', 'printed', 'handwritten', 'notes'] as const
export type Kind = (typeof KIND_CLASSES)[number]

/** digit: 0 means empty. confidence: the lower top probability of the two heads, 0..1. */
/** second: the digit class with the second highest score, the guess the correction screen marks when the first is wrong. */
export type CellResult = {
  digit: number
  kind: Kind
  confidence: number
  validPair: boolean
  second: number
  /** The 10 digit probabilities and the 4 kind probabilities of the model. The scan record keeps them (ADR-030). */
  digitProbs?: number[]
  kindProbs?: number[]
}

export type OutputIndex = { digit: number; kind: number }

export type ModelManifest = {
  model: string
  version: string
  contract: string
  file: string
  outputs: OutputIndex
  run?: string
}

export class ModelContractError extends Error {
  name = 'ModelContractError'
}

/** digit: [81, 10] probabilities, kind: [81, 4], row by row. */
export type RawOutputs = { digit: Float32Array; kind: Float32Array }

/** The part of a fast-tflite TensorflowModel that the classifier uses. */
export type TfliteModel = {
  inputs: { shape: number[]; dataType: string }[]
  outputs: { shape: number[] }[]
  runSync(inputs: ArrayBuffer[]): ArrayBuffer[]
}

export type Classifier = {
  manifest: ModelManifest
  model: TfliteModel
  run(input: Float32Array): RawOutputs
  classify(input: Float32Array): CellResult[]
}

function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export function checkManifest(value: unknown): ModelManifest {
  const m = value as Partial<ModelManifest> | null
  if (m == null || typeof m !== 'object') throw new ModelContractError('the model manifest is missing')
  const major = typeof m.contract === 'string' ? Number(m.contract.split('.')[0]) : NaN
  if (!Number.isInteger(major) || !SUPPORTED_CONTRACTS.includes(major)) {
    throw new ModelContractError(`the scanner does not implement model contract ${String(m.contract)}`)
  }
  const outputs = m.outputs
  if (outputs == null || !isIndex(outputs.digit) || !isIndex(outputs.kind) || outputs.digit === outputs.kind) {
    throw new ModelContractError('the model manifest has no valid output indices')
  }
  return m as ModelManifest
}

function argmax(values: Float32Array, start: number, width: number): number {
  'worklet'
  let best = 0
  for (let c = 1; c < width; c++) if ((values[start + c] ?? 0) > (values[start + best] ?? 0)) best = c
  return best
}

/** The index of the highest value in the row other than `skip`. */
function argmaxExcept(values: Float32Array, start: number, width: number, skip: number): number {
  'worklet'
  let best = skip === 0 ? 1 : 0
  for (let c = 0; c < width; c++) {
    if (c !== skip && (values[start + c] ?? 0) > (values[start + best] ?? 0)) best = c
  }
  return best
}

export function decodeOutputs(raw: RawOutputs): CellResult[] {
  'worklet'
  const width = KIND_CLASSES.length
  const cells: CellResult[] = []
  for (let n = 0; n < CELLS; n++) {
    const digit = argmax(raw.digit, n * DIGIT_CLASSES, DIGIT_CLASSES)
    const kindIndex = argmax(raw.kind, n * width, width)
    const kind = KIND_CLASSES[kindIndex]
    if (kind === undefined) throw new RangeError(`kind index ${kindIndex} is out of range`)
    const validPair = digit === 0 ? kind === 'none' || kind === 'notes' : kind === 'printed' || kind === 'handwritten'
    const confidence = Math.min(raw.digit[n * DIGIT_CLASSES + digit] ?? 0, raw.kind[n * width + kindIndex] ?? 0)
    const second = argmaxExcept(raw.digit, n * DIGIT_CLASSES, DIGIT_CLASSES, digit)
    const digitProbs = Array.from(raw.digit.subarray(n * DIGIT_CLASSES, (n + 1) * DIGIT_CLASSES))
    const kindProbs = Array.from(raw.kind.subarray(n * width, (n + 1) * width))
    cells.push({ digit, kind, confidence, validPair, second, digitProbs, kindProbs })
  }
  return cells
}

function sameShape(shape: number[] | undefined, expected: number[]): boolean {
  return shape != null && shape.length === expected.length && shape.every((v, i) => v === expected[i])
}

/** Copies an output: fast-tflite writes the next call into the same buffer. Throws Error, not ModelContractError: it runs on the scanner runtime. */
function copyOutput(buffer: ArrayBuffer | undefined, length: number, name: string): Float32Array {
  'worklet'
  if (buffer == null || buffer.byteLength !== length * 4) {
    throw new Error(`the ${name} output has ${buffer?.byteLength ?? 0} bytes, expected ${length * 4}`)
  }
  return new Float32Array(buffer.slice(0))
}

/** Runs on the scanner runtime too. input: INPUT_LENGTH floats. */
export function runModel(model: TfliteModel, outputs: OutputIndex, input: Float32Array): RawOutputs {
  'worklet'
  if (input.length !== INPUT_LENGTH) throw new RangeError(`expected ${INPUT_LENGTH} input values, got ${input.length}`)
  const result = model.runSync([new Float32Array(input).buffer])
  return {
    digit: copyOutput(result[outputs.digit], CELLS * DIGIT_CLASSES, 'digit'),
    kind: copyOutput(result[outputs.kind], CELLS * KIND_CLASSES.length, 'kind'),
  }
}

export function createClassifier(model: TfliteModel, manifest: ModelManifest): Classifier {
  const { digit, kind } = manifest.outputs
  const inputTensor = model.inputs[0]
  if (!sameShape(inputTensor?.shape, [CELLS, INPUT_SIZE, INPUT_SIZE, 1]) || inputTensor?.dataType !== 'float32') {
    throw new ModelContractError('the model input is not float32 [81, 32, 32, 1]')
  }
  if (!sameShape(model.outputs[digit]?.shape, [CELLS, DIGIT_CLASSES])) {
    throw new ModelContractError(`output ${digit} is not the digit head [81, 10]`)
  }
  if (!sameShape(model.outputs[kind]?.shape, [CELLS, KIND_CLASSES.length])) {
    throw new ModelContractError(`output ${kind} is not the kind head [81, 4]`)
  }
  const run = (input: Float32Array): RawOutputs => runModel(model, manifest.outputs, input)
  return { manifest, model, run, classify: (input) => decodeOutputs(run(input)) }
}
