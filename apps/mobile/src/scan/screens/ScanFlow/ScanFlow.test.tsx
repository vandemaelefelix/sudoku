import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { RecogniseResult } from '@/scanner'
import { CameraScreen } from '@/scan/screens/CameraScreen'
import { CorrectionScreen } from '@/scan/screens/CorrectionScreen'
import { EffectCanvas } from '@/scan/effects/components/EffectCanvas'
import { ScanFlow } from './ScanFlow'
import { useCapture } from '@/scan/hooks/useCapture'

jest.mock('@/scanner', () => ({ ...jest.requireActual('@/scanner'), useGridDetector: jest.fn(() => undefined) }))
jest.mock('@/scan/hooks/useCapture', () => ({ useCapture: jest.fn() }))
jest.mock('@/scan/effects/components/EffectPicker', () => ({ EffectPicker: () => null }))
jest.mock('@/scan/components/TransitionCanvas', () => ({ TransitionCanvas: () => null }))

const mockMounts: number[] = []
jest.mock('@/scan/effects/components/EffectCanvas', () => ({
  EffectCanvas: jest.fn(() => {
    // Counts mounts, so a test sees a new canvas with a new engine.
    jest.requireActual('react').useEffect(() => {
      mockMounts.push(mockMounts.length)
    }, [])
    return null
  }),
}))

// The real screens render, and the mocks record their props.
jest.mock('@/scan/screens/CameraScreen', () => {
  const { createElement } = jest.requireActual('react')
  const actual = jest.requireActual('@/scan/screens/CameraScreen')
  return { CameraScreen: jest.fn((props: object) => createElement(actual.CameraScreen, props)) }
})
jest.mock('@/scan/screens/CorrectionScreen', () => {
  const { createElement } = jest.requireActual('react')
  const actual = jest.requireActual('@/scan/screens/CorrectionScreen')
  return { CorrectionScreen: jest.fn((props: object) => createElement(actual.CorrectionScreen, props)) }
})

const OK: RecogniseResult = {
  ok: true,
  cells: [],
  quad: [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.8 },
  ],
  corners: 'redetected',
  cornerOffset: 0,
  timings: { imageMs: 1, detectMs: 1, flattenMs: 1, classifyMs: 1 },
}

function givenPhase(state: ReturnType<typeof useCapture>['state']) {
  jest.mocked(useCapture).mockReturnValue({
    state,
    capture: jest.fn(),
    sharedImage: { value: null } as unknown as ReturnType<typeof useCapture>['sharedImage'],
  })
}

function lastCanvas() {
  return jest.mocked(EffectCanvas).mock.calls.at(-1)![0]
}

beforeEach(() => {
  jest.clearAllMocks()
  mockMounts.length = 0
  givenPhase({ phase: 'live' })
})

it('starts live on the camera', () => {
  render(<ScanFlow />)
  expect(screen.getByTestId('camera-screen')).toBeTruthy()
  expect(mockMounts).toHaveLength(1)
})

it('arms the first camera screen', () => {
  render(<ScanFlow />)
  expect(jest.mocked(CameraScreen).mock.calls.at(-1)![0].armed).toBe(true)
  expect(lastCanvas().armed).toBe(true)
})

it('shows the static correction screen after the transition', () => {
  render(<ScanFlow />)
  act(() => jest.mocked(CameraScreen).mock.calls.at(-1)![0].onDone(OK))
  expect(screen.queryByTestId('camera-screen')).toBeNull()
  expect(screen.getByTestId('correction-screen')).toBeTruthy()
  const props = jest.mocked(CorrectionScreen).mock.calls.at(-1)![0]
  expect(props.result).toBe(OK)
  expect(props.clock).toBeUndefined()
  expect(props.layout).toEqual(jest.mocked(CameraScreen).mock.calls.at(-1)![0].layout)
})

it('goes back live with a new scene on Retake from the review', () => {
  render(<ScanFlow />)
  act(() => jest.mocked(CameraScreen).mock.calls.at(-1)![0].onDone(OK))
  fireEvent.press(screen.getByTestId('retake'))
  expect(screen.getByTestId('camera-screen')).toBeTruthy()
  expect(mockMounts).toHaveLength(2)
  expect(lastCanvas().capture!.value).toBeNull()
  expect(jest.mocked(CameraScreen).mock.calls.at(-1)![0].armed).toBe(false)
  expect(lastCanvas().armed).toBe(false)
})

it('mounts a new camera screen and a new effect canvas on Retake from the transition', () => {
  givenPhase({
    phase: 'capturing',
    quad: null,
    image: null,
    imageFailed: false,
    result: { ok: false, reason: 'no grid' },
  })
  render(<ScanFlow />)
  const before = lastCanvas()
  givenPhase({ phase: 'live' })
  fireEvent.press(screen.getByTestId('retake'))
  expect(mockMounts).toHaveLength(2)
  expect(lastCanvas().capture).not.toBe(before.capture)
  expect(lastCanvas().capture!.value).toBeNull()
  expect(jest.mocked(CameraScreen).mock.calls.at(-1)![0].armed).toBe(false)
  expect(lastCanvas().armed).toBe(false)
})
