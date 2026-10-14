import { act, renderHook } from '@testing-library/react-native'
import { useHold } from './useHold'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('turns true only after on has held for the time', () => {
  const { result, rerender } = renderHook(({ on }: { on: boolean }) => useHold(on, 400), {
    initialProps: { on: false },
  })
  rerender({ on: true })
  act(() => jest.advanceTimersByTime(399))
  expect(result.current).toBe(false)
  act(() => jest.advanceTimersByTime(1))
  expect(result.current).toBe(true)
})

it('is false while on is false', () => {
  const { result, rerender } = renderHook(({ on }: { on: boolean }) => useHold(on, 400), { initialProps: { on: true } })
  act(() => jest.advanceTimersByTime(400))
  rerender({ on: false })
  expect(result.current).toBe(false)
})
