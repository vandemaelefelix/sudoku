import { act, renderHook, waitFor } from '@testing-library/react-native'
import { impactAsync } from 'expo-haptics'
import type { Photo } from 'react-native-vision-camera'
import { createScanner, type Quad, type RecogniseResult } from '../scanner'
import { formatScanLog, useCapture } from './useCapture'

jest.mock('../scanner', () => ({ ...jest.requireActual('../scanner'), createScanner: jest.fn() }))

const QUAD: Quad = [
  { x: 0.2, y: 0.3 },
  { x: 0.8, y: 0.3 },
  { x: 0.8, y: 0.65 },
  { x: 0.2, y: 0.65 },
]
const OK: RecogniseResult = {
  ok: true,
  cells: [],
  quad: QUAD,
  corners: 'redetected',
  cornerOffset: 0.012,
  timings: { imageMs: 80, detectMs: 15, flattenMs: 20, classifyMs: 60 },
}

function setup(result: RecogniseResult = OK) {
  const photo = { dispose: jest.fn() } as unknown as Photo
  const output = { capturePhoto: jest.fn(async () => photo) }
  const recognise = jest.fn(async () => result)
  jest.mocked(createScanner).mockResolvedValue({ recognise })
  const hook = renderHook(() => useCapture(output))
  return { hook, output, photo, recognise }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
})

it('plays the haptic, takes a photo and recognises it with the quad', async () => {
  const { hook, output, photo, recognise } = setup()
  await act(async () => hook.result.current.capture(QUAD))
  expect(impactAsync).toHaveBeenCalledTimes(1)
  expect(output.capturePhoto).toHaveBeenCalledTimes(1)
  expect(output.capturePhoto).toHaveBeenCalledWith({ enableShutterSound: false }, {})
  expect(recognise).toHaveBeenCalledWith(photo, QUAD)
  expect(photo.dispose).toHaveBeenCalledTimes(1)
  expect(hook.result.current.state).toEqual({ phase: 'result', result: OK })
})

it('shows the recognising phase while the scan runs', async () => {
  const { hook } = setup()
  act(() => hook.result.current.capture(QUAD))
  expect(hook.result.current.state).toEqual({ phase: 'recognising' })
  // The scan ends after the assertion. Wait for it, so no state update comes outside act.
  await waitFor(() => expect(hook.result.current.state.phase).toBe('result'))
})

it('takes one photo when capture comes twice', async () => {
  const { hook, output, photo, recognise } = setup()
  await act(async () => {
    hook.result.current.capture(QUAD)
    hook.result.current.capture(null)
  })
  expect(output.capturePhoto).toHaveBeenCalledTimes(1)
  expect(recognise).toHaveBeenCalledTimes(1)
  expect(photo.dispose).toHaveBeenCalledTimes(1)
})

it('ignores a capture that comes in a later tick while the scan runs', async () => {
  const { hook, output, recognise } = setup()
  const pending: { finish?: (result: RecogniseResult) => void } = {}
  recognise.mockImplementationOnce(() => new Promise<RecogniseResult>((resolve) => (pending.finish = resolve)))
  await act(async () => hook.result.current.capture(QUAD))
  expect(hook.result.current.state).toEqual({ phase: 'recognising' })
  await act(async () => hook.result.current.capture(null))
  await act(async () => pending.finish?.(OK))
  expect(output.capturePhoto).toHaveBeenCalledTimes(1)
  expect(recognise).toHaveBeenCalledTimes(1)
  expect(hook.result.current.state).toEqual({ phase: 'result', result: OK })
})

it('gives a failure with the reason when the photo fails', async () => {
  const { hook, output } = setup()
  output.capturePhoto.mockRejectedValueOnce(new Error('the camera is not ready'))
  await act(async () => hook.result.current.capture(QUAD))
  expect(hook.result.current.state).toEqual({ phase: 'result', result: { ok: false, reason: 'the camera is not ready' } })
})

it('gives a failure without a photo when the model did not load', async () => {
  const { hook, output } = setup()
  jest.mocked(createScanner).mockRejectedValue(new Error('the scanner does not implement model contract 2.0'))
  await act(async () => hook.result.current.capture(QUAD))
  expect(output.capturePhoto).not.toHaveBeenCalled()
  expect(hook.result.current.state).toMatchObject({ phase: 'result', result: { ok: false } })
})

it('goes back to live on retake, and captures again', async () => {
  const { hook, output } = setup()
  await act(async () => hook.result.current.capture(QUAD))
  act(() => hook.result.current.retake())
  expect(hook.result.current.state).toEqual({ phase: 'live' })
  await act(async () => hook.result.current.capture(QUAD))
  expect(output.capturePhoto).toHaveBeenCalledTimes(2)
})

it('keeps capture the same function across renders', () => {
  const { hook } = setup()
  const first = hook.result.current.capture
  hook.rerender({})
  expect(hook.result.current.capture).toBe(first)
})

describe('formatScanLog', () => {
  it('gives the time of each step', () => {
    expect(formatScanLog(120, 310, OK)).toBe(
      '[scan] photo 120 ms, image 80 ms, detect 15 ms (redetected, offset 1.2 %), flatten 20 ms, classify 60 ms, total 310 ms',
    )
  })

  it('gives the reason of a failure', () => {
    expect(formatScanLog(120, 200, { ok: false, reason: 'no grid in the photo' })).toBe(
      '[scan] failed after 200 ms: no grid in the photo',
    )
  })
})
