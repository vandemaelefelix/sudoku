import { act, renderHook } from '@testing-library/react-native'
import { useIncludeScanned } from './useIncludeScanned'

it('is off at first, and one switch serves every screen', async () => {
  const first = renderHook(() => useIncludeScanned())
  const second = renderHook(() => useIncludeScanned())
  expect(first.result.current.includeScanned).toBe(false)
  await act(async () => first.result.current.setIncludeScanned(true))
  expect(second.result.current.includeScanned).toBe(true)
  await act(async () => first.result.current.setIncludeScanned(false))
  expect(second.result.current.includeScanned).toBe(false)
})
