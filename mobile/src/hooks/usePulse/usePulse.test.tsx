import { act, renderHook } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import type { Digit } from '@sudoku/core'
import { NO_PULSE } from '@/constants/pulse.constants'
import { pulseLook } from '@/utils/pulse.utils'
import { sampleStart } from '@/game/utils/sample.utils'
import { reduceSession, startSession, type Session } from '@/game/utils/session.utils'
import { cobalt } from '@/theme/themes/cobalt'
import { usePulse } from './usePulse'

const look = pulseLook(cobalt)
const STEP = look.stepMs

// Row 0 of the canvas puzzle lacks only cell 2. Its solution is 4.
function rowAlmostDone(): Session {
  const sample = sampleStart()
  const entries = sample.solution.map((value, cell) =>
    cell < 9 && cell !== 2 && sample.givens[cell] === 0 ? value : 0,
  )
  return startSession({ ...sample, entries })
}

function play(session: Session, cell: number, digit: Digit): Session {
  return [{ type: 'select', cell } as const, { type: 'digit', digit } as const].reduce(reduceSession, session)
}

const renderPulse = (session: Session) =>
  renderHook(({ s }: { s: Session }) => usePulse(s.board, s.move), { initialProps: { s: session } })

const isStill = (delays: readonly number[]) => delays.every((delay) => delay === NO_PULSE)

const reduceMotion = { enabledNow: false, onChange: (_enabled: boolean) => {} }

beforeEach(() => {
  reduceMotion.enabledNow = false
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(async () => reduceMotion.enabledNow)
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, handler) => {
    reduceMotion.onChange = handler as unknown as (enabled: boolean) => void
    return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.mocked(useReducedMotion).mockReturnValue(false)
})

it('pulses the completed row out from the cell, and runs the time to the end', () => {
  const before = rowAlmostDone()
  const { result, rerender } = renderPulse(before)
  rerender({ s: play(before, 2, 4) })
  const delays = result.current.delays.get()
  expect(delays.slice(0, 9)).toEqual([2, 1, 0, 1, 2, 3, 4, 5, 6].map((steps) => steps * STEP))
  expect(isStill(delays.slice(9))).toBe(true)
  // The Reanimated mock of withTiming returns the end value at once.
  expect(result.current.elapsed.get()).toBe(6 * STEP + look.waveMs)
})

it('reads the look of the pulse from the theme in use', () => {
  const before = rowAlmostDone()
  const { result, rerender } = renderPulse(before)
  rerender({ s: play(before, 2, 4) })
  expect(result.current.look.get()).toEqual(look)
})

it('does not run the pulse again on a select', () => {
  const before = rowAlmostDone()
  const after = play(before, 2, 4)
  const { result, rerender } = renderPulse(before)
  rerender({ s: after })
  result.current.elapsed.set(0)
  rerender({ s: reduceSession(after, { type: 'select', cell: 40 }) })
  expect(result.current.elapsed.get()).toBe(0)
})

it('does not replay the last move on mount', () => {
  const { result } = renderPulse(play(rowAlmostDone(), 2, 4))
  expect(isStill(result.current.delays.get())).toBe(true)
  expect(result.current.elapsed.get()).toBe(0)
})

it('starts no pulse for a move that completes nothing', () => {
  const before = startSession(sampleStart())
  const { result, rerender } = renderPulse(before)
  rerender({ s: play(before, 2, 4) })
  expect(result.current.elapsed.get()).toBe(0)
})

it('starts no pulse with Reduce Motion on at app start', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  reduceMotion.enabledNow = true
  const before = rowAlmostDone()
  const { result, rerender } = renderPulse(before)
  rerender({ s: play(before, 2, 4) })
  expect(isStill(result.current.delays.get())).toBe(true)
  expect(result.current.elapsed.get()).toBe(0)
})

it('starts no pulse after Reduce Motion is turned on while the app runs', () => {
  const before = rowAlmostDone()
  const { result, rerender } = renderPulse(before)
  act(() => reduceMotion.onChange(true))
  rerender({ s: play(before, 2, 4) })
  expect(isStill(result.current.delays.get())).toBe(true)
  expect(result.current.elapsed.get()).toBe(0)
})

it('stops a running pulse when Reduce Motion is turned on', () => {
  const before = rowAlmostDone()
  const { result, rerender } = renderPulse(before)
  rerender({ s: play(before, 2, 4) })
  act(() => reduceMotion.onChange(true))
  expect(isStill(result.current.delays.get())).toBe(true)
})

it('pulses again after Reduce Motion is turned off while the app runs', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const before = rowAlmostDone()
  const { result, rerender } = renderPulse(before)
  act(() => reduceMotion.onChange(false))
  rerender({ s: play(before, 2, 4) })
  expect(result.current.elapsed.get()).toBe(6 * STEP + look.waveMs)
})

it('follows the setting that the system reports after the start', async () => {
  reduceMotion.enabledNow = true
  const before = rowAlmostDone()
  const { result, rerender } = renderPulse(before)
  await act(async () => undefined)
  rerender({ s: play(before, 2, 4) })
  expect(result.current.elapsed.get()).toBe(0)
})

it('keeps the same pulse object between renders', () => {
  const before = rowAlmostDone()
  const { result, rerender } = renderPulse(before)
  const first = result.current
  rerender({ s: play(before, 2, 4) })
  expect(result.current).toBe(first)
})
