import type { AppearancePreference } from '@/theme/preference'

export const APPEARANCE_OPTIONS: readonly { value: AppearancePreference; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'colour', label: 'Colour' },
]
