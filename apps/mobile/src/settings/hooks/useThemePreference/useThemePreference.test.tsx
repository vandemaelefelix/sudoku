import { act, renderHook } from '@testing-library/react-native'
import Storage from 'expo-sqlite/kv-store'
import { UnistylesRuntime } from 'react-native-unistyles'
import { THEME_PREFERENCE_KEY } from '@/theme/preference'
import { useThemePreference } from './useThemePreference'

// The session choice is one module value for the whole test file, so each test resets it.
// It starts empty, so the test that reads the saved choice must run first.
afterEach(async () => {
  const { result, unmount } = renderHook(() => useThemePreference())
  await act(async () => result.current.choose('system'))
  unmount()
  await Storage.setItemAsync(THEME_PREFERENCE_KEY, 'system')
})

it('reads the saved choice', async () => {
  await Storage.setItemAsync(THEME_PREFERENCE_KEY, 'daylight')
  const { result } = renderHook(() => useThemePreference())
  expect(result.current.preference).toBe('daylight')
})

it('starts with system when nothing is saved', () => {
  const { result } = renderHook(() => useThemePreference())
  expect(result.current.preference).toBe('system')
})

it('applies the choice at once and saves it', async () => {
  const setTheme = jest.spyOn(UnistylesRuntime, 'setTheme')
  const { result } = renderHook(() => useThemePreference())
  await act(async () => result.current.choose('midnight'))
  expect(result.current.preference).toBe('midnight')
  expect(setTheme).toHaveBeenCalledWith('dark')
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(THEME_PREFERENCE_KEY, 'midnight')
  setTheme.mockRestore()
})

it('keeps the choice for this session when the save fails', async () => {
  jest.mocked(Storage.setItemAsync).mockRejectedValueOnce(new Error('disk full'))
  const log = jest.spyOn(console, 'log').mockImplementation(() => {})
  const { result } = renderHook(() => useThemePreference())
  await act(async () => result.current.choose('daylight'))
  expect(result.current.preference).toBe('daylight')
  expect(log).toHaveBeenCalledWith('[theme] theme not saved: disk full')
  log.mockRestore()
})

it('keeps the choice after the screen closes when the save failed', async () => {
  jest.mocked(Storage.setItemAsync).mockRejectedValueOnce(new Error('disk full'))
  const log = jest.spyOn(console, 'log').mockImplementation(() => {})
  const first = renderHook(() => useThemePreference())
  await act(async () => first.result.current.choose('midnight'))
  first.unmount()
  const second = renderHook(() => useThemePreference())
  expect(second.result.current.preference).toBe('midnight')
  log.mockRestore()
})
