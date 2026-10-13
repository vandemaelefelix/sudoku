import { StyleSheet } from 'react-native-unistyles'
import { kvSettings } from '@/settings/SettingsRepository'
import { readThemePreference, startupSettings, unistylesName, type UnistylesName } from '@/theme/preference'
import type { Theme, ThemeName } from '@/theme/theme.types'
import { THEME_NAMES, THEMES } from '@/theme/themes/registry'

export type AppThemes = { [N in ThemeName as UnistylesName<N>]: Theme }

/** Every theme of the registry under its Unistyles name. Unistyles follows the system only with themes named light and dark. */
export const APP_THEMES = Object.fromEntries(
  THEME_NAMES.map((name) => [unistylesName(name), THEMES[name]]),
) as AppThemes

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  themes: APP_THEMES,
  settings: startupSettings(readThemePreference(kvSettings)),
})
