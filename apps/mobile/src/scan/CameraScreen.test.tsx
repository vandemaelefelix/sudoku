import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AppState, Linking } from 'react-native'
import { useCameraDevice, useCameraPermission, useFrameOutput } from 'react-native-vision-camera'
import { useAnimatedReaction } from 'react-native-reanimated'
import { type GridDetector, type Quad, useGridDetector } from '../scanner'
import { CameraScreen, type FrameDetection } from './CameraScreen'
import * as frameRate from './frameRate'
import { GridOutline } from './GridOutline'

jest.mock('../scanner', () => ({
  ...jest.requireActual('../scanner'),
  useGridDetector: jest.fn(() => undefined),
}))

jest.mock('./GridOutline', () => ({ GridOutline: jest.fn(() => null) }))

jest.mock('expo-status-bar', () => {
  const { View } = jest.requireActual('react-native')
  return {
    StatusBar: ({ style }: { style: string }) => <View testID="status-bar" accessibilityLabel={style} />,
  }
})

const permission = jest.mocked(useCameraPermission)
const device = jest.mocked(useCameraDevice)
const frameOutput = jest.mocked(useFrameOutput)

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
const outline = jest.mocked(GridOutline)

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
  device.mockReturnValue({ id: 'back' } as unknown as ReturnType<typeof useCameraDevice>)
})

afterEach(() => jest.restoreAllMocks())

describe('CameraScreen', () => {
  it('shows the camera full screen when permission is given', () => {
    givenPermission('authorized')
    render(<CameraScreen />)
    expect(screen.getByTestId('camera')).toBeTruthy()
  })

  it('uses a light status bar over the camera', () => {
    givenPermission('authorized')
    render(<CameraScreen />)
    expect(screen.getByTestId('status-bar').props.accessibilityLabel).toBe('light')
  })

  it('uses a dark status bar on the message screens', () => {
    givenPermission('denied')
    render(<CameraScreen />)
    expect(screen.getByTestId('status-bar').props.accessibilityLabel).toBe('dark')
  })

  it('asks for permission the first time', () => {
    const request = givenPermission('not-determined')
    render(<CameraScreen />)
    expect(request).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('camera-waiting')).toBeTruthy()
  })

  it('offers the settings when permission was denied', () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue()
    givenPermission('denied')
    render(<CameraScreen />)
    expect(screen.getByTestId('camera-denied')).toBeTruthy()
    fireEvent.press(screen.getByTestId('open-settings'))
    expect(openSettings).toHaveBeenCalledTimes(1)
  })

  it('says so when the phone has no back camera', () => {
    givenPermission('authorized')
    device.mockReturnValue(undefined)
    render(<CameraScreen />)
    expect(screen.getByTestId('camera-missing')).toBeTruthy()
  })

  it('logs the frame rate once per second', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    givenPermission('authorized')
    render(<CameraScreen />)
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
    render(<CameraScreen />)
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
    const { unmount } = render(<CameraScreen />)
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
    render(<CameraScreen />)
    const frame = frameAt(5)
    onFrame()(frame)
    expect(detectGrid).toHaveBeenCalledWith(frame)
    expect(lastReaction().prepare()).toEqual({ quad, timestamp: 5, aspect: 1080 / 1920 })
  })

  it('publishes an empty detection while the detector loads', () => {
    givenPermission('authorized')
    detector.mockReturnValue(undefined)
    render(<CameraScreen />)
    onFrame()(frameAt(5))
    expect(lastReaction().prepare()).toEqual({ quad: null, timestamp: 5, aspect: 1080 / 1920 })
  })

  it('disposes the frame when detection fails', () => {
    givenPermission('authorized')
    detector.mockReturnValue((() => {
      throw new Error('detect failed')
    }) as unknown as GridDetector)
    render(<CameraScreen />)
    const dispose = jest.fn()
    expect(() => onFrame()(frameAt(5, dispose))).toThrow('detect failed')
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('turns a detection into an outline in view points', () => {
    givenPermission('authorized')
    render(<CameraScreen />)
    fireEvent(screen.getByTestId('camera-screen'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 640 } },
    })
    lastReaction().react({ quad, timestamp: 5, aspect: 0.5625 })
    const shown = outline.mock.calls.at(-1)![0].outline.value
    expect(shown).toEqual([
      { x: 72, y: 128 },
      { x: 288, y: 128 },
      { x: 288, y: 512 },
      { x: 72, y: 512 },
    ])
  })

  it('removes the outline when the grid is gone for longer than the hold time', () => {
    givenPermission('authorized')
    render(<CameraScreen />)
    fireEvent(screen.getByTestId('camera-screen'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 640 } },
    })
    const { react } = lastReaction()
    react({ quad, timestamp: 5, aspect: 0.5625 })
    react({ quad: null, timestamp: 6, aspect: 0.5625 })
    expect(outline.mock.calls.at(-1)![0].outline.value).toBeNull()
  })
})
