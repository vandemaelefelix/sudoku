import type { SkImage } from '@shopify/react-native-skia'
import type { Photo } from 'react-native-vision-camera'
import { createScanner, type RecogniseResult } from '@/scanner'
import { deletePickedImage, saveUprightPhoto } from '@/scan/photoFile'
import { photoToSkImage } from '@/scan/utils/photoImage.utils'
import type { Quad } from '@/utils/geometry.utils'
import type { Change } from './captureAttempt'
import { type RunContext, runCapture, runImport } from './captureRun'

const mockStillImage = { dispose: jest.fn() }
const mockStill = { toImageAsync: jest.fn(async () => mockStillImage) }
jest.mock('@/scan/photoFile', () => ({
  saveUprightPhoto: jest.fn(async () => '/tmp/photo.jpg'),
  stillPhoto: jest.fn(() => mockStill),
  deletePickedImage: jest.fn(),
}))
jest.mock('@/scanner', () => ({ ...jest.requireActual('@/scanner'), createScanner: jest.fn() }))
jest.mock('@/scan/utils/photoImage.utils', () => ({ photoToSkImage: jest.fn() }))

const QUAD: Quad = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.8, y: 0.8 },
  { x: 0.2, y: 0.8 },
]
// The upright aspect of the fake photo with orientation 'right'.
const FRAME_ASPECT = 2376 / 4224
const OK: RecogniseResult = {
  ok: true,
  cells: [],
  quad: QUAD,
  corners: 'redetected',
  cornerOffset: 0.012,
  timings: { imageMs: 80, detectMs: 15, flattenMs: 20, classifyMs: 60 },
}
const PICKED = 'file:///cache/ImagePicker/picked.png'

function setup(live = true) {
  const changes: Change[] = []
  const state = { live }
  const context: RunContext = {
    current: () => state.live,
    change: (change) => changes.push(change),
    keepImage: jest.fn(),
  }
  const photo = { width: 4224, height: 2376, orientation: 'right', dispose: jest.fn() } as unknown as Photo
  return { changes, state, context, photo, takePhoto: jest.fn(async () => photo) }
}

const scanner = (over: Partial<Awaited<ReturnType<typeof createScanner>>> = {}) =>
  jest.mocked(createScanner).mockResolvedValue({
    recognise: jest.fn(async () => OK),
    recogniseStill: jest.fn(async () => OK),
    ...over,
  })

const resultOf = (changes: Change[]) => changes.find((change) => change.type === 'result')

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
  jest.mocked(photoToSkImage).mockResolvedValue({ dispose: jest.fn() } as unknown as SkImage)
  mockStillImage.dispose.mockClear()
  scanner()
})

afterEach(() => jest.restoreAllMocks())

describe('runCapture', () => {
  it('settles an ok result and keeps the converted image', async () => {
    const { context, changes, takePhoto, photo } = setup()
    await runCapture(context, takePhoto, QUAD, FRAME_ASPECT)
    expect(changes.map((change) => change.type).sort()).toEqual(['image', 'result'])
    expect(resultOf(changes)).toMatchObject({ result: { ok: true, photoPath: '/tmp/photo.jpg' } })
    expect(context.keepImage).toHaveBeenCalledTimes(1)
    expect(photo.dispose).toHaveBeenCalledTimes(1)
  })

  it('fails with no image when the photo fails, so the transition cross-fades', async () => {
    const { context, changes, takePhoto } = setup()
    takePhoto.mockRejectedValue(new Error('no camera'))
    await runCapture(context, takePhoto, QUAD, FRAME_ASPECT)
    expect(changes).toEqual([{ type: 'imageFailed' }, { type: 'result', result: { ok: false, reason: 'no camera' } }])
  })

  it('fails with no image when the scanner does not load', async () => {
    const { context, changes, takePhoto } = setup()
    jest.mocked(createScanner).mockRejectedValue(new Error('no model'))
    await runCapture(context, takePhoto, QUAD, FRAME_ASPECT)
    expect(takePhoto).not.toHaveBeenCalled()
    expect(changes).toEqual([{ type: 'imageFailed' }, { type: 'result', result: { ok: false, reason: 'no model' } }])
  })

  it('fails without touching the image when the scan fails, and still disposes the photo', async () => {
    const { context, changes, takePhoto, photo } = setup()
    scanner({
      recognise: jest.fn(async () => {
        throw new Error('model error')
      }),
    })
    await runCapture(context, takePhoto, QUAD, FRAME_ASPECT)
    expect(changes).toContainEqual({ type: 'result', result: { ok: false, reason: 'model error' } })
    expect(changes).not.toContainEqual({ type: 'imageFailed' })
    expect(photo.dispose).toHaveBeenCalledTimes(1)
  })

  it('marks an image failure and goes on with the scan', async () => {
    const { context, changes, takePhoto } = setup()
    jest.mocked(photoToSkImage).mockRejectedValue(new Error('no pixels'))
    await runCapture(context, takePhoto, QUAD, FRAME_ASPECT)
    expect(changes).toContainEqual({ type: 'imageFailed' })
    expect(resultOf(changes)).toMatchObject({ result: { ok: true } })
  })

  it('drops the quad when the photo and the frame differ in aspect', async () => {
    const { context, changes, takePhoto } = setup()
    const recognise = jest.fn(async () => OK)
    scanner({ recognise })
    await runCapture(context, takePhoto, QUAD, 1)
    expect(changes).toContainEqual({ type: 'dropQuad' })
    expect(recognise).toHaveBeenCalledWith(expect.anything(), null)
  })

  it('does not drop a quad that fits the photo', async () => {
    const { context, changes, takePhoto } = setup()
    await runCapture(context, takePhoto, QUAD, FRAME_ASPECT)
    expect(changes).not.toContainEqual({ type: 'dropQuad' })
  })

  it('changes nothing after the attempt went stale, and disposes the image that it made', async () => {
    const { context, changes, state, takePhoto, photo } = setup()
    const converted = { dispose: jest.fn() }
    jest.mocked(photoToSkImage).mockImplementation(async () => {
      state.live = false
      return converted as unknown as SkImage
    })
    await runCapture(context, takePhoto, QUAD, FRAME_ASPECT)
    expect(changes).toEqual([])
    expect(context.keepImage).not.toHaveBeenCalled()
    expect(converted.dispose).toHaveBeenCalledTimes(1)
    expect(photo.dispose).toHaveBeenCalledTimes(1)
  })

  it('keeps no photo file when saving it fails', async () => {
    const { context, changes, takePhoto } = setup()
    jest.mocked(saveUprightPhoto).mockRejectedValueOnce(new Error('disk full'))
    await runCapture(context, takePhoto, QUAD, FRAME_ASPECT)
    expect(resultOf(changes)).toMatchObject({ result: { ok: true } })
    expect(resultOf(changes)).not.toMatchObject({ result: { photoPath: expect.anything() } })
  })
})

describe('runImport', () => {
  it('settles an ok result marked as imported, and deletes the picked file', async () => {
    const { context, changes } = setup()
    await runImport(context, PICKED)
    expect(changes).toEqual([{ type: 'result', result: expect.objectContaining({ ok: true, imported: true }) }])
    expect(mockStillImage.dispose).toHaveBeenCalledTimes(1)
    expect(deletePickedImage).toHaveBeenCalledWith(PICKED)
  })

  it('fails with no image when the image does not decode', async () => {
    const { context, changes } = setup()
    mockStill.toImageAsync.mockRejectedValueOnce(new Error('bad file'))
    await runImport(context, PICKED)
    expect(changes).toEqual([{ type: 'imageFailed' }, { type: 'result', result: { ok: false, reason: 'bad file' } }])
    expect(deletePickedImage).toHaveBeenCalledWith(PICKED)
  })

  it('fails when the scan fails, disposes the decoded image and deletes the picked file', async () => {
    const { context, changes } = setup()
    scanner({
      recogniseStill: jest.fn(async () => {
        throw new Error('model error')
      }),
    })
    await runImport(context, PICKED)
    expect(changes).toEqual([{ type: 'result', result: { ok: false, reason: 'model error' } }])
    expect(mockStillImage.dispose).toHaveBeenCalledTimes(1)
    expect(deletePickedImage).toHaveBeenCalledWith(PICKED)
  })

  it('passes a failed result of the scanner on as it is', async () => {
    const { context, changes } = setup()
    scanner({ recogniseStill: jest.fn(async () => ({ ok: false as const, reason: 'no grid in the photo' })) })
    await runImport(context, PICKED)
    expect(changes).toEqual([{ type: 'result', result: { ok: false, reason: 'no grid in the photo' } }])
  })

  it('changes nothing after the attempt went stale, but still deletes the picked file', async () => {
    const { context, changes } = setup(false)
    await runImport(context, PICKED)
    expect(changes).toEqual([])
    expect(deletePickedImage).toHaveBeenCalledWith(PICKED)
  })
})
