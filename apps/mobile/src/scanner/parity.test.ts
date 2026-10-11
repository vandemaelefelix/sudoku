import type { Classifier, RawOutputs } from './classifier'
import {
  compareOutputs,
  decodeInputs,
  formatParity,
  measureParity,
  PARITY_RUNS,
  type ParityReport,
  type ReferenceOutputs,
} from './parity'
import { INPUT_LENGTH } from './preprocess'

function oneHot(width: number, top: number): number[][] {
  return Array.from({ length: 81 }, () => Array.from({ length: width }, (_, c) => (c === top ? 1 : 0)))
}

function base64Of(values: Float32Array): string {
  return Buffer.from(values.buffer).toString('base64')
}

const REFERENCE: ReferenceOutputs = {
  run: 'test-run',
  inputs: base64Of(new Float32Array(INPUT_LENGTH).fill(0.25)),
  digit: oneHot(10, 3),
  kind: oneHot(4, 1),
}

function raw(digit: number[][], kind: number[][]): RawOutputs {
  return { digit: Float32Array.from(digit.flat()), kind: Float32Array.from(kind.flat()) }
}

describe('decodeInputs', () => {
  it('decodes little-endian float32 values', () => {
    const inputs = decodeInputs(REFERENCE.inputs)
    expect(inputs).toHaveLength(INPUT_LENGTH)
    expect(inputs[INPUT_LENGTH - 1]).toBe(0.25)
  })
})

describe('compareOutputs', () => {
  it('finds no difference for equal outputs', () => {
    expect(compareOutputs(raw(REFERENCE.digit, REFERENCE.kind), REFERENCE)).toEqual({
      maxDiff: 0,
      digitMismatches: [],
      kindMismatches: [],
    })
  })

  it('reports the largest difference and the cells with another top class', () => {
    const digit = oneHot(10, 3)
    digit[5] = digit[5].map((_, c) => (c === 8 ? 1 : 0))
    const kind = oneHot(4, 1)
    kind[2][1] = 0.9996
    const result = compareOutputs(raw(digit, kind), REFERENCE)
    expect(result.digitMismatches).toEqual([5])
    expect(result.kindMismatches).toEqual([])
    expect(result.maxDiff).toBeCloseTo(1)
  })
})

describe('measureParity', () => {
  it('sends the reference inputs and takes the median of the timed runs', () => {
    const sent: Float32Array[] = []
    const classifier: Classifier = {
      manifest: { model: 'm', version: '1.0.0', contract: '1.0', file: 'f', outputs: { digit: 0, kind: 1 }, run: 'test-run' },
      run: (input) => (sent.push(input), raw(REFERENCE.digit, REFERENCE.kind)),
      classify: () => [],
    }
    let clock = 0
    let call = 0
    // Each run takes 1 ms longer than the one before it, so the median is known.
    const now = () => (call++ % 2 === 0 ? clock : (clock += Math.floor(call / 2)))
    const report = measureParity(classifier, REFERENCE, now)
    expect(sent).toHaveLength(PARITY_RUNS + 1)
    expect(sent[0][0]).toBe(0.25)
    expect(report.medianMs).toBe(10.5)
    expect(report.maxDiff).toBe(0)
    expect(report).toMatchObject({ run: 'test-run', runMatches: true })
  })

  it('reports a run that differs from the reference run', () => {
    const classifier: Classifier = {
      manifest: { model: 'm', version: '1.0.0', contract: '1.0', file: 'f', outputs: { digit: 0, kind: 1 }, run: 'other-run' },
      run: () => raw(REFERENCE.digit, REFERENCE.kind),
      classify: () => [],
    }
    expect(measureParity(classifier, REFERENCE, () => 0)).toMatchObject({ run: 'other-run', runMatches: false })
  })
})

describe('formatParity', () => {
  const GOOD: ParityReport = {
    maxDiff: 2e-7,
    digitMismatches: [],
    kindMismatches: [],
    medianMs: 12,
    run: 'r1',
    runMatches: true,
  }

  it('says PASS and names the run when the report meets ADR-005 and the 100 ms budget', () => {
    expect(formatParity(GOOD)).toMatch(/^PASS \(run r1\)/)
  })

  it('says FAIL for a mismatch, a large difference, a slow call or another run', () => {
    expect(formatParity({ ...GOOD, digitMismatches: [4] })).toMatch(/^FAIL \(run r1\)/)
    expect(formatParity({ ...GOOD, maxDiff: 2e-3 })).toMatch(/^FAIL/)
    expect(formatParity({ ...GOOD, medianMs: 101 })).toMatch(/^FAIL/)
    expect(formatParity({ ...GOOD, runMatches: false })).toMatch(/^FAIL/)
  })
})
