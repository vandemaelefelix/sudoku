import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native'
import { createGame, place, select, type Game } from '@sudoku/core'
import { sampleStart } from '@/game/utils/sample.utils'
import { GameSaveContext, useGameSaver } from './useGameSaver'

type Props = { board: Game; playedMs: number }

let listeners: ((state: AppStateStatus) => void)[] = []

beforeEach(() => {
  listeners = []
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener)
    return { remove: jest.fn() } as NativeEventSubscription
  })
})

afterEach(() => jest.restoreAllMocks())

function setup() {
  const save = jest.fn<void, [Game]>()
  const board = createGame(sampleStart())
  const wrapper = ({ children }: { children: ReactNode }) => <GameSaveContext value={save}>{children}</GameSaveContext>
  const hook = renderHook(({ board: current, playedMs }: Props) => useGameSaver(current, playedMs), {
    wrapper,
    initialProps: { board, playedMs: 0 },
  })
  return { save, board, hook }
}

const sendAppState = (state: AppStateStatus) => act(() => listeners.forEach((listener) => listener(state)))

it('does not save the board it starts with', () => {
  const { save } = setup()
  expect(save).not.toHaveBeenCalled()
})

it('saves the board after a move', () => {
  const { save, board, hook } = setup()
  // Cell 2 is empty in the canvas puzzle. Its solution is 4.
  const next = place(select(board, 2), 4).game
  hook.rerender({ board: next, playedMs: 0 })
  expect(save).toHaveBeenCalledTimes(1)
  expect(save).toHaveBeenLastCalledWith(next)
})

it('selecting a cell never saves', () => {
  const { save, board, hook } = setup()
  hook.rerender({ board: select(board, 2), playedMs: 0 })
  hook.rerender({ board: select(select(board, 2), 40), playedMs: 0 })
  expect(save).not.toHaveBeenCalled()
})

it('does not save on a clock tick', () => {
  const { save, board, hook } = setup()
  hook.rerender({ board, playedMs: 1000 })
  expect(save).not.toHaveBeenCalled()
})

it('saves the time played and the selection when the app leaves the foreground', () => {
  const { save, board, hook } = setup()
  const selected = select(board, 2)
  hook.rerender({ board: selected, playedMs: 5000 })
  sendAppState('background')
  expect(save).toHaveBeenLastCalledWith({ ...selected, playedMs: 5000 })
})

it('saves nothing when the app comes back to the foreground', () => {
  const { save } = setup()
  sendAppState('active')
  expect(save).not.toHaveBeenCalled()
})

it('saves the time played when the game screen closes', () => {
  const { save, board, hook } = setup()
  hook.rerender({ board, playedMs: 7000 })
  hook.unmount()
  expect(save).toHaveBeenLastCalledWith({ ...board, playedMs: 7000 })
})

it('saves nothing without a save context', () => {
  const board = createGame(sampleStart())
  const hook = renderHook(({ board: current, playedMs }: Props) => useGameSaver(current, playedMs), {
    initialProps: { board, playedMs: 0 },
  })
  expect(() => hook.unmount()).not.toThrow()
  expect(listeners).toHaveLength(0)
})
