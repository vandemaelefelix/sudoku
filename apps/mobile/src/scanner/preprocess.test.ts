import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { CELL_SIZE, CELLS, INPUT_LENGTH, INPUT_SIZE, preprocessCells } from './preprocess'

const FIXTURES = join(__dirname, '../../../../fixtures/preprocess')

function readCellRgb(file: string): Uint8Array {
  const png = PNG.sync.read(readFileSync(join(FIXTURES, file)))
  const rgb = new Uint8Array(CELL_SIZE * CELL_SIZE * 3)
  for (let p = 0; p < CELL_SIZE * CELL_SIZE; p++) {
    rgb[p * 3] = png.data[p * 4]
    rgb[p * 3 + 1] = png.data[p * 4 + 1]
    rgb[p * 3 + 2] = png.data[p * 4 + 2]
  }
  return rgb
}

// The straightforward dense maths: every output sums over all 52 sources.
function denseReference(cells: Uint8Array): Float32Array {
  const crop = 52
  const start = 6
  const scale = crop / INPUT_SIZE
  const w = new Float64Array(INPUT_SIZE * crop)
  for (let i = 0; i < INPUT_SIZE; i++) {
    const lo = i * scale
    const hi = (i + 1) * scale
    for (let j = Math.floor(lo); j < Math.ceil(hi); j++) {
      const overlap = Math.min(hi, j + 1) - Math.max(lo, j)
      if (overlap > 0) w[i * crop + j] = overlap / scale
    }
  }
  const out = new Float32Array(INPUT_LENGTH)
  const gray = new Float64Array(crop * crop)
  const rows = new Float64Array(INPUT_SIZE * crop)
  for (let n = 0; n < CELLS; n++) {
    const base = n * CELL_SIZE * CELL_SIZE * 3
    for (let y = 0; y < crop; y++) {
      for (let x = 0; x < crop; x++) {
        const p = base + ((y + start) * CELL_SIZE + x + start) * 3
        gray[y * crop + x] = 0.299 * cells[p] + 0.587 * cells[p + 1] + 0.114 * cells[p + 2]
      }
    }
    for (let i = 0; i < INPUT_SIZE; i++) {
      for (let x = 0; x < crop; x++) {
        let sum = 0
        for (let y = 0; y < crop; y++) sum += w[i * crop + y] * gray[y * crop + x]
        rows[i * crop + x] = sum
      }
    }
    for (let i = 0; i < INPUT_SIZE; i++) {
      for (let k = 0; k < INPUT_SIZE; k++) {
        let sum = 0
        for (let x = 0; x < crop; x++) sum += rows[i * crop + x] * w[k * crop + x]
        out[n * INPUT_SIZE * INPUT_SIZE + i * INPUT_SIZE + k] = 1 - sum / 255
      }
    }
  }
  return out
}

describe('preprocessCells', () => {
  const pngs = readdirSync(FIXTURES).filter((f) => f.endsWith('.cell.png')).toSorted()

  it('has all 81 reference pairs', () => {
    expect(pngs).toHaveLength(CELLS)
  })

  it('matches every reference pair within 1/255', () => {
    const cells = new Uint8Array(CELLS * CELL_SIZE * CELL_SIZE * 3)
    pngs.forEach((file, n) => cells.set(readCellRgb(file), n * CELL_SIZE * CELL_SIZE * 3))
    const input = preprocessCells(cells)
    expect(input).toHaveLength(INPUT_LENGTH)
    let worst = 0
    pngs.forEach((file, n) => {
      const expected: number[][] = JSON.parse(
        readFileSync(join(FIXTURES, file.replace('.cell.png', '.expected.json')), 'utf8'),
      ).values
      for (let y = 0; y < INPUT_SIZE; y++) {
        for (let x = 0; x < INPUT_SIZE; x++) {
          const got = input[n * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x]
          worst = Math.max(worst, Math.abs(got - expected[y][x]))
        }
      }
    })
    expect(worst).toBeLessThanOrEqual(1 / 255)
  })

  it('maps white paper to 0 and black ink to 1', () => {
    const white = preprocessCells(new Uint8Array(CELLS * CELL_SIZE * CELL_SIZE * 3).fill(255))
    const black = preprocessCells(new Uint8Array(CELLS * CELL_SIZE * CELL_SIZE * 3))
    expect(white.reduce((worst, v) => Math.max(worst, Math.abs(v)), 0)).toBeLessThan(1e-6)
    expect(black.reduce((least, v) => Math.min(least, v), Infinity)).toBeGreaterThan(1 - 1e-6)
  })

  it('matches a dense reference on random cells within 1e-6', () => {
    let seed = 12345
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 2 ** 32
    }
    const cells = new Uint8Array(CELLS * CELL_SIZE * CELL_SIZE * 3).map(() => Math.floor(random() * 256))
    const got = preprocessCells(cells)
    const want = denseReference(cells)
    let worst = 0
    for (let i = 0; i < want.length; i++) worst = Math.max(worst, Math.abs(got[i] - want[i]))
    expect(worst).toBeLessThan(1e-6)
  })

  it('refuses an input of the wrong length', () => {
    expect(() => preprocessCells(new Uint8Array(10))).toThrow(RangeError)
  })
})
