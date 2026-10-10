import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AppState, Linking } from 'react-native'
import { useCameraDevice, useCameraPermission, useFrameOutput } from 'react-native-vision-camera'
import { CameraScreen } from './CameraScreen'
import * as frameRate from './frameRate'

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

type FrameConfig = { onFrame: (frame: { timestamp: number; dispose: () => void }) => void }

function onFrame() {
  const config = frameOutput.mock.calls.at(-1)?.[0] as unknown as FrameConfig
  return config.onFrame
}

beforeEach(() => {
  jest.clearAllMocks()
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
    disposers.forEach((dispose, i) => handle({ timestamp: 100 + i / 30, dispose }))
    await Promise.resolve()
    expect(log).toHaveBeenCalledWith('[camera] 30.0 fps')
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
    expect(() => onFrame()({ timestamp: 1, dispose })).toThrow('count failed')
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
})
