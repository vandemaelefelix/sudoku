import type { ColorSchemeName } from 'react-native'
import { UnistylesRuntime } from 'react-native-unistyles'
import type { SettingsRepository } from '@/settings/SettingsRepository'
import type { Appearance, ThemeName } from '@/theme/theme.types'
import { THEMES } from '@/theme/themes/registry'
import { devLog, errorMessage } from '@/utils/log.utils'

export type ThemePreference = ThemeName

/** Auto follows the iOS appearance: system Light gives Light, system Dark gives Colour (ADR-026). */
export type AppearancePreference = Appearance | 'auto'

/** What the system reports: the iOS appearance, or nothing when it is not known. The same values as React Native. */
export type SystemScheme = ColorSchemeName | null | undefined

/** The look that a preference gives under a system scheme. Only Auto reads the scheme. An unknown scheme gives Light. */
export function resolveAppearance(preference: AppearancePreference, scheme: SystemScheme): Appearance {
  if (preference === 'auto') return scheme === 'dark' ? 'colour' : 'light'
  return preference
}

export const DEFAULT_THEME: ThemeName = 'cobalt'
export const DEFAULT_APPEARANCE: AppearancePreference = 'light'

export const THEME_PREFERENCE_KEY = 'theme.preference'
export const APPEARANCE_PREFERENCE_KEY = 'theme.appearance'

/** The name of a theme in Unistyles: the colourway for Light, the colourway and a suffix for Colour (ADR-026). */
export type UnistylesName = ThemeName | `${ThemeName}-colour`

export function unistylesName(name: ThemeName, appearance: Appearance): UnistylesName {
  return appearance === 'light' ? name : `${name}-colour`
}

export type StartupSettings = { initialTheme: UnistylesName }

export type ThemeRuntime = { setTheme(name: UnistylesName): void }

function isThemeName(value: string): value is ThemeName {
  return Object.hasOwn(THEMES, value)
}

/** A value saved by an older version (system, daylight, midnight, opart, progressive) gives the default theme (ADR-025). */
export function parseThemePreference(value: string | null): ThemePreference {
  return value != null && isThemeName(value) ? value : DEFAULT_THEME
}

/** Only a known appearance is kept. Anything else, and no saved value, gives Light, so an older version shows no change (ADR-026). */
export function parseAppearancePreference(value: string | null): AppearancePreference {
  return value === 'auto' || value === 'light' || value === 'colour' ? value : DEFAULT_APPEARANCE
}

/**
 * The app has no adaptive theme, because Unistyles adapts only the names light and dark. Unistyles always gets an initial
 * theme, and Auto is resolved here with the system scheme, so the first frame already has the right theme (ADR-025, ADR-026).
 */
export function startupSettings(
  preference: ThemePreference,
  appearance: AppearancePreference,
  scheme: SystemScheme,
): StartupSettings {
  return { initialTheme: unistylesName(preference, resolveAppearance(appearance, scheme)) }
}

/** appearance is the look that is on screen, so Auto is already resolved. */
export function applyThemePreference(preference: ThemePreference, appearance: Appearance, runtime: ThemeRuntime): void {
  runtime.setTheme(unistylesName(preference, appearance))
}

/** Synchronous, so the first frame already has the saved theme. A store that throws gives the default: the app must still start. */
export function readThemePreference(settings: SettingsRepository): ThemePreference {
  try {
    return parseThemePreference(settings.getSync(THEME_PREFERENCE_KEY))
  } catch (error) {
    devLog('theme', `saved theme unreadable: ${errorMessage(error)}`)
    return DEFAULT_THEME
  }
}

/** Synchronous, like the colourway. A store that throws gives Light. */
export function readAppearancePreference(settings: SettingsRepository): AppearancePreference {
  try {
    return parseAppearancePreference(settings.getSync(APPEARANCE_PREFERENCE_KEY))
  } catch (error) {
    devLog('theme', `saved appearance unreadable: ${errorMessage(error)}`)
    return DEFAULT_APPEARANCE
  }
}

export async function saveThemePreference(
  settings: SettingsRepository,
  preference: ThemePreference,
  appearance: AppearancePreference,
  scheme: SystemScheme,
  runtime: ThemeRuntime = UnistylesRuntime,
): Promise<void> {
  applyThemePreference(preference, resolveAppearance(appearance, scheme), runtime)
  await settings.set(THEME_PREFERENCE_KEY, preference)
}

export async function saveAppearancePreference(
  settings: SettingsRepository,
  appearance: AppearancePreference,
  preference: ThemePreference,
  scheme: SystemScheme,
  runtime: ThemeRuntime = UnistylesRuntime,
): Promise<void> {
  applyThemePreference(preference, resolveAppearance(appearance, scheme), runtime)
  await settings.set(APPEARANCE_PREFERENCE_KEY, appearance)
}
