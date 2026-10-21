import { renderHook } from '@testing-library/react-native'
import { useThemeTransition } from './useThemeTransition'

it('switches at once without a provider', () => {
  const { result } = renderHook(() => useThemeTransition())
  const apply = jest.fn()
  result.current.start({ name: 'cobalt', appearance: 'light' }, apply)
  expect(apply).toHaveBeenCalledTimes(1)
})
