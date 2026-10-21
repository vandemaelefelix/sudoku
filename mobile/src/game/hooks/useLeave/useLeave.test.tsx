import { act, renderHook } from '@testing-library/react-native'
import { useSharedValue } from 'react-native-reanimated'
import { useLeave } from './useLeave'

function renderLeave() {
  return renderHook(() => {
    const rise = useSharedValue(0)
    return { rise, ...useLeave(rise) }
  })
}

// The sink calls back through a microtask, as on the device.
const sink = () => act(async () => jest.runAllTicks())

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('sinks the sheet, then calls next once', async () => {
  const { result } = renderLeave()
  const next = jest.fn()
  act(() => result.current.leaveThen(next))
  await sink()
  expect(result.current.rise.get()).toBe(1)
  expect(next).toHaveBeenCalledTimes(1)
})

it('a second tap does nothing, so it cannot start a second game', async () => {
  const { result } = renderLeave()
  const first = jest.fn()
  const second = jest.fn()
  act(() => {
    result.current.leaveThen(first)
    result.current.leaveThen(second)
  })
  await sink()
  expect(first).toHaveBeenCalledTimes(1)
  expect(second).not.toHaveBeenCalled()
})

it('guard calls next, unless a leave runs', async () => {
  const { result } = renderLeave()
  const before = jest.fn()
  const during = jest.fn()
  act(() => result.current.guard(before))
  expect(before).toHaveBeenCalledTimes(1)
  act(() => result.current.leaveThen(jest.fn()))
  act(() => result.current.guard(during))
  expect(during).not.toHaveBeenCalled()
})

it('rises again and takes taps again when next fails', async () => {
  const { result } = renderLeave()
  const failing = jest.fn(() => Promise.reject(new Error('does not start')))
  act(() => result.current.leaveThen(failing))
  await sink()
  await act(async () => undefined)
  expect(result.current.rise.get()).toBe(0)
  const again = jest.fn()
  act(() => result.current.leaveThen(again))
  await sink()
  expect(again).toHaveBeenCalledTimes(1)
})

it('stays down when next does not return a promise', async () => {
  const { result } = renderLeave()
  act(() => result.current.leaveThen(jest.fn()))
  await sink()
  await act(async () => undefined)
  expect(result.current.rise.get()).toBe(1)
  const again = jest.fn()
  act(() => result.current.leaveThen(again))
  await sink()
  expect(again).not.toHaveBeenCalled()
})
