import { renderHook } from '@testing-library/react-native'
import { useReducedMotion } from 'react-native-reanimated'
import type { Digit } from '@sudoku/core'
import { NO_PULSE, PULSE_STEP_MS, WAVE_MS } from '@/game/constants/pulse.constants'
import { sampleStart } from '@/game/utils/sample.utils'
import { reduceSession, startSession, type Session } from '@/game/utils/session.utils'
import { usePulse } from './usePulse'

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

afterEach(() => jest.mocked(useReducedMotion).mockReturnValue(false))

it('pulses the completed row out from the cell, and runs the time to the end', () => {
  const before = rowAlmostDone()
  const { result, rerender } = renderPulse(before)
  rerender({ s: play(before, 2, 4) })
  const delays = result.current.delays.get()
  expect(delays.slice(0, 9)).toEqual([2, 1, 0, 1, 2, 3, 4, 5, 6].map((steps) => steps * PULSE_STEP_MS))
  expect(delays.slice(9).every((delay) => delay === NO_PULSE)).toBe(true)
  // The Reanimated mock of withTiming returns the end value at once.
  expect(result.current.elapsed.get()).toBe(6 * PULSE_STEP_MS + WAVE_MS)
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
  expect(result.current.delays.get().every((delay) => delay === NO_PULSE)).toBe(true)
  expect(result.current.elapsed.get()).toBe(0)
})

it('starts no pulse for a move that completes nothing', () => {
  const before = startSession(sampleStart())
  const { result, rerender } = renderPulse(before)
  rerender({ s: play(before, 2, 4) })
  expect(result.current.elapsed.get()).toBe(0)
})

it('starts no pulse with Reduce Motion', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const before = rowAlmostDone()
  const { result, rerender } = renderPulse(before)
  rerender({ s: play(before, 2, 4) })
  expect(result.current.delays.get().every((delay) => delay === NO_PULSE)).toBe(true)
  expect(result.current.elapsed.get()).toBe(0)
})

it('keeps the same pulse object between renders', () => {
  const before = rowAlmostDone()
  const { result, rerender } = renderPulse(before)
  const first = result.current
  rerender({ s: play(before, 2, 4) })
  expect(result.current).toBe(first)
})
