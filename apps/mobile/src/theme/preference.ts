import { UnistylesRuntime } from 'react-native-unistyles'
import type { SettingsRepository } from '@/settings/SettingsRepository'
import { devLog, errorMessage } from '@/utils/log.utils'

export type ThemePreference = 'system' | 'daylight' | 'midnight'

export const THEME_PREFERENCE_KEY = 'theme.preference'

/** The Unistyles name of each theme. Adaptive themes need the names light and dark. */
const UNISTYLES_NAME = { daylight: 'light', midnight: 'dark' } as const

export type StartupSettings = { adaptiveThemes: true } | { initialTheme: 'light' | 'dark' }

export type ThemeRuntime = { setAdaptiveThemes(on: boolean): void; setTheme(name: 'light' | 'dark'): void }

export function parseThemePreference(value: string | null): ThemePreference {
  return value === 'daylight' || value === 'midnight' ? value : 'system'
}

/** Unistyles refuses adaptiveThemes together with initialTheme, so a saved theme turns adaptive themes off. */
export function startupSettings(preference: ThemePreference): StartupSettings {
  return preference === 'system' ? { adaptiveThemes: true } : { initialTheme: UNISTYLES_NAME[preference] }
}

export function applyThemePreference(preference: ThemePreference, runtime: ThemeRuntime): void {
  if (preference === 'system') {
    runtime.setAdaptiveThemes(true)
    return
  }
  runtime.setAdaptiveThemes(false)
  runtime.setTheme(UNISTYLES_NAME[preference])
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
