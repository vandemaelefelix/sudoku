import { kvSettings } from '@/preferences/SettingsRepository'
import {
  readAppearancePreference,
  readThemePreference,
  type AppearancePreference,
  type ThemePreference,
} from '@/theme/preference'

// The choices of this session outlive any screen, also when a save fails. The Settings screen sets them. The system
// follower reads them, because it runs at the root and has no screen state (ADR-026).
let preference: ThemePreference | null = null
let appearance: AppearancePreference | null = null

export function sessionThemePreference(): ThemePreference {
  return preference ?? readThemePreference(kvSettings)
}

export function sessionAppearancePreference(): AppearancePreference {
  return appearance ?? readAppearancePreference(kvSettings)
}

export function setSessionThemePreference(next: ThemePreference): void {
  preference = next
}

export function setSessionAppearancePreference(next: AppearancePreference): void {
  appearance = next
}

/** For tests: the session value outlives a test. */
export function resetThemeSession(): void {
  preference = null
  appearance = null
}
