import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Alert, AppState, Linking } from 'react-native'
import { launchImageLibraryAsync, type ImagePickerResult } from 'expo-image-picker'
import { useCameraDevice, useCameraPermission, useFrameOutput, usePhotoOutput } from 'react-native-vision-camera'
import { useAnimatedReaction, useReducedMotion } from 'react-native-reanimated'
import type { SkImage } from '@shopify/react-native-skia'
import { kvSettings } from '@/settings/SettingsRepository'
import { createScanner, type RecogniseResult } from '@/scanner'
import { CameraScreen } from './CameraScreen'
import { correctionLayout } from '@/scan/utils/correction.utils'
import { DEFAULT_INDEX } from '@/scan/effects/registry'
import { EffectCanvas } from '@/scan/effects/components/EffectCanvas'
import { EffectPicker } from '@/scan/effects/components/EffectPicker'
import { photoToSkImage } from '@/scan/utils/photoImage.utils'
import type { Quad } from '@/utils/geometry.utils'

jest.mock('@/scanner', () => ({
  ...jest.requireActual('@/scanner'),
  useGridDetector: jest.fn(() => undefined),
  // The model never loads, unless a test gives a scanner.
  createScanner: jest.fn(() => new Promise(() => undefined)),
}))
jest.mock('@/scan/utils/photoImage.utils', () => ({ photoToSkImage: jest.fn() }))
const mockStillImage = { width: 1206, height: 2622, dispose: jest.fn() }
const mockStill = { toImageAsync: jest.fn(async () => mockStillImage) }
jest.mock('@/scan/utils/photoFile', () => ({
  saveUprightPhoto: jest.fn(async () => '/tmp/photo.jpg'),
  stillPhoto: jest.fn(() => mockStill),
  deletePickedImage: jest.fn(),
}))

jest.mock('@/scan/effects/components/EffectCanvas', () => ({ EffectCanvas: jest.fn(() => null) }))
jest.mock('@/scan/effects/components/EffectPicker', () => ({ EffectPicker: jest.fn(() => null) }))
jest.mock('expo-status-bar', () => {
  const { View } = jest.requireActual('react-native')
  return {
    StatusBar: ({ style }: { style: string }) => <View testID="status-bar" accessibilityLabel={style} />,
  }
})

const permission = jest.mocked(useCameraPermission)
const device = jest.mocked(useCameraDevice)
const frameOutput = jest.mocked(useFrameOutput)
const LAYOUT = correctionLayout({ width: 402, height: 874 }, { top: 0, bottom: 0, left: 0, right: 0 })
const onRetake = jest.fn()
const onPlay = jest.fn()
const onHome = jest.fn()
const onExit = jest.fn()
const onClose = jest.fn()
const onSave = jest.fn(async () => true)

function props() {
  return { layout: LAYOUT, onRetake, onPlay, onHome, onClose, onExit, onSave }
}

function givenPermission(status: 'authorized' | 'denied' | 'not-determined') {
  const requestPermission = jest.fn(async () => true)
  permission.mockReturnValue({
    status,
    hasPermission: status === 'authorized',
    canRequestPermission: status === 'not-determined',
    requestPermission,
  } as unknown as ReturnType<typeof useCameraPermission>)
  return requestPermission
}

type FakeFrame = {
  timestamp: number
  width: number
  height: number
  orientation: 'up' | 'right' | 'down' | 'left'
  dispose: () => void
}
type FrameConfig = { onFrame: (frame: FakeFrame) => void }

function onFrame() {
  const config = frameOutput.mock.calls.at(-1)?.[0] as unknown as FrameConfig
  return config.onFrame
}

function frameAt(timestamp: number, dispose: () => void = jest.fn()): FakeFrame {
  return { timestamp, width: 1920, height: 1080, orientation: 'right', dispose }
}

const reaction = jest.mocked(useAnimatedReaction)
const effectCanvas = jest.mocked(EffectCanvas)
const effectPicker = jest.mocked(EffectPicker)

const quad: Quad = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.8, y: 0.8 },
  { x: 0.2, y: 0.8 },
]

beforeEach(() => {
  jest.clearAllMocks()
  device.mockReturnValue({ id: 'back' } as unknown as ReturnType<typeof useCameraDevice>)
})

afterEach(() => jest.restoreAllMocks())

describe('CameraScreen', () => {
  it('shows the camera full screen when permission is given', () => {
    givenPermission('authorized')
    render(<CameraScreen {...props()} />)
    expect(screen.getByTestId('camera')).toBeTruthy()
  })

  it('keeps the frames upright with the portrait interface, not the accelerometer', () => {
    givenPermission('authorized')
    render(<CameraScreen {...props()} />)
    expect(screen.getByTestId('camera').props.orientationSource).toBe('interface')
  })

  it('uses a light status bar over the camera', () => {
    givenPermission('authorized')
    render(<CameraScreen {...props()} />)
    expect(screen.getByTestId('status-bar').props.accessibilityLabel).toBe('light')
  })

  it('uses a dark status bar on the message screens', () => {
    givenPermission('denied')
    render(<CameraScreen {...props()} />)
    expect(screen.getByTestId('status-bar').props.accessibilityLabel).toBe('dark')
  })

  it('asks for permission the first time', () => {
    const request = givenPermission('not-determined')
    render(<CameraScreen {...props()} />)
    expect(request).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('camera-waiting')).toBeTruthy()
  })

  it('offers the settings when permission was denied', () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue()
    givenPermission('denied')
    render(<CameraScreen {...props()} />)
    expect(screen.getByTestId('camera-denied')).toBeTruthy()
    fireEvent.press(screen.getByTestId('open-settings'))
    expect(openSettings).toHaveBeenCalledTimes(1)
  })

  it('says so when the phone has no back camera', () => {
    givenPermission('authorized')
    device.mockReturnValue(undefined)
    render(<CameraScreen {...props()} />)
    expect(screen.getByTestId('camera-missing')).toBeTruthy()
  })

  it('closes the scan from the live camera', () => {
    givenPermission('authorized')
    render(<CameraScreen {...props()} />)
    fireEvent.press(screen.getByTestId('scan-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it.each(['not-determined', 'denied'] as const)('closes the scan from the message screen, permission %s', (status) => {
    givenPermission(status)
    render(<CameraScreen {...props()} />)
    fireEvent.press(screen.getByTestId('scan-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes the scan when the phone has no back camera', () => {
    givenPermission('authorized')
    device.mockReturnValue(undefined)
    render(<CameraScreen {...props()} />)
    fireEvent.press(screen.getByTestId('scan-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('pauses the camera when the app is not active', () => {
    const listener: { change: (state: string) => void } = { change: () => undefined }
    const remove = jest.fn()
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      listener.change = handler as (state: string) => void
      return { remove }
    })
    Object.assign(AppState, { currentState: 'active' })
    givenPermission('authorized')
    const { unmount } = render(<CameraScreen {...props()} />)
    expect(screen.getByTestId('camera').props.isActive).toBe(true)
    act(() => listener.change('inactive'))
    expect(screen.getByTestId('camera').props.isActive).toBe(false)
    act(() => listener.change('active'))
    expect(screen.getByTestId('camera').props.isActive).toBe(true)
    unmount()
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it('gives the effect canvas the camera view size', () => {
    givenPermission('authorized')
    render(<CameraScreen {...props()} />)
    fireEvent(screen.getByTestId('camera-screen'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 874 } },
    })
    expect(effectCanvas.mock.calls.at(-1)![0].view.value).toEqual({ width: 402, height: 874 })
  })

  it('adds the photo output to the camera', () => {
    givenPermission('authorized')
    render(<CameraScreen {...props()} />)
    expect(screen.getByTestId('camera').props.outputs).toHaveLength(2)
  })

  it('starts the overlay on the default effect', () => {
    givenPermission('authorized')
    render(<CameraScreen {...props()} />)
    expect(effectCanvas.mock.calls.at(-1)![0].effect.value).toBe(DEFAULT_INDEX)
  })

  it('shows the effect lab in a development build, on the same effect index as the canvas', () => {
    givenPermission('authorized')
    render(<CameraScreen {...props()} />)
    const picker = effectPicker.mock.calls.at(-1)![0]
    expect(picker.effect).toBe(effectCanvas.mock.calls.at(-1)![0].effect)
    expect(picker.settings).toBe(kvSettings)
  })

  describe('in a release build', () => {
    const dev = __DEV__
    beforeEach(() => Object.assign(globalThis, { __DEV__: false }))
    afterEach(() => Object.assign(globalThis, { __DEV__: dev }))

    it('shows no effect lab and runs the default effect', () => {
      givenPermission('authorized')
      render(<CameraScreen {...props()} />)
      expect(effectPicker).not.toHaveBeenCalled()
      expect(effectCanvas.mock.calls.at(-1)![0].effect.value).toBe(DEFAULT_INDEX)
    })
  })
})

/** The overlay of the last render. It holds the capture session. */
const overlay = () => effectCanvas.mock.calls.at(-1)![0]

/** Renders the live screen, with a layout and one frame. */
function renderLive() {
  givenPermission('authorized')
  const view = render(<CameraScreen {...props()} />)
  fireEvent(screen.getByTestId('camera-screen'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 874 } },
  })
  onFrame()(frameAt(1))
  return view
}

describe('capture', () => {
  const IMAGE = { dispose: jest.fn() } as unknown as SkImage
  const OK: RecogniseResult = {
    ok: true,
    cells: [],
    quad,
    corners: 'redetected',
    cornerOffset: 0,
    timings: { imageMs: 1, detectMs: 1, flattenMs: 1, classifyMs: 1 },
  }
  const FAILED: RecogniseResult = { ok: false, reason: 'no grid in the photo' }
  const photo = { width: 4224, height: 2376, orientation: 'right', dispose: jest.fn() }
  let frameTime = 0

  /** The photo and the result of the scanner wait until the test settles them. */
  function givenScanner() {
    let giveImage!: () => void
    let giveResult!: (result: RecogniseResult) => void
    const image = new Promise<SkImage>((resolve) => (giveImage = () => resolve(IMAGE)))
    const result = new Promise<RecogniseResult>((resolve) => (giveResult = resolve))
    jest.mocked(usePhotoOutput).mockReturnValue({ capturePhoto: jest.fn(async () => photo) } as never)
    const recogniseStill = jest.fn(() => result)
    jest.mocked(createScanner).mockResolvedValue({ recognise: jest.fn(() => result), recogniseStill })
    jest.mocked(photoToSkImage).mockReturnValue(image)
    return {
      recogniseStill,
      giveImage: () => act(async () => giveImage()),
      giveResult: (done: RecogniseResult) => act(async () => giveResult(done)),
    }
  }

  /** Runs UI frames of 1/60 s for the given seconds, through the clock step that the overlay calls first in each frame. */
  function runFrames(seconds: number) {
    for (let i = 0; i <= Math.round(seconds * 60); i++) {
      overlay().session.stepClock(frameTime * 1000)
      frameTime += 1 / 60
    }
  }

  beforeEach(() => {
    frameTime = 0
    Object.assign(AppState, { currentState: 'active' })
    jest.mocked(useReducedMotion).mockReturnValue(false)
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  it('locks on through the overlay and shows the transition layers, without the shutter, the close button and the effect lab', async () => {
    givenScanner()
    renderLive()
    expect(screen.getByTestId('shutter')).toBeTruthy()
    expect(screen.getByTestId('scan-close')).toBeTruthy()
    await act(async () => overlay().session.startCapture(quad, 'auto'))
    expect(screen.getByTestId('camera')).toBeTruthy()
    expect(screen.getByTestId('transition-canvas')).toBeTruthy()
    expect(screen.getByTestId('correction-screen')).toBeTruthy()
    expect(screen.getByTestId('capture-flash')).toBeTruthy()
    expect(screen.queryByTestId('shutter')).toBeNull()
    expect(screen.queryByTestId('scan-close')).toBeNull()
  })

  it('starts a capture on a shutter press', async () => {
    givenScanner()
    renderLive()
    await act(async () => fireEvent.press(screen.getByTestId('shutter')))
    expect(jest.mocked(usePhotoOutput).mock.results.at(-1)!.value.capturePhoto).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('shutter')).toBeNull()
  })

  it('stops the camera once the photo is an image', async () => {
    const { giveImage } = givenScanner()
    renderLive()
    await act(async () => overlay().session.startCapture(quad, 'auto'))
    expect(screen.getByTestId('camera').props.isActive).toBe(true)
    await giveImage()
    expect(screen.getByTestId('camera').props.isActive).toBe(false)
  })

  it('turns the status bar dark when the light background is half in', async () => {
    const { giveImage } = givenScanner()
    renderLive()
    await act(async () => overlay().session.startCapture(quad, 'auto'))
    await giveImage()
    expect(screen.getByTestId('status-bar').props.accessibilityLabel).toBe('light')
    const calls = reaction.mock.calls as unknown as [() => unknown, (dark: boolean, previous: boolean | null) => void][]
    const falseBefore = new Set(calls.filter(([prepare]) => prepare() === false))
    runFrames(0.4)
    // The status bar reaction is the one whose condition the dim turns from false to true.
    const [, react] = calls.findLast((call) => falseBefore.has(call) && call[0]() === true)!
    await act(async () => react(true, false))
    expect(screen.getByTestId('status-bar').props.accessibilityLabel).toBe('dark')
  })

  it('keeps the correction screen of the transition as the static screen at the end, and unmounts the camera layers', async () => {
    const { giveImage, giveResult } = givenScanner()
    renderLive()
    await act(async () => overlay().session.startCapture(quad, 'auto'))
    const shown = screen.getByTestId('correction-screen')
    await giveImage()
    await giveResult(OK)
    const overlays = effectCanvas.mock.calls.length
    runFrames(3)
    await act(async () => undefined)
    expect(screen.getByTestId('correction-screen')).toBe(shown)
    expect(screen.queryByTestId('camera')).toBeNull()
    expect(screen.queryByTestId('transition-canvas')).toBeNull()
    expect(screen.queryByTestId('capture-flash')).toBeNull()
    expect(screen.getByTestId('status-bar').props.accessibilityLabel).toBe('dark')
    // The overlay of the last live render stays unmounted: no new one renders after the end.
    expect(effectCanvas.mock.calls.length).toBe(overlays)
  })

  it('shows the failure, and hands the failed result to Retake', async () => {
    const { giveImage, giveResult } = givenScanner()
    renderLive()
    await act(async () => overlay().session.startCapture(quad, 'auto'))
    await giveImage()
    await giveResult(FAILED)
    runFrames(3)
    expect(screen.getByTestId('correction-failure')).toBeTruthy()
    fireEvent.press(screen.getByTestId('retake'))
    expect(onRetake).toHaveBeenCalledWith(FAILED)
  })

  it('hands the result and the looks of the player to Exit when the screen unmounts', async () => {
    const { giveImage, giveResult } = givenScanner()
    const view = renderLive()
    await act(async () => overlay().session.startCapture(quad, 'auto'))
    await giveImage()
    await giveResult(OK)
    runFrames(3)
    await act(async () => undefined)
    view.unmount()
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(onExit).toHaveBeenCalledWith(expect.objectContaining({ ok: true }), expect.any(Array))
  })

  it('does not hand the scan to Exit after a Retake', async () => {
    const { giveImage, giveResult } = givenScanner()
    const view = renderLive()
    await act(async () => overlay().session.startCapture(quad, 'auto'))
    await giveImage()
    await giveResult(OK)
    runFrames(3)
    await act(async () => undefined)
    fireEvent.press(screen.getByTestId('retake'))
    view.unmount()
    expect(onRetake).toHaveBeenCalledWith(expect.objectContaining({ ok: true }))
    expect(onExit).not.toHaveBeenCalled()
  })
})

/** The result of the scanner for a picked image waits until the test settles it. */
function givenStillScanner() {
  let giveResult!: (result: RecogniseResult) => void
  const result = new Promise<RecogniseResult>((resolve) => (giveResult = resolve))
  const recogniseStill = jest.fn(() => result)
  jest.mocked(createScanner).mockResolvedValue({ recognise: jest.fn(), recogniseStill })
  jest.mocked(photoToSkImage).mockReturnValue(new Promise(() => undefined))
  return { recogniseStill, giveResult: (done: RecogniseResult) => act(async () => giveResult(done)) }
}

describe('an image from the photo library', () => {
  const PICKED = 'file:///cache/ImagePicker/picked.png'
  const picker = jest.mocked(launchImageLibraryAsync)
  const FAILED: RecogniseResult = { ok: false, reason: 'no grid in the photo' }
  let frameTime = 0

  function deferredPick() {
    let resolve!: (result: ImagePickerResult) => void
    picker.mockReturnValueOnce(new Promise((res) => (resolve = res)))
    return {
      pick: () => act(async () => resolve({ canceled: false, assets: [{ uri: PICKED, width: 1206, height: 2622 }] })),
      cancel: () => act(async () => resolve({ canceled: true, assets: null })),
    }
  }

  function runFrames(seconds: number) {
    for (let i = 0; i <= Math.round(seconds * 60); i++) {
      overlay().session.stepClock(frameTime * 1000)
      frameTime += 1 / 60
    }
  }

  beforeEach(() => {
    frameTime = 0
    Object.assign(AppState, { currentState: 'active' })
    jest.mocked(useReducedMotion).mockReturnValue(false)
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  it('stops the camera while the picker is open, and keeps the camera live after a cancel', async () => {
    givenStillScanner()
    const { cancel } = deferredPick()
    renderLive()
    await act(async () => fireEvent.press(screen.getByTestId('scan-library')))
    expect(picker).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('camera').props.isActive).toBe(false)
    await cancel()
    expect(screen.getByTestId('camera').props.isActive).toBe(true)
    expect(screen.getByTestId('shutter')).toBeTruthy()
  })

  it('scans the picked image, with the camera off', async () => {
    const { recogniseStill } = givenStillScanner()
    const { pick } = deferredPick()
    renderLive()
    await act(async () => fireEvent.press(screen.getByTestId('scan-library')))
    await pick()
    expect(recogniseStill).toHaveBeenCalledWith(mockStillImage)
    expect(screen.getByTestId('correction-screen')).toBeTruthy()
    expect(screen.getByTestId('camera').props.isActive).toBe(false)
  })

  it('offers another image when the image has no grid', async () => {
    const { giveResult } = givenStillScanner()
    const { pick } = deferredPick()
    renderLive()
    await act(async () => fireEvent.press(screen.getByTestId('scan-library')))
    await pick()
    await giveResult(FAILED)
    runFrames(3)
    expect(screen.getByTestId('correction-failure')).toHaveTextContent(/No sudoku found/)
    fireEvent.press(screen.getByTestId('choose-another'))
    expect(onRetake).toHaveBeenCalledWith(FAILED, 'library')
  })

  it('opens the picker at the start when the parent asks for it', async () => {
    givenStillScanner()
    givenPermission('authorized')
    render(<CameraScreen {...props()} pickAtStart />)
    await act(async () => undefined)
    expect(picker).toHaveBeenCalledTimes(1)
  })

  it('says so when the image does not load', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    picker.mockRejectedValueOnce(new Error('the image is in iCloud'))
    renderLive()
    await act(async () => fireEvent.press(screen.getByTestId('scan-library')))
    expect(alert).toHaveBeenCalledWith('The image did not load', expect.stringContaining('iCloud'))
    expect(screen.getByTestId('shutter')).toBeTruthy()
  })

  it.each(['denied', 'missing'] as const)('scans a picked image when the camera is %s', async (block) => {
    const { recogniseStill } = givenStillScanner()
    const { pick } = deferredPick()
    givenPermission(block === 'denied' ? 'denied' : 'authorized')
    if (block === 'missing') device.mockReturnValue(undefined)
    render(<CameraScreen {...props()} />)
    await act(async () => fireEvent.press(screen.getByTestId('choose-image')))
    await pick()
    expect(recogniseStill).toHaveBeenCalledWith(mockStillImage)
    expect(screen.getByTestId('correction-screen')).toBeTruthy()
    expect(screen.queryByTestId('camera')).toBeNull()
  })
})
