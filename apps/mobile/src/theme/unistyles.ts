import { StyleSheet } from 'react-native-unistyles'
import { daylight } from '@/theme/themes/daylight'
import { midnight } from '@/theme/themes/midnight'

/** Unistyles follows the system only with themes named light and dark. */
export const APP_THEMES = { light: daylight, dark: midnight }

export type AppThemes = typeof APP_THEMES

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({ themes: APP_THEMES, settings: { adaptiveThemes: true } })
