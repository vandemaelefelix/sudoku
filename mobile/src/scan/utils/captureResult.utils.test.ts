import type { RecogniseResult } from '@/scanner'
import { flatToSkImage, saveFlatPng } from '@/scan/utils/flatImage.utils'
import { formatScanLog, toCaptureResult } from './captureResult.utils'

const FLAT_IMAGE = { width: () => 576 }
jest.mock('@/scan/utils/flatImage.utils', () => ({
  saveFlatPng: jest.fn(() => 'file:///tmp/flat.png'),
  flatToSkImage: jest.fn(() => FLAT_IMAGE),
}))

const OK: RecogniseResult = {
  ok: true,
  cells: [],
  quad: [
    { x: 0.2, y: 0.3 },
    { x: 0.8, y: 0.3 },
    { x: 0.8, y: 0.65 },
    { x: 0.2, y: 0.65 },
  ],
  corners: 'redetected',
  cornerOffset: 0.012,
  timings: { imageMs: 80, detectMs: 15, flattenMs: 20, classifyMs: 60 },
}
const FLAT = new Uint8Array(3)

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => jest.restoreAllMocks())

describe('toCaptureResult', () => {
  it('passes a failure through', () => {
    const failed: RecogniseResult = { ok: false, reason: 'no grid in the photo' }
    expect(toCaptureResult(failed, '/tmp/photo.jpg')).toBe(failed)
  })

  it('keeps the flattened grid as an image, and drops the bytes', () => {
    const kept = toCaptureResult({ ...OK, flat: FLAT }, null)
    expect(kept).not.toHaveProperty('flat')
    expect(kept).toMatchObject({ flatImage: FLAT_IMAGE })
    expect(flatToSkImage).toHaveBeenCalledWith(FLAT)
  })

  it('adds the photo file and, in a development build, the flattened grid file', () => {
    const kept = toCaptureResult({ ...OK, flat: FLAT }, '/tmp/photo.jpg')
    expect(kept).toMatchObject({ photoPath: '/tmp/photo.jpg', flatPath: 'file:///tmp/flat.png' })
    expect(saveFlatPng).toHaveBeenCalledWith(FLAT)
  })

  it('adds no file when the photo was not kept', () => {
    const kept = toCaptureResult({ ...OK, flat: FLAT }, null)
    expect(kept).not.toHaveProperty('photoPath')
    expect(kept).not.toHaveProperty('flatPath')
    expect(saveFlatPng).not.toHaveBeenCalled()
  })

  it('keeps the result without the image when Skia cannot make one', () => {
    jest.mocked(flatToSkImage).mockReturnValueOnce(null)
    expect(toCaptureResult({ ...OK, flat: FLAT }, '/tmp/photo.jpg')).not.toHaveProperty('flatImage')
    jest.mocked(flatToSkImage).mockImplementationOnce(() => {
      throw new Error('no pixels')
    })
    expect(toCaptureResult({ ...OK, flat: FLAT }, '/tmp/photo.jpg')).not.toHaveProperty('flatImage')
  })

  it('keeps the photo file when the flattened grid file is not saved', () => {
    jest.mocked(saveFlatPng).mockImplementationOnce(() => {
      throw new Error('disk full')
    })
    const kept = toCaptureResult({ ...OK, flat: FLAT }, '/tmp/photo.jpg')
    expect(kept).toMatchObject({ photoPath: '/tmp/photo.jpg' })
    expect(kept).not.toHaveProperty('flatPath')
  })

  describe('in a release build', () => {
    const dev = __DEV__
    beforeEach(() => Object.assign(globalThis, { __DEV__: false }))
    afterEach(() => Object.assign(globalThis, { __DEV__: dev }))

    it('saves no flattened grid file', () => {
      const kept = toCaptureResult({ ...OK, flat: FLAT }, '/tmp/photo.jpg')
      expect(kept).toMatchObject({ photoPath: '/tmp/photo.jpg' })
      expect(kept).not.toHaveProperty('flatPath')
      expect(saveFlatPng).not.toHaveBeenCalled()
    })
  })
})

describe('formatScanLog', () => {
  it('gives the time of each step', () => {
    expect(formatScanLog(120, 310, OK)).toBe(
      '[scan] photo 120 ms, image 80 ms, detect 15 ms (redetected, offset 1.2 %), flatten 20 ms, classify 60 ms, total 310 ms',
    )
  })

  it('gives the reason of a failure', () => {
    expect(formatScanLog(120, 200, { ok: false, reason: 'no grid in the photo' })).toBe(
      '[scan] failed after 200 ms: no grid in the photo',
    )
  })
})
