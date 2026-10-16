import { renderHook } from '@testing-library/react-native'
import Storage from 'expo-sqlite/kv-store'
import { APPEARANCE_PREFERENCE_KEY, THEME_PREFERENCE_KEY } from '@/theme/preference'
import { resetThemeSession } from '@/theme/session'
import { useThemePreference } from './useThemePreference'

// The session values outlive a test. This file never chooses, so the startup read stays clean.

afterEach(async () => {
  resetThemeSession()
  await Storage.setItemAsync(THEME_PREFERENCE_KEY, 'cobalt')
  await Storage.setItemAsync(APPEARANCE_PREFERENCE_KEY, 'light')
})

it('reads the saved colourway', async () => {
  await Storage.setItemAsync(THEME_PREFERENCE_KEY, 'forest')
  const { result } = renderHook(() => useThemePreference())
  expect(result.current.preference).toBe('forest')
})

it('reads the saved appearance, Auto included', async () => {
  await Storage.setItemAsync(APPEARANCE_PREFERENCE_KEY, 'auto')
  const { result } = renderHook(() => useThemePreference())
  expect(result.current.appearance).toBe('auto')
})

it('starts with Cobalt and Light when nothing is saved', async () => {
  await Storage.setItemAsync(THEME_PREFERENCE_KEY, '')
  await Storage.setItemAsync(APPEARANCE_PREFERENCE_KEY, '')
  const { result } = renderHook(() => useThemePreference())
  expect(result.current.preference).toBe('cobalt')
  expect(result.current.appearance).toBe('light')
})
