import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AppState, Linking } from 'react-native'
import { useCameraDevice, useCameraPermission, useFrameOutput } from 'react-native-vision-camera'
import { useAnimatedReaction, useFrameCallback, useReducedMotion } from 'react-native-reanimated'
import type { SkImage } from '@shopify/react-native-skia'
import { kvSettings } from '@/settings/SettingsRepository'
import { type GridDetector, type RecogniseResult, useGridDetector } from '@/scanner'
import { CameraScreen, type FrameDetection } from './CameraScreen'
import { CorrectionScreen } from './correction/CorrectionScreen'
import { correctionLayout } from './correction/layout'
import * as frameRate from './frameRate'
import { DEFAULT_INDEX } from './effects/registry'
import { EffectCanvas } from './effects/EffectCanvas'
import { EffectPicker } from './effects/EffectPicker'
import { GATE_PHOTO, GATE_RESULTS, REDUCED_END, TRANSITION_END } from './transition/timeline'
import { TransitionCanvas } from './transition/TransitionCanvas'
import { useCapture } from './useCapture'
import type { Quad } from '@/utils/geometry.utils'

jest.mock('@/scanner', () => ({
  ...jest.requireActual('@/scanner'),
  useGridDetector: jest.fn(() => undefined),
}))

jest.mock('./effects/EffectCanvas', () => ({ EffectCanvas: jest.fn(() => null) }))
jest.mock('./effects/EffectPicker', () => ({ EffectPicker: jest.fn(() => null) }))
jest.mock('./useCapture', () => ({ useCapture: jest.fn() }))
jest.mock('./transition/TransitionCanvas', () => ({ TransitionCanvas: jest.fn(() => null) }))
// The real screen renders, and the mock records its props (the clock, the waiting flag, Reduce Motion).
jest.mock('./correction/CorrectionScreen', () => {
  const { createElement } = jest.requireActual('react')
  const actual = jest.requireActual('./correction/CorrectionScreen')
  return { CorrectionScreen: jest.fn((screenProps: object) => createElement(actual.CorrectionScreen, screenProps)) }
})

jest.mock('expo-status-bar', () => {
  const { View } = jest.requireActual('react-native')
  return {
    StatusBar: ({ style }: { style: string }) => <View testID="status-bar" accessibilityLabel={style} />,
  }
})

const permission = jest.mocked(useCameraPermission)
const device = jest.mocked(useCameraDevice)
const frameOutput = jest.mocked(useFrameOutput)
const captureHook = jest.mocked(useCapture)
const capture = jest.fn()
const sharedImage = { value: null } as unknown as ReturnType<typeof useCapture>['sharedImage']
const LAYOUT = correctionLayout({ width: 402, height: 874 }, { top: 0, bottom: 0, left: 0, right: 0 })
const onDone = jest.fn()
/** The start of the digit sweep in the timeline. */
const SWEEP_START = 0.55
const onRetake = jest.fn()

function props() {
  return { layout: LAYOUT, onDone, onRetake }
}

function givenPhase(state: ReturnType<typeof useCapture>['state']) {
  captureHook.mockReturnValue({ state, capture, sharedImage })
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

const detector = jest.mocked(useGridDetector)
const reaction = jest.mocked(useAnimatedReaction)
const effectCanvas = jest.mocked(EffectCanvas)
const effectPicker = jest.mocked(EffectPicker)

const quad: Quad = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.8, y: 0.8 },
  { x: 0.2, y: 0.8 },
]

/** The last render's reaction: its input (the published detection) and its handler. */
function lastReaction() {
  const [prepare, react] = reaction.mock.calls.at(-1)! as unknown as [
    () => FrameDetection | null,
    (current: FrameDetection | null) => void,
  ]
  return { prepare, react }
}

beforeEach(() => {
  jest.clearAllMocks()
  detector.mockReturnValue(undefined)
  givenPhase({ phase: 'live' })
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

  it('logs the frame rate once per second', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    givenPermission('authorized')
    render(<CameraScreen {...props()} />)
    const handle = onFrame()
    const disposers = Array.from({ length: 31 }, () => jest.fn())
    disposers.forEach((dispose, i) => handle(frameAt(100 + i / 30, dispose)))
    await Promise.resolve()
    expect(log).toHaveBeenCalledWith('[camera] 30.0 fps, detection 0.0 ms')
    disposers.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1))
    log.mockRestore()
  })

  it('releases every frame, also when counting fails', () => {
    givenPermission('authorized')
    // The spy comes before render: the worklet captures countFrame when it is created.
    jest.spyOn(frameRate, 'countFrame').mockImplementation(() => {
      throw new Error('count failed')
    })
    render(<CameraScreen {...props()} />)
    const dispose = jest.fn()
    expect(() => onFrame()(frameAt(1, dispose))).toThrow('count failed')
    expect(dispose).toHaveBeenCalledTimes(1)
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

  it('publishes the detection of every frame for the UI thread', () => {
    givenPermission('authorized')
    const detectGrid = jest.fn(() => ({ quad, score: 0.36 }))
    detector.mockReturnValue(detectGrid as unknown as GridDetector)
    render(<CameraScreen {...props()} />)
    const frame = frameAt(5)
    onFrame()(frame)
    expect(detectGrid).toHaveBeenCalledWith(frame)
    expect(lastReaction().prepare()).toEqual({ quad, timestamp: 5, aspect: 1080 / 1920 })
  })

  it('publishes an empty detection while the detector loads', () => {
    givenPermission('authorized')
    detector.mockReturnValue(undefined)
    render(<CameraScreen {...props()} />)
    onFrame()(frameAt(5))
    expect(lastReaction().prepare()).toEqual({ quad: null, timestamp: 5, aspect: 1080 / 1920 })
  })

  it('publishes an empty detection and disposes the frame when detection fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    givenPermission('authorized')
    detector.mockReturnValue((() => {
      throw new Error('detect failed')
    }) as unknown as GridDetector)
    render(<CameraScreen {...props()} />)
    const dispose = jest.fn()
    expect(() => onFrame()(frameAt(5, dispose))).not.toThrow()
    expect(lastReaction().prepare()).toEqual({ quad: null, timestamp: 5, aspect: 1080 / 1920 })
    expect(dispose).toHaveBeenCalledTimes(1)
    onFrame()(frameAt(6))
    await Promise.resolve()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('turns a detection into an outline in view points', () => {
    givenPermission('authorized')
    render(<CameraScreen {...props()} />)
    fireEvent(screen.getByTestId('camera-screen'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 640 } },
    })
    lastReaction().react({ quad, timestamp: 5, aspect: 0.5625 })
    const shown = effectCanvas.mock.calls.at(-1)![0].outline.value
    expect(shown).toEqual([
      { x: 72, y: 128 },
      { x: 288, y: 128 },
      { x: 288, y: 512 },
      { x: 72, y: 512 },
    ])
  })

  it('removes the outline when the grid is gone for longer than the hold time', () => {
    givenPermission('authorized')
    render(<CameraScreen {...props()} />)
    fireEvent(screen.getByTestId('camera-screen'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 640 } },
    })
    const { react } = lastReaction()
    react({ quad, timestamp: 5, aspect: 0.5625 })
    react({ quad: null, timestamp: 6, aspect: 0.5625 })
    expect(effectCanvas.mock.calls.at(-1)![0].outline.value).toBeNull()
  })

  it('gives the effect canvas the camera view size', () => {
    givenPermission('authorized')
    render(<CameraScreen {...props()} />)
    fireEvent(screen.getByTestId('camera-screen'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 874 } },
    })
    expect(effectCanvas.mock.calls.at(-1)![0].view.value).toEqual({ width: 402, height: 874 })
  })

  it('arms the effect canvas by default, and passes armed on', () => {
    givenPermission('authorized')
    const view = render(<CameraScreen {...props()} />)
    expect(effectCanvas.mock.calls.at(-1)![0].armed).toBe(true)
    view.rerender(<CameraScreen {...props()} armed={false} />)
    expect(effectCanvas.mock.calls.at(-1)![0].armed).toBe(false)
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

function correction() {
  return jest.mocked(CorrectionScreen).mock.calls.at(-1)![0]
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
  type Capturing = { quad: Quad | null; image: SkImage | null; imageFailed?: boolean; result: RecogniseResult | null }

  let frameTime = 0

  /** Renders the live screen, locks on (a null quad is a shutter press without a grid), and goes to the capturing state. */
  function lockOn(locked: Quad | null, capturing: Capturing) {
    givenPermission('authorized')
    const view = render(<CameraScreen {...props()} />)
    fireEvent(screen.getByTestId('camera-screen'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 874 } },
    })
    onFrame()(frameAt(1))
    act(() => effectCanvas.mock.calls.at(-1)![0].onLock(locked as Quad))
    const show = (next: Capturing) => {
      givenPhase({ phase: 'capturing', imageFailed: false, ...next })
      view.rerender(<CameraScreen {...props()} />)
    }
    show(capturing)
    return show
  }

  /** Runs UI frames of 1/60 s for the given seconds. */
  function runFrames(seconds: number) {
    const callback = jest.mocked(useFrameCallback).mock.calls.at(-1)![0] as unknown as (frame: {
      timestamp: number
    }) => void
    for (let i = 0; i <= Math.round(seconds * 60); i++) {
      callback({ timestamp: frameTime * 1000 })
      frameTime += 1 / 60
    }
  }

  beforeEach(() => {
    frameTime = 0
    jest.mocked(useReducedMotion).mockReturnValue(false)
  })

  it('locks on through the canvas, once, with the quad', () => {
    lockOn(quad, { quad, image: null, result: null })
    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture).toHaveBeenCalledWith(quad, expect.any(Number))
    act(() => effectCanvas.mock.calls.at(-1)![0].onLock(quad))
    expect(capture).toHaveBeenCalledTimes(1)
  })

  it('keeps onLock the same function across renders', () => {
    givenPermission('authorized')
    const view = render(<CameraScreen {...props()} />)
    const first = effectCanvas.mock.calls.at(-1)![0].onLock
    view.rerender(<CameraScreen {...props()} />)
    expect(effectCanvas.mock.calls.at(-1)![0].onLock).toBe(first)
  })

  it('captures the current frame quad on a shutter press', () => {
    givenPermission('authorized')
    render(<CameraScreen {...props()} />)
    fireEvent.press(screen.getByTestId('shutter'))
    expect(capture).toHaveBeenCalledWith(null, expect.any(Number))
  })

  it('renders the transition layers and hides the shutter and the effect lab', () => {
    lockOn(quad, { quad, image: null, result: null })
    expect(screen.getByTestId('camera')).toBeTruthy()
    expect(jest.mocked(TransitionCanvas)).toHaveBeenCalled()
    expect(screen.getByTestId('correction-screen')).toBeTruthy()
    expect(screen.getByTestId('capture-flash')).toBeTruthy()
    expect(screen.queryByTestId('shutter')).toBeNull()
    effectPicker.mockClear()
    lockOn(quad, { quad, image: null, result: null })
    expect(effectPicker).not.toHaveBeenCalled()
  })

  it('gives the effect canvas the moving grid while it captures', () => {
    lockOn(quad, { quad, image: IMAGE, result: null })
    const moving = effectCanvas.mock.calls.at(-1)![0].capture!
    expect(moving.value).toBeNull()
    runFrames(0.1)
    expect(moving.value).toMatchObject({ channels: { flash: expect.any(Number) } })
    expect(moving.value!.quad).toHaveLength(4)
  })

  it('stops the camera once the photo is an image', () => {
    const show = lockOn(quad, { quad, image: null, result: null })
    expect(screen.getByTestId('camera').props.isActive).toBe(true)
    show({ quad, image: IMAGE, result: null })
    expect(screen.getByTestId('camera').props.isActive).toBe(false)
  })

  it('holds the clock at the photo gate until the image exists', () => {
    const show = lockOn(quad, { quad, image: null, result: null })
    runFrames(0.5)
    expect(correction().clock!.value).toBeCloseTo(GATE_PHOTO)
    show({ quad, image: IMAGE, result: null })
    runFrames(0.2)
    expect(correction().clock!.value).toBeGreaterThan(GATE_PHOTO)
  })

  it('holds the clock at the results gate, then waits with a spinner', () => {
    lockOn(quad, { quad, image: IMAGE, result: null })
    runFrames(1.2)
    expect(correction().clock!.value).toBeCloseTo(GATE_RESULTS)
    expect(correction().waiting!.value).toBe(false)
    runFrames(1)
    expect(correction().waiting!.value).toBe(true)
  })

  it('runs to the end and calls onDone once with the result', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const show = lockOn(quad, { quad, image: IMAGE, result: null })
    runFrames(1)
    show({ quad, image: IMAGE, result: OK })
    runFrames(1.5)
    // The results came at the gate, 0.15 s after the sweep start, so the end moves 0.15 s later.
    expect(correction().resultsAt!.value).toBeCloseTo(GATE_RESULTS)
    expect(correction().clock!.value).toBeCloseTo(TRANSITION_END + GATE_RESULTS - SWEEP_START)
    expect(correction().reduceMotion).toBe(false)
    runFrames(0.5)
    await act(async () => undefined)
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledWith(OK)
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[scan\] transition done in \d+ ms$/))
  })

  it('does not move the end when the results come before the sweep start', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const show = lockOn(quad, { quad, image: IMAGE, result: null })
    runFrames(0.2)
    show({ quad, image: IMAGE, result: OK })
    runFrames(0.05)
    expect(correction().resultsAt!.value).toBeGreaterThan(0)
    expect(correction().resultsAt!.value).toBeLessThan(SWEEP_START)
    runFrames(1.5)
    expect(correction().clock!.value).toBe(TRANSITION_END)
    await act(async () => undefined)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('reaches review when the photo conversion fails after lock-on and the results come later', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const show = lockOn(quad, { quad, image: null, result: null })
    runFrames(0.5)
    expect(correction().clock!.value).toBeCloseTo(GATE_PHOTO)
    show({ quad, image: null, imageFailed: true, result: null })
    runFrames(1)
    expect(correction().clock!.value).toBeCloseTo(GATE_PHOTO)
    await act(async () => undefined)
    expect(onDone).not.toHaveBeenCalled()
    show({ quad, image: null, imageFailed: true, result: OK })
    runFrames(0.5)
    expect(correction().clock!.value).toBe(REDUCED_END)
    runFrames(0.5)
    await act(async () => undefined)
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledWith(OK)
  })

  it('tells the effect canvas about the cross-fade, so the free dots do not drift', () => {
    const show = lockOn(quad, { quad, image: null, result: null })
    runFrames(0.1)
    const moving = effectCanvas.mock.calls.at(-1)![0].capture!
    expect(moving.value!.crossFade).toBe(false)
    show({ quad, image: null, imageFailed: true, result: OK })
    runFrames(0.1)
    expect(moving.value!.crossFade).toBe(true)
  })

  it('keeps the clock at the results gate on a failure, and shows the failure with Retake', () => {
    const show = lockOn(quad, { quad, image: IMAGE, result: null })
    show({ quad, image: IMAGE, result: FAILED })
    runFrames(3)
    expect(correction().clock!.value).toBeCloseTo(GATE_RESULTS)
    expect(onDone).not.toHaveBeenCalled()
    expect(screen.getByTestId('correction-failure')).toBeTruthy()
    fireEvent.press(screen.getByTestId('retake'))
    expect(onRetake).toHaveBeenCalledTimes(1)
  })

  it('cross-fades without a locked quad', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    lockOn(null, { quad: null, image: IMAGE, result: OK })
    expect(jest.mocked(TransitionCanvas).mock.calls.at(-1)![0]).toMatchObject({ crossFade: true })
    expect(correction().reduceMotion).toBe(true)
    runFrames(0.5)
    expect(correction().clock!.value).toBe(REDUCED_END)
    await act(async () => undefined)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('cross-fades when the photo conversion failed, and does not wait for the image', () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    lockOn(quad, { quad, image: null, imageFailed: true, result: OK })
    expect(correction().reduceMotion).toBe(true)
    runFrames(0.5)
    expect(correction().clock!.value).toBe(REDUCED_END)
  })

  it('keeps the dots on the locked grid in the cross-fade, and puts the cells on the grid square', () => {
    jest.mocked(useReducedMotion).mockReturnValue(true)
    lockOn(quad, { quad, image: IMAGE, result: OK })
    runFrames(0.2)
    const frame = effectCanvas.mock.calls.at(-1)![0].capture!.value!
    expect(frame.quad[0].x).toBeCloseTo(-44.8 + 0.2 * 491.6, 0)
    expect(frame.grid[0]).toEqual({ x: LAYOUT.grid.x, y: LAYOUT.grid.y })
  })

  it('writes nothing while a gate holds the clock', () => {
    lockOn(quad, { quad, image: null, result: null })
    runFrames(0.5)
    const moving = effectCanvas.mock.calls.at(-1)![0].capture!
    const held = moving.value
    runFrames(0.5)
    expect(moving.value).toBe(held)
  })

  it('turns the status bar dark when the light background is half in', async () => {
    lockOn(quad, { quad, image: IMAGE, result: null })
    expect(screen.getByTestId('status-bar').props.accessibilityLabel).toBe('light')
    const calls = reaction.mock.calls as unknown as [() => unknown, (dark: boolean, previous: boolean | null) => void][]
    const falseBefore = new Set(calls.filter(([prepare]) => prepare() === false))
    runFrames(0.4)
    // The status bar reaction is the one whose condition the dim turns from false to true.
    const [, react] = calls.findLast((call) => falseBefore.has(call) && call[0]() === true)!
    await act(async () => react(true, false))
    expect(screen.getByTestId('status-bar').props.accessibilityLabel).toBe('dark')
  })

  it('cross-fades with Reduce Motion, and the gates still hold the clock', () => {
    jest.mocked(useReducedMotion).mockReturnValue(true)
    lockOn(quad, { quad, image: IMAGE, result: null })
    expect(jest.mocked(TransitionCanvas).mock.calls.at(-1)![0]).toMatchObject({ crossFade: true })
    runFrames(0.5)
    expect(correction().clock!.value).toBe(0)
  })

  it('warps from the locked grid in view points to the grid square', () => {
    lockOn(quad, { quad, image: IMAGE, result: OK })
    runFrames(0.02)
    const moving = effectCanvas.mock.calls.at(-1)![0].capture!
    // A 9:16 frame covers 402 x 874 pt: it is 491.6 pt wide, and 44.8 pt of it is cut on each side.
    expect(moving.value!.quad[0].x).toBeCloseTo(-44.8 + 0.2 * 491.6, 0)
    runFrames(GATE_RESULTS)
    const grid = LAYOUT.grid
    expect(moving.value!.quad[2].x).toBeCloseTo(grid.x + grid.width)
    expect(moving.value!.quad[2].y).toBeCloseTo(grid.y + grid.height)
  })

  it('adds the photo output to the camera', () => {
    givenPermission('authorized')
    render(<CameraScreen {...props()} />)
    expect(screen.getByTestId('camera').props.outputs).toHaveLength(2)
  })
})
