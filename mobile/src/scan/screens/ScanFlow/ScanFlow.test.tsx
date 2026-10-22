import { act, render } from '@testing-library/react-native'
import { CameraScreen } from '@/scan/screens/CameraScreen'
import { ScanFlow } from './ScanFlow'
import { useScannedStart } from '@/scan/hooks/useScannedStart'
import type { CaptureResult } from '@/scan/utils/captureResult.utils'
import type { FinalGrid } from '@/utils/finalGrid.utils'

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
jest.mock('@/scan/screens/CameraScreen', () => ({
  CameraScreen: jest.fn(() => {
    // Counts mounts, so a test sees a new camera screen, and with it a new capture session.
    jest.requireActual('react').useEffect(() => {
      mockMounts.push(mockMounts.length)
    }, [])
    return null
  }),
}))

const OK: CaptureResult = {
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
const WITH_PHOTO: CaptureResult = { ...OK, photoPath: '/tmp/photo.jpg' }
const mockPlay = jest.fn()

function camera() {
  return jest.mocked(CameraScreen).mock.calls.at(-1)![0]
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useScannedStart).mockReturnValue(mockPlay)
  mockMounts.length = 0
})

it('starts with one camera screen, and gives it the correction layout', () => {
  render(<ScanFlow />)
  expect(mockMounts).toHaveLength(1)
  expect(camera().layout.grid.width).toBeGreaterThan(0)
})

it('hands the close button to the router, as a dismiss to the home route', () => {
  render(<ScanFlow />)
  camera().onClose()
  expect(mockDismissTo).toHaveBeenCalledWith('/')
})

it('mounts a new camera screen on Retake, so the capture session starts new', () => {
  render(<ScanFlow />)
  act(() => camera().onRetake(null))
  expect(mockMounts).toHaveLength(2)
})

it('hands Play to the scanned start, and Home to the router as a dismiss to the home route', () => {
  render(<ScanFlow />)
  expect(camera().onPlay).toBe(mockPlay)
  camera().onHome()
  expect(mockDismissTo).toHaveBeenCalledWith('/')
})

it('hands Save to the correction store, in a development build', () => {
  render(<ScanFlow />)
  const looks = [] as FinalGrid
  camera().onSave!(OK, looks)
  expect(mockSave).toHaveBeenCalledWith(OK, looks)
})

describe('in a release build', () => {
  const dev = __DEV__
  beforeEach(() => Object.assign(globalThis, { __DEV__: false }))
  afterEach(() => Object.assign(globalThis, { __DEV__: dev }))

  it('has no Save', () => {
    render(<ScanFlow />)
    expect(camera().onSave).toBeUndefined()
  })
})

describe('the photo of a scan that the player drops', () => {
  it('is deleted on Retake', () => {
    render(<ScanFlow />)
    act(() => camera().onRetake(WITH_PHOTO))
    expect(mockDiscard).toHaveBeenCalledWith('/tmp/photo.jpg')
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('needs no delete when the result has no photo, or no result came', () => {
    render(<ScanFlow />)
    act(() => camera().onRetake(OK))
    act(() => camera().onRetake({ ok: false, reason: 'no grid' }))
    act(() => camera().onRetake(null))
    expect(mockDiscard).not.toHaveBeenCalled()
  })

  it('is not deleted here when the player leaves, because the queue step deletes it', () => {
    render(<ScanFlow />)
    camera().onExit(WITH_PHOTO, [] as FinalGrid)
    expect(mockEnqueue).toHaveBeenCalledWith('/tmp/photo.jpg', WITH_PHOTO, [])
    expect(mockDiscard).not.toHaveBeenCalled()
  })

  it('does not join the upload queue without an ok result', () => {
    render(<ScanFlow />)
    camera().onExit(null, [] as FinalGrid)
    camera().onExit({ ok: false, reason: 'no grid' }, [] as FinalGrid)
    expect(mockEnqueue).not.toHaveBeenCalled()
  })
})

describe('an image from the photo library', () => {
  const IMPORTED: CaptureResult = { ...WITH_PHOTO, imported: true }

  it('never joins the upload queue, and its photo is deleted', () => {
    render(<ScanFlow />)
    camera().onExit(IMPORTED, [] as FinalGrid)
    expect(mockEnqueue).not.toHaveBeenCalled()
    expect(mockDiscard).toHaveBeenCalledWith('/tmp/photo.jpg')
  })

  it('needs no delete when the import kept no photo', () => {
    render(<ScanFlow />)
    camera().onExit({ ...OK, imported: true }, [] as FinalGrid)
    expect(mockEnqueue).not.toHaveBeenCalled()
    expect(mockDiscard).not.toHaveBeenCalled()
  })

  it('mounts a new camera screen that opens the picker when the player chooses another image', () => {
    render(<ScanFlow />)
    expect(camera().pickAtStart).toBe(false)
    act(() => camera().onRetake({ ok: false, reason: 'no grid in the photo' }, 'library'))
    expect(mockMounts).toHaveLength(2)
    expect(camera().pickAtStart).toBe(true)
  })

  it('mounts a plain camera screen on a later Retake', () => {
    render(<ScanFlow />)
    act(() => camera().onRetake(null, 'library'))
    act(() => camera().onRetake(null))
    expect(camera().pickAtStart).toBe(false)
  })
})

describe('Scan another', () => {
  it('mounts a new camera screen and keeps the photo, so the exit of the old screen can queue the scan', () => {
    render(<ScanFlow />)
    act(() => camera().onScanAnother())
    expect(mockMounts).toHaveLength(2)
    expect(mockDiscard).not.toHaveBeenCalled()
  })

  it('mounts a plain camera screen after an import that came from Choose another image', () => {
    render(<ScanFlow />)
    act(() => camera().onRetake(null, 'library'))
    act(() => camera().onScanAnother())
    expect(camera().pickAtStart).toBe(false)
  })
})
