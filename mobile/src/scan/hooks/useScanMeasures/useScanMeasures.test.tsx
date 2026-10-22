import { act, renderHook } from '@testing-library/react-native'
import { type SharedValue, useAnimatedReaction, useSharedValue } from 'react-native-reanimated'
import type { FrameDetection } from '@/scan/hooks/useFrameTracking'
import type { CapturePhase } from '@/scan/hooks/useCaptureSession'
import type { CaptureResult, ScanOrigin } from '@/scan/utils/captureResult.utils'
import type { Quad } from '@/utils/geometry.utils'
import { isDevelopmentVariant } from '@/utils/appVariant.utils'
import { useScanMeasures } from './useScanMeasures'

jest.mock('@/utils/appVariant.utils', () => ({ isDevelopmentVariant: jest.fn(() => true) }))

type Props = { phase: CapturePhase; origin: ScanOrigin; result: CaptureResult | null }

const square = (x: number): Quad => [
  { x, y: 0 },
  { x: x + 100, y: 0 },
  { x: x + 100, y: 100 },
  { x, y: 100 },
]

function renderMeasures(initial: Props = { phase: 'live', origin: 'camera', result: null }) {
  let detection: SharedValue<FrameDetection | null> | null = null
  const view = renderHook(
    (props: Props) => {
      detection = useSharedValue<FrameDetection | null>(null)
      const outline = useSharedValue<Quad | null>(null)
      useScanMeasures({ detection, outline, ...props })
    },
    { initialProps: initial },
  )
  // The hook adds two reactions: the detection first, then the outline.
  const [detectionReaction, outlineReaction] = jest.mocked(useAnimatedReaction).mock.calls.slice(-2)
  const frame = (timestamp: number, quad: Quad | null) => {
    const current = { quad, timestamp, aspect: 0.75, switches: 0 }
    detection!.set(current)
    detectionReaction![1](current, null)
    jest.runAllTicks()
  }
  // scheduleOnRN reaches the JS thread through a microtask, as on the device.
  const drawn = (quad: Quad | null) => {
    outlineReaction![1](quad, null)
    jest.runAllTicks()
  }
  return { view, frame, drawn }
}

const lines = () => jest.mocked(console.log).mock.calls.map(([line]) => String(line))

beforeEach(() => {
  jest.useFakeTimers({ now: 10_000 })
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
  jest.mocked(useAnimatedReaction).mockClear()
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it('logs the time to the first grid and the first outline, once each (QR-05)', () => {
  const { frame, drawn } = renderMeasures()
  jest.setSystemTime(10_180)
  frame(1, square(0))
  jest.setSystemTime(10_240)
  drawn(square(0))
  drawn(square(1))
  expect(lines()).toEqual([
    '[measure] QR-05 first grid found 180 ms after the camera screen opened',
    '[measure] QR-05 first outline 240 ms after the camera screen opened',
  ])
})

it('logs the frame rate of the live detection (QR-05)', () => {
  const { frame } = renderMeasures()
  for (let index = 0; index <= 31; index++) frame(1 + index / 30, null)
  expect(lines()).toContain('[measure] QR-05 detection 30.0 fps')
})

it('logs the largest corner step of the outline over 5 s (QR-06)', () => {
  const { frame, drawn } = renderMeasures()
  for (let index = 0; index <= 150; index++) {
    frame(1 + index / 30, square(0))
    drawn(square(index % 2 === 0 ? 0 : 1.5))
  }
  expect(lines()).toContainEqual(expect.stringMatching(/^\[measure\] QR-06 max corner step 1\.50 pt over \d+ frames/))
})

it('logs the time from lock-on to the correction screen, and the recognition (QR-07)', () => {
  const { view } = renderMeasures()
  jest.setSystemTime(20_000)
  view.rerender({ phase: 'capturing', origin: 'camera', result: null })
  const result = { ok: true, timings: { imageMs: 10, detectMs: 30, flattenMs: 5, classifyMs: 40 } } as CaptureResult
  view.rerender({ phase: 'capturing', origin: 'camera', result })
  jest.setSystemTime(21_200)
  view.rerender({ phase: 'review', origin: 'camera', result })
  expect(lines()).toEqual([
    '[measure] QR-07 recognition 85 ms: image 10 ms, detect 30 ms, flatten 5 ms, classify 40 ms',
    '[measure] QR-07 lock-on to the correction screen 1200 ms',
  ])
})

it('logs no lock-on time for an image from the photo library', () => {
  const { view } = renderMeasures({ phase: 'live', origin: 'library', result: null })
  view.rerender({ phase: 'capturing', origin: 'library', result: null })
  view.rerender({ phase: 'review', origin: 'library', result: null })
  expect(lines()).toEqual([])
})

it('logs the JS heap every 30 s while the camera scans (QR-08)', () => {
  const engine = {
    getInstrumentedStats: () => ({ js_heapSize: 8_388_608, js_allocatedBytes: 4_194_304, js_numGCs: 3 }),
  }
  Object.assign(globalThis, { HermesInternal: engine })
  const { view } = renderMeasures()
  act(() => jest.advanceTimersByTime(60_000))
  expect(lines()).toEqual([
    '[measure] QR-08 scanning 0.5 min: JS heap 8.0 MB, allocated 4.0 MB, 3 collections',
    '[measure] QR-08 scanning 1.0 min: JS heap 8.0 MB, allocated 4.0 MB, 3 collections',
  ])
  view.rerender({ phase: 'capturing', origin: 'camera', result: null })
  act(() => jest.advanceTimersByTime(60_000))
  expect(lines()).toHaveLength(2)
  Reflect.deleteProperty(globalThis, 'HermesInternal')
})

it('measures nothing in the production variant', () => {
  jest.mocked(isDevelopmentVariant).mockReturnValue(false)
  const { view, frame, drawn } = renderMeasures()
  frame(1, square(0))
  drawn(square(0))
  view.rerender({ phase: 'capturing', origin: 'camera', result: null })
  view.rerender({ phase: 'review', origin: 'camera', result: null })
  act(() => jest.advanceTimersByTime(60_000))
  expect(lines()).toEqual([])
})
