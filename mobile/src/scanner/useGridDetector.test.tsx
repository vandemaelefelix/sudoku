import { renderHook } from '@testing-library/react-native'
import type { Frame } from 'react-native-vision-camera'
import { useResizer } from 'react-native-vision-camera-resizer'
import { findGrids } from './findGrid'
import { type GridDetection, turnHalf } from './quad'
import { DETECT_HEIGHT, DETECT_WIDTH, useGridDetector } from './useGridDetector'
import type { Quad } from '@/utils/geometry.utils'

jest.mock('./findGrid', () => ({ findGrids: jest.fn(() => []) }))

const resizerState = jest.mocked(useResizer)
const find = jest.mocked(findGrids)

function at<T>(items: ArrayLike<T>, index: number): T {
  const item = items[index]
  if (item === undefined) throw new RangeError(`no item at index ${index}`)
  return item
}
const trapezoid: Quad = [
  { x: 0.25, y: 0.125 },
  { x: 0.5, y: 0.125 },
  { x: 0.875, y: 0.5 },
  { x: 0.125, y: 0.5 },
]
const frame = { timestamp: 1, width: 1080, height: 1920, orientation: 'up' } as unknown as Frame

/** A square grid of side 0.5 of the frame width, centred at (0.5, cy) of an upright 9:16 frame. */
function stacked(cy: number): GridDetection {
  const h = (0.5 * 9) / 16 / 2
  const quad: Quad = [
    { x: 0.25, y: cy - h },
    { x: 0.75, y: cy - h },
    { x: 0.75, y: cy + h },
    { x: 0.25, y: cy + h },
  ]
  return { quad, score: 0.5 * 2 * h }
}

function frameAt(timestamp: number): Frame {
  return { timestamp, width: 1080, height: 1920, orientation: 'up' } as unknown as Frame
}

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
    const detection = stacked(0.5)
    find.mockReturnValueOnce([detection])
    const { result } = renderHook(() => useGridDetector())
    expect(result.current!(frame)).toEqual({ ...detection, switched: false })
    expect(resizer.resize).toHaveBeenCalledWith(frame)
    const [pixels, width, height] = at(find.mock.calls, 0)
    expect(pixels).toBeInstanceOf(Uint8Array)
    expect(pixels.length).toBe(360 * 640 * 3)
    expect([width, height]).toEqual([360, 640])
    expect(resized.dispose).toHaveBeenCalledTimes(1)
  })

  it.each(['left', 'right'] as const)('turns the quad back by 180 degrees for a %s frame', (orientation) => {
    givenResizer()
    find.mockReturnValueOnce([{ quad: trapezoid, score: 0.4 }])
    const { result } = renderHook(() => useGridDetector())
    const sideways = { timestamp: 1, width: 1920, height: 1080, orientation } as unknown as Frame
    expect(result.current!(sideways)).toEqual({ quad: turnHalf(trapezoid), score: 0.4, switched: false })
  })

  it('keeps the grid it aims at on a page with three equal grids, whatever their order', () => {
    givenResizer()
    const grids = [stacked(0.2), stacked(0.5), stacked(0.8)]
    const { result } = renderHook(() => useGridDetector())
    for (let i = 0; i < 30; i++) {
      // findGrids gives the largest first, and three equal grids come in any order.
      find.mockReturnValueOnce(i % 2 === 0 ? grids : [...grids].reverse())
      const chosen = result.current!(frameAt(1 + i / 30))
      expect(chosen?.quad).toEqual(stacked(0.5).quad)
    }
  })

  it('reports the frame of a switch to the grid the phone now aims at', () => {
    givenResizer()
    const { result } = renderHook(() => useGridDetector())
    find.mockReturnValueOnce([stacked(0.2)])
    result.current!(frameAt(1))
    const switched: boolean[] = []
    for (let i = 1; i <= 15; i++) {
      find.mockReturnValueOnce([stacked(0.15), stacked(0.5)])
      switched.push(result.current!(frameAt(1 + i / 30))?.switched ?? false)
    }
    expect(switched.filter(Boolean)).toHaveLength(1)
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
