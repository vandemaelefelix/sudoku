import { act, renderHook } from '@testing-library/react-native'
import { sampleStart } from '@/game/utils/sample.utils'
import { useGameSession } from './useGameSession'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('plays a number through its actions and updates the views', () => {
  const { result } = renderHook(() => useGameSession(sampleStart()))
  act(() => result.current.actions.select(2))
  act(() => result.current.actions.digit(4))
  expect(result.current.views[2]).toMatchObject({ digit: 4, digitStyle: 'entry', fill: 'selected' })
  expect(result.current.move).toMatchObject({ kind: 'number' })
})

it('counts the time played while playing, and not while paused', () => {
  const { result } = renderHook(() => useGameSession(sampleStart()))
  act(() => jest.advanceTimersByTime(2000))
  expect(result.current.game.playedMs).toBe(2000)
  act(() => result.current.actions.pause())
  act(() => jest.advanceTimersByTime(5000))
  expect(result.current.game.playedMs).toBe(2000)
})

it('keeps the same actions object between renders', () => {
  const { result, rerender } = renderHook(() => useGameSession(sampleStart()))
  const first = result.current.actions
  rerender({})
  expect(result.current.actions).toBe(first)
})
