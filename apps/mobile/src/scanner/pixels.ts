import { CELL_SIZE, CELLS } from './preprocess'

/** Raw pixels as nitro-image gives them. A row may end in padding: the row length is byteLength / height. */
export type RawPixels = { buffer: ArrayBuffer; width: number; height: number; pixelFormat: string }

/** Integer pixels. */
export type Rect = { x: number; y: number; width: number; height: number }

/** The side of the rough flatten: 9 cells of CELL_SIZE. */
export const FLAT_SIZE = 9 * CELL_SIZE

/** Byte offsets of red, green and blue inside one pixel, and the bytes per pixel. */
const LAYOUTS: { [format: string]: { r: number; g: number; b: number; bytes: number } } = {
  RGBA: { r: 0, g: 1, b: 2, bytes: 4 },
  RGBX: { r: 0, g: 1, b: 2, bytes: 4 },
  BGRA: { r: 2, g: 1, b: 0, bytes: 4 },
  BGRX: { r: 2, g: 1, b: 0, bytes: 4 },
  ARGB: { r: 1, g: 2, b: 3, bytes: 4 },
  XRGB: { r: 1, g: 2, b: 3, bytes: 4 },
  ABGR: { r: 3, g: 2, b: 1, bytes: 4 },
  XBGR: { r: 3, g: 2, b: 1, bytes: 4 },
  RGB: { r: 0, g: 1, b: 2, bytes: 3 },
  BGR: { r: 2, g: 1, b: 0, bytes: 3 },
}

function layoutOf(format: string) {
  'worklet'
  const layout = LAYOUTS[format]
  if (layout == null) throw new Error(`unsupported pixel format ${format}`)
  return layout
}

export function bytesPerPixel(format: string): number {
  'worklet'
  return layoutOf(format).bytes
}

/** Throws when the buffer does not hold height whole rows of width pixels. */
export function rowBytes(raw: RawPixels): number {
  'worklet'
  const row = raw.buffer.byteLength / raw.height
  if (!Number.isInteger(row) || row < raw.width * bytesPerPixel(raw.pixelFormat)) {
    throw new RangeError(
      `${raw.buffer.byteLength} bytes do not hold ${raw.height} rows of ${raw.width} ${raw.pixelFormat} pixels`,
    )
  }
  return row
}

/** Interleaved RGB, width × height × 3, without padding. */
export function toRgb(raw: RawPixels): Uint8Array {
  'worklet'
  const layout = layoutOf(raw.pixelFormat)
  const row = rowBytes(raw)
  const src = new Uint8Array(raw.buffer)
  const out = new Uint8Array(raw.width * raw.height * 3)
  for (let y = 0; y < raw.height; y++) {
    let p = y * row
    let q = y * raw.width * 3
    for (let x = 0; x < raw.width; x++) {
      out[q] = src[p + layout.r]
      out[q + 1] = src[p + layout.g]
      out[q + 2] = src[p + layout.b]
      p += layout.bytes
      q += 3
    }
  }
  return out
}

/** rgb: interleaved RGB, width pixels per row. */
export function cropRgb(rgb: Uint8Array, width: number, rect: Rect): Uint8Array {
  'worklet'
  const out = new Uint8Array(rect.width * rect.height * 3)
  for (let y = 0; y < rect.height; y++) {
    const start = ((rect.y + y) * width + rect.x) * 3
    out.set(rgb.subarray(start, start + rect.width * 3), y * rect.width * 3)
  }
  return out
}

/** flat: FLAT_SIZE × FLAT_SIZE RGB. Returns 81 cell images of CELL_SIZE × CELL_SIZE RGB, row by row, as preprocessCells reads them. */
export function sliceCells(flat: Uint8Array): Uint8Array {
  'worklet'
  if (flat.length !== FLAT_SIZE * FLAT_SIZE * 3) {
    throw new RangeError(`expected ${FLAT_SIZE * FLAT_SIZE * 3} bytes of flattened grid, got ${flat.length}`)
  }
  const rowLength = CELL_SIZE * 3
  const out = new Uint8Array(CELLS * CELL_SIZE * CELL_SIZE * 3)
  for (let n = 0; n < CELLS; n++) {
    const top = Math.floor(n / 9) * CELL_SIZE
    const left = (n % 9) * CELL_SIZE
    for (let y = 0; y < CELL_SIZE; y++) {
      const start = ((top + y) * FLAT_SIZE + left) * 3
      out.set(flat.subarray(start, start + rowLength), (n * CELL_SIZE + y) * rowLength)
    }
  }
  return out
}
