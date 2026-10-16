// The input steps of the model contract (docs/architecture/00-concepts/model-contract.md).
// ml/src/sudoku_ml/preprocess.py implements the same maths. shared/fixtures/preprocess/ pins both.

export const CELL_SIZE = 64
export const INPUT_SIZE = 32
export const CELLS = 81
export const INPUT_LENGTH = CELLS * INPUT_SIZE * INPUT_SIZE
const CROP_START = 0
const CROP_SIZE = 64
const CELL_BYTES = CELL_SIZE * CELL_SIZE * 3

/** W[i * src + j]: the share of output pixel i that source pixel j covers. A dst × src matrix, rows sum to 1. */
function areaWeights(src: number, dst: number): Float64Array {
  'worklet'
  const scale = src / dst
  const weights = new Float64Array(dst * src)
  for (let i = 0; i < dst; i++) {
    const lo = i * scale
    const hi = (i + 1) * scale
    for (let j = Math.floor(lo); j < Math.ceil(hi); j++) {
      const overlap = Math.min(hi, j + 1) - Math.max(lo, j)
      if (overlap > 0) weights[i * src + j] = overlap / scale
    }
  }
  return weights
}

/** cells: 81 cell images of 64 × 64 RGB, one after the other. Returns the [81, 32, 32, 1] model input. */
export function preprocessCells(cells: Uint8Array): Float32Array {
  'worklet'
  if (cells.length !== CELLS * CELL_BYTES) {
    throw new RangeError(`expected ${CELLS * CELL_BYTES} bytes of cell images, got ${cells.length}`)
  }
  const w = areaWeights(CROP_SIZE, INPUT_SIZE)
  // Each output row of w has 2 or 3 non-zero weights in a run. Loop over the run only: the dense
  // sum adds the same terms in the same order, so the result is the same.
  const first = new Int32Array(INPUT_SIZE)
  const last = new Int32Array(INPUT_SIZE)
  for (let i = 0; i < INPUT_SIZE; i++) {
    let lo = CROP_SIZE
    let hi = -1
    for (let j = 0; j < CROP_SIZE; j++) {
      if ((w[i * CROP_SIZE + j] ?? 0) > 0) {
        if (j < lo) lo = j
        hi = j
      }
    }
    first[i] = lo
    last[i] = hi
  }
  const gray = new Float64Array(CROP_SIZE * CROP_SIZE)
  const rows = new Float64Array(INPUT_SIZE * CROP_SIZE)
  const out = new Float32Array(INPUT_LENGTH)
  for (let n = 0; n < CELLS; n++) {
    const base = n * CELL_BYTES
    for (let y = 0; y < CROP_SIZE; y++) {
      for (let x = 0; x < CROP_SIZE; x++) {
        const p = base + ((y + CROP_START) * CELL_SIZE + x + CROP_START) * 3
        gray[y * CROP_SIZE + x] = 0.299 * (cells[p] ?? 0) + 0.587 * (cells[p + 1] ?? 0) + 0.114 * (cells[p + 2] ?? 0)
      }
    }
    // W · crop, then (W · crop) · Wᵀ.
    for (let i = 0; i < INPUT_SIZE; i++) {
      const lo = first[i] ?? 0
      const hi = last[i] ?? -1
      for (let x = 0; x < CROP_SIZE; x++) {
        let sum = 0
        for (let y = lo; y <= hi; y++) sum += (w[i * CROP_SIZE + y] ?? 0) * (gray[y * CROP_SIZE + x] ?? 0)
        rows[i * CROP_SIZE + x] = sum
      }
    }
    const outBase = n * INPUT_SIZE * INPUT_SIZE
    for (let i = 0; i < INPUT_SIZE; i++) {
      for (let k = 0; k < INPUT_SIZE; k++) {
        const lo = first[k] ?? 0
        const hi = last[k] ?? -1
        let sum = 0
        for (let x = lo; x <= hi; x++) sum += (rows[i * CROP_SIZE + x] ?? 0) * (w[k * CROP_SIZE + x] ?? 0)
        out[outBase + i * INPUT_SIZE + k] = 1 - sum / 255
      }
    }
  }
  return out
}
