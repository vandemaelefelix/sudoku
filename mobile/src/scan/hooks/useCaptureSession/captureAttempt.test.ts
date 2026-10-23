import type { SkImage } from '@shopify/react-native-skia'
import type { CaptureResult } from '@/scan/utils/captureResult.utils'
import type { Quad } from '@/utils/geometry.utils'
import { type Attempt, type Change, crossFadeOf, gatesOf, LIVE, reduceAttempt } from './captureAttempt'

const QUAD: Quad = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.8, y: 0.8 },
  { x: 0.2, y: 0.8 },
]
const IMAGE = {} as SkImage
const OK = { ok: true, cells: [] } as unknown as CaptureResult
const FAILED: CaptureResult = { ok: false, reason: 'no grid in the photo' }

const start: Change = { type: 'start', quad: QUAD, lockedView: QUAD, origin: 'camera' }
const capturing = (over: Partial<Attempt> = {}): Attempt => ({ ...reduceAttempt(LIVE, start), ...over })

describe('reduceAttempt', () => {
  it('starts an attempt from the live state, with the quad and the origin', () => {
    expect(reduceAttempt(LIVE, start)).toEqual({ ...LIVE, phase: 'capturing', quad: QUAD, lockedView: QUAD })
    expect(reduceAttempt(LIVE, { ...start, quad: null, lockedView: null, origin: 'library' })).toMatchObject({
      phase: 'capturing',
      origin: 'library',
      quad: null,
      lockedView: null,
    })
  })

  it('forgets the old attempt at a new start', () => {
    const old = capturing({ result: OK, imageFailed: true, image: IMAGE, phase: 'review' })
    expect(reduceAttempt(old, start)).toEqual(capturing())
  })

  it('ignores a late callback in the live state', () => {
    const late: Change[] = [
      { type: 'image', image: IMAGE },
      { type: 'imageFailed' },
      { type: 'dropQuad' },
      { type: 'result', result: OK },
      { type: 'end' },
    ]
    for (const change of late) expect(reduceAttempt(LIVE, change)).toBe(LIVE)
  })

  it('keeps the image, the failure of the image and the result', () => {
    expect(reduceAttempt(capturing(), { type: 'image', image: IMAGE }).image).toBe(IMAGE)
    expect(reduceAttempt(capturing(), { type: 'imageFailed' }).imageFailed).toBe(true)
    expect(reduceAttempt(capturing(), { type: 'result', result: FAILED }).result).toBe(FAILED)
  })

  it('drops the quad and keeps the locked view, so the dots of the cross-fade stay on the locked grid', () => {
    const dropped = reduceAttempt(capturing(), { type: 'dropQuad' })
    expect(dropped.quad).toBeNull()
    expect(dropped.lockedView).toBe(QUAD)
  })

  it('ends only a capturing attempt', () => {
    expect(reduceAttempt(capturing(), { type: 'end' }).phase).toBe('review')
    const review = capturing({ phase: 'review' })
    expect(reduceAttempt(review, { type: 'end' })).toBe(review)
  })
})

describe('crossFadeOf', () => {
  it('is false in the live state, also with Reduce Motion', () => {
    expect(crossFadeOf(LIVE, true)).toBe(false)
  })

  it('is false for a locked grid without Reduce Motion', () => {
    expect(crossFadeOf(capturing(), false)).toBe(false)
  })

  it('is true with Reduce Motion', () => {
    expect(crossFadeOf(capturing(), true)).toBe(true)
  })

  it('is true without a quad, without a locked view and after an image failure', () => {
    expect(crossFadeOf(capturing({ quad: null }), false)).toBe(true)
    expect(crossFadeOf(capturing({ lockedView: null }), false)).toBe(true)
    expect(crossFadeOf(capturing({ imageFailed: true }), false)).toBe(true)
  })
})

describe('gatesOf', () => {
  it('closes both gates in the live state', () => {
    expect(gatesOf(LIVE)).toEqual({ photo: false, results: false })
  })

  it('opens the photo gate when the image is ready', () => {
    expect(gatesOf(capturing()).photo).toBe(false)
    expect(gatesOf(capturing({ image: IMAGE })).photo).toBe(true)
  })

  it('opens the photo gate when no image will come: no quad or a failed conversion', () => {
    expect(gatesOf(capturing({ quad: null })).photo).toBe(true)
    expect(gatesOf(capturing({ imageFailed: true })).photo).toBe(true)
  })

  it('opens the results gate for an ok result only', () => {
    expect(gatesOf(capturing()).results).toBe(false)
    expect(gatesOf(capturing({ result: FAILED })).results).toBe(false)
    expect(gatesOf(capturing({ result: OK })).results).toBe(true)
  })
})
