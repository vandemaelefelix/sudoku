import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { SkImage } from '@shopify/react-native-skia'
import * as Haptics from 'expo-haptics'
import { useReducedMotion } from 'react-native-reanimated'
import type { Photo } from 'react-native-vision-camera'
import { createScanner, type RecogniseResult } from '@/scanner'
import {
  GATE_PHOTO,
  GATE_RESULTS,
  REDUCED_END,
  SPINNER_DELAY,
  TRANSITION_END,
} from '@/scan/constants/transition.constants'
import { correctionLayout } from '@/scan/utils/correction.utils'
import { deletePickedImage, saveUprightPhoto, stillPhoto } from '@/scan/utils/photoFile'
import { photoToSkImage } from '@/scan/utils/photoImage.utils'
import { transitionAt } from '@/scan/utils/transition.utils'
import type { Quad } from '@/utils/geometry.utils'
import { useCaptureSession } from './useCaptureSession'

const mockStillImage = { width: 1206, height: 2622, dispose: jest.fn() }
const mockStill = { toImageAsync: jest.fn(async () => mockStillImage) }
jest.mock('@/scan/utils/photoFile', () => ({
  saveUprightPhoto: jest.fn(async () => '/tmp/photo.jpg'),
  stillPhoto: jest.fn(() => mockStill),
  deletePickedImage: jest.fn(),
}))
jest.mock('@/scanner', () => ({ ...jest.requireActual('@/scanner'), createScanner: jest.fn() }))
jest.mock('@/scan/utils/photoImage.utils', () => ({ photoToSkImage: jest.fn() }))
const FLAT_IMAGE = { width: () => 576 }
jest.mock('@/scan/utils/flatImage.utils', () => ({
  saveFlatPng: jest.fn(() => 'file:///tmp/flat.png'),
  flatToSkImage: jest.fn(() => FLAT_IMAGE),
}))

// A new image per test: the automatic unmount after a test disposes the image of that test a little later.
let IMAGE = { dispose: jest.fn() } as unknown as SkImage

const QUAD: Quad = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.8, y: 0.8 },
  { x: 0.2, y: 0.8 },
]
// The upright aspect of the fake 4224 × 2376 photo with orientation 'right'.
const FRAME_ASPECT = 2376 / 4224
const VIEW = { width: 402, height: 874 }
const LAYOUT = correctionLayout(VIEW, { top: 0, bottom: 0, left: 0, right: 0 })
/** The start of the digit sweep in the timeline. */
const SWEEP_START = 0.55
const OK: RecogniseResult = {
  ok: true,
  cells: [],
  quad: QUAD,
  corners: 'redetected',
  cornerOffset: 0.012,
  timings: { imageMs: 80, detectMs: 15, flattenMs: 20, classifyMs: 60 },
}
// The session adds the temporary photo file of the capture to an ok result.
const WITH_PHOTO = { ...OK, photoPath: '/tmp/photo.jpg' }
const FAILED: RecogniseResult = { ok: false, reason: 'no grid in the photo' }
const PICKED = 'file:///cache/ImagePicker/picked.png'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function shared<T>(value: T) {
  return { value, get: () => value } as never
}

/** The photo and the result wait until the test settles them, so the test controls the order. */
function setup({ aspect = FRAME_ASPECT, view = VIEW }: { aspect?: number; view?: typeof VIEW } = {}) {
  const photo = { width: 4224, height: 2376, orientation: 'right', dispose: jest.fn() } as unknown as Photo
  const output = { capturePhoto: jest.fn(async () => photo) }
  const image = deferred<SkImage>()
  const result = deferred<RecogniseResult>()
  const recognise = jest.fn(() => result.promise)
  const recogniseStill = jest.fn(() => result.promise)
  jest.mocked(createScanner).mockResolvedValue({ recognise, recogniseStill })
  jest.mocked(photoToSkImage).mockReturnValue(image.promise)
  const detection = shared({ quad: null, timestamp: 0, aspect })
  const viewSize = shared(view)
  const hook = renderHook(() => useCaptureSession({ photoOutput: output, layout: LAYOUT, detection, viewSize }))
  return {
    hook,
    output,
    photo,
    recognise,
    recogniseStill,
    session: () => hook.result.current,
    start: (quad: Quad | null = QUAD, source: 'auto' | 'shutter' = 'auto') =>
      act(async () => hook.result.current.startCapture(quad, source)),
    startImport: (uri = PICKED) => act(async () => hook.result.current.startImport(uri)),
    giveImage: () => act(async () => image.resolve(IMAGE)),
    failImage: () => act(async () => image.reject(new Error('no pixels'))),
    giveResult: (done: RecogniseResult = OK) => act(async () => result.resolve(done)),
  }
}

let frameTime = 0

/** Runs UI frames of 1/60 s for the given seconds, through the clock step that the overlay calls first in each frame. */
function runFrames(session: () => ReturnType<typeof useCaptureSession>, seconds: number) {
  for (let i = 0; i <= Math.round(seconds * 60); i++) {
    session().stepClock(frameTime * 1000)
    frameTime += 1 / 60
  }
}

beforeEach(() => {
  frameTime = 0
  IMAGE = { dispose: jest.fn() } as unknown as SkImage
  jest.mocked(useReducedMotion).mockReturnValue(false)
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => jest.restoreAllMocks())

describe('the capture attempt', () => {
  it('starts live, with no result', () => {
    const { session } = setup()
    expect(session()).toMatchObject({ phase: 'live', result: null, quad: null, photoShown: false, crossFade: false })
  })

  it('takes a photo, recognises it with the quad and keeps both results', async () => {
    const { session, output, photo, recognise, start, giveImage, giveResult } = setup()
    await start()
    expect(output.capturePhoto).toHaveBeenCalledTimes(1)
    expect(output.capturePhoto).toHaveBeenCalledWith({ enableShutterSound: false }, {})
    expect(recognise).toHaveBeenCalledWith(photo, QUAD)
    expect(photoToSkImage).toHaveBeenCalledWith(photo, 1600)
    expect(session()).toMatchObject({ phase: 'capturing', quad: QUAD, photoShown: false, result: null })
    await giveImage()
    await giveResult()
    expect(session()).toMatchObject({ phase: 'capturing', quad: QUAD, photoShown: true, result: WITH_PHOTO })
    expect(session().image.value).toBe(IMAGE)
    expect(photo.dispose).toHaveBeenCalledTimes(1)
  })

  it('disposes the photo once, after the image and the result', async () => {
    const { photo, start, giveImage, giveResult } = setup()
    await start()
    await giveImage()
    expect(photo.dispose).not.toHaveBeenCalled()
    await giveResult()
    expect(photo.dispose).toHaveBeenCalledTimes(1)
  })

  it('keeps the flattened grid as an image in the result, not as bytes', async () => {
    const { session, start, giveImage, giveResult } = setup()
    await start()
    await giveImage()
    await giveResult({ ...OK, flat: new Uint8Array(3) } as RecogniseResult)
    const result = session().result
    if (result?.ok !== true) throw new Error('no ok result')
    expect(result).not.toHaveProperty('flat')
    expect(result.flatImage).toBe(FLAT_IMAGE)
    expect(result.flatPath).toBe('file:///tmp/flat.png')
  })

  it('drops the locked quad when the frame aspect does not fit the photo, and cross-fades', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { session, photo, recognise, start, giveImage, giveResult } = setup({ aspect: 3 / 4 })
    await start()
    await giveImage()
    await giveResult()
    expect(recognise).toHaveBeenCalledWith(photo, null)
    expect(session()).toMatchObject({ quad: null, crossFade: true })
  })

  it('cross-fades when the locked grid has no place in the view, and still recognises with the quad', async () => {
    // The view has no size yet, so the quad cannot map to view points.
    const { session, recognise, photo, start, giveImage, giveResult } = setup({ view: { width: 0, height: 0 } })
    await start()
    await giveImage()
    await giveResult()
    expect(recognise).toHaveBeenCalledWith(photo, QUAD)
    expect(session()).toMatchObject({ quad: QUAD, crossFade: true })
  })

  it('keeps the image null and still gives the result when the conversion fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { session, photo, start, failImage, giveResult } = setup()
    await start()
    await failImage()
    await giveResult()
    expect(session()).toMatchObject({ photoShown: false, crossFade: true, result: WITH_PHOTO })
    expect(photo.dispose).toHaveBeenCalledTimes(1)
  })

  it('gives a failure with the reason when the photo fails', async () => {
    const { session, output, start } = setup()
    output.capturePhoto.mockRejectedValueOnce(new Error('the camera is not ready'))
    await start()
    expect(session()).toMatchObject({
      phase: 'capturing',
      crossFade: true,
      result: { ok: false, reason: 'the camera is not ready' },
    })
  })

  it('gives a failure without a photo when the model did not load', async () => {
    const { session, output, start } = setup()
    jest.mocked(createScanner).mockRejectedValue(new Error('the scanner does not implement model contract 2.0'))
    await start()
    expect(output.capturePhoto).not.toHaveBeenCalled()
    expect(photoToSkImage).not.toHaveBeenCalled()
    expect(session()).toMatchObject({ phase: 'capturing', crossFade: true, result: { ok: false } })
  })
})

describe('the lock latch', () => {
  it('starts one capture when the lock-on and the shutter come together', async () => {
    const { output, recognise, photo, start, giveImage, giveResult } = setup()
    await start(QUAD, 'auto')
    await start(null, 'shutter')
    await giveImage()
    await giveResult()
    expect(output.capturePhoto).toHaveBeenCalledTimes(1)
    expect(recognise).toHaveBeenCalledTimes(1)
    expect(photo.dispose).toHaveBeenCalledTimes(1)
  })

  it('ignores a call that comes in a later tick while the scan runs', async () => {
    const { session, output, start, giveImage, giveResult } = setup()
    await start()
    await start(null, 'shutter')
    await giveImage()
    await giveResult()
    expect(output.capturePhoto).toHaveBeenCalledTimes(1)
    expect(session()).toMatchObject({ quad: QUAD, result: WITH_PHOTO })
  })

  it('plays a thud for the automatic lock-on and a tap for the shutter, once each', async () => {
    const auto = setup()
    await auto.start(QUAD, 'auto')
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1)
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith(Haptics.ImpactFeedbackStyle.Medium)
    await auto.start(QUAD, 'shutter')
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1)
    auto.hook.unmount()
    const shutter = setup()
    await shutter.start(null, 'shutter')
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2)
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith(Haptics.ImpactFeedbackStyle.Light)
  })

  it('keeps startCapture the same function across renders', () => {
    const { hook, session } = setup()
    const first = session().startCapture
    hook.rerender({})
    expect(session().startCapture).toBe(first)
  })

  it('cross-fades without a locked quad, as after a shutter press without a grid', async () => {
    const { session, recognise, photo, start } = setup()
    await start(null, 'shutter')
    expect(recognise).toHaveBeenCalledWith(photo, null)
    expect(session()).toMatchObject({ quad: null, crossFade: true })
  })
})

describe('an image from the photo library', () => {
  it('recognises the picked image without a quad and cross-fades', async () => {
    const { session, output, recogniseStill, startImport, giveResult } = setup()
    await startImport()
    expect(stillPhoto).toHaveBeenCalledWith(PICKED)
    expect(output.capturePhoto).not.toHaveBeenCalled()
    expect(recogniseStill).toHaveBeenCalledWith(mockStillImage)
    expect(session()).toMatchObject({ phase: 'capturing', origin: 'library', quad: null, crossFade: true })
    await giveResult({ ...OK, corners: 'found', cornerOffset: null })
    expect(session().result).toMatchObject({ ok: true, corners: 'found', imported: true })
    // The transition does not draw an import, so no second copy of a large image exists.
    expect(photoToSkImage).not.toHaveBeenCalled()
    expect(session().photoShown).toBe(false)
  })

  it('keeps the image only in development builds, after the scanner let go of its copy', async () => {
    const { session, startImport, giveResult } = setup()
    await startImport()
    expect(saveUprightPhoto).not.toHaveBeenCalled()
    await giveResult()
    // Jest runs as a development build.
    expect(saveUprightPhoto).toHaveBeenCalledWith(mockStill)
    expect(mockStillImage.dispose.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(saveUprightPhoto).mock.invocationCallOrder[0]!,
    )
    expect(session().result).toMatchObject({ photoPath: '/tmp/photo.jpg', imported: true })
  })

  it('keeps no image of an import without a grid', async () => {
    const { startImport, giveResult } = setup()
    await startImport()
    await giveResult(FAILED)
    expect(saveUprightPhoto).not.toHaveBeenCalled()
  })

  it('keeps no image of an import in a release build', async () => {
    const dev = __DEV__
    Object.assign(globalThis, { __DEV__: false })
    try {
      const { session, startImport, giveResult } = setup()
      await startImport()
      await giveResult()
      expect(saveUprightPhoto).not.toHaveBeenCalled()
      expect(session().result).not.toHaveProperty('photoPath')
    } finally {
      Object.assign(globalThis, { __DEV__: dev })
    }
  })

  it('starts no scan when the picker closes after unmount, and deletes the picked file', async () => {
    const { hook, recogniseStill } = setup()
    const { startImport } = hook.result.current
    hook.unmount()
    startImport(PICKED)
    await act(async () => undefined)
    expect(recogniseStill).not.toHaveBeenCalled()
    expect(Haptics.impactAsync).not.toHaveBeenCalled()
    expect(deletePickedImage).toHaveBeenCalledWith(PICKED)
  })

  it('disposes the loaded image and deletes the picked file when the scan is done', async () => {
    const { startImport, giveResult } = setup()
    await startImport()
    expect(deletePickedImage).not.toHaveBeenCalled()
    await giveResult()
    expect(mockStillImage.dispose).toHaveBeenCalledTimes(1)
    expect(deletePickedImage).toHaveBeenCalledWith(PICKED)
  })

  it('gives the failure of an image without a grid, and keeps the origin', async () => {
    const { session, startImport, giveResult } = setup()
    await startImport()
    await giveResult(FAILED)
    expect(session()).toMatchObject({ phase: 'capturing', origin: 'library', result: FAILED })
  })

  it('gives a failure when the picked file does not load', async () => {
    mockStill.toImageAsync.mockRejectedValueOnce(new Error('the file is not an image'))
    const { session, recogniseStill, startImport } = setup()
    await startImport()
    await waitFor(() => expect(session().result).toEqual({ ok: false, reason: 'the file is not an image' }))
    expect(recogniseStill).not.toHaveBeenCalled()
    expect(deletePickedImage).toHaveBeenCalledWith(PICKED)
  })

  it('plays a tap', async () => {
    const { startImport } = setup()
    await startImport()
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1)
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith(Haptics.ImpactFeedbackStyle.Light)
  })

  it('refuses an import after a lock-on, and deletes the picked file', async () => {
    const { session, recogniseStill, start, startImport } = setup()
    await start()
    await startImport()
    expect(recogniseStill).not.toHaveBeenCalled()
    expect(session().origin).toBe('camera')
    expect(deletePickedImage).toHaveBeenCalledWith(PICKED)
  })

  it('refuses a lock-on after an import', async () => {
    const { output, start, startImport } = setup()
    await startImport()
    await start()
    expect(output.capturePhoto).not.toHaveBeenCalled()
  })
})

describe('the stale attempt', () => {
  it('clears the image on the UI thread before it disposes the image', async () => {
    const { hook, session, start, giveImage } = setup()
    await start()
    await giveImage()
    const image = session().image
    const seenAtDispose: unknown[] = []
    jest.mocked(IMAGE.dispose).mockImplementationOnce(() => seenAtDispose.push(image.value))
    hook.unmount()
    expect(IMAGE.dispose).not.toHaveBeenCalled()
    await waitFor(() => expect(IMAGE.dispose).toHaveBeenCalledTimes(1))
    expect(seenAtDispose).toEqual([null])
  })

  it('disposes an image that arrives after unmount', async () => {
    const { hook, start, giveImage } = setup()
    await start()
    hook.unmount()
    await giveImage()
    expect(IMAGE.dispose).toHaveBeenCalledTimes(1)
  })
})

describe('the gates and the clock', () => {
  it('holds the clock at the photo gate until the image exists', async () => {
    const { session, start, giveImage } = setup()
    await start()
    runFrames(session, 0.5)
    expect(session().clock.value).toBeCloseTo(GATE_PHOTO)
    await giveImage()
    runFrames(session, 0.2)
    expect(session().clock.value).toBeGreaterThan(GATE_PHOTO)
  })

  it('holds the clock at the results gate, then waits with a spinner', async () => {
    const { session, start, giveImage } = setup()
    await start()
    await giveImage()
    runFrames(session, 1.2)
    expect(session().clock.value).toBeCloseTo(GATE_RESULTS)
    expect(session().waiting.value).toBe(false)
    runFrames(session, SPINNER_DELAY)
    expect(session().waiting.value).toBe(true)
  })

  it('writes resultsAt once, when the results gate opens', async () => {
    const { session, start, giveImage, giveResult } = setup()
    await start()
    await giveImage()
    expect(session().resultsAt.value).toBe(-1)
    runFrames(session, 1)
    await giveResult()
    runFrames(session, 0.05)
    const at = session().resultsAt.value
    expect(at).toBeCloseTo(GATE_RESULTS)
    runFrames(session, 0.5)
    expect(session().resultsAt.value).toBe(at)
  })

  it('runs to the end once, and moves the review phase there with the result', async () => {
    const { session, start, giveImage, giveResult } = setup()
    await start()
    await giveImage()
    runFrames(session, 1)
    await giveResult()
    runFrames(session, 1.5)
    // The results came at the gate, 0.15 s after the sweep start, so the end moves 0.15 s later.
    expect(session().clock.value).toBeCloseTo(TRANSITION_END + GATE_RESULTS - SWEEP_START)
    expect(session().phase).toBe('capturing')
    runFrames(session, 0.5)
    await act(async () => undefined)
    expect(session().phase).toBe('review')
    expect(session().result).toEqual(WITH_PHOTO)
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^\[scan\] transition done in \d+ ms$/))
    runFrames(session, 1)
    await act(async () => undefined)
    expect(
      jest.mocked(console.log).mock.calls.filter(([line]) => String(line).includes('transition done')),
    ).toHaveLength(1)
  })

  it('does not move the end when the results come before the sweep start', async () => {
    const { session, start, giveImage, giveResult } = setup()
    await start()
    await giveImage()
    runFrames(session, 0.2)
    await giveResult()
    runFrames(session, 0.05)
    expect(session().resultsAt.value).toBeGreaterThan(0)
    expect(session().resultsAt.value).toBeLessThan(SWEEP_START)
    runFrames(session, 1.5)
    expect(session().clock.value).toBe(TRANSITION_END)
    await act(async () => undefined)
    expect(session().phase).toBe('review')
  })

  it('reaches review when the photo conversion fails after lock-on and the results come later', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { session, start, failImage, giveResult } = setup()
    await start()
    runFrames(session, 0.5)
    expect(session().clock.value).toBeCloseTo(GATE_PHOTO)
    await failImage()
    runFrames(session, 1)
    expect(session().clock.value).toBeCloseTo(GATE_PHOTO)
    await act(async () => undefined)
    expect(session().phase).toBe('capturing')
    await giveResult()
    runFrames(session, 0.5)
    expect(session().clock.value).toBe(REDUCED_END)
    runFrames(session, 0.5)
    await act(async () => undefined)
    expect(session().phase).toBe('review')
  })

  it('keeps the clock at the results gate on a failure, and never reaches review', async () => {
    const { session, start, giveImage, giveResult } = setup()
    await start()
    await giveImage()
    await giveResult(FAILED)
    runFrames(session, 3)
    expect(session().clock.value).toBeCloseTo(GATE_RESULTS)
    await act(async () => undefined)
    expect(session()).toMatchObject({ phase: 'capturing', result: FAILED })
  })

  it('cross-fades without a locked quad, and does not wait for the image', async () => {
    const { session, start, giveResult } = setup()
    await start(null, 'shutter')
    await giveResult()
    runFrames(session, 0.5)
    expect(session().clock.value).toBe(REDUCED_END)
    await act(async () => undefined)
    expect(session().phase).toBe('review')
  })

  it('cross-fades with Reduce Motion, and the gates still hold the clock', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true)
    const { session, start, giveImage } = setup()
    await start()
    await giveImage()
    expect(session().crossFade).toBe(true)
    runFrames(session, 0.5)
    expect(session().clock.value).toBe(0)
  })

  it('writes nothing while a gate holds the clock', async () => {
    const { session, start } = setup()
    await start()
    runFrames(session, 0.5)
    const held = session().captureFrame.value
    runFrames(session, 0.5)
    expect(session().captureFrame.value).toBe(held)
  })

  it('publishes the frame of the step that moved the clock, so the overlay draws the grid of this frame', async () => {
    const { session, start, giveImage } = setup()
    await start()
    await giveImage()
    expect(session().captureFrame.value).toBeNull()
    for (const seconds of [0.1, 0.1, 0.1]) {
      runFrames(session, seconds)
      const frame = session().captureFrame.value!
      expect(frame.channels).toEqual(transitionAt(session().clock.value, false, 0))
    }
  })

  it('warps from the locked grid in view points to the grid square', async () => {
    const { session, start, giveImage, giveResult } = setup()
    await start()
    await giveImage()
    await giveResult()
    runFrames(session, 0.02)
    // A 9:16 frame covers 402 x 874 pt: it is 491.6 pt wide, and 44.8 pt of it is cut on each side.
    expect(session().captureFrame.value!.quad[0].x).toBeCloseTo(-44.8 + 0.2 * 491.6, 0)
    runFrames(session, GATE_RESULTS)
    const { grid } = LAYOUT
    const frame = session().captureFrame.value!
    expect(frame.crossFade).toBe(false)
    expect(frame.quad[2].x).toBeCloseTo(grid.x + grid.width)
    expect(frame.quad[2].y).toBeCloseTo(grid.y + grid.height)
  })

  it('keeps the dots on the locked grid in the cross-fade, and puts the cells on the grid square', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true)
    const { session, start, giveImage, giveResult } = setup()
    await start()
    await giveImage()
    await giveResult()
    runFrames(session, 0.2)
    const frame = session().captureFrame.value!
    expect(frame.crossFade).toBe(true)
    expect(frame.quad[0].x).toBeCloseTo(-44.8 + 0.2 * 491.6, 0)
    expect(frame.grid[0]).toEqual({ x: LAYOUT.grid.x, y: LAYOUT.grid.y })
  })

  it('publishes the cross-fade again when the plan changes while a gate holds the clock', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { session, start, failImage } = setup()
    await start()
    runFrames(session, 0.3)
    expect(session().captureFrame.value!.crossFade).toBe(false)
    await failImage()
    runFrames(session, 0.1)
    expect(session().captureFrame.value!.crossFade).toBe(true)
  })
})
