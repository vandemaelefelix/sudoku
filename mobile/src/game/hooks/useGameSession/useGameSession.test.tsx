import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import type { Game } from '@sudoku/core'
import { sampleStart } from '@/game/utils/sample.utils'
import { GameSaveContext, useGameSession } from './useGameSession'

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

function captureAppState() {
  const listeners: ((state: AppStateStatus) => void)[] = []
  const remove = jest.fn()
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    listeners.push(handler as (state: AppStateStatus) => void)
    return { remove }
  })
  return { listeners, remove }
}

it('shows the time played and the board to its readers', () => {
  const { result } = renderHook(() => useGameSession(sampleStart()))
  act(() => result.current.actions.select(2))
  act(() => result.current.actions.digit(4))
  act(() => jest.advanceTimersByTime(2000))
  expect(result.current.state.board.entries[2]).toBe(4)
  expect(result.current.state.move).toMatchObject({ kind: 'number' })
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

it.each<AppStateStatus>(['inactive', 'background'])('pauses the game when the app becomes %s', (state) => {
  const { listeners } = captureAppState()
  const { result } = renderHook(() => useGameSession(sampleStart()))
  act(() => jest.advanceTimersByTime(2000))
  act(() => listeners.forEach((listener) => listener(state)))
  expect(result.current.state.board.status).toBe('paused')
  act(() => jest.advanceTimersByTime(60_000))
  expect(result.current.playedMs).toBe(2000)
})

it('keeps the game paused when the app comes back, until the player resumes', () => {
  const { listeners } = captureAppState()
  const { result } = renderHook(() => useGameSession(sampleStart()))
  act(() => listeners.forEach((listener) => listener('background')))
  act(() => listeners.forEach((listener) => listener('active')))
  act(() => jest.advanceTimersByTime(5000))
  expect(result.current.state.board.status).toBe('paused')
  act(() => result.current.actions.resume())
  act(() => jest.advanceTimersByTime(1000))
  expect(result.current.playedMs).toBe(1000)
})

it('adds one AppState listener, and removes it on unmount', () => {
  const { listeners, remove } = captureAppState()
  const { unmount } = renderHook(() => useGameSession(sampleStart()), {
    wrapper: ({ children }: { children: ReactNode }) => <GameSaveContext value={jest.fn()}>{children}</GameSaveContext>,
  })
  expect(listeners).toHaveLength(1)
  unmount()
  expect(remove).toHaveBeenCalledTimes(1)
})

function setup() {
  const save = jest.fn<void, [Game]>()
  const wrapper = ({ children }: { children: ReactNode }) => <GameSaveContext value={save}>{children}</GameSaveContext>
  return { save, ...renderHook(() => useGameSession(sampleStart()), { wrapper }) }
}

describe('with a save from the play screen', () => {
  it('saves the game after a move, and not after a selection or a tick', () => {
    const { save, result } = setup()
    act(() => result.current.actions.select(2))
    act(() => jest.advanceTimersByTime(2000))
    expect(save).not.toHaveBeenCalled()
    act(() => result.current.actions.digit(4))
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('saves the time played when the screen closes', () => {
    const { save, unmount } = setup()
    act(() => jest.advanceTimersByTime(7000))
    unmount()
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ playedMs: 7000 }))
  })

  it('saves the paused game with the exact time played, once, when the app leaves the foreground', () => {
    const { listeners } = captureAppState()
    const { save } = setup()
    act(() => jest.advanceTimersByTime(2500))
    act(() => listeners.forEach((listener) => listener('background')))
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'paused', playedMs: 2500 }))
  })
})
