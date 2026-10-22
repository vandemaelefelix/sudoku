import type { MessageId } from '@/i18n/messages'
import type { AppearancePreference } from '@/theme/preference'

export const APPEARANCE_OPTIONS: readonly { value: AppearancePreference; label: MessageId }[] = [
  { value: 'auto', label: 'settings.appearance.auto' },
  { value: 'light', label: 'settings.appearance.light' },
  { value: 'colour', label: 'settings.appearance.colour' },
]
