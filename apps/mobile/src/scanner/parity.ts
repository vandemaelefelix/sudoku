import { type Classifier, DIGIT_CLASSES, KIND_CLASSES, type RawOutputs } from './classifier'
import { loadClassifier } from './model'

// ADR-005 and issue #5: the phone must give PyTorch's answers on the 81 reference cells, fast enough.

export type ReferenceOutputs = { run: string; inputs: string; digit: number[][]; kind: number[][] }
/** maxDiff: the largest absolute probability difference. Mismatches: cell indices with another top class. medianMs: of PARITY_RUNS calls. */
export type ParityReport = { maxDiff: number; digitMismatches: number[]; kindMismatches: number[]; medianMs: number }

export const PARITY_RUNS = 20
const MAX_DIFF = 1e-3
const MAX_MEDIAN_MS = 100

/** The export writes little-endian float32. Every iPhone is little-endian. */
export function decodeInputs(base64: string): Float32Array {
  const text = atob(base64)
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}

function topIndex(row: ArrayLike<number>): number {
  let best = 0
  for (let c = 1; c < row.length; c++) if (row[c] > row[best]) best = c
  return best
}

function compareHead(got: Float32Array, expected: number[][], width: number) {
  let maxDiff = 0
  const mismatches: number[] = []
  expected.forEach((row, n) => {
    const gotRow = got.subarray(n * width, (n + 1) * width)
    for (let c = 0; c < width; c++) maxDiff = Math.max(maxDiff, Math.abs(gotRow[c] - row[c]))
    if (topIndex(gotRow) !== topIndex(row)) mismatches.push(n)
  })
  return { maxDiff, mismatches }
}

export function compareOutputs(raw: RawOutputs, reference: ReferenceOutputs): Omit<ParityReport, 'medianMs'> {
  const digit = compareHead(raw.digit, reference.digit, DIGIT_CLASSES)
  const kind = compareHead(raw.kind, reference.kind, KIND_CLASSES.length)
  return {
    maxDiff: Math.max(digit.maxDiff, kind.maxDiff),
    digitMismatches: digit.mismatches,
    kindMismatches: kind.mismatches,
  }
}

/** One untimed call first: the first call allocates the tensors. */
export function measureParity(
  classifier: Classifier,
  reference: ReferenceOutputs,
  now: () => number = () => performance.now(),
): ParityReport {
  const inputs = decodeInputs(reference.inputs)
  const result = compareOutputs(classifier.run(inputs), reference)
  const times: number[] = []
  for (let i = 0; i < PARITY_RUNS; i++) {
    const started = now()
    classifier.run(inputs)
    times.push(now() - started)
  }
  times.sort((a, b) => a - b)
  const medianMs = (times[PARITY_RUNS / 2 - 1] + times[PARITY_RUNS / 2]) / 2
  return { ...result, medianMs }
}

export function formatParity(report: ParityReport): string {
  const pass =
    report.digitMismatches.length === 0 &&
    report.kindMismatches.length === 0 &&
    report.maxDiff <= MAX_DIFF &&
    report.medianMs <= MAX_MEDIAN_MS
  return (
    `${pass ? 'PASS' : 'FAIL'}: max diff ${report.maxDiff.toExponential(2)}, ` +
    `digit mismatches [${report.digitMismatches.join(', ')}], kind mismatches [${report.kindMismatches.join(', ')}], ` +
    `median ${report.medianMs.toFixed(1)} ms over ${PARITY_RUNS} calls`
  )
}

export async function checkModelParity(reference: ReferenceOutputs): Promise<ParityReport> {
  return measureParity(await loadClassifier(), reference)
}
