import { useCallback, useState } from 'react'
import { kvSettings } from '@/settings/SettingsRepository'
import { readThemePreference, saveThemePreference, type ThemePreference } from '@/theme/preference'
import { devLog, errorMessage } from '@/utils/log.utils'

// The choice of this session must outlive the screen, also when the save fails.
let sessionPreference: ThemePreference | null = null

/** The theme preference of the player. choose applies the theme at once, then saves it (ADR-015). */
export function useThemePreference(): { preference: ThemePreference; choose(next: ThemePreference): void } {
  const [preference, setPreference] = useState(() => sessionPreference ?? readThemePreference(kvSettings))
  const choose = useCallback((next: ThemePreference) => {
    sessionPreference = next
    setPreference(next)
    saveThemePreference(kvSettings, next).catch((error: unknown) =>
      devLog('theme', `theme not saved: ${errorMessage(error)}`),
    )
  }, [])
  return { preference, choose }
}
