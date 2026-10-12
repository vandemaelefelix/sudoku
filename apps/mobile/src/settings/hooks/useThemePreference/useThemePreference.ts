import { useCallback, useState } from 'react'
import { kvSettings } from '@/settings/SettingsRepository'
import { readThemePreference, saveThemePreference, type ThemePreference } from '@/theme/preference'
import { devLog, errorMessage } from '@/utils/log.utils'

/** The theme preference of the player. choose applies the theme at once, then saves it (ADR-015). */
export function useThemePreference(): { preference: ThemePreference; choose(next: ThemePreference): void } {
  const [preference, setPreference] = useState(() => readThemePreference(kvSettings))
  const choose = useCallback((next: ThemePreference) => {
    setPreference(next)
    saveThemePreference(kvSettings, next).catch((error: unknown) =>
      devLog('theme', `theme not saved: ${errorMessage(error)}`),
    )
  }, [])
  return { preference, choose }
}
