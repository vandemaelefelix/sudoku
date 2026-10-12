import type { ThemePreference } from '@/theme/preference'

export const THEME_OPTIONS: ReadonlyArray<{ preference: ThemePreference; label: string }> = [
  { preference: 'system', label: 'System' },
  { preference: 'daylight', label: 'Daylight' },
  { preference: 'midnight', label: 'Midnight' },
]
