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

  it('refuses an input of the wrong length', () => {
    expect(() => preprocessCells(new Uint8Array(10))).toThrow(RangeError)
  })
})
