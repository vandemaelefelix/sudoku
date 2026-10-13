import { UnistylesRuntime } from 'react-native-unistyles'
import type { SettingsRepository } from '@/settings/SettingsRepository'
import type { ThemeName } from '@/theme/theme.types'
import { THEMES } from '@/theme/themes/registry'
import { devLog, errorMessage } from '@/utils/log.utils'

export type ThemePreference = 'system' | ThemeName

export const THEME_PREFERENCE_KEY = 'theme.preference'

/** The Unistyles name of a theme. Adaptive themes need the names light and dark, so Daylight and Midnight take them. */
export type UnistylesName<N extends ThemeName = ThemeName> = N extends 'daylight'
  ? 'light'
  : N extends 'midnight'
    ? 'dark'
    : N

export function unistylesName<N extends ThemeName>(name: N): UnistylesName<N> {
  const adaptive: Partial<Record<ThemeName, string>> = { daylight: 'light', midnight: 'dark' }
  return (adaptive[name] ?? name) as UnistylesName<N>
}

export type StartupSettings = { adaptiveThemes: true } | { initialTheme: UnistylesName }

export type ThemeRuntime = { setAdaptiveThemes(on: boolean): void; setTheme(name: UnistylesName): void }

function isThemeName(value: string): value is ThemeName {
  return Object.hasOwn(THEMES, value)
}

export function parseThemePreference(value: string | null): ThemePreference {
  return value != null && isThemeName(value) ? value : 'system'
}

/** Unistyles refuses adaptiveThemes together with initialTheme, so a saved theme turns adaptive themes off. */
export function startupSettings(preference: ThemePreference): StartupSettings {
  return preference === 'system' ? { adaptiveThemes: true } : { initialTheme: unistylesName(preference) }
}

export function applyThemePreference(preference: ThemePreference, runtime: ThemeRuntime): void {
  if (preference === 'system') {
    runtime.setAdaptiveThemes(true)
    return
  }
  runtime.setAdaptiveThemes(false)
  runtime.setTheme(unistylesName(preference))
}

/** Synchronous, so the first frame already has the saved theme. A store that throws gives system: the app must still start. */
export function readThemePreference(settings: SettingsRepository): ThemePreference {
  try {
    return parseThemePreference(settings.getSync(THEME_PREFERENCE_KEY))
  } catch (error) {
    devLog('theme', `saved theme unreadable: ${errorMessage(error)}`)
    return 'system'
  }
}

export async function saveThemePreference(
  settings: SettingsRepository,
  preference: ThemePreference,
  runtime: ThemeRuntime = UnistylesRuntime,
): Promise<void> {
  applyThemePreference(preference, runtime)
  await settings.set(THEME_PREFERENCE_KEY, preference)
}
