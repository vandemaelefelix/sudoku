import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { RecogniseResult } from '@/scanner'
import { CameraScreen } from '@/scan/screens/CameraScreen'
import { CorrectionScreen } from '@/scan/screens/CorrectionScreen'
import { EffectCanvas } from '@/scan/effects/components/EffectCanvas'
import { ScanFlow } from './ScanFlow'
import { useCapture } from '@/scan/hooks/useCapture'
import { useScannedStart } from '@/scan/hooks/useScannedStart'
import type { CellLook } from '@/scan/utils/correction.utils'

jest.mock('@/scanner', () => ({ ...jest.requireActual('@/scanner'), useGridDetector: jest.fn(() => undefined) }))
jest.mock('@/scan/hooks/useCapture', () => ({ useCapture: jest.fn() }))
jest.mock('@/scan/effects/components/EffectPicker', () => ({ EffectPicker: () => null }))
jest.mock('@/scan/components/TransitionCanvas', () => ({ TransitionCanvas: () => null }))
const mockDismissTo = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ dismissTo: mockDismissTo }) }))
jest.mock('@/scan/hooks/useScannedStart', () => ({ useScannedStart: jest.fn() }))
const mockSave = jest.fn()
jest.mock('@/scan/utils/correctionStore', () => ({ saveScanCorrection: (...args: unknown[]) => mockSave(...args) }))

const mockDiscard = jest.fn()
const mockEnqueue = jest.fn()
jest.mock('@/scanShare/useScanShare', () => ({
  useScanShare: () => ({ enqueueScan: mockEnqueue, discardPhoto: mockDiscard }),
}))

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

const mockPlay = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useScannedStart).mockReturnValue(mockPlay)
  mockMounts.length = 0
  givenPhase({ phase: 'live' })
})

it('starts live on the camera', () => {
  render(<ScanFlow />)
  expect(screen.getByTestId('camera-screen')).toBeTruthy()
  expect(mockMounts).toHaveLength(1)
})

/** Renders the flow at the end of a transition with an ok result, and finishes it. */
function finishTransition() {
  givenPhase({ phase: 'capturing', quad: null, image: null, imageFailed: false, result: OK })
  render(<ScanFlow />)
  const transition = jest.mocked(CorrectionScreen).mock.calls.at(-1)![0]
  const shown = screen.getByTestId('correction-screen')
  const effectRenders = jest.mocked(EffectCanvas).mock.calls.length
  act(() => jest.mocked(CameraScreen).mock.calls.at(-1)![0].onDone(OK))
  return { transition, shown, effectRenders }
}

it('keeps the correction screen of the transition as the static screen, so no new canvas mounts', () => {
  const { transition, shown } = finishTransition()
  expect(transition.clock).toBeDefined()
  expect(screen.getByTestId('correction-screen')).toBe(shown)
  const props = jest.mocked(CorrectionScreen).mock.calls.at(-1)![0]
  expect(props.result).toBe(OK)
  expect(props.clock).toBeUndefined()
  expect(props.layout).toEqual(jest.mocked(CameraScreen).mock.calls.at(-1)![0].layout)
})

it('unmounts the camera layers in the review', () => {
  const { effectRenders } = finishTransition()
  expect(jest.mocked(EffectCanvas).mock.calls).toHaveLength(effectRenders)
  expect(screen.queryByTestId('capture-flash')).toBeNull()
})

it('goes back live with a new scene on Retake from the review', () => {
  finishTransition()
  givenPhase({ phase: 'live' })
  fireEvent.press(screen.getByTestId('retake'))
  expect(screen.getByTestId('camera-screen')).toBeTruthy()
  expect(mockMounts).toHaveLength(2)
  expect(lastCanvas().capture!.value).toBeNull()
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
})

it('hands Save of the review to the correction store, and keeps Play, in a development build', () => {
  finishTransition()
  const props = jest.mocked(CorrectionScreen).mock.calls.at(-1)![0]
  expect(props.onPlay).toBeDefined()
  const looks = [] as CellLook[]
  props.onSave!(looks)
  expect(mockSave).toHaveBeenCalledWith(OK, looks)
  expect(mockPlay).not.toHaveBeenCalled()
})

it('hands Home of the review to the router, as a dismiss to the home route', () => {
  finishTransition()
  const props = jest.mocked(CorrectionScreen).mock.calls.at(-1)![0]
  props.onHome!()
  expect(mockDismissTo).toHaveBeenCalledWith('/')
})

function reviewWith(result: RecogniseResult) {
  givenPhase({ phase: 'capturing', quad: null, image: null, imageFailed: false, result })
  render(<ScanFlow />)
  act(() => jest.mocked(CameraScreen).mock.calls.at(-1)![0].onDone(result))
  givenPhase({ phase: 'live' })
}

describe('the photo of a scan that the player drops', () => {
  const WITH_PHOTO = { ...OK, photoPath: '/tmp/photo.jpg' } as RecogniseResult

  it('is deleted on Retake from the review', () => {
    reviewWith(WITH_PHOTO)
    fireEvent.press(screen.getByTestId('retake'))
    expect(mockDiscard).toHaveBeenCalledWith('/tmp/photo.jpg')
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('is deleted on Retake from the capture transition', () => {
    givenPhase({ phase: 'capturing', quad: null, image: null, imageFailed: false, result: WITH_PHOTO })
    render(<ScanFlow />)
    givenPhase({ phase: 'live' })
    fireEvent.press(screen.getByTestId('retake'))
    expect(mockDiscard).toHaveBeenCalledWith('/tmp/photo.jpg')
  })

  it('needs no delete when the result has no photo', () => {
    reviewWith(OK)
    fireEvent.press(screen.getByTestId('retake'))
    expect(mockDiscard).not.toHaveBeenCalled()
  })

  it('is not deleted here when the player plays, because the queue step deletes it', () => {
    reviewWith(WITH_PHOTO)
    jest.mocked(CorrectionScreen).mock.calls.at(-1)![0].onExit!([] as CellLook[])
    expect(mockEnqueue).toHaveBeenCalledWith('/tmp/photo.jpg', WITH_PHOTO, [])
    expect(mockDiscard).not.toHaveBeenCalled()
  })
})
