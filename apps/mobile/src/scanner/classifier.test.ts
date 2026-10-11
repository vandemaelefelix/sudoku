import {
  checkManifest,
  createClassifier,
  decodeOutputs,
  ModelContractError,
  type ModelManifest,
  type TfliteModel,
} from './classifier'
import { CELLS, INPUT_LENGTH } from './preprocess'

const MANIFEST: ModelManifest = {
  model: 'cell-classifier',
  version: '1.0.0',
  contract: '1.0',
  file: 'cell-classifier.tflite',
  outputs: { digit: 0, kind: 1 },
}

/** Every cell gets the same rows. One-hot rows unless a probability is given. */
function rows(width: number, top: number, probability = 1): Float32Array {
  const out = new Float32Array(CELLS * width)
  for (let n = 0; n < CELLS; n++) {
    for (let c = 0; c < width; c++) out[n * width + c] = c === top ? probability : (1 - probability) / (width - 1)
  }
  return out
}

/** A model like fast-tflite: it writes into the same output buffers on every call. */
function fakeModel(digit: Float32Array, kind: Float32Array, order: 'digit-first' | 'kind-first' = 'digit-first') {
  const digitBuffer = new ArrayBuffer(digit.byteLength)
  const kindBuffer = new ArrayBuffer(kind.byteLength)
  const received: ArrayBuffer[] = []
  const model: TfliteModel & { received: ArrayBuffer[]; next: (d: Float32Array, k: Float32Array) => void } = {
    received,
    outputs: order === 'digit-first' ? [{ shape: [81, 10] }, { shape: [81, 4] }] : [{ shape: [81, 4] }, { shape: [81, 10] }],
    runSync: (inputs) => {
      received.push(inputs[0])
      return order === 'digit-first' ? [digitBuffer, kindBuffer] : [kindBuffer, digitBuffer]
    },
    next: (d, k) => {
      new Float32Array(digitBuffer).set(d)
      new Float32Array(kindBuffer).set(k)
    },
  }
  model.next(digit, kind)
  return model
}

describe('checkManifest', () => {
  it('accepts contract 1.x', () => {
    expect(checkManifest({ ...MANIFEST, contract: '1.3' })).toEqual({ ...MANIFEST, contract: '1.3' })
  })

  it.each([
    ['another major', { ...MANIFEST, contract: '2.0' }],
    ['a malformed version', { ...MANIFEST, contract: 'x' }],
    ['no outputs', { ...MANIFEST, outputs: undefined }],
    ['the same index twice', { ...MANIFEST, outputs: { digit: 0, kind: 0 } }],
    ['not an object', null],
  ])('refuses %s', (_name, value) => {
    expect(() => checkManifest(value)).toThrow(ModelContractError)
  })
})

describe('decodeOutputs', () => {
  it('reads the top class and the lower probability as confidence', () => {
    const [cell] = decodeOutputs({ digit: rows(10, 7, 0.9), kind: rows(4, 2, 0.8) })
    expect(cell.digit).toBe(7)
    expect(cell.kind).toBe('handwritten')
    expect(cell.confidence).toBeCloseTo(0.8)
    expect(cell.validPair).toBe(true)
  })

  it('marks a digit with kind none as an invalid pair', () => {
    expect(decodeOutputs({ digit: rows(10, 3), kind: rows(4, 0) })[0].validPair).toBe(false)
  })

  it('accepts empty with notes', () => {
    const [cell] = decodeOutputs({ digit: rows(10, 0), kind: rows(4, 3) })
    expect(cell).toMatchObject({ digit: 0, kind: 'notes', validPair: true })
  })

  it('returns 81 cells', () => {
    expect(decodeOutputs({ digit: rows(10, 1), kind: rows(4, 1) })).toHaveLength(CELLS)
  })
})

describe('createClassifier', () => {
  it('reads the outputs by the manifest index, not the tensor order', () => {
    const model = fakeModel(rows(10, 5), rows(4, 1), 'kind-first')
    const classifier = createClassifier(model, { ...MANIFEST, outputs: { digit: 1, kind: 0 } })
    expect(classifier.classify(new Float32Array(INPUT_LENGTH))[0]).toMatchObject({ digit: 5, kind: 'printed' })
  })

  it('refuses a model whose output shapes do not fit the manifest', () => {
    const model = fakeModel(rows(10, 5), rows(4, 1), 'kind-first')
    expect(() => createClassifier(model, MANIFEST)).toThrow(ModelContractError)
  })

  it('keeps the first results when the model reuses its output buffers', () => {
    const model = fakeModel(rows(10, 2), rows(4, 1))
    const classifier = createClassifier(model, MANIFEST)
    const first = classifier.run(new Float32Array(INPUT_LENGTH))
    model.next(rows(10, 9), rows(4, 2))
    classifier.run(new Float32Array(INPUT_LENGTH))
    expect(decodeOutputs(first)[0].digit).toBe(2)
  })

  it('sends exactly the input floats when the input is a view with an offset', () => {
    const model = fakeModel(rows(10, 2), rows(4, 1))
    const big = new Float32Array(INPUT_LENGTH + 8)
    big[4] = 0.5
    createClassifier(model, MANIFEST).run(big.subarray(4, 4 + INPUT_LENGTH))
    const sent = new Float32Array(model.received[0])
    expect(sent).toHaveLength(INPUT_LENGTH)
    expect(sent[0]).toBe(0.5)
  })

  it('refuses an input of the wrong length', () => {
    const classifier = createClassifier(fakeModel(rows(10, 2), rows(4, 1)), MANIFEST)
    expect(() => classifier.run(new Float32Array(10))).toThrow(RangeError)
  })

  it('refuses an output of the wrong size', () => {
    const model = fakeModel(rows(10, 2), rows(4, 1))
    model.runSync = () => [new ArrayBuffer(8), new ArrayBuffer(8)]
    expect(() => createClassifier(model, MANIFEST).run(new Float32Array(INPUT_LENGTH))).toThrow(ModelContractError)
  })
})
