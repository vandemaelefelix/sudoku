import { renderHook } from '@testing-library/react-native'
import { useThemeTransition } from './useThemeTransition'

it('switches at once and accepts the switch without a provider', () => {
  const { result } = renderHook(() => useThemeTransition())
  const apply = jest.fn()
  expect(result.current.start({ name: 'cobalt', appearance: 'light' }, apply)).toBe(true)
  expect(apply).toHaveBeenCalledTimes(1)
})
