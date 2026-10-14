import { renderHook } from '@testing-library/react-native'
import { useEased } from './useEased'

// The Reanimated mock applies a timing at once, so the value shows the end of each change.
it('starts at the target and follows each change', () => {
  const { result, rerender } = renderHook(({ target }: { target: number }) => useEased(target), {
    initialProps: { target: 0.3 },
  })
  expect(result.current.get()).toBe(0.3)
  rerender({ target: 1 })
  expect(result.current.get()).toBe(1)
})
