import { renderHook } from '@testing-library/react-native'
import Storage from 'expo-sqlite/kv-store'
import { THEME_PREFERENCE_KEY } from '@/theme/preference'
import { useThemePreference } from './useThemePreference'

// The session value outlives a test. This file never chooses, so the startup read stays clean.

afterEach(async () => {
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
