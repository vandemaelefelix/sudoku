import type { TfliteModel } from './classifier'
import { findGrids } from './findGrid'
import { downscaleSize, searchRect, toPhotoPixels } from './photoGeometry'
import { FLAT_SIZE } from './pixels'
import { INNER_INSET, type ImageSource, recognise, recogniseStill, SEARCH_GROW, STILL_MAX_SIDE } from './recognise'
import { warpGrid } from './warp'
import type { Rect, Quad } from '@/utils/geometry.utils'

jest.mock('./findGrid', () => ({ findGrid: jest.fn(), findGrids: jest.fn() }))
jest.mock('./warp', () => ({ warpGrid: jest.fn() }))

const findAll = jest.mocked(findGrids)
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

/** A grid across the middle of the photo, from y top to top + 0.2. score: the share of the photo it covers. */
function band(top: number) {
  const quad: Quad = [
    { x: 0.3, y: top },
    { x: 0.7, y: top },
    { x: 0.7, y: top + 0.2 },
    { x: 0.3, y: top + 0.2 },
  ]
  return { quad, score: 0.08 }
}

function moved(quad: Quad, dx: number, dy: number): Quad {
  const move = (p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy })
  return [move(quad[0]), move(quad[1]), move(quad[2]), move(quad[3])]
}

const BOX = searchRect(LOCKED, SMALL.width, SMALL.height, SEARCH_GROW)

/** inBox: the grids in the search box, normalised to the photo. whole: the grids in the whole photo. */
function photoHas(inBox: Quad[], whole: Quad[] = inBox) {
  findAll.mockImplementation((_pixels, width, height) =>
    (width === SMALL.width && height === SMALL.height ? whole : inBox.map((quad) => inCrop(quad, BOX))).map((quad) => ({
      quad,
      score: 0.5,
    })),
  )
}

function expectQuad(actual: Quad, expected: Quad) {
  actual.forEach((p, i) => {
    expect(p.x).toBeCloseTo(at(expected, i).x, 6)
    expect(p.y).toBeCloseTo(at(expected, i).y, 6)
  })
}

beforeEach(() => {
  photoHas([LOCKED])
  warp.mockImplementation((_raw, _corners, side) => ({
    buffer: new ArrayBuffer(side * side * 4),
    width: side,
    height: side,
    pixelFormat: 'BGRA',
  }))
})

it('uses the corners from the photo when the grid lies near the locked quad', () => {
  const near = moved(LOCKED, 0.01, 0)
  photoHas([near])
  const result = recognise(photo(), LOCKED, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expect(result.corners).toBe('redetected')
  expectQuad(result.quad, near)
  expect(result.cornerOffset).toBeGreaterThan(0)
  expect(result.cells).toHaveLength(81)
  expect(result.cells[0]).toMatchObject({ digit: 3, kind: 'printed' })
})

it('uses the corners from the photo, not the locked quad, when the phone moved after lock-on', () => {
  const after = moved(LOCKED, 0.03, 0.02)
  photoHas([after])
  const result = recognise(photo(), LOCKED, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expectQuad(result.quad, after)
  expect(at(warp.mock.calls, 0)[1]).toEqual(toPhotoPixels(result.quad, PHOTO.width, PHOTO.height))
})

it('searches the grown box around the locked quad first', () => {
  recognise(photo(), LOCKED, model(), OUTPUTS)
  expect(findAll).toHaveBeenCalledTimes(1)
  expect(at(findAll.mock.calls, 0).slice(1)).toEqual([BOX.width, BOX.height])
  expect(at(findAll.mock.calls, 0)[0]).toHaveLength(BOX.width * BOX.height * 3)
})

it('searches the whole photo when the grid moved out of the box', () => {
  const after = moved(LOCKED, 0.12, 0.05)
  photoHas([], [after])
  const result = recognise(photo(), LOCKED, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expect(at(findAll.mock.calls, 1).slice(1)).toEqual([SMALL.width, SMALL.height])
  expectQuad(result.quad, after)
})

it('chooses the grid nearest the locked quad when the photo has several', () => {
  const other = moved(LOCKED, 0, -0.28)
  const after = moved(LOCKED, 0.12, 0)
  photoHas([], [other, after])
  const result = recognise(photo(), LOCKED, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expect(result.corners).toBe('redetected')
  expectQuad(result.quad, after)
})

it('fails when the only grid in the photo is another grid', () => {
  photoHas([], [moved(LOCKED, 0, -0.28)])
  const result = recognise(photo(), LOCKED, model(), OUTPUTS)
  expect(result).toEqual({ ok: false, reason: 'no grid in the photo' })
  expect(warp).not.toHaveBeenCalled()
})

it('fails when the photo has no grid', () => {
  photoHas([])
  expect(recognise(photo(), LOCKED, model(), OUTPUTS)).toEqual({ ok: false, reason: 'no grid in the photo' })
})

it('flattens the full photo to the flat size', () => {
  recognise(photo(), LOCKED, model(), OUTPUTS)
  expect(at(warp.mock.calls, 0)[0]).toMatchObject({ width: PHOTO.width, height: PHOTO.height })
  expect(at(warp.mock.calls, 0)[2]).toBe(FLAT_SIZE)
})

it('searches the whole photo when there is no quad', () => {
  findAll.mockReturnValue([{ quad: LOCKED, score: 0.5 }])
  const result = recognise(photo(), null, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expect(result.corners).toBe('found')
  expect(at(findAll.mock.calls, 0).slice(1)).toEqual([SMALL.width, SMALL.height])
})

it('takes the grid nearest the centre when there is no quad, not the largest', () => {
  // The centre grid has more than 60 % of the area of the larger one, so it counts.
  const larger = { ...band(0.05), score: 0.1 }
  findAll.mockReturnValue([larger, band(0.4)])
  const result = recognise(photo(), null, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expect(result.corners).toBe('found')
  expectQuad(result.quad, band(0.4).quad)
})

it('fails when there is no quad and no grid in the photo', () => {
  findAll.mockReturnValue([])
  expect(recognise(photo(), null, model(), OUTPUTS)).toEqual({ ok: false, reason: 'no grid in the photo' })
})

it('reads the full pixels upright', () => {
  recognise(photo(), LOCKED, model(), OUTPUTS)
  expect(at(warp.mock.calls, 0)[0]).toMatchObject({ width: PHOTO.width, height: PHOTO.height })
})

it('fails with the reason when a step throws, and disposes every image', () => {
  warp.mockImplementation(() => {
    throw new Error('warp failed')
  })
  const disposed: string[] = []
  expect(recognise(photo(disposed), LOCKED, model(), OUTPUTS)).toEqual({ ok: false, reason: 'warp failed' })
  expect([...disposed].sort()).toEqual(
    [`${PHOTO.width}x${PHOTO.height}`, `${PHOTO.width}x${PHOTO.height}`, `${SMALL.width}x${SMALL.height}`].sort(),
  )
})

it('gives the time of each step', () => {
  const result = recognise(photo(), LOCKED, model(), OUTPUTS)
  if (!result.ok) throw new Error(result.reason)
  expect(Object.keys(result.timings).sort()).toEqual(['classifyMs', 'detectMs', 'flattenMs', 'imageMs'])
})

describe('a still image', () => {
  it('searches the whole image with findGrid, as after a shutter press without a grid', () => {
    findAll.mockReturnValueOnce([{ quad: LOCKED, score: 0.5 }]).mockReturnValue([])
    const result = recogniseStill(image(PHOTO.width, PHOTO.height, []), model(), OUTPUTS)
    if (!result.ok) throw new Error(result.reason)
    expect(result).toMatchObject({ corners: 'found', cornerOffset: null })
    expectQuad(result.quad, LOCKED)
    expect(at(findAll.mock.calls, 0).slice(1)).toEqual([SMALL.width, SMALL.height])
    expect(at(warp.mock.calls, 0)[0]).toMatchObject({ width: PHOTO.width, height: PHOTO.height })
  })

  it('searches inside the found quad, so a photo of a whole page finds the grid on the page', () => {
    const page: Quad = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ]
    const inside = searchRect(page, SMALL.width, SMALL.height, -INNER_INSET)
    findAll
      .mockReturnValueOnce([{ quad: page, score: 0.64 }])
      .mockReturnValueOnce([{ quad: inCrop(LOCKED, inside), score: 0.3 }])
      .mockReturnValue([])
    const result = recogniseStill(image(PHOTO.width, PHOTO.height, []), model(), OUTPUTS)
    if (!result.ok) throw new Error(result.reason)
    expectQuad(result.quad, LOCKED)
    expect(at(findAll.mock.calls, 1).slice(1)).toEqual([inside.width, inside.height])
    // The search stops when the inside of the grid has no quad.
    expect(findAll).toHaveBeenCalledTimes(3)
  })

  it('stops after the deepest search it allows', () => {
    findAll.mockReturnValue([{ quad: LOCKED, score: 0.5 }])
    recogniseStill(image(PHOTO.width, PHOTO.height, []), model(), OUTPUTS)
    expect(findAll).toHaveBeenCalledTimes(4)
  })

  it('reads a large image at most STILL_MAX_SIDE on its long side, upright', () => {
    findAll.mockReturnValueOnce([{ quad: LOCKED, score: 0.5 }]).mockReturnValue([])
    recogniseStill(image(8064, 6048, []), model(), OUTPUTS)
    expect(at(warp.mock.calls, 0)[0]).toMatchObject({ width: STILL_MAX_SIDE, height: 3024 })
  })

  it('reads a small image at its own size', () => {
    findAll.mockReturnValueOnce([{ quad: LOCKED, score: 0.5 }]).mockReturnValue([])
    recogniseStill(image(1206, 2622, []), model(), OUTPUTS)
    expect(at(warp.mock.calls, 0)[0]).toMatchObject({ width: 1206, height: 2622 })
  })

  it('takes the grid nearest the image centre on a page of three equal grids, not the first one', () => {
    findAll.mockReturnValueOnce([band(0.1), band(0.4), band(0.7)]).mockReturnValue([])
    const result = recogniseStill(image(PHOTO.width, PHOTO.height, []), model(), OUTPUTS)
    if (!result.ok) throw new Error(result.reason)
    expect(result.corners).toBe('found')
    expectQuad(result.quad, band(0.4).quad)
  })

  it('fails when the image has no grid', () => {
    findAll.mockReturnValue([])
    expect(recogniseStill(image(PHOTO.width, PHOTO.height, []), model(), OUTPUTS)).toEqual({
      ok: false,
      reason: 'no grid in the photo',
    })
  })

  it('disposes the images it makes, but not the image of the caller', () => {
    findAll.mockReturnValue([{ quad: LOCKED, score: 0.5 }])
    const disposed: string[] = []
    const still = image(PHOTO.width, PHOTO.height, disposed)
    const own = jest.spyOn(still, 'dispose')
    recogniseStill(still, model(), OUTPUTS)
    expect(own).not.toHaveBeenCalled()
    expect([...disposed].sort()).toEqual([`${PHOTO.width}x${PHOTO.height}`, `${SMALL.width}x${SMALL.height}`].sort())
  })
})
