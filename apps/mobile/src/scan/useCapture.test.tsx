import { act, renderHook, waitFor } from '@testing-library/react-native'
import { impactAsync } from 'expo-haptics'
import type { SkImage } from '@shopify/react-native-skia'
import type { Photo } from 'react-native-vision-camera'
import { createScanner, type Quad, type RecogniseResult } from '@/scanner'
import { photoToSkImage } from './transition/photoImage'
import { formatScanLog, useCapture } from './useCapture'

jest.mock('@/scanner', () => ({ ...jest.requireActual('@/scanner'), createScanner: jest.fn() }))
jest.mock('./transition/photoImage', () => ({ photoToSkImage: jest.fn() }))

// A new image per test: the automatic unmount after a test disposes the image of that test a little later.
let IMAGE = { dispose: jest.fn() } as unknown as SkImage

const QUAD: Quad = [
  { x: 0.2, y: 0.3 },
  { x: 0.8, y: 0.3 },
  { x: 0.8, y: 0.65 },
  { x: 0.2, y: 0.65 },
]
// The upright aspect of the fake 4224 × 2376 photo with orientation 'right'.
const FRAME_ASPECT = 2376 / 4224
const OK: RecogniseResult = {
  ok: true,
  cells: [],
  quad: QUAD,
  corners: 'redetected',
  cornerOffset: 0.012,
  timings: { imageMs: 80, detectMs: 15, flattenMs: 20, classifyMs: 60 },
}

function setup(result: RecogniseResult = OK) {
  const photo = { width: 4224, height: 2376, orientation: 'right', dispose: jest.fn() } as unknown as Photo
  const output = { capturePhoto: jest.fn(async () => photo) }
  const recognise = jest.fn(async () => result)
  jest.mocked(createScanner).mockResolvedValue({ recognise })
  jest.mocked(photoToSkImage).mockResolvedValue(IMAGE)
  const hook = renderHook(() => useCapture(output))
  return { hook, output, photo, recognise }
}

beforeEach(() => {
  jest.clearAllMocks()
  IMAGE = { dispose: jest.fn() } as unknown as SkImage
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
})

it('plays the haptic, takes a photo and recognises it with the quad', async () => {
  const { hook, output, photo, recognise } = setup()
  await act(async () => hook.result.current.capture(QUAD, FRAME_ASPECT))
  expect(impactAsync).toHaveBeenCalledTimes(1)
  expect(output.capturePhoto).toHaveBeenCalledTimes(1)
  expect(output.capturePhoto).toHaveBeenCalledWith({ enableShutterSound: false }, {})
  expect(recognise).toHaveBeenCalledWith(photo, QUAD)
  expect(photo.dispose).toHaveBeenCalledTimes(1)
  expect(photoToSkImage).toHaveBeenCalledWith(photo, 1600)
  expect(hook.result.current.state).toEqual({
    phase: 'capturing',
    quad: QUAD,
    image: IMAGE,
    imageFailed: false,
    result: OK,
  })
})

it('drops the quad when the frame aspect does not fit the photo', async () => {
  const { hook, photo, recognise } = setup()
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  await act(async () => hook.result.current.capture(QUAD, 3 / 4))
  expect(recognise).toHaveBeenCalledWith(photo, null)
  expect(hook.result.current.state).toEqual({
    phase: 'capturing',
    quad: null,
    image: IMAGE,
    imageFailed: false,
    result: OK,
  })
})

it('goes from capturing to the image to the result, and disposes the photo once, after both', async () => {
  const { hook, photo, recognise } = setup()
  const pending: { image?: (image: SkImage) => void; result?: (result: RecogniseResult) => void } = {}
  jest.mocked(photoToSkImage).mockImplementationOnce(() => new Promise((resolve) => (pending.image = resolve)))
  recognise.mockImplementationOnce(() => new Promise<RecogniseResult>((resolve) => (pending.result = resolve)))
  act(() => hook.result.current.capture(QUAD, FRAME_ASPECT))
  expect(hook.result.current.state).toEqual({
    phase: 'capturing',
    quad: QUAD,
    image: null,
    imageFailed: false,
    result: null,
  })
  await waitFor(() => expect(pending.image).toBeDefined())
  await act(async () => pending.image?.(IMAGE))
  expect(hook.result.current.state).toEqual({
    phase: 'capturing',
    quad: QUAD,
    image: IMAGE,
    imageFailed: false,
    result: null,
  })
  expect(photo.dispose).not.toHaveBeenCalled()
  await act(async () => pending.result?.(OK))
  expect(hook.result.current.state).toEqual({
    phase: 'capturing',
    quad: QUAD,
    image: IMAGE,
    imageFailed: false,
    result: OK,
  })
  expect(photo.dispose).toHaveBeenCalledTimes(1)
})

it('keeps the image null and still gives the result when the conversion fails', async () => {
  const { hook, photo } = setup()
  jest.mocked(photoToSkImage).mockRejectedValueOnce(new Error('no pixels'))
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  await act(async () => hook.result.current.capture(QUAD, FRAME_ASPECT))
  expect(hook.result.current.state).toEqual({
    phase: 'capturing',
    quad: QUAD,
    image: null,
    imageFailed: true,
    result: OK,
  })
  expect(photo.dispose).toHaveBeenCalledTimes(1)
})

it('gives the image to the UI thread too', async () => {
  const { hook } = setup()
  await act(async () => hook.result.current.capture(QUAD, FRAME_ASPECT))
  expect(hook.result.current.sharedImage.value).toBe(IMAGE)
})

it('on unmount, clears the image on the UI thread before it disposes the image', async () => {
  const { hook } = setup()
  await act(async () => hook.result.current.capture(QUAD, FRAME_ASPECT))
  const sharedImage = hook.result.current.sharedImage
  const seenAtDispose: unknown[] = []
  jest.mocked(IMAGE.dispose).mockImplementationOnce(() => seenAtDispose.push(sharedImage.value))
  hook.unmount()
  expect(IMAGE.dispose).not.toHaveBeenCalled()
  await waitFor(() => expect(IMAGE.dispose).toHaveBeenCalledTimes(1))
  expect(seenAtDispose).toEqual([null])
})

it('disposes an image that arrives after unmount', async () => {
  const { hook } = setup()
  const pending: { image?: (image: SkImage) => void } = {}
  jest.mocked(photoToSkImage).mockImplementationOnce(() => new Promise((resolve) => (pending.image = resolve)))
  act(() => hook.result.current.capture(QUAD, FRAME_ASPECT))
  await waitFor(() => expect(pending.image).toBeDefined())
  hook.unmount()
  await act(async () => pending.image?.(IMAGE))
  expect(IMAGE.dispose).toHaveBeenCalledTimes(1)
})

it('takes one photo when capture comes twice', async () => {
  const { hook, output, photo, recognise } = setup()
  await act(async () => {
    hook.result.current.capture(QUAD, FRAME_ASPECT)
    hook.result.current.capture(null, FRAME_ASPECT)
  })
  expect(output.capturePhoto).toHaveBeenCalledTimes(1)
  expect(recognise).toHaveBeenCalledTimes(1)
  expect(photo.dispose).toHaveBeenCalledTimes(1)
})

it('ignores a capture that comes in a later tick while the scan runs', async () => {
  const { hook, output, recognise } = setup()
  const pending: { finish?: (result: RecogniseResult) => void } = {}
  recognise.mockImplementationOnce(() => new Promise<RecogniseResult>((resolve) => (pending.finish = resolve)))
  await act(async () => hook.result.current.capture(QUAD, FRAME_ASPECT))
  expect(hook.result.current.state.phase).toBe('capturing')
  await act(async () => hook.result.current.capture(null, FRAME_ASPECT))
  await act(async () => pending.finish?.(OK))
  expect(output.capturePhoto).toHaveBeenCalledTimes(1)
  expect(recognise).toHaveBeenCalledTimes(1)
  expect(hook.result.current.state).toMatchObject({ phase: 'capturing', result: OK })
})

it('gives a failure with the reason when the photo fails', async () => {
  const { hook, output } = setup()
  output.capturePhoto.mockRejectedValueOnce(new Error('the camera is not ready'))
  await act(async () => hook.result.current.capture(QUAD, FRAME_ASPECT))
  expect(hook.result.current.state).toMatchObject({
    phase: 'capturing',
    image: null,
    imageFailed: true,
    result: { ok: false, reason: 'the camera is not ready' },
  })
})

it('gives a failure without a photo when the model did not load', async () => {
  const { hook, output } = setup()
  jest.mocked(createScanner).mockRejectedValue(new Error('the scanner does not implement model contract 2.0'))
  await act(async () => hook.result.current.capture(QUAD, FRAME_ASPECT))
  expect(output.capturePhoto).not.toHaveBeenCalled()
  expect(hook.result.current.state).toMatchObject({
    phase: 'capturing',
    image: null,
    imageFailed: true,
    result: { ok: false },
  })
  expect(photoToSkImage).not.toHaveBeenCalled()
})

it('keeps capture the same function across renders', () => {
  const { hook } = setup()
  const first = hook.result.current.capture
  hook.rerender({})
  expect(hook.result.current.capture).toBe(first)
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
