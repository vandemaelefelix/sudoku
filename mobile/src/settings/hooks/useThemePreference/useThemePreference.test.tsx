import { act, renderHook } from '@testing-library/react-native'
import Storage from 'expo-sqlite/kv-store'
import type { ReactNode } from 'react'
import { Appearance } from 'react-native'
import { UnistylesRuntime } from 'react-native-unistyles'
import { INDICATOR_MS } from '@/settings/components/SegmentedControl'
import { APPEARANCE_PREFERENCE_KEY, THEME_PREFERENCE_KEY } from '@/theme/preference'
import { resetThemeSession } from '@/theme/session'
import { ThemeTransitionContext, type ThemeTarget } from '@/theme/transition/useThemeTransition'
import { useThemePreference } from './useThemePreference'

// The session choices are module values for the whole test file, so each test resets them and the saved values.
afterEach(async () => {
  resetThemeSession()
  await Storage.setItemAsync(THEME_PREFERENCE_KEY, 'cobalt')
  await Storage.setItemAsync(APPEARANCE_PREFERENCE_KEY, 'light')
  jest.restoreAllMocks()
})

it('applies the colourway at once and saves it', async () => {
  const setTheme = jest.spyOn(UnistylesRuntime, 'setTheme')
  const { result } = renderHook(() => useThemePreference())
  await act(async () => result.current.choose('forest'))
  expect(result.current.preference).toBe('forest')
  expect(setTheme).toHaveBeenCalledWith('forest')
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(THEME_PREFERENCE_KEY, 'forest')
})

it('applies the appearance at once and saves it under its own key', async () => {
  const setTheme = jest.spyOn(UnistylesRuntime, 'setTheme')
  const { result } = renderHook(() => useThemePreference())
  await act(async () => result.current.chooseAppearance('colour'))
  expect(result.current.appearance).toBe('colour')
  expect(setTheme).toHaveBeenCalledWith('cobalt-colour')
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(APPEARANCE_PREFERENCE_KEY, 'colour')
})

it('combines the two choices in either order', async () => {
  const setTheme = jest.spyOn(UnistylesRuntime, 'setTheme')
  const { result } = renderHook(() => useThemePreference())
  await act(async () => result.current.chooseAppearance('colour'))
  await act(async () => result.current.choose('bordeaux'))
  expect(setTheme).toHaveBeenLastCalledWith('bordeaux-colour')
  await act(async () => result.current.chooseAppearance('light'))
  expect(setTheme).toHaveBeenLastCalledWith('bordeaux')
})

it('keeps the choices for this session when the save fails', async () => {
  jest.mocked(Storage.setItemAsync).mockRejectedValueOnce(new Error('disk full'))
  const log = jest.spyOn(console, 'log').mockImplementation(() => {})
  const { result } = renderHook(() => useThemePreference())
  await act(async () => result.current.choose('forest'))
  expect(result.current.preference).toBe('forest')
  expect(log).toHaveBeenCalledWith('[theme] theme not saved: disk full')
})

it('keeps the choices after the screen closes when the save failed', async () => {
  jest.mocked(Storage.setItemAsync).mockRejectedValueOnce(new Error('disk full'))
  jest.mocked(Storage.setItemAsync).mockRejectedValueOnce(new Error('disk full'))
  const log = jest.spyOn(console, 'log').mockImplementation(() => {})
  const first = renderHook(() => useThemePreference())
  await act(async () => first.result.current.choose('forest'))
  await act(async () => first.result.current.chooseAppearance('colour'))
  first.unmount()
  const second = renderHook(() => useThemePreference())
  expect(second.result.current.preference).toBe('forest')
  expect(second.result.current.appearance).toBe('colour')
  expect(log).toHaveBeenCalledWith('[theme] appearance not saved: disk full')
})

describe('with the cell wave', () => {
  function wrapper({ children }: { children: ReactNode }) {
    return <ThemeTransitionContext value={{ start }}>{children}</ThemeTransitionContext>
  }
  const start = jest.fn<void, [ThemeTarget, () => void, number?]>()

  beforeEach(() => start.mockReset())

  it('hands the wave the combined theme and applies it only when the wave says so', async () => {
    const covers: (() => void)[] = []
    start.mockImplementation((_target, apply) => void covers.push(apply))
    const setTheme = jest.spyOn(UnistylesRuntime, 'setTheme')
    const { result } = renderHook(() => useThemePreference(), { wrapper })
    await act(async () => result.current.choose('bordeaux'))
    expect(start).toHaveBeenCalledWith({ name: 'bordeaux', appearance: 'light' }, expect.any(Function), INDICATOR_MS)
    expect(result.current.preference).toBe('bordeaux')
    expect(setTheme).not.toHaveBeenCalled()
    await act(async () => covers[0]?.())
    expect(setTheme).toHaveBeenCalledWith('bordeaux')
    expect(Storage.setItemAsync).toHaveBeenLastCalledWith(THEME_PREFERENCE_KEY, 'bordeaux')
  })

  it('plays the same wave when only the appearance changes, to the combined theme', async () => {
    const setTheme = jest.spyOn(UnistylesRuntime, 'setTheme')
    start.mockImplementation((_target, apply) => apply())
    const { result } = renderHook(() => useThemePreference(), { wrapper })
    await act(async () => result.current.choose('forest'))
    start.mockClear()
    await act(async () => result.current.chooseAppearance('colour'))
    expect(start).toHaveBeenCalledWith({ name: 'forest', appearance: 'colour' }, expect.any(Function), INDICATOR_MS)
    expect(setTheme).toHaveBeenLastCalledWith('forest-colour')
    expect(Storage.setItemAsync).toHaveBeenLastCalledWith(APPEARANCE_PREFERENCE_KEY, 'colour')
  })

  it('hands the wave nothing when the choice is the one already made', async () => {
    const { result } = renderHook(() => useThemePreference(), { wrapper })
    await act(async () => result.current.choose('cobalt'))
    await act(async () => result.current.chooseAppearance('light'))
    expect(start).not.toHaveBeenCalled()
  })

  describe('Auto', () => {
    it('resolves Auto with a dark system to the Colour theme', async () => {
      jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark')
      start.mockImplementation(() => undefined)
      const { result } = renderHook(() => useThemePreference(), { wrapper })
      await act(async () => result.current.chooseAppearance('auto'))
      expect(start).toHaveBeenCalledWith({ name: 'cobalt', appearance: 'colour' }, expect.any(Function), INDICATOR_MS)
      expect(result.current.appearance).toBe('auto')
    })

    it('hands Auto to Light to the wave as the same look while the system is light, and saves it', async () => {
      jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light')
      start.mockImplementation((_target, apply) => apply())
      const { result } = renderHook(() => useThemePreference(), { wrapper })
      await act(async () => result.current.chooseAppearance('auto'))
      await act(async () => result.current.chooseAppearance('light'))
      expect(start).toHaveBeenLastCalledWith(
        { name: 'cobalt', appearance: 'light' },
        expect.any(Function),
        INDICATOR_MS,
      )
      expect(Storage.setItemAsync).toHaveBeenLastCalledWith(APPEARANCE_PREFERENCE_KEY, 'light')
    })

    it('keeps Auto for a colourway change and applies the look of the system', async () => {
      jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark')
      const setTheme = jest.spyOn(UnistylesRuntime, 'setTheme')
      start.mockImplementation((_target, apply) => apply())
      const { result } = renderHook(() => useThemePreference(), { wrapper })
      await act(async () => result.current.chooseAppearance('auto'))
      await act(async () => result.current.choose('forest'))
      expect(start).toHaveBeenLastCalledWith(
        { name: 'forest', appearance: 'colour' },
        expect.any(Function),
        INDICATOR_MS,
      )
      expect(setTheme).toHaveBeenLastCalledWith('forest-colour')
    })
  })
})
