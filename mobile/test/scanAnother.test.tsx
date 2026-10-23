import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { useFrameOutput } from 'react-native-vision-camera'
import type { SkImage } from '@shopify/react-native-skia'
import { generate } from '@sudoku/core'
import { createScanner, type CellResult, type RecogniseResult } from '@/scanner'
import { EffectCanvas } from '@/scan/effects/components/EffectCanvas'
import { ScanFlow } from '@/scan/screens/ScanFlow'
import { photoToSkImage } from '@/scan/utils/photoImage.utils'

// The flow from the capture to "Scan another" with the real camera screen, correction screen and ScanFlow. Only the native
// parts are fakes: the scanner, the photo file and the upload queue.

const PHOTO = '/tmp/photo.jpg'
// The files that exist. saveUprightPhoto writes the photo, discardPhoto deletes it.
const mockFiles = new Set<string>()
const mockEvents: string[] = []

jest.mock('expo-router', () => ({ useRouter: () => ({ dismissTo: jest.fn(), replace: jest.fn() }) }))
jest.mock('@/scan/hooks/useScannedStart', () => ({ useScannedStart: () => jest.fn() }))
jest.mock('@/scanner', () => ({
  ...jest.requireActual('@/scanner'),
  useGridDetector: jest.fn(() => undefined),
  createScanner: jest.fn(),
}))
jest.mock('@/scan/utils/photoImage.utils', () => ({ photoToSkImage: jest.fn() }))
jest.mock('@/scan/photoFile', () => ({
  saveUprightPhoto: jest.fn(async () => {
    mockFiles.add('/tmp/photo.jpg')
    return '/tmp/photo.jpg'
  }),
}))
jest.mock('@/scan/effects/components/EffectCanvas', () => ({ EffectCanvas: jest.fn(() => null) }))
jest.mock('@/scanShare/hooks/useScanShare', () => ({
  useScanShare: () => ({
    enqueueScan: jest.fn(async (photoPath: string | undefined) => {
      mockEvents.push(
        `enqueue ${photoPath} ${photoPath !== undefined && mockFiles.has(photoPath) ? 'present' : 'missing'}`,
      )
    }),
    discardPhoto: jest.fn((photoPath: string) => {
      mockEvents.push(`discard ${photoPath}`)
      mockFiles.delete(photoPath)
    }),
  }),
}))

const { solution } = generate('easy', 3)
// Every digit printed and right: the correction screen offers "Check the grid", then "Scan another".
const SOLVED: RecogniseResult = {
  ok: true,
  cells: solution.map((digit): CellResult => ({ digit, kind: 'printed', confidence: 1, validPair: true, second: 1 })),
  quad: [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.8 },
  ],
  corners: 'found',
  cornerOffset: null,
  timings: { imageMs: 1, detectMs: 1, flattenMs: 1, classifyMs: 1 },
}

const overlay = () => jest.mocked(EffectCanvas).mock.calls.at(-1)![0]
let frameTime = 0

function runFrames(seconds: number) {
  for (let i = 0; i <= Math.round(seconds * 60); i++) {
    overlay().session.stepClock(frameTime * 1000)
    frameTime += 1 / 60
  }
}

beforeEach(() => {
  mockFiles.clear()
  mockEvents.length = 0
  frameTime = 0
  jest.mocked(useReducedMotion).mockReturnValue(false)
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
  const photo = { width: 4224, height: 2376, orientation: 'right', dispose: jest.fn() }
  const { usePhotoOutput } = jest.requireMock<{ usePhotoOutput: jest.Mock }>('react-native-vision-camera')
  usePhotoOutput.mockReturnValue({ capturePhoto: jest.fn(async () => photo) })
  jest.mocked(createScanner).mockResolvedValue({ recognise: jest.fn(async () => SOLVED) } as never)
  jest.mocked(photoToSkImage).mockResolvedValue({ dispose: jest.fn() } as unknown as SkImage)
})

afterEach(() => jest.restoreAllMocks())

async function scanToSolved() {
  render(<ScanFlow />)
  fireEvent(screen.getByTestId('camera-screen'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 874 } },
  })
  const config = jest.mocked(useFrameOutput).mock.calls.at(-1)?.[0] as unknown as {
    onFrame: (frame: object) => void
  }
  config.onFrame({ timestamp: 1, width: 1920, height: 1080, orientation: 'right', dispose: jest.fn() })
  await act(async () => fireEvent.press(screen.getByTestId('shutter')))
  await act(async () => undefined)
  runFrames(3)
  await act(async () => undefined)
  fireEvent.press(screen.getByTestId('verify'))
}

it('queues the scan with its photo on Scan another, and deletes the photo only after that', async () => {
  await scanToSolved()
  expect(mockFiles.has(PHOTO)).toBe(true)
  await act(async () => fireEvent.press(screen.getByTestId('scan-another')))
  expect(mockEvents).toEqual([`enqueue ${PHOTO} present`])
  // A fresh camera screen follows.
  expect(screen.getByTestId('shutter')).toBeTruthy()
})

it('deletes the photo and queues nothing on Retake', async () => {
  await scanToSolved()
  await act(async () => fireEvent.press(screen.getByTestId('retake')))
  expect(mockEvents).toEqual([`discard ${PHOTO}`])
})
