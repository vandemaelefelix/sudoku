import { Appearance } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { kvSettings } from '@/settings/SettingsRepository'
import { readAppearancePreference, readThemePreference, startupSettings, type UnistylesName } from '@/theme/preference'
import type { Theme } from '@/theme/theme.types'
import { COLOUR_THEMES, THEMES } from '@/theme/themes/registry'

export type AppThemes = { [N in UnistylesName]: Theme }

/**
 * Every theme of the registry under its own name: the Light theme of each colourway first, then the Colour themes.
 * Jest uses the first one. The app has no adaptive theme (ADR-025, ADR-026).
 */
export const APP_THEMES: AppThemes = {
  cobalt: THEMES.cobalt,
  forest: THEMES.forest,
  bordeaux: THEMES.bordeaux,
  'cobalt-colour': COLOUR_THEMES.cobalt,
  'forest-colour': COLOUR_THEMES.forest,
  'bordeaux-colour': COLOUR_THEMES.bordeaux,
}

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  themes: APP_THEMES,
  // The system scheme is read here, before the first frame, so Auto starts in the right look (ADR-026).
  settings: startupSettings(
    readThemePreference(kvSettings),
    readAppearancePreference(kvSettings),
    Appearance.getColorScheme(),
  ),
})
