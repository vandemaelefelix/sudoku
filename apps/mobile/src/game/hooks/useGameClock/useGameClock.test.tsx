import { renderHook } from '@testing-library/react-native'
import { useGameClock } from './useGameClock'
import { MAX_ELAPSED_MS } from './useGameClock.constants'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('reports the elapsed time once a second while running', () => {
  const onElapsed = jest.fn()
  renderHook(() => useGameClock(true, onElapsed))
  jest.advanceTimersByTime(3000)
  expect(onElapsed).toHaveBeenCalledTimes(3)
  expect(onElapsed).toHaveBeenLastCalledWith(1000)
})

it('stops when it no longer runs', () => {
  const onElapsed = jest.fn()
  const { rerender } = renderHook(({ running }: { running: boolean }) => useGameClock(running, onElapsed), {
    initialProps: { running: true },
  })
  jest.advanceTimersByTime(1000)
  rerender({ running: false })
  jest.advanceTimersByTime(5000)
  expect(onElapsed).toHaveBeenCalledTimes(1)
})

it('counts at most MAX_ELAPSED_MS for one report that comes late', () => {
  const onElapsed = jest.fn()
  renderHook(() => useGameClock(true, onElapsed))
  // The system clock jumps as it does when iOS suspends JavaScript in the background.
  jest.setSystemTime(Date.now() + 60_000)
  jest.advanceTimersByTime(1000)
  expect(onElapsed).toHaveBeenCalledTimes(1)
  expect(onElapsed).toHaveBeenLastCalledWith(MAX_ELAPSED_MS)
})
