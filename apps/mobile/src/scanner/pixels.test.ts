import { CELL_SIZE, CELLS } from './preprocess'
import { bytesPerPixel, cropRgb, FLAT_SIZE, rowBytes, sliceCells, toRgb } from './pixels'

describe('toRgb', () => {
  it('reads BGRA and skips the padding at the end of each row', () => {
    // 2 × 2 pixels, 12 bytes per row: 8 bytes of pixels and 4 bytes of padding.
    const bytes = new Uint8Array([
      3, 2, 1, 255, 6, 5, 4, 255, 99, 99, 99, 99,
      9, 8, 7, 255, 12, 11, 10, 255, 99, 99, 99, 99,
    ])
    const rgb = toRgb({ buffer: bytes.buffer, width: 2, height: 2, pixelFormat: 'BGRA' })
    expect(Array.from(rgb)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('reads RGBA and ARGB', () => {
    const rgba = new Uint8Array([1, 2, 3, 255])
    const argb = new Uint8Array([255, 1, 2, 3])
    expect(Array.from(toRgb({ buffer: rgba.buffer, width: 1, height: 1, pixelFormat: 'RGBA' }))).toEqual([1, 2, 3])
    expect(Array.from(toRgb({ buffer: argb.buffer, width: 1, height: 1, pixelFormat: 'ARGB' }))).toEqual([1, 2, 3])
  })

  it('refuses an unknown pixel format', () => {
    expect(() => toRgb({ buffer: new ArrayBuffer(4), width: 1, height: 1, pixelFormat: 'unknown' })).toThrow(
      'unsupported pixel format unknown',
    )
  })

  it('refuses a buffer that is too short for its rows', () => {
    expect(() => toRgb({ buffer: new ArrayBuffer(12), width: 2, height: 2, pixelFormat: 'BGRA' })).toThrow(RangeError)
  })
})

describe('rowBytes and bytesPerPixel', () => {
  it('gives the row length with padding', () => {
    expect(rowBytes({ buffer: new ArrayBuffer(2 * 4160), width: 1000, height: 2, pixelFormat: 'BGRA' })).toBe(4160)
  })

  it('gives 3 bytes for RGB and 4 for BGRA', () => {
    expect(bytesPerPixel('RGB')).toBe(3)
    expect(bytesPerPixel('BGRA')).toBe(4)
  })
})

describe('cropRgb', () => {
  it('copies the rect, row by row', () => {
    // 4 × 3 pixels. Each byte holds its pixel index.
    const rgb = new Uint8Array(4 * 3 * 3).map((_, i) => Math.floor(i / 3))
    const crop = cropRgb(rgb, 4, { x: 1, y: 1, width: 2, height: 2 })
    expect(Array.from(crop).filter((_, i) => i % 3 === 0)).toEqual([5, 6, 9, 10])
  })
})

describe('sliceCells', () => {
  it('cuts 81 cells of 64 × 64 RGB, row by row', () => {
    const flat = new Uint8Array(FLAT_SIZE * FLAT_SIZE * 3)
    for (let y = 0; y < FLAT_SIZE; y++) {
      for (let x = 0; x < FLAT_SIZE; x++) {
        const p = (y * FLAT_SIZE + x) * 3
        flat[p] = Math.floor(y / CELL_SIZE) * 9 + Math.floor(x / CELL_SIZE)
        flat[p + 1] = y % CELL_SIZE
        flat[p + 2] = x % CELL_SIZE
      }
    }
    const cells = sliceCells(flat)
    expect(cells).toHaveLength(CELLS * CELL_SIZE * CELL_SIZE * 3)
    const p = (10 * CELL_SIZE * CELL_SIZE + 5 * CELL_SIZE + 7) * 3
    expect([cells[p], cells[p + 1], cells[p + 2]]).toEqual([10, 5, 7])
    const last = (80 * CELL_SIZE * CELL_SIZE + 63 * CELL_SIZE + 63) * 3
    expect([cells[last], cells[last + 1], cells[last + 2]]).toEqual([80, 63, 63])
  })

  it('refuses a flat image of the wrong size', () => {
    expect(() => sliceCells(new Uint8Array(10))).toThrow(RangeError)
  })
})
