import { renderHook } from '@testing-library/react-native'
import type { Frame } from 'react-native-vision-camera'
import { useResizer } from 'react-native-vision-camera-resizer'
import { findGrid } from './findGrid'
import { type Quad, turnHalf } from './quad'
import { DETECT_HEIGHT, DETECT_WIDTH, useGridDetector } from './useGridDetector'

jest.mock('./findGrid', () => ({ findGrid: jest.fn(() => null) }))

const resizerState = jest.mocked(useResizer)
const find = jest.mocked(findGrid)
const square: Quad = [
  { x: 0.25, y: 0.125 },
  { x: 0.5, y: 0.125 },
  { x: 0.875, y: 0.5 },
  { x: 0.125, y: 0.5 },
]
const frame = { timestamp: 1, orientation: 'up' } as unknown as Frame

function givenState(state: 'loading' | 'error') {
  resizerState.mockReturnValue(
    (state === 'loading'
      ? { state, resizer: undefined, error: undefined }
      : { state, resizer: undefined, error: new Error('no Metal device') }) as ReturnType<typeof useResizer>,
  )
}

function givenResizer() {
  const resized = {
    width: DETECT_WIDTH,
    height: DETECT_HEIGHT,
    getPixelBuffer: jest.fn(() => new ArrayBuffer(DETECT_WIDTH * DETECT_HEIGHT * 3)),
    dispose: jest.fn(),
  }
  const resizer = { resize: jest.fn(() => resized) }
  resizerState.mockReturnValue({ state: 'ready', resizer, error: undefined } as unknown as ReturnType<
    typeof useResizer
  >)
  return { resizer, resized }
}

beforeEach(() => jest.clearAllMocks())

describe('useGridDetector', () => {
  it('asks for an upright 360 × 640 RGB image of the whole frame', () => {
    givenState('loading')
    renderHook(() => useGridDetector())
    expect(resizerState).toHaveBeenCalledWith({
      width: 360,
      height: 640,
      channelOrder: 'rgb',
      dataType: 'uint8',
      scaleMode: 'stretch',
      pixelLayout: 'interleaved',
    })
  })

  it('has no detector while the resizer loads', () => {
    givenState('loading')
    const { result } = renderHook(() => useGridDetector())
    expect(result.current).toBeUndefined()
  })

  it('finds the grid in the resized frame and disposes it', () => {
    const { resizer, resized } = givenResizer()
    const detection = { quad: [], score: 0.4 } as never
    find.mockReturnValueOnce(detection)
    const { result } = renderHook(() => useGridDetector())
    expect(result.current!(frame)).toBe(detection)
    expect(resizer.resize).toHaveBeenCalledWith(frame)
    const [pixels, width, height] = find.mock.calls[0]
    expect(pixels).toBeInstanceOf(Uint8Array)
    expect(pixels.length).toBe(360 * 640 * 3)
    expect([width, height]).toEqual([360, 640])
    expect(resized.dispose).toHaveBeenCalledTimes(1)
  })

  it.each(['left', 'right'] as const)('turns the quad back by 180 degrees for a %s frame', (orientation) => {
    givenResizer()
    find.mockReturnValueOnce({ quad: square, score: 0.4 })
    const { result } = renderHook(() => useGridDetector())
    const sideways = { timestamp: 1, orientation } as unknown as Frame
    expect(result.current!(sideways)).toEqual({ quad: turnHalf(square), score: 0.4 })
  })

  it('disposes the resized frame when detection fails', () => {
    const { resized } = givenResizer()
    find.mockImplementationOnce(() => {
      throw new Error('opencv failed')
    })
    const { result } = renderHook(() => useGridDetector())
    expect(() => result.current!(frame)).toThrow('opencv failed')
    expect(resized.dispose).toHaveBeenCalledTimes(1)
  })

  it('warns once when the resizer fails', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    givenState('error')
    const { result, rerender } = renderHook(() => useGridDetector())
    rerender({})
    expect(result.current).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('[scanner] the frame resizer failed: no Metal device')
    warn.mockRestore()
  })
})
