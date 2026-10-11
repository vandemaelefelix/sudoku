import type { TfliteModel } from './classifier'
import { findGrid } from './findGrid'
import { downscaleSize, searchRect, toPhotoPixels } from './photoGeometry'
import { FLAT_SIZE, type Rect } from './pixels'
import type { Quad } from './quad'
import { CORNER_TOLERANCE, type ImageSource, recognise, SEARCH_GROW } from './recognise'
import { warpGrid } from './warp'

jest.mock('./findGrid', () => ({ findGrid: jest.fn() }))
jest.mock('./warp', () => ({ warpGrid: jest.fn() }))

const find = jest.mocked(findGrid)
const warp = jest.mocked(warpGrid)
const OUTPUTS = { digit: 0, kind: 1 }

function at<T>(items: ArrayLike<T>, index: number): T {
  const item = items[index]
  if (item === undefined) throw new RangeError(`no item at index ${index}`)
  return item
}
// A 16:9 photo, smaller than the real one so the test stays fast.
const PHOTO = { width: 720, height: 1280 }
const SMALL = downscaleSize(PHOTO.width, PHOTO.height)
const LOCKED: Quad = [
  { x: 0.2, y: 0.3 },
  { x: 0.8, y: 0.3 },
  { x: 0.8, y: 0.65 },
  { x: 0.2, y: 0.65 },
]

/** Like the device: the raw pixels of a photo image are sideways, a resized image is upright. */
function image(width: number, height: number, disposed: string[], upright = false): ImageSource {
  return {
    width,
    height,
    resize: (w, h) => image(w, h, disposed, true),
    toRawPixelData: () => {
      const [w, h] = upright ? [width, height] : [height, width]
      return { buffer: new ArrayBuffer(w * h * 4), width: w, height: h, pixelFormat: 'BGRA' }
    },
    dispose: () => disposed.push(`${width}x${height}`),
  }
}

function photo(disposed: string[] = []) {
  return { toImage: () => image(PHOTO.width, PHOTO.height, disposed) }
}

/** Every cell gets digit 3, printed. */
function model(): TfliteModel {
  const digit = new Float32Array(81 * 10)
  const kind = new Float32Array(81 * 4)
  for (let n = 0; n < 81; n++) {
    digit[n * 10 + 3] = 1
    kind[n * 4 + 1] = 1
  }
  return {
    inputs: [{ shape: [81, 32, 32, 1], dataType: 'float32' }],
    outputs: [{ shape: [81, 10] }, { shape: [81, 4] }],
    runSync: () => [digit.buffer.slice(0), kind.buffer.slice(0)],
  }
}

/** The quad as findGrid returns it for the crop rect: normalised to the crop. */
function inCrop(quad: Quad, rect: Rect): Quad {
  const map = (p: { x: number; y: number }) => ({
    x: (p.x * SMALL.width - rect.x) / rect.width,
    y: (p.y * SMALL.height - rect.y) / rect.height,
  })
  return [map(quad[0]), map(quad[1]), map(quad[2]), map(quad[3])]
}

function shifted(quad: Quad, dx: number): Quad {
  return [quad[0], quad[1], { x: quad[2].x + dx, y: quad[2].y }, quad[3]]
}

beforeEach(() => {
  jest.clearAllMocks()
  warp.mockImplementation((_raw, _corners, side) => ({
    buffer: new ArrayBuffer(side * side * 4),
    width: side,
    height: side,
    pixelFormat: 'BGRA',
  }))
})

it('uses the re-detected corners when they lie near the locked quad', () => {
  const near = shifted(LOCKED, 0.01)
  find.mockReturnValue({ quad: inCrop(near, searchRect(LOCKED, SMALL.width, SMALL.height, SEARCH_GROW)), score: 0.5 })
  const result = recognise(photo(), LOCKED, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expect(result.corners).toBe('redetected')
  expect(result.quad[2].x).toBeCloseTo(near[2].x, 6)
  expect(result.cornerOffset).toBeLessThanOrEqual(CORNER_TOLERANCE)
  expect(result.cells).toHaveLength(81)
  expect(result.cells[0]).toMatchObject({ digit: 3, kind: 'printed' })
})

it('searches only the grown box around the locked quad', () => {
  find.mockReturnValue(null)
  recognise(photo(), LOCKED, model(), OUTPUTS)
  const rect = searchRect(LOCKED, SMALL.width, SMALL.height, SEARCH_GROW)
  expect(at(find.mock.calls, 0).slice(1)).toEqual([rect.width, rect.height])
  expect(at(find.mock.calls, 0)[0]).toHaveLength(rect.width * rect.height * 3)
})

it('keeps the locked quad when the found corners are too far', () => {
  const far = shifted(LOCKED, 0.1)
  find.mockReturnValue({ quad: inCrop(far, searchRect(LOCKED, SMALL.width, SMALL.height, SEARCH_GROW)), score: 0.5 })
  const result = recognise(photo(), LOCKED, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expect(result.corners).toBe('locked')
  expect(result.quad).toEqual(LOCKED)
  expect(result.cornerOffset).toBeGreaterThan(CORNER_TOLERANCE)
})

it('keeps the locked quad when the search finds nothing', () => {
  find.mockReturnValue(null)
  const result = recognise(photo(), LOCKED, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expect(result.corners).toBe('locked')
  expect(result.cornerOffset).toBeNull()
})

it('flattens the photo from the chosen corners in photo pixels', () => {
  find.mockReturnValue(null)
  recognise(photo(), LOCKED, model(), OUTPUTS)
  expect(at(warp.mock.calls, 0)[0]).toMatchObject({ width: PHOTO.width, height: PHOTO.height })
  expect(at(warp.mock.calls, 0)[1]).toEqual(toPhotoPixels(LOCKED, PHOTO.width, PHOTO.height))
  expect(at(warp.mock.calls, 0)[2]).toBe(FLAT_SIZE)
})

it('searches the whole photo when there is no quad', () => {
  find.mockReturnValue({ quad: LOCKED, score: 0.5 })
  const result = recognise(photo(), null, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expect(result.corners).toBe('found')
  expect(at(find.mock.calls, 0).slice(1)).toEqual([SMALL.width, SMALL.height])
})

it('fails when there is no quad and no grid in the photo', () => {
  find.mockReturnValue(null)
  expect(recognise(photo(), null, model(), OUTPUTS)).toEqual({ ok: false, reason: 'no grid in the photo' })
})

it('reads the full pixels upright', () => {
  find.mockReturnValue(null)
  recognise(photo(), LOCKED, model(), OUTPUTS)
  expect(at(warp.mock.calls, 0)[0]).toMatchObject({ width: PHOTO.width, height: PHOTO.height })
})

it('fails with the reason when a step throws, and disposes every image', () => {
  find.mockReturnValue(null)
  warp.mockImplementation(() => {
    throw new Error('warp failed')
  })
  const disposed: string[] = []
  expect(recognise(photo(disposed), LOCKED, model(), OUTPUTS)).toEqual({ ok: false, reason: 'warp failed' })
  expect(disposed.toSorted()).toEqual(
    [`${PHOTO.width}x${PHOTO.height}`, `${PHOTO.width}x${PHOTO.height}`, `${SMALL.width}x${SMALL.height}`].toSorted(),
  )
})

it('gives the time of each step', () => {
  find.mockReturnValue(null)
  const result = recognise(photo(), LOCKED, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expect(Object.keys(result.timings).toSorted()).toEqual(['classifyMs', 'detectMs', 'flattenMs', 'imageMs'])
})
