import { renderHook } from '@testing-library/react-native'
import { useAnimatedReaction } from 'react-native-reanimated'
import { useFrameOutput } from 'react-native-vision-camera'
import { type GridDetector, useGridDetector } from '@/scanner'
import * as frameRate from '@/scan/utils/tracking.utils'
import type { Quad } from '@/utils/geometry.utils'
import { type FrameDetection, useFrameTracking } from './useFrameTracking'

jest.mock('@/scanner', () => ({ ...jest.requireActual('@/scanner'), useGridDetector: jest.fn(() => undefined) }))

type FakeFrame = {
  timestamp: number
  width: number
  height: number
  orientation: 'up' | 'right' | 'down' | 'left'
  dispose: () => void
}

const quad: Quad = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.8, y: 0.8 },
  { x: 0.2, y: 0.8 },
]

function frameAt(timestamp: number, dispose: () => void = jest.fn()): FakeFrame {
  return { timestamp, width: 1920, height: 1080, orientation: 'right', dispose }
}

function setup(detectGrid?: GridDetector | (() => never), size = { width: 360, height: 640 }) {
  jest.mocked(useGridDetector).mockReturnValue(detectGrid as GridDetector | undefined)
  const viewSize = { value: size, get: () => size } as never
  const hook = renderHook(() => useFrameTracking(viewSize))
  const config = jest.mocked(useFrameOutput).mock.calls.at(-1)![0] as unknown as { onFrame: (frame: FakeFrame) => void }
  const [prepare, react] = jest.mocked(useAnimatedReaction).mock.calls.at(-1)! as unknown as [
    () => FrameDetection | null,
    (current: FrameDetection | null) => void,
  ]
  return { hook, onFrame: config.onFrame, prepare, react }
}

beforeEach(() => jest.clearAllMocks())

afterEach(() => jest.restoreAllMocks())

describe('useFrameTracking', () => {
  it('logs the frame rate once per second', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    const { onFrame } = setup()
    const disposers = Array.from({ length: 31 }, () => jest.fn())
    disposers.forEach((dispose, i) => onFrame(frameAt(100 + i / 30, dispose)))
    await Promise.resolve()
    expect(log).toHaveBeenCalledWith('[camera] 30.0 fps, detection 0.0 ms')
    disposers.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1))
  })

  it('releases every frame, also when counting fails', () => {
    // The spy comes before render: the worklet captures countFrame when it is created.
    jest.spyOn(frameRate, 'countFrame').mockImplementation(() => {
      throw new Error('count failed')
    })
    const { onFrame } = setup()
    const dispose = jest.fn()
    expect(() => onFrame(frameAt(1, dispose))).toThrow('count failed')
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('publishes the detection of every frame for the UI thread', () => {
    const detectGrid = jest.fn(() => ({ quad, score: 0.36, switched: false }))
    const { onFrame, prepare } = setup(detectGrid as unknown as GridDetector)
    const frame = frameAt(5)
    onFrame(frame)
    expect(detectGrid).toHaveBeenCalledWith(frame)
    expect(prepare()).toEqual({ quad, timestamp: 5, aspect: 1080 / 1920, switches: 0 })
  })

  it('publishes an empty detection while the detector loads', () => {
    const { onFrame, prepare } = setup(undefined)
    onFrame(frameAt(5))
    expect(prepare()).toEqual({ quad: null, timestamp: 5, aspect: 1080 / 1920, switches: 0 })
  })

  it('publishes an empty detection and disposes the frame when detection fails, and warns once per message', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { onFrame, prepare } = setup((() => {
      throw new Error('detect failed')
    }) as GridDetector)
    const dispose = jest.fn()
    expect(() => onFrame(frameAt(5, dispose))).not.toThrow()
    expect(prepare()).toEqual({ quad: null, timestamp: 5, aspect: 1080 / 1920, switches: 0 })
    expect(dispose).toHaveBeenCalledTimes(1)
    onFrame(frameAt(6))
    await Promise.resolve()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('turns a detection into an outline in view points', () => {
    const { hook, react } = setup()
    react({ quad, timestamp: 5, aspect: 0.5625, switches: 0 })
    expect(hook.result.current.outline.value).toEqual([
      { x: 72, y: 128 },
      { x: 288, y: 128 },
      { x: 288, y: 512 },
      { x: 72, y: 512 },
    ])
    expect(hook.result.current.frameQuad.value).toEqual(quad)
  })

  it('removes the outline when the grid is gone for longer than the hold time', () => {
    const { hook, react } = setup()
    react({ quad, timestamp: 5, aspect: 0.5625, switches: 0 })
    react({ quad: null, timestamp: 6, aspect: 0.5625, switches: 0 })
    expect(hook.result.current.outline.value).toBeNull()
  })

  it('counts the switches of the aiming rule for the UI thread', () => {
    const detectGrid = jest
      .fn()
      .mockReturnValueOnce({ quad, score: 0.36, switched: false })
      .mockReturnValueOnce({ quad, score: 0.36, switched: true })
      .mockReturnValue({ quad, score: 0.36, switched: false })
    const { onFrame, prepare } = setup(detectGrid as unknown as GridDetector)
    onFrame(frameAt(5))
    expect(prepare()).toMatchObject({ switches: 0 })
    onFrame(frameAt(5.1))
    expect(prepare()).toMatchObject({ switches: 1 })
    onFrame(frameAt(5.2))
    expect(prepare()).toMatchObject({ switches: 1 })
  })

  it('starts the smoothing new on a switch, so the outline jumps to the new grid in one frame', () => {
    const { hook, react } = setup()
    const next: Quad = [
      { x: 0.2, y: 0.5 },
      { x: 0.8, y: 0.5 },
      { x: 0.8, y: 0.9 },
      { x: 0.2, y: 0.9 },
    ]
    react({ quad, timestamp: 5, aspect: 0.5625, switches: 0 })
    react({ quad: next, timestamp: 5 + 1 / 30, aspect: 0.5625, switches: 1 })
    expect(hook.result.current.frameQuad.value).toEqual(next)
  })

  it('starts the smoothing new when the UI thread skipped the frame of the switch', () => {
    const { hook, react } = setup()
    const next: Quad = [
      { x: 0.2, y: 0.5 },
      { x: 0.8, y: 0.5 },
      { x: 0.8, y: 0.9 },
      { x: 0.2, y: 0.9 },
    ]
    react({ quad, timestamp: 5, aspect: 0.5625, switches: 0 })
    // The frame of the switch never reached the reaction. The next frame still carries the count.
    react({ quad: next, timestamp: 5 + 2 / 30, aspect: 0.5625, switches: 1 })
    expect(hook.result.current.frameQuad.value).toEqual(next)
  })

  it('smooths a move of the same grid', () => {
    const { hook, react } = setup()
    const next: Quad = [
      { x: 0.2, y: 0.5 },
      { x: 0.8, y: 0.5 },
      { x: 0.8, y: 0.9 },
      { x: 0.2, y: 0.9 },
    ]
    react({ quad, timestamp: 5, aspect: 0.5625, switches: 0 })
    react({ quad: next, timestamp: 5 + 1 / 30, aspect: 0.5625, switches: 0 })
    expect(hook.result.current.frameQuad.value).not.toEqual(next)
  })
})
