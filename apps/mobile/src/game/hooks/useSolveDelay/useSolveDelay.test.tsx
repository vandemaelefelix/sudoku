import { act, renderHook } from '@testing-library/react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { pulseLook, solvePulseDuration } from '@/game/utils/pulse.utils'
import { daylight } from '@/theme/themes/daylight'
import { useSolveDelay } from './useSolveDelay'

const SOLVE_MS = solvePulseDuration(pulseLook(daylight))

beforeEach(() => jest.useFakeTimers())

afterEach(() => {
  jest.useRealTimers()
  jest.mocked(useReducedMotion).mockReturnValue(false)
})

it('stays false while the game is not won', () => {
  const { result } = renderHook(() => useSolveDelay(false))
  act(() => jest.advanceTimersByTime(SOLVE_MS * 2))
  expect(result.current).toBe(false)
})

it('turns true when the solve pulse ends', () => {
  const { result } = renderHook(() => useSolveDelay(true))
  act(() => jest.advanceTimersByTime(SOLVE_MS - 1))
  expect(result.current).toBe(false)
  act(() => jest.advanceTimersByTime(1))
  expect(result.current).toBe(true)
})

it('turns true at once with Reduce Motion on', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const { result } = renderHook(() => useSolveDelay(true))
  expect(result.current).toBe(true)
})
