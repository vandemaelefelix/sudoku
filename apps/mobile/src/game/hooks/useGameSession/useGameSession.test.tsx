import { act, renderHook } from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'
import { sampleStart } from '@/game/utils/sample.utils'
import { useGameSession } from './useGameSession'

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it('plays a number through its actions and records the move', () => {
  const { result } = renderHook(() => useGameSession(sampleStart()))
  act(() => result.current.actions.select(2))
  act(() => result.current.actions.digit(4))
  expect(result.current.state.board.entries[2]).toBe(4)
  expect(result.current.state.move).toMatchObject({ kind: 'number' })
})

it('counts the time played while playing, and not while paused', () => {
  const { result } = renderHook(() => useGameSession(sampleStart()))
  act(() => jest.advanceTimersByTime(2000))
  expect(result.current.playedMs).toBe(2000)
  act(() => result.current.actions.pause())
  act(() => jest.advanceTimersByTime(5000))
  expect(result.current.playedMs).toBe(2000)
})

it('keeps the same state object on a clock tick', () => {
  const { result } = renderHook(() => useGameSession(sampleStart()))
  const before = result.current.state
  act(() => jest.advanceTimersByTime(3000))
  expect(result.current.playedMs).toBe(3000)
  expect(result.current.state).toBe(before)
})

it('keeps the same actions object between renders', () => {
  const { result, rerender } = renderHook(() => useGameSession(sampleStart()))
  const first = result.current.actions
  act(() => result.current.actions.select(2))
  rerender({})
  expect(result.current.actions).toBe(first)
})

function captureAppState() {
  const listener = { change: (_state: AppStateStatus) => undefined as void }
  const remove = jest.fn()
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    listener.change = handler as (state: AppStateStatus) => void
    return { remove }
  })
  return { listener, remove }
}

it.each<AppStateStatus>(['inactive', 'background'])('pauses the game when the app becomes %s', (state) => {
  const { listener } = captureAppState()
  const { result } = renderHook(() => useGameSession(sampleStart()))
  act(() => jest.advanceTimersByTime(2000))
  act(() => listener.change(state))
  expect(result.current.state.board.status).toBe('paused')
  act(() => jest.advanceTimersByTime(60_000))
  expect(result.current.playedMs).toBe(2000)
})

it('stays paused when the app comes back, until the player resumes', () => {
  const { listener } = captureAppState()
  const { result } = renderHook(() => useGameSession(sampleStart()))
  act(() => listener.change('background'))
  act(() => listener.change('active'))
  act(() => jest.advanceTimersByTime(5000))
  expect(result.current.state.board.status).toBe('paused')
  expect(result.current.playedMs).toBe(0)
  act(() => result.current.actions.resume())
  act(() => jest.advanceTimersByTime(1000))
  expect(result.current.playedMs).toBe(1000)
})

it('stops the AppState subscription on unmount', () => {
  const { remove } = captureAppState()
  const { unmount } = renderHook(() => useGameSession(sampleStart()))
  unmount()
  expect(remove).toHaveBeenCalledTimes(1)
})
