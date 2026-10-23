import { renderHook, waitFor } from '@testing-library/react-native'
import { GATE_PHOTO, GATE_RESULTS, SPINNER_DELAY, TRANSITION_END } from '@/scan/constants/transition.constants'
import { transitionAt } from '@/scan/utils/transition.utils'
import type { Quad } from '@/utils/geometry.utils'
import { useTransitionClock } from './useTransitionClock'

const GRID = { x: 20, y: 100, width: 360, height: 360 }
const LOCKED: Quad = [
  { x: 60, y: 200 },
  { x: 300, y: 210 },
  { x: 310, y: 420 },
  { x: 50, y: 400 },
]

type Input = Parameters<typeof useTransitionClock>[0]
const input = (over: Partial<Input> = {}): Input => ({
  started: true,
  crossFade: false,
  lockedView: LOCKED,
  grid: GRID,
  gates: { photo: true, results: true },
  onEnd: jest.fn(),
  ...over,
})

let frameTime = 0
beforeEach(() => {
  frameTime = 0
})

/** Runs UI frames of 1/60 s for the given seconds. */
function runFrames(step: (timestamp: number) => void, seconds: number) {
  for (let i = 0; i <= Math.round(seconds * 60); i++) {
    step(frameTime * 1000)
    frameTime += 1 / 60
  }
}

function clockOf(start: Input) {
  return renderHook((props: Input) => useTransitionClock(props), { initialProps: start })
}

describe('before the start', () => {
  it('does nothing without a plan, so no frame shows and the clock stays at 0', () => {
    const { result } = clockOf(input({ started: false }))
    runFrames(result.current.stepClock, 0.5)
    expect(result.current.clock.value).toBe(0)
    expect(result.current.captureFrame.value).toBeNull()
    expect(result.current.resultsAt.value).toBe(-1)
  })
})

describe('the clock', () => {
  it('runs to the end, writes the frame of each step and calls onEnd once', async () => {
    const start = input()
    const { result } = clockOf(start)
    runFrames(result.current.stepClock, TRANSITION_END + 0.5)
    expect(result.current.clock.value).toBeGreaterThanOrEqual(TRANSITION_END)
    const frame = result.current.captureFrame.value!
    expect(frame.crossFade).toBe(false)
    expect(frame.channels).toEqual(transitionAt(result.current.clock.value, false, 0))
    await waitFor(() => expect(start.onEnd).toHaveBeenCalledTimes(1))
    runFrames(result.current.stepClock, 0.5)
    expect(start.onEnd).toHaveBeenCalledTimes(1)
  })

  it('ends on the grid square of the screen', () => {
    const { result } = clockOf(input())
    runFrames(result.current.stepClock, TRANSITION_END + 0.5)
    const { grid } = result.current.captureFrame.value!
    expect(grid[0]).toEqual({ x: GRID.x, y: GRID.y })
    expect(grid[2]).toEqual({ x: GRID.x + GRID.width, y: GRID.y + GRID.height })
  })

  it('holds at the photo gate until the photo is ready', () => {
    const { result, rerender } = clockOf(input({ gates: { photo: false, results: true } }))
    runFrames(result.current.stepClock, 1)
    expect(result.current.clock.value).toBe(GATE_PHOTO)
    rerender(input({ gates: { photo: true, results: true } }))
    runFrames(result.current.stepClock, 0.3)
    expect(result.current.clock.value).toBeGreaterThan(GATE_PHOTO)
  })

  it('holds at the results gate, shows the spinner after SPINNER_DELAY and never calls onEnd', async () => {
    const start = input({ gates: { photo: true, results: false } })
    const { result } = clockOf(start)
    runFrames(result.current.stepClock, GATE_RESULTS + 0.5)
    expect(result.current.clock.value).toBe(GATE_RESULTS)
    expect(result.current.waiting.value).toBe(false)
    runFrames(result.current.stepClock, SPINNER_DELAY + 0.2)
    expect(result.current.waiting.value).toBe(true)
    expect(result.current.resultsAt.value).toBe(-1)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(start.onEnd).not.toHaveBeenCalled()
  })

  it('writes resultsAt once, when the results gate opens, and hides the spinner', () => {
    const { result, rerender } = clockOf(input({ gates: { photo: true, results: false } }))
    runFrames(result.current.stepClock, GATE_RESULTS + SPINNER_DELAY + 0.2)
    expect(result.current.waiting.value).toBe(true)
    rerender(input({ gates: { photo: true, results: true } }))
    runFrames(result.current.stepClock, 0.1)
    const at = result.current.resultsAt.value
    expect(at).toBeGreaterThanOrEqual(GATE_RESULTS)
    expect(result.current.waiting.value).toBe(false)
    runFrames(result.current.stepClock, 0.5)
    expect(result.current.resultsAt.value).toBe(at)
  })

  it('publishes the frame again when a new plan comes while the clock holds', () => {
    const { result, rerender } = clockOf(input({ gates: { photo: true, results: false } }))
    runFrames(result.current.stepClock, GATE_RESULTS + 0.3)
    const held = result.current.captureFrame.value!
    expect(held.crossFade).toBe(false)
    rerender(input({ gates: { photo: true, results: false }, crossFade: true }))
    runFrames(result.current.stepClock, 0.1)
    expect(result.current.captureFrame.value).not.toBe(held)
    expect(result.current.captureFrame.value!.crossFade).toBe(true)
  })

  it('uses the grid square as the start when no grid is locked', () => {
    const { result } = clockOf(input({ lockedView: null, crossFade: true }))
    runFrames(result.current.stepClock, 0.1)
    const { quad, grid } = result.current.captureFrame.value!
    expect(quad).toEqual(grid)
  })
})
