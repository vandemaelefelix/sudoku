import { act, renderHook } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { useSystemReduceMotion } from './useSystemReduceMotion'

const system = { enabled: false, change: (_enabled: boolean) => {} }

beforeEach(() => {
  system.enabled = false
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(async () => system.enabled)
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, handler) => {
    system.change = handler as unknown as (enabled: boolean) => void
    return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.mocked(useReducedMotion).mockReturnValue(false)
})

it('starts from the value of Reanimated', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const { result } = renderHook(() => useSystemReduceMotion())
  expect(result.current.current).toBe(true)
})

it('takes the value of the system when it answers', async () => {
  system.enabled = true
  const { result } = renderHook(() => useSystemReduceMotion())
  await act(async () => undefined)
  expect(result.current.current).toBe(true)
})

it('follows a live change, and calls onEnable only when the setting turns on', () => {
  const onEnable = jest.fn()
  const { result } = renderHook(() => useSystemReduceMotion(onEnable))
  act(() => system.change(true))
  expect(result.current.current).toBe(true)
  expect(onEnable).toHaveBeenCalledTimes(1)
  act(() => system.change(false))
  expect(result.current.current).toBe(false)
  expect(onEnable).toHaveBeenCalledTimes(1)
})
